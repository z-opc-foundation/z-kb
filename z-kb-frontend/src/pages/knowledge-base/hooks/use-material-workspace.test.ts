import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNode } from '@/services/category';
import type { CompilationBatchRecord } from '@/services/compilation';
import type { MaterialRecord, MaterialUploadItem } from '@/services/material';

vi.mock('@/services/material', () => ({
  pageMaterial: vi.fn(),
  pageDeletedMaterials: vi.fn(),
  uploadMaterials: vi.fn(),
  updateMaterialCategory: vi.fn(),
  removeMaterials: vi.fn(),
  restoreMaterials: vi.fn(),
  purgeMaterials: vi.fn(),
  getMaterial: vi.fn(),
  reviseMaterial: vi.fn(),
  reparseMaterial: vi.fn(),
}));

vi.mock('@/services/category', () => ({
  getCategoryTree: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  removeCategory: vi.fn(),
  moveCategory: vi.fn(),
}));

vi.mock('@/services/compilation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/compilation')>();
  return {
    ...actual,
    runCompilation: vi.fn(),
    retryCompilation: vi.fn(),
    cancelCompilation: vi.fn(),
    getCompilationByMaterial: vi.fn(),
    getCompilationByJob: vi.fn(),
    listCompilationChunks: vi.fn(),
    createCompilationBatch: vi.fn(),
  };
});

