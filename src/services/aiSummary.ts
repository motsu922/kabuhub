import { Article } from '../types';

interface SummaryResult {
  summary: string;
  relatedStocks: string[];
  relatedThemes: string[];
  title: string;
}

// OpenAI APIキーは環境変数で管理する
// expo-constantsのextra経由で注入する
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

export const AISummaryService = {
  async summarizeArticle(url: string, content?: string): Promise<SummaryResult> {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY_NOT_SET');
    }

    const prompt = `
以下の記事URLの内容を分析し、日本語で以下の形式でJSONを返してください。
必ず投資助言や売買推奨は行わず、中立的な情報整理のみ行ってください。

URL: ${url}
${content ? `\n記事内容:\n${content}` : ''}

返却形式:
{
  "title": "記事タイトル（30字以内）",
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
