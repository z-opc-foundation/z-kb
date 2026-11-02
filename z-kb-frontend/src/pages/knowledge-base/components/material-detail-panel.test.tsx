import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompilationJobRecord } from '@/services/compilation';
import type { MaterialDetailRecord } from '@/services/material';
import type { CategoryNode } from '@/services/category';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';
import MaterialDetailPanel from './material-detail-panel';

vi.mock('@/pages/ai/agent-ask', () => ({
  AgentAskButton: ({ label }: { label?: string }) => (
    <button type="button">{label || '问 AI'}</button>
  ),
}));

vi.mock('./material-original-preview', () => ({
  default: ({ material }: { material: { fileName?: string } }) => (
    <div data-testid="original-preview">{material.fileName}</div>
  ),
}));

const DETAIL: MaterialDetailRecord = {
  material: {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '排班管理制度',
    sourceType: 'LOCAL',
    categoryId: 'cat-1',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-1',
    currentVersionId: 'v-1',
    versionNo: 1,
    fileName: '排班管理制度.md',
    fileExt: 'md',
    sizeBytes: 2048,
    versionStatus: 'PARSED',
    parseStatus: 'READY',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
    registeredAt: '2026-10-26T09:00:00',
  },
  versions: [
    {
      versionId: 'v-1',
      versionNo: 1,
      fileName: '排班管理制度.md',
      sizeBytes: 2048,
      fingerprint: 'fp-1',
      versionStatus: 'PARSED',
      registeredAt: '2026-10-26T09:00:00',
    },
    {
      versionId: 'v-2',
      versionNo: 2,
      fileName: '排班管理制度-v2.md',
      sizeBytes: 4096,
      fingerprint: 'fp-2',
      versionStatus: 'REGISTERED',
      registeredAt: '2026-10-27T09:00:00',
    },
  ],
  currentDraft: {
    draftId: 'd-1',
    status: 'READY',
    parserName: 'MinerU',
    parserVersion: '2.1',
    textContent: '正文',
    textLength: 2,
  },
};

const TREE: CategoryNode[] = [{ categoryId: 'cat-1', name: '护理制度', sortNo: 1 }];

const JOB: CompilationJobRecord = {
  jobId: 'job-1',
  kbId: 'kb-1',
  materialId: 'mat-1',
  materialVersionId: 'v-1',
  pipelineType: 'DOCUMENT',
  configVersion: 'cfg-1',
  compilerVersion: 'local-chunker-v2',
  runStatus: 'RUNNING',
  milestone: 'P2',
  chunkCount: 0,
  reused: false,
  stages: [],
};

function createCtrl(overrides: Partial<Record<string, unknown>> = {}) {
  const versionInputRef = { current: { click: vi.fn() } };
  return {
    kbId: 'kb-1',
    tree: TREE,
    canWrite: true,
    canCompile: true,
    onOpenConcept: vi.fn(),
    detailId: 'mat-1',
    detail: DETAIL,
    detailTab: 'basic',
    setDetailTab: vi.fn(),
    compilation: null,
    compilationLoading: false,
    chunks: [],
    compileBusy: false,
    cancelBusy: false,
    versionUploading: false,
    reparseBusy: false,
    draftSaving: false,
    setConfirmRerun: vi.fn(),
    setCompareMode: vi.fn(),
    versionInputRef,
    materialAskQuestion: '请介绍资料',
    closeDetail: vi.fn(),
    download: vi.fn(),
    submitCompile: vi.fn(),
    cancelCompile: vi.fn(),
    submitRevise: vi.fn(),
    submitReparse: vi.fn(),
    submitDraftText: vi.fn(),
    ...overrides,
  } as unknown as MaterialWorkspaceController & { versionInputRef: { current: { click: ReturnType<typeof vi.fn> } } };
}

afterEach(() => {
  cleanup();
});