vi.mock('@/components/confirm', () => ({ confirmAction: vi.fn() }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

import { getCategoryTree } from '@/services/category';
import { createCompilationBatch } from '@/services/compilation';
import {
  pageDeletedMaterials,
  pageMaterial,
  removeMaterials,
  updateMaterialCategory,
  uploadMaterials,
} from '@/services/material';
import { toast } from '@/utils/toast';
import { useMaterialWorkspace } from './use-material-workspace';

const TREE: CategoryNode[] = [
  {
    categoryId: 'cat-1',
    name: '护理制度',
    sortNo: 1,
    children: [{ categoryId: 'cat-2', parentId: 'cat-1', name: '心血管', sortNo: 1 }],
  },
];

function material(id: string): MaterialRecord {
  return {
    materialId: id,
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: `资料 ${id}`,
    sourceType: 'UPLOAD',
    categoryId: 'cat-1',
    materialStatus: 'ACTIVE',
    fingerprint: `fp-${id}`,
    parseStatus: 'READY',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  };
}

const RECORDS = [material('m1'), material('m2')];

function batch(overrides: Partial<CompilationBatchRecord> = {}): CompilationBatchRecord {
  return {
    batchId: 'batch-1',
    kbId: 'kb-1',
    name: '知识编译',
    taskType: 'COMPILE',
    scopeType: 'WORKSPACE',
    scopeCount: 2,
    totalCount: 2,
    successCount: 2,
    failedCount: 0,
    status: 'QUEUED',
    ...overrides,
  };
}

function setup(
  overrides: Partial<Parameters<typeof useMaterialWorkspace>[0]> = {},
) {
  const params = {
    kbId: 'kb-1',
    canManage: true,
    ...overrides,
  };
  return { params, ...renderHook(() => useMaterialWorkspace(params)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCategoryTree).mockResolvedValue(TREE);
  vi.mocked(pageMaterial).mockResolvedValue({
    records: RECORDS,
    total: 2,
    size: 10,
    current: 1,
  });
  vi.mocked(pageDeletedMaterials).mockResolvedValue({
    records: [],
    total: 0,
    size: 1,
    current: 1,
  });
  vi.mocked(uploadMaterials).mockResolvedValue([
    {
      fileName: '制度.md',
      success: true,
      duplicated: false,
      materialId: 'm3',
      message: 'ok',
    } satisfies MaterialUploadItem,
  ]);
  vi.mocked(updateMaterialCategory).mockResolvedValue([
    { materialId: 'm1', success: true, message: 'ok' },
  ]);
  vi.mocked(removeMaterials).mockResolvedValue([
    { materialId: 'm1', success: true, message: 'ok' },
  ]);
  vi.mocked(createCompilationBatch).mockResolvedValue(batch());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useMaterialWorkspace', () => {
  it('初始化时并行加载资料列表、分类树与回收站计数', async () => {
    const { result } = setup();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.records).toHaveLength(2));
    await waitFor(() => expect(result.current.treeMaterials).toHaveLength(2));
    await waitFor(() => expect(result.current.recycle.count).toBe(0));

    expect(getCategoryTree).toHaveBeenCalledWith('kb-1');
    expect(pageMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: 'kb-1', current: 1, size: 10 }),
    );
    expect(pageMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: 'kb-1', current: 1, size: 200 }),
    );
    expect(pageDeletedMaterials).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: 'kb-1', materialType: 'DOCUMENT' }),
    );
    expect(result.current.categoryId).toBe('');
    expect(result.current.currentCategory).toBeUndefined();
    expect(result.current.canWrite).toBe(true);
    expect(result.current.canCompile).toBe(true);
    expect(result.current.tree.map((node) => node.categoryId)).toEqual(['cat-1']);
  });

  it('uploadSignal 打开上传弹窗，提交上传后刷新列表与树', async () => {
    const { result } = setup({ uploadSignal: 1 });
    await waitFor(() => expect(result.current.records).toHaveLength(2));
    expect(result.current.uploadOpen).toBe(true);

    const callsBefore = vi.mocked(pageMaterial).mock.calls.length;
    const file = new File(['content'], '制度.md');
    act(() => {
      result.current.setUploadFiles([file]);
    });
    expect(result.current.uploadFiles).toHaveLength(1);

    await act(async () => {
      await result.current.submitUpload();
    });

    expect(uploadMaterials).toHaveBeenCalledWith('kb-1', undefined, [file]);
    expect(result.current.uploading).toBe(false);
    expect(result.current.uploadFiles).toEqual([]);
    expect(result.current.uploadResults.map((item) => item.materialId)).toEqual(['m3']);
    expect(toast).toHaveBeenCalledWith(
      '上传完成',
      '成功 1 个，解析任务已提交',
      'success',
    );
    await waitFor(() =>
      expect(vi.mocked(pageMaterial).mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('勾选资料后批量移动分类，成功后清空选择', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.records).toHaveLength(2));

    act(() => {
      result.current.toggleSelected('m1');
    });
    expect(result.current.selected).toEqual(['m1']);

    await act(async () => {
      await result.current.moveSelected('cat-2');
    });

    expect(updateMaterialCategory).toHaveBeenCalledWith('kb-1', ['m1'], 'cat-2');
    expect(result.current.selected).toEqual([]);
    expect(result.current.moveOpen).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(toast).toHaveBeenCalledWith('分类已更新', '1/1 个资料已移动', 'success');
  });

  it('确认删除后调用删除接口并刷新全部数据', async () => {
    vi.mocked(removeMaterials).mockResolvedValue([
      { materialId: 'm1', success: true, message: 'ok' },
      { materialId: 'm2', success: true, message: 'ok' },
    ]);
    const { result } = setup();
    await waitFor(() => expect(result.current.records).toHaveLength(2));

    act(() => {
      result.current.askRemove(['m1', 'm2']);
    });
    expect(result.current.confirmRemove).toBe(true);
    expect(result.current.selected).toEqual(['m1', 'm2']);

    await act(async () => {
      await result.current.removeSelected();
    });

    expect(removeMaterials).toHaveBeenCalledWith('kb-1', ['m1', 'm2']);
    expect(result.current.confirmRemove).toBe(false);
    expect(result.current.selected).toEqual([]);
    expect(toast).toHaveBeenCalledWith('删除完成', '2/2 个资料已删除', 'success');
    expect(getCategoryTree).toHaveBeenCalledTimes(2);
  });

  it('打开批量编译并提交所选资料，完成后回调批次 ID', async () => {
    const onBatchCreated = vi.fn();
    const { result } = setup({ onBatchCreated });
    await waitFor(() => expect(result.current.records).toHaveLength(2));

    act(() => {
      result.current.toggleSelected('m1');
      result.current.toggleSelected('m2');
    });
    act(() => {
      result.current.openBatch();
    });
    expect(result.current.batchOpen).toBe(true);
    expect(result.current.batchName).toMatch(/^知识编译 · \d{2}-\d{2} \d{2}:\d{2}$/);

    await act(async () => {
      await result.current.submitBatch();
    });

    expect(createCompilationBatch).toHaveBeenCalledWith({
      kbId: 'kb-1',
      name: result.current.batchName,
      scopeType: 'WORKSPACE',
      materialIds: ['m1', 'm2'],
    });
    expect(result.current.batchOpen).toBe(false);
    expect(result.current.selected).toEqual([]);
    expect(result.current.batchBusy).toBe(false);
    expect(toast).toHaveBeenCalledWith('编译组别已创建', '2/2 成功 · 状态 QUEUED', 'success');
    expect(onBatchCreated).toHaveBeenCalledWith('batch-1');
  });

  it('按分类节点创建批量编译，提交分类范围', async () => {
    vi.mocked(createCompilationBatch).mockResolvedValue(
      batch({ scopeType: 'CATEGORY', scopeId: 'cat-1', scopeCount: 2, successCount: 1, failedCount: 1 }),
    );
    const onBatchCreated = vi.fn();
    const { result } = setup({ onBatchCreated });
    await waitFor(() => expect(result.current.tree).toHaveLength(1));

    act(() => {
      result.current.openNodeBatch(TREE[0]);
    });
    expect(result.current.nodeBatch?.categoryId).toBe('cat-1');
    expect(result.current.nodeBatchName).toBe('护理制度 批量编译');

    await act(async () => {
      await result.current.submitNodeBatch();
    });

    expect(createCompilationBatch).toHaveBeenCalledWith({
      kbId: 'kb-1',
      name: '护理制度 批量编译',
      scopeType: 'CATEGORY',
      scopeId: 'cat-1',
    });
    expect(result.current.nodeBatch).toBeNull();
    expect(result.current.nodeBatchBusy).toBe(false);
    expect(toast).toHaveBeenCalledWith('编译组别已创建', '范围 2 份 · 1/2 成功', 'warn');
    expect(onBatchCreated).toHaveBeenCalledWith('batch-1');
  });
});
