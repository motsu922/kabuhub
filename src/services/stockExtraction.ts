import { StockCandidate } from '../types';
import { StockDataService } from './stockData';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

export type ExtractionStage =
  | '字幕を取得中...'
  | 'ページを取得中...'
  | 'AIで銘柄を解析中...'
  | '株価を取得中...';

export type OnStage = (s: ExtractionStage) => void;

// ── URL 判定 ────────────────────────────────────────────────────────────────

function isYouTubeUrl(s: string) {
  return s.includes('youtube.com') || s.includes('youtu.be');
}
function isXUrl(s: string) {
  return s.includes('x.com/') || s.includes('twitter.com/');
}
function isUrl(s: string) {
  return s.startsWith('http://') || s.startsWith('https://');
}

function extractVideoId(url: string): string | null {
  for (const p of [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
  ]) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── YouTube 字幕取得 ─────────────────────────────────────────────────────────

// Strategy 1: timedtext API (最も安定)
async function fetchTimedTextDirect(videoId: string, lang: string): Promise<string> {
  const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja,en;q=0.9' },
  });
  if (!res.ok) return '';
  const json = await res.json();
  const events: Array<{ segs?: Array<{ utf8: string }> }> = json.events ?? [];
  return events
    .filter((e) => e.segs)
    .map((e) => e.segs!.map((s) => s.utf8 ?? '').join(''))
    .join(' ')
    .replace(/\n/g, ' ')
    .trim();
}

// Strategy 2: ページHTML から captionTracks の baseUrl を取得
async function fetchTranscriptViaPage(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'ja,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`page ${res.status}`);
  const html = await res.text();

  // captionTracks の baseUrl を取り出す
  const re = new RegExp('"baseUrl":"(https://www\\.youtube\\.com/api/timedtext[^"]+)"', 'g');
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('no baseUrl found');

  // 日本語優先
  const jaMatch = matches.find((m) => m[1].includes('lang=ja'));
  const enMatch = matches.find((m) => m[1].includes('lang=en'));
  const chosen = jaMatch ?? enMatch ?? matches[0];
  const baseUrl = chosen[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');

  const captionRes = await fetch(baseUrl + '&fmt=json3', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!captionRes.ok) throw new Error(`caption ${captionRes.status}`);
  const json = await captionRes.json();
  const events: Array<{ segs?: Array<{ utf8: string }> }> = json.events ?? [];
  return events
    .filter((e) => e.segs)
    .map((e) => e.segs!.map((s) => s.utf8 ?? '').join(''))
    .join(' ')
    .trim();
}

async function fetchYouTubeTranscript(url: string): Promise<string> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new YouTubeTranscriptError('動画IDを取得できません');

  // Strategy 1: timedtext API (ja → en → ja自動生成)
  for (const lang of ['ja', 'en', 'ja-JP', 'en-US']) {
    try {
      const text = await fetchTimedTextDirect(videoId, lang);
      if (text.length >= 30) return text;
    } catch {}
  }

  // Strategy 2: page parse
  try {
    const text = await fetchTranscriptViaPage(videoId);
    if (text.length >= 30) return text;
  } catch {}

  throw new YouTubeTranscriptError('字幕が見つかりません（字幕オフ・非公開の可能性があります）');
}

// ── Web記事取得 ──────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

async function fetchWebText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KabuHub/1.0)' },
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return stripHtml(await res.text());
}

// X (Twitter) oEmbed API — 認証不要・公開API
// x.com は oEmbed で失敗するケースがあるため twitter.com に正規化して送る
async function fetchXPostText(url: string): Promise<string> {
  const normalized = url.replace('x.com/', 'twitter.com/');
  const oembed = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalized)}&omit_script=1&lang=ja`;
  const res = await fetch(oembed, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KabuHub/1.0)' },
  });
  if (!res.ok) throw new XUrlError();
  const json = await res.json();
  // oEmbed の html フィールドからテキストを抽出、author_name も補足情報として追加
  const bodyText = stripHtml(json.html ?? '');
  if (!bodyText) throw new XUrlError();
  return bodyText;
}

// ── OpenAI 抽出 ──────────────────────────────────────────────────────────────

interface RawMention { name: string; code?: string; context: string; }

// 有効な証券コード形式かどうか（4桁数字 / 3〜4桁数字+大文字1字）
function isCodeLike(s: string): boolean {
  return /^\d{4}$/.test(s) || /^\d{3,4}[A-Z]$/.test(s);
}

function extractCodesFromText(text: string): RawMention[] {
  // \b は日本語境界で機能しないため lookahead/lookbehind で代替
  // 3桁+大文字 (521A) と 4桁(数字のみ or +大文字) (7630, 268A) の両方を捕捉
  const matches = text.match(/(?<![0-9A-Za-z])(?:\d{3,4}[A-Z]|\d{4})(?![0-9A-Za-z])/g) ?? [];
  return [...new Set(matches)]
    .filter(isCodeLike)
    .map((code) => ({ name: code, code, context: 'テキスト内のコード' }));
}

async function extractWithAI(text: string): Promise<RawMention[]> {
  if (!OPENAI_API_KEY) throw new Error('no api key');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'あなたは日本株の銘柄情報を抽出する専門アシスタントです。テキストから言及されている日本株の企業を全て特定し、東京証券取引所の証券コード（4桁）を必ず付与してください。コードが確実でない場合でも、最も可能性の高いコードを推定してください。投資助言は行いません。',
        },
        {
          role: 'user',
          content: `以下のテキストから日本株の銘柄を全て抽出してください。

