import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFavorites, saveFavorites, toggleFavoriteId } from './favorites';

const KEY = '***REMOVED***.favorite-***REMOVED***s';

describe('收藏本地存储', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('没有存储时返回空数组', () => {
    expect(readFavorites()).toEqual([]);
  });

  it('读取合法的字符串数组', () => {
    localStorage.setItem(KEY, JSON.stringify(['***REMOVED***-1', '***REMOVED***-2']));
    expect(readFavorites()).toEqual(['***REMOVED***-1', '***REMOVED***-2']);
  });

  it('JSON 非法时回退为空数组', () => {
    localStorage.setItem(KEY, '{not-json');
    expect(readFavorites()).toEqual([]);
  });

  it('JSON 合法但不是数组时回退为空数组', () => {
    localStorage.setItem(KEY, JSON.stringify({ ***REMOVED***Id: '***REMOVED***-1' }));
    expect(readFavorites()).toEqual([]);
  });

  it('localStorage 读取抛错时回退为空数组', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readFavorites()).toEqual([]);
  });

  it('写入收藏时序列化为 JSON', () => {
    saveFavorites(['***REMOVED***-1', '***REMOVED***-3']);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(['***REMOVED***-1', '***REMOVED***-3']));
  });

  it('写入失败不抛出异常', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveFavorites(['***REMOVED***-1'])).not.toThrow();
  });

  it('切换收藏：已收藏则移除，未收藏则追加到末尾', () => {
    expect(toggleFavoriteId(['***REMOVED***-1', '***REMOVED***-2'], '***REMOVED***-1')).toEqual(['***REMOVED***-2']);
    expect(toggleFavoriteId(['***REMOVED***-1'], '***REMOVED***-9')).toEqual(['***REMOVED***-1', '***REMOVED***-9']);
    expect(toggleFavoriteId([], '***REMOVED***-1')).toEqual(['***REMOVED***-1']);
  });

  it('切换收藏不修改入参数组', () => {
    const ids = ['***REMOVED***-1'];
    const next = toggleFavoriteId(ids, '***REMOVED***-2');
    expect(ids).toEqual(['***REMOVED***-1']);
    expect(next).not.toBe(ids);
  });
});
