import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CompilationJobRecord,
  RetrievalChunkRecord,
} from '@/services/compilation';
import type {
  MaterialDetailRecord,
  MaterialRecord,
  MaterialVersionRecord,
  ParsedDraftRecord,
} from '@/services/material';

vi.mock('@/services/material', () => ({
  getMaterial: vi.fn(),
  reviseMaterial: vi.fn(),
  reparseMaterial: vi.fn(),
  saveDraftText: vi.fn(),
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
  };
});

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

import {
  cancelCompilation,
  getCompilationByJob,
  getCompilationByMaterial,
  listCompilationChunks,
  runCompilation,
} from '@/services/compilation';
import { getMaterial, reparseMaterial, reviseMaterial, saveDraftText } from '@/services/material';
import { toast } from '@/utils/toast';
import { useMaterialDetail } from './use-material-detail';

const MATERIAL: MaterialRecord = {
  materialId: 'm1',
  kbId: 'kb-1',
  materialType: 'DOCUMENT',
  title: '护理制度',
  sourceType: 'UPLOAD',
  categoryId: 'cat-1',
  materialStatus: 'ACTIVE',
  fingerprint: 'fp-1',
  currentVersionId: 'v1',
  compileStatus: 'COMPLETED',
  governanceStatus: 'NORMAL',
  registeredBy: 1,
};

const VERSION: MaterialVersionRecord = {
  versionId: 'v1',
  versionNo: 1,
  fileName: '护理制度.md',
  sizeBytes: 128,
  fingerprint: 'fp-1',
  versionStatus: 'ACTIVE',
};

const DRAFT: ParsedDraftRecord = {
  draftId: 'd1',
  status: 'READY',
  parserName: 'markdown',
  parserVersion: '1.0',
  textContent: '  护理   制度正文内容  ',
  textLength: 12,
};

function detail(overrides: Partial<MaterialDetailRecord> = {}): MaterialDetailRecord {
  return {
    material: MATERIAL,
    versions: [VERSION],
    currentDraft: DRAFT,
    ...overrides,
  };
}

function job(overrides: Partial<CompilationJobRecord> = {}): CompilationJobRecord {
  return {
    jobId: 'job-1',
    kbId: 'kb-1',
    materialId: 'm1',
    materialVersionId: 'v1',
    pipelineType: 'M1',
    configVersion: '1',
    compilerVersion: '1.0',
    runStatus: 'COMPLETED',
    milestone: 'M1',
    chunkCount: 3,
    reused: false,
    stages: [],
    ...overrides,
  };
}

const CHUNK: RetrievalChunkRecord = {
  chunkId: 'chunk-1',
  materialId: 'm1',
  materialVersionId: 'v1',
  artifactId: 'artifact-1',
  ordinal: 1,
  heading: '总则',
  content: '护理制度内容',
  charCount: 8,
  indexState: 'INDEXED',
};

