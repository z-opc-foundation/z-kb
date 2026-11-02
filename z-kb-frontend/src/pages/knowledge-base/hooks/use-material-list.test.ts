import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialRecord } from '@/services/material';

vi.mock('@/services/material', () => ({
  pageMaterial: vi.fn(),
}));

import { pageMaterial } from '@/services/material';
import { useMaterialList } from './use-material-list';

function material(id: string, parseStatus = 'READY'): MaterialRecord {
  return {
    materialId: id,
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: `资料 ${id}`,
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: `fp-${id}`,
    parseStatus,
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  };
}

function page(records: MaterialRecord[], total = records.length, current = 1) {
  return { records, total, size: 10, current };
}

function setup(overrides: Partial<Parameters<typeof useMaterialList>[0]> = {}) {
  const params = {
    kbId: 'kb-1',
    materialType: 'DOCUMENT' as const,
    categoryId: '',
    onCategoryChange: vi.fn(),
    ...overrides,
  };
  return { params, ...renderHook((props: typeof params) => useMaterialList(props), { initialProps: params }) };
}

beforeEach(() => {
  vi.mocked(pageMaterial).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useMaterialList', () => {
  it('首屏加载列表并给出分页信息', async () => {
    vi.mocked(pageMaterial).mockResolvedValue(page([material('m1')], 25));
    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(pageMaterial).toHaveBeenCalledWith({
      current: 1,
      size: 10,
      kbId: 'kb-1',
      keyword: undefined,
      categoryId: undefined,
      materialType: 'DOCUMENT',
    });
    expect(result.current.records).toHaveLength(1);
    expect(result.current.total).toBe(25);
    expect(result.current.totalPages).toBe(3);
  });

  it('搜索会去掉首尾空格并回到第一页重新取数', async () => {
    vi.mocked(pageMaterial).mockResolvedValue(page([material('m1')], 25));
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setKeyword('  护理  '));
    act(() => result.current.applySearch());
    await waitFor(() =>
      expect(pageMaterial).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 1, keyword: '护理' }),
      ),
    );
    expect(result.current.queryKeyword).toBe('护理');

    act(() => result.current.clearSearch());
    await waitFor(() =>
      expect(pageMaterial).toHaveBeenLastCalledWith(
        expect.objectContaining({ current: 1, keyword: undefined }),
      ),
    );
    expect(result.current.keyword).toBe('');
  });

  it('翻页、分类切换与类型切换重置选择', async () => {
    vi.mocked(pageMaterial).mockResolvedValue(page([material('m1')], 25));
    const { result, rerender, params } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleSelected('m1'));
    expect(result.current.selected).toEqual(['m1']);
    act(() => result.current.setPage(2));
    await waitFor(() =>
      expect(pageMaterial).toHaveBeenLastCalledWith(expect.objectContaining({ current: 2 })),
    );

    act(() => result.current.selectCategory('cat-1'));
    expect(params.onCategoryChange).toHaveBeenCalledWith('cat-1');
    expect(result.current.selected).toEqual([]);
    expect(result.current.page).toBe(1);

    rerender({
      kbId: 'kb-1',
      materialType: 'CODE',
      categoryId: 'cat-1',
      onCategoryChange: vi.fn(),
    });
    await waitFor(() =>
      expect(pageMaterial).toHaveBeenLastCalledWith(
        expect.objectContaining({ materialType: 'CODE', categoryId: 'cat-1', current: 1 }),
      ),
    );
  });

  it('全选与取消全选基于当前页记录', async () => {
    vi.mocked(pageMaterial).mockResolvedValue(page([material('m1'), material('m2')]));
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleAll());
    expect(result.current.selected).toEqual(['m1', 'm2']);
    act(() => result.current.toggleAll());
    expect(result.current.selected).toEqual([]);
    act(() => result.current.toggleSelected('m1'));
    act(() => result.current.toggleSelected('m1'));
    expect(result.current.selected).toEqual([]);
  });

  it('存在解析中资料时轮询刷新，卸载后停止', async () => {
    vi.useFakeTimers();
    vi.mocked(pageMaterial).mockResolvedValue(page([material('m1', 'PARSING')]));
    const { result, unmount } = setup();
    await act(async () => {});
    expect(result.current.records).toHaveLength(1);
    const baseline = vi.mocked(pageMaterial).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(vi.mocked(pageMaterial).mock.calls.length).toBe(baseline + 1);

    unmount();
    const afterUnmount = vi.mocked(pageMaterial).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(vi.mocked(pageMaterial).mock.calls.length).toBe(afterUnmount);
    vi.useRealTimers();
  });
});
