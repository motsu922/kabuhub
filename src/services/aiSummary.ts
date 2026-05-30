import { Article } from '../types';

interface SummaryResult {
  summary: string;
  relatedStocks: string[];
  relatedThemes: string[];
  title: string;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

function extractYouTubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    },
  });
  const html = await pageRes.text();

  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) throw new Error('この動画には字幕がありません');

  const tracks: Array<{ languageCode: string; kind?: string; baseUrl: string }> = JSON.parse(match[1]);
  const track =
    tracks.find((t) => t.languageCode === 'ja') ??
    tracks.find((t) => t.languageCode === 'en') ??
    tracks[0];
  if (!track) throw new Error('字幕トラックが見つかりません');

  const transcriptRes = await fetch(track.baseUrl + '&fmt=json3');
  const transcriptData = await transcriptRes.json();

  const text: string = (transcriptData.events ?? [])
    .filter((e: { segs?: unknown[] }) => e.segs)
    .map((e: { segs: Array<{ utf8: string }> }) => e.segs.map((s) => s.utf8).join(''))
    .join(' ');

  return text.replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export const AISummaryService = {
  async summarizeArticle(url: string, content?: string): Promise<SummaryResult> {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY_NOT_SET');
    }

    let resolvedContent = content;
    const videoId = extractYouTubeVideoId(url);
    if (videoId && !resolvedContent) {
      resolvedContent = await fetchYouTubeTranscript(videoId);
    }

    const prompt = `
以下の${videoId ? 'YouTube動画の字幕' : '記事URL'}の内容を分析し、日本語で以下の形式でJSONを返してください。
必ず投資助言や売買推奨は行わず、中立的な情報整理のみ行ってください。

URL: ${url}
${resolvedContent ? `\n内容:\n${resolvedContent}` : ''}

返却形式:
{
  "title": "タイトル（30字以内）",
  "summary": "要約（100字以内、中立表現）",
  "relatedStocks": ["銘柄コード（4桁）のみ"],
  "relatedThemes": ["テーマタグ（#なし）"]
}
`.trim();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return result as SummaryResult;
  },

  createArticle(url: string, result: SummaryResult): Omit<Article, 'id'> {
    return {
      url,
      title: result.title,
      summary: result.summary,
      relatedStocks: result.relatedStocks,
      relatedThemes: result.relatedThemes,
      savedAt: new Date(),
      isProcessed: true,
    };
  },
};
