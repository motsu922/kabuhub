import { Article } from '../types';

export function useArticles(_code?: string) {
  return { articles: [] as Article[] };
}