【重要】
- 企業名・ブランド名・略称など、日本株として上場している企業を全てリストアップ
- 証券コードは必ず推定して付与（例: トヨタ→7203, ソニー→6758, 三菱UFJ→8306）
- 外国株・未上場企業は除外
- 同じ企業の重複は除く

テキスト:
${text.slice(0, 4000)}

返却形式（JSONのみ）:
{"stocks":[{"name":"企業名（正式名称）","code":"証券コード4桁","context":"言及内容20字以内"}]}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return (JSON.parse(data.choices[0].message.content).stocks ?? []) as RawMention[];
}

// ── カスタムエラー ────────────────────────────────────────────────────────────

export class YouTubeTranscriptError extends Error {
  constructor(public reason: string) {
    super('youtube_transcript');
    this.name = 'YouTubeTranscriptError';
  }
}
export class XUrlError extends Error {
  constructor() { super('x_url'); this.name = 'XUrlError'; }
}

// ── メイン ───────────────────────────────────────────────────────────────────

export async function fetchStockCandidates(
  input: string,
  onStage?: OnStage,
): Promise<{ candidates: StockCandidate[]; sourceText: string }> {
  let text = input.trim();

  if (isUrl(text) && isXUrl(text)) {
    onStage?.('ページを取得中...');
    text = await fetchXPostText(text);
  }

  if (isUrl(text) && isYouTubeUrl(text)) {
    onStage?.('字幕を取得中...');
    text = await fetchYouTubeTranscript(text); // throws YouTubeTranscriptError on failure
  } else if (isUrl(text)) {
    onStage?.('ページを取得中...');
    try { text = await fetchWebText(text); } catch {}
  }

  const sourceText = text.slice(0, 300);

  onStage?.('AIで銘柄を解析中...');
  let mentions: RawMention[];
  let source: StockCandidate['source'];

  try {
    mentions = await extractWithAI(text);
    source = 'ai';
  } catch {
    mentions = extractCodesFromText(text);
    source = 'regex';
  }

  if (!mentions.length) return { candidates: [], sourceText };

  onStage?.('株価を取得中...');
  const results = await Promise.all(
    mentions.map(async (m): Promise<StockCandidate | null> => {
      let code = m.code;
      let name = m.name;

      // コードが未解決 or 名前と同じ（regex fallback）の場合はコード検索
      if (!code || !isCodeLike(code)) {
        // 1. ローカルインデックスから部分一致
        const local = StockDataService.searchStockLocal(name);
        if (local.length > 0) {
          code = local[0].code;
          name = local[0].name;
        } else {
          // 2. Yahoo Finance 検索（lang=ja）
          const remote = await StockDataService.searchStockRemote(name).catch(() => []);
          if (remote.length > 0) {
            code = remote[0].code;
            name = remote[0].name;
          }
        }
      }
      // AI抽出で名前はあるがコードが特定できない場合はコード不明として返す
      // regex抽出でコードが特定できない場合は除外
      if (!code || !isCodeLike(code)) {
        if (source === 'ai') return { name, code: null, context: m.context, source };
        return null;
      }

      // 日本語名を確実に解決
      const resolvedName = await StockDataService.resolveNameByCode(code).catch(() => null);
      if (resolvedName) name = resolvedName;

      const quote = await StockDataService.fetchQuote(code).catch(() => null);
      return { name, code, context: m.context, price: quote?.price, changePercent: quote?.changePercent, source };
    }),
  );

  const seen = new Set<string>();
  return {
    candidates: results.filter((c): c is StockCandidate => {
      if (!c) return false;
      const key = c.code ?? c.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    sourceText,
  };
}
