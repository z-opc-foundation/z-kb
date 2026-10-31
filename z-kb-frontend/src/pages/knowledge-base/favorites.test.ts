import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFavorites, saveFavorites, toggleFavoriteId } from './favorites';

const KEY = 'future-knowledge.favorite-kbs';

describe('收藏本地存储', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('没有存储时返回空数组', () => {
    expect(readFavorites()).toEqual([]);
  });

  it('读取合法的字符串数组', () => {
    localStorage.setItem(KEY, JSON.stringify(['kb-1', 'kb-2']));
    expect(readFavorites()).toEqual(['kb-1', 'kb-2']);
  });

  it('JSON 非法时回退为空数组', () => {
    localStorage.setItem(KEY, '{not-json');
    expect(readFavorites()).toEqual([]);
  });

  it('JSON 合法但不是数组时回退为空数组', () => {
    localStorage.setItem(KEY, JSON.stringify({ kbId: 'kb-1' }));
    expect(readFavorites()).toEqual([]);
  });

  it('localStorage 读取抛错时回退为空数组', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readFavorites()).toEqual([]);
  });

  it('写入收藏时序列化为 JSON', () => {
    saveFavorites(['kb-1', 'kb-3']);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(['kb-1', 'kb-3']));
  });

  it('写入失败不抛出异常', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveFavorites(['kb-1'])).not.toThrow();
  });

  it('切换收藏：已收藏则移除，未收藏则追加到末尾', () => {
    expect(toggleFavoriteId(['kb-1', 'kb-2'], 'kb-1')).toEqual(['kb-2']);
    expect(toggleFavoriteId(['kb-1'], 'kb-9')).toEqual(['kb-1', 'kb-9']);
    expect(toggleFavoriteId([], 'kb-1')).toEqual(['kb-1']);
  });

  it('切换收藏不修改入参数组', () => {
    const ids = ['kb-1'];
    const next = toggleFavoriteId(ids, 'kb-2');
    expect(ids).toEqual(['kb-1']);
    expect(next).not.toBe(ids);
  });
});
