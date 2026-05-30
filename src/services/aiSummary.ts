import { Article } from '../types';

interface SummaryResult {
  summary: string;
  relatedStocks: string[];
  title: string;
}

export interface DailyBriefingInput {
  name: string;
  code: string;
  intention: 'buy' | 'hold' | 'sell' | 'neutral';
  changePercent: number;
  price: number;
}

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
${content ? `\n内容:\n${content}` : ''}

返却形式:
{
  "title": "タイトル（30字以内）",
  "summary": "要約（100字以内、中立表現）",
  "relatedStocks": ["銘柄コード（4桁）のみ"]
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

  async generateDailyBriefing(inputs: DailyBriefingInput[]): Promise<{ lines: string[] }> {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_NOT_SET');

    const LABEL: Record<string, string> = {
      buy: '買いたい', hold: '持ってる', sell: '売りたい', neutral: '注目',
    };
    const stockList = inputs.map((s) => {
      const sign = s.changePercent >= 0 ? '+' : '';
      return `[${LABEL[s.intention]}] ${s.name}(${s.code}): ${sign}${s.changePercent.toFixed(2)}%`;
    }).join('\n');

    const prompt = `以下はユーザーのウォッチリスト銘柄の本日の動向です。
投資助言・売買推奨は一切せず、中立的な事実ベースで3行以内に要約してください。
各行は40字以内、簡潔に。特に「持ってる」「買いたい」「売りたい」銘柄の動きを優先。

${stockList}

返却形式（JSON）:
{"lines":["1行目","2行目","3行目"]}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 300,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return { lines: Array.isArray(result.lines) ? result.lines.slice(0, 3) : [] };
  },

  createArticle(url: string, result: SummaryResult): Omit<Article, 'id'> {
    return {
      url,
      title: result.title,
      summary: result.summary,
      relatedStocks: result.relatedStocks,
      savedAt: new Date(),
      isProcessed: true,
    };
  },
};