describe('资料详情面板', () => {
  it('基本信息按资料字段展示，页签切换交给控制器', () => {
    const ctrl = createCtrl();
    render(<MaterialDetailPanel ctrl={ctrl} />);

    expect(screen.getByText('排班管理制度')).toBeTruthy();
    expect(screen.getAllByText('mat-1')).toHaveLength(2);
    expect(screen.getByText('排班管理制度.md')).toBeTruthy();
    expect(screen.getByText('文档')).toBeTruthy();
    expect(screen.getByText('2.0 KB')).toBeTruthy();
    expect(screen.getByText('本地上传')).toBeTruthy();
    expect(screen.getByText('护理制度')).toBeTruthy();
    expect(screen.getByText('10-26 09:00')).toBeTruthy();
    expect(screen.getByText('未编译')).toBeTruthy();
    expect(screen.getByText('fp-1')).toBeTruthy();
    expect(screen.getByText('当前 v1 · 已解析')).toBeTruthy();
    expect(screen.getByRole('button', { name: '问 AI' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '版本' }));
    expect(ctrl.setDetailTab).toHaveBeenCalledWith('versions');
    fireEvent.click(screen.getByRole('button', { name: '加工对照' }));
    expect(ctrl.setDetailTab).toHaveBeenCalledWith('compare');
  });

  it('版本页签列出全部版本、标识当前版本并支持对比与下载', () => {
    const ctrl = createCtrl({ detailTab: 'versions' });
    render(<MaterialDetailPanel ctrl={ctrl} />);

    expect(screen.getByText('文件版本')).toBeTruthy();
    expect(screen.getByText('当前')).toBeTruthy();
    expect(screen.getByText('4.0 KB')).toBeTruthy();
    expect(screen.getByText('已登记')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '对比版本' }));
    expect(ctrl.setCompareMode).toHaveBeenCalledWith('version');
    fireEvent.click(screen.getAllByTitle('下载该版本')[1]);
    expect(ctrl.download).toHaveBeenCalledWith('mat-1', '排班管理制度-v2.md', 'v-2');
  });

  it('原文页签先展示原件，切到解析稿后以渲染态展示并可进入编辑态', () => {
    const content = '# 排班制度\n\n护士按班次轮转。';
    const ctrl = createCtrl({
      detailTab: 'draft',
      detail: {
        ...DETAIL,
        currentDraft: {
          ...(DETAIL.currentDraft as NonNullable<MaterialDetailRecord['currentDraft']>),
          textContent: content,
          textLength: content.length,
        },
      },
    });
    render(<MaterialDetailPanel ctrl={ctrl} />);

    expect(screen.getByTestId('original-preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '解析稿' }));

    expect(screen.getByRole('heading', { name: '排班制度' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(content);

    fireEvent.click(screen.getByRole('button', { name: '对比解析稿' }));
    expect(ctrl.setCompareMode).toHaveBeenCalledWith('draft');
  });

  it('页脚按编译状态切换编译、取消与重试按钮', () => {
    const ctrl = createCtrl();
    const view = render(<MaterialDetailPanel ctrl={ctrl} />);
    const compileButtons = screen.getAllByRole('button', { name: '编译' });
    fireEvent.click(compileButtons[compileButtons.length - 1]);
    expect(ctrl.submitCompile).toHaveBeenCalled();

    view.unmount();
    const running = createCtrl({ compilation: JOB });
    render(<MaterialDetailPanel ctrl={running} />);
    fireEvent.click(screen.getByRole('button', { name: '取消编译' }));
    expect(running.cancelCompile).toHaveBeenCalled();

    view.unmount();
    const done = createCtrl({ compilation: { ...JOB, runStatus: 'COMPLETED' } });
    render(<MaterialDetailPanel ctrl={done} />);
    fireEvent.click(screen.getByRole('button', { name: '重试编译' }));
    expect(done.setConfirmRerun).toHaveBeenCalledWith(true);
  });

  it('重新解析、上传新版本与下载原件的交互', () => {
    const ctrl = createCtrl();
    render(<MaterialDetailPanel ctrl={ctrl} />);

    fireEvent.click(screen.getByRole('button', { name: '下载原件' }));
    expect(ctrl.download).toHaveBeenCalledWith('mat-1', '排班管理制度.md');

    fireEvent.click(screen.getByRole('button', { name: '重新解析' }));
    expect(ctrl.submitReparse).toHaveBeenCalled();

    const clickSpy = vi.spyOn(
      ctrl.versionInputRef.current as HTMLInputElement,
      'click',
    );
    fireEvent.click(screen.getByRole('button', { name: '上传新版本' }));
    expect(clickSpy).toHaveBeenCalled();

    const input = document.querySelector('.material-detail-foot input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'new.md');
    fireEvent.change(input, { target: { files: [file] } });
    expect(ctrl.submitRevise).toHaveBeenCalledWith(file);
  });

  it('资料未加载时展示加载占位', () => {
    render(<MaterialDetailPanel ctrl={createCtrl({ detail: null })} />);

    expect(screen.getByText('资料详情')).toBeTruthy();
    expect(screen.getByText('正在加载…')).toBeTruthy();
    expect(screen.getByText('物料详情')).toBeTruthy();
  });
});