function setup(
  overrides: Partial<Parameters<typeof useMaterialDetail>[0]> = {},
) {
  const params = {
    kbId: 'kb-1',
    onMaterialsChanged: vi.fn(),
    ...overrides,
  };
  return { params, ...renderHook(() => useMaterialDetail(params)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMaterial).mockResolvedValue(detail());
  vi.mocked(getCompilationByMaterial).mockResolvedValue(undefined);
  vi.mocked(getCompilationByJob).mockResolvedValue(job());
  vi.mocked(listCompilationChunks).mockResolvedValue([CHUNK]);
  vi.mocked(runCompilation).mockResolvedValue(job());
  vi.mocked(cancelCompilation).mockResolvedValue(job({ runStatus: 'CANCELED' }));
  vi.mocked(reviseMaterial).mockResolvedValue({
    fileName: '护理制度-v2.md',
    success: true,
    duplicated: false,
    message: '新版本已登记',
  });
  vi.mocked(reparseMaterial).mockResolvedValue({ ...DRAFT, draftId: 'd2', status: 'READY' });
  vi.mocked(saveDraftText).mockResolvedValue({
    ...DRAFT,
    draftId: 'd3',
    textContent: '人工修订正文',
    textLength: 6,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useMaterialDetail', () => {
  it('打开详情时并行加载资料、编译任务与检索块', async () => {
    vi.mocked(getCompilationByMaterial).mockResolvedValue(job());

    const { result, params } = setup();
    await act(async () => {
      await result.current.openDetail('m1');
    });

    expect(result.current.detailId).toBe('m1');
    expect(result.current.detail?.material.title).toBe('护理制度');
    expect(result.current.detailTab).toBe('basic');
    expect(result.current.compilation?.jobId).toBe('job-1');
    expect(result.current.compilationLoading).toBe(false);
    expect(result.current.chunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-1']);
    expect(getMaterial).toHaveBeenCalledWith('m1');
    expect(getCompilationByMaterial).toHaveBeenCalledWith('m1');
    expect(listCompilationChunks).toHaveBeenCalledWith('m1', 'v1');
    expect(result.current.materialAskQuestion).toContain('护理制度');
    expect(result.current.materialAskQuestion).toContain('护理 制度正文内容');
    expect(params.onMaterialsChanged).not.toHaveBeenCalled();
  });

  it('initialMaterialId 自动打开详情并按 initialDetailTab 定位', async () => {
    const { result } = setup({
      initialMaterialId: 'm1',
      initialDetailTab: 'compile',
    });

    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(result.current.detailId).toBe('m1');
    expect(result.current.detailTab).toBe('compile');
    expect(result.current.compilation).toBeNull();
    expect(result.current.chunks).toEqual([]);
  });

  it('提交编译并已完成时写入结果、检索块并通知资料变更', async () => {
    const { result, params } = setup({ initialMaterialId: 'm1' });
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    await act(async () => {
      await result.current.submitCompile();
    });

    expect(runCompilation).toHaveBeenCalledWith('m1', 'v1');
    expect(result.current.compilation?.runStatus).toBe('COMPLETED');
    expect(result.current.detailTab).toBe('basic');
    expect(result.current.chunks).toHaveLength(1);
    expect(result.current.compileBusy).toBe(false);
    expect(toast).toHaveBeenCalledWith('编译完成', 'M1 已达成 · 检索块 3 个', 'success');
    expect(params.onMaterialsChanged).toHaveBeenCalled();
  });

  it('编译进行中轮询任务，完成后停止轮询并刷新检索块', async () => {
    vi.useFakeTimers();
    const { result, params, unmount } = setup({ initialMaterialId: 'm1' });
    await act(async () => {});
    expect(result.current.detail).not.toBeNull();

    vi.mocked(runCompilation).mockResolvedValueOnce(
      job({ runStatus: 'RUNNING', taskStatus: 'RUNNING' }),
    );
    vi.mocked(getCompilationByJob).mockResolvedValue(job({ runStatus: 'COMPLETED' }));

    await act(async () => {
      await result.current.submitCompile();
    });
    expect(toast).toHaveBeenCalledWith(
      '编译已提交',
      '任务已进入队列 · RUNNING',
      'success',
    );
    expect(getCompilationByJob).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(getCompilationByJob).toHaveBeenCalledWith('job-1');
    expect(result.current.compilation?.runStatus).toBe('COMPLETED');
    expect(result.current.chunks).toHaveLength(1);
    expect(params.onMaterialsChanged).toHaveBeenCalled();

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(getCompilationByJob).toHaveBeenCalledTimes(1);
  });

  it('取消编译后停止轮询并提示取消结果', async () => {
    vi.mocked(getCompilationByMaterial).mockResolvedValue(
      job({ runStatus: 'RUNNING' }),
    );
    vi.mocked(cancelCompilation).mockResolvedValue(
      job({ runStatus: 'CANCELED', failureSummary: '用户取消' }),
    );
    const { result } = setup({ initialMaterialId: 'm1' });
    await waitFor(() => expect(result.current.compilation).not.toBeNull());

    await act(async () => {
      await result.current.cancelCompile();
    });

    expect(cancelCompilation).toHaveBeenCalledWith('job-1');
    expect(result.current.compilation?.runStatus).toBe('CANCELED');
    expect(result.current.cancelBusy).toBe(false);
    expect(toast).toHaveBeenCalledWith('编译已取消', '用户取消', 'warn');
  });

  it('上传新版本成功后刷新详情并通知资料变更', async () => {
    const refreshed = detail({ material: { ...MATERIAL, title: '护理制度（修订）' } });
    vi.mocked(getMaterial)
      .mockResolvedValueOnce(detail())
      .mockResolvedValue(refreshed);
    const { result, params } = setup({ initialMaterialId: 'm1' });
    await waitFor(() => expect(result.current.detail?.material.title).toBe('护理制度'));

    await act(async () => {
      await result.current.submitRevise(undefined);
    });
    expect(reviseMaterial).not.toHaveBeenCalled();

    const file = new File(['content'], '护理制度-v2.md');
    await act(async () => {
      await result.current.submitRevise(file);
    });

    expect(reviseMaterial).toHaveBeenCalledWith('kb-1', 'm1', file);
    expect(toast).toHaveBeenCalledWith('新版本已登记', '新版本已登记', 'success');
    expect(result.current.versionUploading).toBe(false);
    expect(result.current.detail?.material.title).toBe('护理制度（修订）');
    expect(params.onMaterialsChanged).toHaveBeenCalled();
  });

  it('重新解析成功时刷新详情并提示解析稿更新', async () => {
    vi.mocked(getMaterial)
      .mockResolvedValueOnce(detail())
      .mockResolvedValue(detail());
    const { result, params } = setup({ initialMaterialId: 'm1' });
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    await act(async () => {
      await result.current.submitReparse();
    });

    expect(reparseMaterial).toHaveBeenCalledWith('m1', 'v1');
    expect(toast).toHaveBeenCalledWith('已重新解析', '解析稿已更新', 'success');
    expect(getMaterial).toHaveBeenCalledTimes(2);
    expect(result.current.reparseBusy).toBe(false);
    expect(params.onMaterialsChanged).toHaveBeenCalled();
  });

  it('保存解析稿正文后刷新详情并通知资料变更', async () => {
    const { result, params } = setup({ initialMaterialId: 'm1' });
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    let saved = false;
    await act(async () => {
      saved = await result.current.submitDraftText('人工修订正文');
    });

    expect(saved).toBe(true);
    expect(saveDraftText).toHaveBeenCalledWith('m1', '人工修订正文', 'v1');
    expect(toast).toHaveBeenCalledWith(
      '解析稿已保存',
      '已生成新解析稿（旧稿保留），重新编译后应用到 Wiki',
      'success',
    );
    expect(getMaterial).toHaveBeenCalledTimes(2);
    expect(result.current.draftSaving).toBe(false);
    expect(params.onMaterialsChanged).toHaveBeenCalled();
  });
});
