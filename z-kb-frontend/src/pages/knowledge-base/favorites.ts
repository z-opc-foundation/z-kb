const FAV_STORAGE_KEY = 'z***REMOVED***.favorite-***REMOVED***s';

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

export function toggleFavoriteId(ids: string[], ***REMOVED***Id: string): string[] {
  return ids.includes(***REMOVED***Id) ? ids.filter((item) => item !== ***REMOVED***Id) : [...ids, ***REMOVED***Id];
}
