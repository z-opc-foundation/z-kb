import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompilationJobRecord } from '@/services/compilation';
import type { MaterialDetailRecord } from '@/services/material';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';
import MaterialWorkspaceDialogs from './material-workspace-dialogs';

vi.mock('./material-recycle-modal', () => ({
  default: () => <div data-testid="recycle-stub" />,
}));

const DETAIL: MaterialDetailRecord = {
  material: {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '排班管理制度',
    sourceType: 'LOCAL',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-1',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  versions: [],
};

const JOB: CompilationJobRecord = {
  jobId: 'job-1',
  kbId: 'kb-1',
  materialId: 'mat-1',
  materialVersionId: 'v-1',
  pipelineType: 'DOCUMENT',
  configVersion: 'cfg-1',
  compilerVersion: 'local-chunker-v2',
  runStatus: 'COMPLETED',
  milestone: 'M1',
  chunkCount: 2,
  reused: false,
  stages: [],
};

function createCtrl(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tree: [
      {
        categoryId: 'cat-1',
        name: '护理制度',
        sortNo: 1,
        children: [{ categoryId: 'cat-2', parentId: 'cat-1', name: '心血管', sortNo: 1 }],
      },
    ],
    selected: ['mat-1', 'mat-2'],
    busy: false,
    currentCategory: { categoryId: 'cat-1', name: '护理制度', sortNo: 1 },
    detail: DETAIL,
    recycle: { open: false, count: 0 },
    uploadOpen: false,
    setUploadOpen: vi.fn(),
    uploadFiles: [],
    setUploadFiles: vi.fn(),
    uploadResults: [],
    setUploadResults: vi.fn(),
    uploading: false,
    fileInputRef: { current: { click: vi.fn() } },
    categoryModal: { open: false },
    setCategoryModal: vi.fn(),
    categoryName: '',
    setCategoryName: vi.fn(),
    moveOpen: false,
    setMoveOpen: vi.fn(),
    confirmRemove: false,
    setConfirmRemove: vi.fn(),
    confirmRerun: false,
    setConfirmRerun: vi.fn(),
    compilation: null,
    compileBusy: false,
    nodeBatch: null,
    setNodeBatch: vi.fn(),
    nodeBatchName: '',
    setNodeBatchName: vi.fn(),
    nodeBatchBusy: false,
    batchOpen: false,
    setBatchOpen: vi.fn(),
    batchName: '',
    setBatchName: vi.fn(),
    batchBusy: false,
    compareMode: null,
    setCompareMode: vi.fn(),
    submitUpload: vi.fn(),
    submitCategory: vi.fn(),
    moveSelected: vi.fn(),
    removeSelected: vi.fn(),
    submitRerun: vi.fn(),
    submitNodeBatch: vi.fn(),
    submitBatch: vi.fn(),
    ...overrides,
  } as unknown as MaterialWorkspaceController;
}

afterEach(() => {
  cleanup();
});

