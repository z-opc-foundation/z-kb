import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialRecord } from '@/services/material';

vi.mock('@/services/category', () => ({
  getCategoryTree: vi.fn(),
}));

vi.mock('@/services/material', () => ({
  pageMaterial: vi.fn(),
}));

import { getCategoryTree } from '@/services/category';
import { pageMaterial } from '@/services/material';
import { useMixEntryTree } from './use-mix-entry-tree';

function material(id: string, fileExt: string, materialType: MaterialRecord['materialType'] = 'DOCUMENT') {
  return {
    materialId: id,
    kbId: 'kb-1',
    materialType,
    title: `资料 ${id}`,
    sourceType: 'UPLOAD',
    categoryId: 'cat-1',
    materialStatus: 'ACTIVE',
    fingerprint: `fp-${id}`,
    fileExt,
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  } satisfies MaterialRecord;
}

beforeEach(() => {
  vi.mocked(getCategoryTree).mockReset();
  vi.mocked(pageMaterial).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useMixEntryTree', () => {
  it('并行加载分类与全部资料，并推导条目类型', async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([
      { categoryId: 'cat-1', name: '院级制度', sortNo: 1 },
    ]);
    vi.mocked(pageMaterial).mockResolvedValue({
      records: [material('m1', 'pdf'), material('m2', 'xlsx', 'DATA_TABLE')],
      total: 2,
      size: 100,
      current: 1,
    });

    const { result } = renderHook(() => useMixEntryTree('kb-1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCategoryTree).toHaveBeenCalledWith('kb-1');
    expect(pageMaterial).toHaveBeenCalledWith({ current: 1, size: 100, kbId: 'kb-1' });
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.entries.map((entry) => entry.type)).toEqual(['document', 'table']);
    expect(result.current.total).toBe(2);
    expect(result.current.truncated).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('资料超过一页时继续翻页直到取完', async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    const firstPage = Array.from({ length: 100 }, (_, index) => material(`a-${index}`, 'md'));
    const secondPage = Array.from({ length: 20 }, (_, index) => material(`b-${index}`, 'md'));
    vi.mocked(pageMaterial)
      .mockResolvedValueOnce({ records: firstPage, total: 120, size: 100, current: 1 })
      .mockResolvedValueOnce({ records: secondPage, total: 120, size: 100, current: 2 });

    const { result } = renderHook(() => useMixEntryTree('kb-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(pageMaterial).toHaveBeenCalledTimes(2);
    expect(pageMaterial).toHaveBeenLastCalledWith({ current: 2, size: 100, kbId: 'kb-1' });
    expect(result.current.entries).toHaveLength(120);
    expect(result.current.truncated).toBe(false);
  });

  it('任一接口失败时标记错误，reload 后恢复', async () => {
    vi.mocked(getCategoryTree).mockResolvedValueOnce(undefined);
    vi.mocked(pageMaterial).mockResolvedValue({ records: [], total: 0, size: 100, current: 1 });

    const { result } = renderHook(() => useMixEntryTree('kb-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.entries).toEqual([]);

    vi.mocked(getCategoryTree).mockResolvedValue([{ categoryId: 'c1', name: '分类', sortNo: 1 }]);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBe(false);
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.total).toBe(0);
  });

  it('实际条数少于总数时标记截断', async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    const firstPage = Array.from({ length: 100 }, (_, index) => material(`a-${index}`, 'md'));
    vi.mocked(pageMaterial)
      .mockResolvedValueOnce({ records: firstPage, total: 500, size: 100, current: 1 })
      .mockResolvedValue({ records: [], total: 500, size: 100, current: 2 });

    const { result } = renderHook(() => useMixEntryTree('kb-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.truncated).toBe(true);
    expect(result.current.total).toBe(500);
  });
});
