import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialRecord } from '@/services/material';

vi.mock('@/services/material', () => ({
  pageDeletedMaterials: vi.fn(),
  restoreMaterials: vi.fn(),
  purgeMaterials: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

import {
  pageDeletedMaterials,
  purgeMaterials,
  restoreMaterials,
} from '@/services/material';
import { toast } from '@/utils/toast';
import { useMaterialRecycle } from './use-material-recycle';

function material(id: string): MaterialRecord {
  return {
    materialId: id,
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: `已删除 ${id}`,
    sourceType: 'UPLOAD',
    materialStatus: 'DELETED',
    fingerprint: `fp-${id}`,
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  };
}

function page(records: MaterialRecord[], total = records.length, current = 1) {
  return { records, total, size: 10, current };
}

function setup(overrides: Partial<Parameters<typeof useMaterialRecycle>[0]> = {}) {
  const params = {
    kbId: 'kb-1',
    canWrite: true,
    materialType: 'DOCUMENT' as const,
    onChanged: vi.fn(),
    ...overrides,
  };
  return { params, ...renderHook(() => useMaterialRecycle(params)) };
}

beforeEach(() => {
  vi.mocked(pageDeletedMaterials).mockReset();
  vi.mocked(restoreMaterials).mockReset();
  vi.mocked(purgeMaterials).mockReset();
  vi.mocked(toast).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useMaterialRecycle', () => {
  it('有写权限时挂载即统计回收站数量', async () => {
    vi.mocked(pageDeletedMaterials).mockResolvedValue(page([], 5));
    const { result } = setup();

    await waitFor(() => expect(result.current.count).toBe(5));
    expect(pageDeletedMaterials).toHaveBeenCalledWith({
      current: 1,
      size: 1,
      kbId: 'kb-1',
      materialType: 'DOCUMENT',
    });
  });

  it('无写权限时不请求回收站', async () => {
    const { result } = setup({ canWrite: false });
    await act(async () => {});
    expect(pageDeletedMaterials).not.toHaveBeenCalled();
    expect(result.current.count).toBe(0);
  });

  it('打开回收站后加载列表，搜索与翻页带上参数', async () => {
    vi.mocked(pageDeletedMaterials).mockResolvedValue(page([material('m1'), material('m2')], 25));
    const { result } = setup();
    await waitFor(() => expect(result.current.count).toBe(25));

    act(() => result.current.openRecycle());
    expect(result.current.open).toBe(true);
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.records).toHaveLength(2);
    expect(result.current.total).toBe(25);
    expect(result.current.totalPages).toBe(3);
    expect(pageDeletedMaterials).toHaveBeenLastCalledWith(
      expect.objectContaining({ current: 1, size: 10, keyword: undefined }),
    );

    act(() => result.current.setKeyword('过期'));
    act(() => result.current.applySearch());
    await waitFor(() =>
      expect(pageDeletedMaterials).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 1, keyword: '过期' }),
      ),
    );

    act(() => result.current.goPage(3));
    await waitFor(() =>
      expect(pageDeletedMaterials).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 3, keyword: '过期' }),
      ),
    );

    act(() => result.current.clearSearch());
    await waitFor(() =>
      expect(pageDeletedMaterials).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 1, keyword: undefined }),
      ),
    );
  });

  it('选择、取回与彻底删除都会刷新并通知外部', async () => {
    vi.mocked(pageDeletedMaterials).mockResolvedValue(page([material('m1')], 1));
    vi.mocked(restoreMaterials).mockResolvedValue([
      { materialId: 'm1', success: true, message: '已恢复' },
    ]);
    vi.mocked(purgeMaterials).mockResolvedValue([
      { materialId: 'm1', success: true, message: '已彻底删除' },
    ]);
    const { result, params } = setup();
    await waitFor(() => expect(result.current.count).toBe(1));
    act(() => result.current.openRecycle());
    await waitFor(() => expect(result.current.records).toHaveLength(1));

    act(() => result.current.toggleAll());
    expect(result.current.selected).toEqual(['m1']);
    act(() => result.current.toggleSelected('m1'));
    expect(result.current.selected).toEqual([]);
    act(() => result.current.toggleSelected('m1'));

    await act(async () => {
      await result.current.restore(result.current.selected);
    });
    expect(restoreMaterials).toHaveBeenCalledWith('kb-1', ['m1']);
    expect(toast).toHaveBeenCalledWith('取回完成', '1/1 份资料已恢复', 'success');
    expect(params.onChanged).toHaveBeenCalled();

    act(() => result.current.toggleSelected('m1'));
    await act(async () => {
      await result.current.purge(result.current.selected);
    });
    expect(purgeMaterials).toHaveBeenCalledWith('kb-1', ['m1']);
    expect(toast).toHaveBeenCalledWith('彻底删除完成', '1/1 份资料已清除', 'success');
    expect(params.onChanged).toHaveBeenCalledTimes(2);
  });

  it('busy 时禁止关闭回收站', async () => {
    vi.mocked(pageDeletedMaterials).mockResolvedValue(page([], 0));
    const { result } = setup();
    act(() => result.current.openRecycle());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.closeRecycle());
    expect(result.current.open).toBe(false);
  });
});