describe('资料工作台弹窗组', () => {
  it('上传弹窗：选择文件后展示清单并提交', () => {
    const file = new File(['hello'], '制度.md', { type: 'text/markdown' });
    const ctrl = createCtrl({ uploadOpen: true, uploadFiles: [file] });
    render(<MaterialWorkspaceDialogs ctrl={ctrl} />);

    expect(screen.getByText('上传资料')).toBeTruthy();
    expect(screen.getByText(/登记到 护理制度/)).toBeTruthy();
    expect(screen.getByText('已选 1 个文件')).toBeTruthy();
    const input = document.querySelector('.modal input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(ctrl.setUploadFiles).toHaveBeenCalledWith([file]);
    expect(ctrl.setUploadResults).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByRole('button', { name: '开始上传' }));
    expect(ctrl.submitUpload).toHaveBeenCalled();
  });

  it('上传弹窗展示已选文件与上传结果，上传中禁止关闭', () => {
    const ctrl = createCtrl({
      uploadOpen: true,
      uploadFiles: [{ name: '制度.md', size: 2048 } as File],
      uploadResults: [
        { fileName: '制度.md', success: true, duplicated: false, message: '已登记' },
        { fileName: '重复.md', success: false, duplicated: true, message: '内容已存在' },
      ],
      uploading: true,
    });
    render(<MaterialWorkspaceDialogs ctrl={ctrl} />);

    expect(screen.getByText('已选 1 个文件')).toBeTruthy();
    expect(screen.getByText('已登记')).toBeTruthy();
    expect(screen.getByText('内容已存在')).toBeTruthy();
    expect(screen.getByRole('button', { name: '上传中…' })).toBeDisabled();
    expect(screen.getByText('关闭').closest('button')).toBeDisabled();
  });

  it('新建分类弹窗按父子层级展示并提交名称', () => {
    const ctrl = createCtrl({ categoryModal: { open: true, parentId: 'cat-1' } });
    render(<MaterialWorkspaceDialogs ctrl={ctrl} />);

    expect(screen.getByText('新建子分类')).toBeTruthy();
    expect(screen.getByText('将创建在「护理制度」下')).toBeTruthy();
    const input = screen.getByPlaceholderText('例如：临床指南');
    fireEvent.change(input, { target: { value: '护理常规' } });
    expect(ctrl.setCategoryName).toHaveBeenCalledWith('护理常规');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));
    expect(ctrl.submitCategory).toHaveBeenCalledTimes(2);
  });

  it('移动分类弹窗把所选目标交给批量移动', () => {
    const ctrl = createCtrl({ moveOpen: true });
    render(<MaterialWorkspaceDialogs ctrl={ctrl} />);

    expect(screen.getByText('将 2 个资料移动到目标分类')).toBeTruthy();
    fireEvent.click(screen.getByText('心血管'));
    fireEvent.click(screen.getByRole('button', { name: '移动到所选分类' }));
    expect(ctrl.moveSelected).toHaveBeenCalledWith('cat-2');
  });

  it('删除确认与重跑确认调用对应提交', () => {
    const ctrl = createCtrl({ confirmRemove: true });
    const view = render(<MaterialWorkspaceDialogs ctrl={ctrl} />);
    expect(screen.getByText('将删除已勾选的 2 个资料，是否继续？')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(ctrl.removeSelected).toHaveBeenCalled();

    view.unmount();
    const rerun = createCtrl({ confirmRerun: true, compilation: JOB });
    render(<MaterialWorkspaceDialogs ctrl={rerun} />);
    expect(screen.getByText('排班管理制度')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认重跑' }));
    expect(rerun.submitRerun).toHaveBeenCalled();
  });

  it('分类批任务与多选知识编译弹窗传入名称并提交', () => {
    const ctrl = createCtrl({
      nodeBatch: { categoryId: 'cat-1', name: '护理制度', sortNo: 1 },
      nodeBatchName: '护理制度 批量编译',
    });
    const view = render(<MaterialWorkspaceDialogs ctrl={ctrl} />);
    expect(screen.getByText('按分类发起批任务')).toBeTruthy();
    expect(screen.getByText('范围锁定当前分类（含子分类）')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('组别名称'), {
      target: { value: '护理批量' },
    });
    expect(ctrl.setNodeBatchName).toHaveBeenCalledWith('护理批量');
    fireEvent.click(screen.getByRole('button', { name: '开始编译' }));
    expect(ctrl.submitNodeBatch).toHaveBeenCalled();

    view.unmount();
    const batch = createCtrl({
      batchOpen: true,
      batchName: '知识编译 · 10-30 10:00',
    });
    render(<MaterialWorkspaceDialogs ctrl={batch} />);
    expect(screen.getByText('已选 2 份资料，按每份资料扇出编译单任务')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('组别名称'), {
      target: { value: '多选编译' },
    });
    expect(batch.setBatchName).toHaveBeenCalledWith('多选编译');
    fireEvent.click(screen.getByRole('button', { name: '开始编译（2）' }));
    expect(batch.submitBatch).toHaveBeenCalled();
  });

  it('空闲时只渲染回收站占位', () => {
    render(<MaterialWorkspaceDialogs ctrl={createCtrl()} />);
    expect(screen.getByTestId('recycle-stub')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
