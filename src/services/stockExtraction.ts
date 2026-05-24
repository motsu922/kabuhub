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

// ── OpenAI 抽出 ──────────────────────────────────────────────────────────────

interface RawMention { name: string; code?: string; context: string; }

function extractCodesFromText(text: string): RawMention[] {
  const matches = text.match(/\b\d{4}[A-Z]?\b/g) ?? [];
  return [...new Set(matches)]
    .filter((m) => /^\d{4}$/.test(m) || /^\d{3}[A-Z]$/.test(m))
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
            'あなたは日本株の銘柄情報を抽出するアシスタントです。与えられたテキストから言及されている日本株の企業名・証券コードを抽出してください。投資助言は行いません。',
        },
        {
          role: 'user',
          content: `以下のテキストから日本株の銘柄を抽出してください。証券コードが不明な場合はcodeを省略してください。

テキスト:
${text.slice(0, 4000)}

返却形式（JSONのみ）:
{"stocks":[{"name":"企業名","code":"証券コード（省略可）","context":"言及内容20字以内"}]}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
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

  // X/Twitter URL → 直接取得不可
  if (isUrl(text) && isXUrl(text)) throw new XUrlError();

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
      if (!code || code === name) {
        const resolved = await StockDataService.searchByName(name).catch(() => null);
        if (resolved) { code = resolved.code; name = resolved.fullName; }
      }
      if (!code) return null;
      const quote = await StockDataService.fetchQuote(code).catch(() => null);
      return { name, code, context: m.context, price: quote?.price, changePercent: quote?.changePercent, source };
    }),
  );

  const seen = new Set<string>();
  return {
    candidates: results.filter((c): c is StockCandidate => {
      if (!c || seen.has(c.code)) return false;
      seen.add(c.code);
      return true;
    }),
    sourceText,
  };
}
