import { useState, useEffect, useCallback } from 'react';
import { Article } from '../types';
import { StorageService } from '../services/storage';

export function useArticles(filterByCode?: string) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      let all = await StorageService.getArticles();
      if (filterByCode) {
        all = all.filter((a) => a.relatedStocks?.includes(filterByCode));
      }
      setArticles(all);
    } finally {
      setIsLoading(false);
    }
  }, [filterByCode]);

  useEffect(() => {
    load();
  }, [load]);

  const saveArticle = useCallback(async (article: Article) => {
    await StorageService.saveArticle(article);
    await load();
  }, [load]);

  const deleteArticle = useCallback(async (id: string) => {
    await StorageService.deleteArticle(id);
    await load();
  }, [load]);

  return { articles, isLoading, saveArticle, deleteArticle, refresh: load };
}
