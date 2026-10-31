const FAV_STORAGE_KEY = 'future-knowledge.favorite-kbs';

export function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids: string[]): void {
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // 收藏只是本地个人星标，写入失败不阻断页面
  }
}

export function toggleFavoriteId(ids: string[], kbId: string): string[] {
  return ids.includes(kbId) ? ids.filter((item) => item !== kbId) : [...ids, kbId];
}
