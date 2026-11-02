import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNode } from '@/services/category';
import type { MaterialRecord } from '@/services/material';

vi.mock('@/services/category', () => ({
  getCategoryTree: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  removeCategory: vi.fn(),
  moveCategory: vi.fn(),
}));

vi.mock('@/services/material', () => ({
  pageMaterial: vi.fn(),
  updateMaterialCategory: vi.fn(),
}));

vi.mock('@/components/confirm', () => ({
  confirmAction: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

import { confirmAction } from '@/components/confirm';
import {
  createCategory,
  getCategoryTree,
  moveCategory,
  removeCategory,
  renameCategory,
} from '@/services/category';
import { pageMaterial, updateMaterialCategory } from '@/services/material';
import { toast } from '@/utils/toast';
import { useMaterialTree } from './use-material-tree';

const TREE: CategoryNode[] = [
  {
    categoryId: 'cat-1',
    name: '护理制度',
    sortNo: 1,
    children: [{ categoryId: 'cat-2', parentId: 'cat-1', name: '心血管', sortNo: 1 }],
  },
];

function material(id: string, categoryId: string | null): MaterialRecord {
  return {
    materialId: id,
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: `资料 ${id}`,
    sourceType: 'UPLOAD',
    categoryId,
    materialStatus: 'ACTIVE',
    fingerprint: `fp-${id}`,
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  };
}

function setup(overrides: Partial<Parameters<typeof useMaterialTree>[0]> = {}) {
  const params = {
    kbId: 'kb-1',
    canWrite: true,
    categoryId: '',
    setBusy: vi.fn(),
    onCategoryCleared: vi.fn(),
    onMaterialsChanged: vi.fn(),
    ...overrides,
  };
  return { params, ...renderHook(() => useMaterialTree(params)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCategoryTree).mockResolvedValue(TREE);
  vi.mocked(pageMaterial).mockResolvedValue({
    records: [material('m1', 'cat-1'), material('m2', 'unknown')],
    total: 2,
    size: 200,
    current: 1,
  });
  vi.mocked(createCategory).mockResolvedValue({ categoryId: 'cat-3', name: '护理', sortNo: 2 });
  vi.mocked(renameCategory).mockResolvedValue(true);
  vi.mocked(removeCategory).mockResolvedValue(true);
  vi.mocked(moveCategory).mockResolvedValue(true);
  vi.mocked(updateMaterialCategory).mockResolvedValue([
    { materialId: 'm1', success: true, message: 'ok' },
  ]);
  vi.mocked(confirmAction).mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useMaterialTree', () => {
  it('加载分类树与全库资料，按分类归组并累计计数', async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.tree).toHaveLength(1));
    await waitFor(() => expect(result.current.treeMaterials).toHaveLength(2));
    expect(getCategoryTree).toHaveBeenCalledWith('kb-1');
    expect(pageMaterial).toHaveBeenCalledWith({ kbId: 'kb-1', current: 1, size: 200 });
    expect(result.current.materialsByCategory.get('cat-1')?.map((item) => item.materialId)).toEqual(['m1']);
    expect(result.current.materialsByCategory.get('')).toHaveLength(1);
    expect(result.current.categoryCounts.get('cat-1')).toBe(1);
    expect(result.current.libraryTotal).toBe(2);
  });

  it('折叠与展开分类，新建分类校验名称并刷新树', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.tree).toHaveLength(1));

    act(() => result.current.toggleCollapsed('cat-1'));
    expect(result.current.collapsed.has('cat-1')).toBe(true);
    act(() => result.current.expandCategory('cat-1'));
    expect(result.current.collapsed.has('cat-1')).toBe(false);

    act(() => result.current.openCreateCategory('cat-1'));
    expect(result.current.categoryModal).toEqual({ open: true, parentId: 'cat-1' });
    await act(async () => {
      await result.current.submitCategory();
    });
    expect(createCategory).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('请输入分类名称', undefined, 'warn');

    act(() => result.current.setCategoryName('护理'));
    await act(async () => {
      await result.current.submitCategory();
    });
    expect(createCategory).toHaveBeenCalledWith('kb-1', '护理', 'cat-1');
    expect(result.current.categoryModal.open).toBe(false);
    expect(getCategoryTree).toHaveBeenCalledTimes(2);
  });

  it('重命名分类，取消后不再提交', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.tree).toHaveLength(1));

    act(() => result.current.beginRename(TREE[0]));
    expect(result.current.editingCategoryId).toBe('cat-1');
    act(() => result.current.setEditingCategoryName('护理核心制度'));
    await act(async () => {
      await result.current.commitRename(TREE[0]);
    });
    expect(renameCategory).toHaveBeenCalledWith('cat-1', '护理核心制度');
    expect(toast).toHaveBeenCalledWith('分类已重命名', '「护理制度」→ 护理核心制度', 'success');

    act(() => result.current.beginRename(TREE[0]));
    act(() => result.current.cancelRename());
    await act(async () => {
      await result.current.commitRename(TREE[0]);
    });
    expect(renameCategory).toHaveBeenCalledTimes(1);
  });

  it('删除分类需确认，确认后清空当前分类', async () => {
    const { result, params } = setup({ categoryId: 'cat-1' });
    await waitFor(() => expect(result.current.tree).toHaveLength(1));

    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    await act(async () => {
      await result.current.deleteCategory();
    });
    expect(removeCategory).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.deleteCategory('cat-1');
    });
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: '删除当前分类？', confirmText: '删除' }),
    );
    expect(removeCategory).toHaveBeenCalledWith('cat-1');
    expect(params.onCategoryCleared).toHaveBeenCalledWith('cat-1');
  });

  it('拖放资料到分类或根目录时调用批量改分类', async () => {
    const { result, params } = setup();
    await waitFor(() => expect(result.current.treeMaterials).toHaveLength(2));

    const materialDrop = {
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn((type: string) => (type === 'text/plain' ? 'm1' : '')),
        dropEffect: '',
      },
    } as unknown as React.DragEvent<HTMLDivElement>;
    await act(async () => {
      result.current.dropProps('cat-2').onDrop(materialDrop);
      await Promise.resolve();
    });
    expect(updateMaterialCategory).toHaveBeenCalledWith('kb-1', ['m1'], 'cat-2');
    expect(params.setBusy).toHaveBeenCalledWith(true);
    expect(params.setBusy).toHaveBeenCalledWith(false);
    expect(params.onMaterialsChanged).toHaveBeenCalled();

    const rootDrop = {
      preventDefault: vi.fn(),
      target: 'root',
      currentTarget: 'root',
      dataTransfer: {
        getData: vi.fn((type: string) => (type === 'text/plain' ? 'm1' : '')),
        dropEffect: '',
      },
    } as unknown as React.DragEvent<HTMLDivElement>;
    await act(async () => {
      result.current.rootDropProps.onDrop(rootDrop);
      await Promise.resolve();
    });
    expect(updateMaterialCategory).toHaveBeenLastCalledWith('kb-1', ['m1'], undefined);
  });

  it('拖动分类到根目录时调用移动接口', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.tree).toHaveLength(1));

    const categoryDrop = {
      preventDefault: vi.fn(),
      target: 'root',
      currentTarget: 'root',
      dataTransfer: {
        getData: vi.fn((type: string) =>
          type === 'application/x-kb-category' ? 'cat-2' : '',
        ),
        dropEffect: '',
      },
    } as unknown as React.DragEvent<HTMLDivElement>;
    await act(async () => {
      result.current.rootDropProps.onDrop(categoryDrop);
      await Promise.resolve();
    });
    expect(moveCategory).toHaveBeenCalledWith('cat-2', undefined);
    expect(toast).toHaveBeenCalledWith('分类已移动', '「心血管」→ 根目录', 'success');
  });
});
