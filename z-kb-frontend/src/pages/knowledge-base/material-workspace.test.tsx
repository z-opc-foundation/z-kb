import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNode } from '@/services/category';
import type { CompilationJobRecord } from '@/services/compilation';
import type { MaterialDetailRecord, MaterialRecord } from '@/services/material';

vi.mock('@/services/material', () => ({
  pageMaterial: vi.fn(),
  pageDeletedMaterials: vi.fn(),
  getMaterial: vi.fn(),
  uploadMaterials: vi.fn(),
  updateMaterialCategory: vi.fn(),
  removeMaterials: vi.fn(),
  restoreMaterials: vi.fn(),
  purgeMaterials: vi.fn(),
  reviseMaterial: vi.fn(),
  reparseMaterial: vi.fn(),
  listDrafts: vi.fn(),
  downloadMaterial: vi.fn(),
  materialDownloadUrl: vi.fn(),
}));

vi.mock('@/services/compilation', () => ({
  runCompilation: vi.fn(),
  retryCompilation: vi.fn(),
  cancelCompilation: vi.fn(),
  isCompilationActive: vi.fn(),
  getCompilationByMaterial: vi.fn(),
  getCompilationByJob: vi.fn(),
  listCompilationChunks: vi.fn(),
  createCompilationBatch: vi.fn(),
}));

vi.mock('@/services/category', () => ({
  getCategoryTree: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  moveCategory: vi.fn(),
  removeCategory: vi.fn(),
}));

import { getCategoryTree } from '@/services/category';
import {
  getCompilationByJob,
  getCompilationByMaterial,
  isCompilationActive,
  listCompilationChunks,
  runCompilation,
} from '@/services/compilation';
import {
  getMaterial,
  pageDeletedMaterials,
  pageMaterial,
  purgeMaterials,
  removeMaterials,
  restoreMaterials,
  uploadMaterials,
} from '@/services/material';
import MaterialWorkspace from './material-workspace';

const KB_ID = 'kb-1';

const MATERIAL: MaterialRecord = {
  materialId: 'mat-1',
  kbId: KB_ID,
  materialType: 'DOCUMENT',
  title: '护理管理制度',
  sourceType: 'LOCAL',
  categoryId: 'cat-1',
  materialStatus: 'ACTIVE',
  fingerprint: 'fp-0001',
  currentVersionId: 'v-1',
  versionNo: 1,
  fileName: '护理管理制度.md',
  fileExt: 'md',
  sizeBytes: 2048,
  versionStatus: 'PARSED',
  parseStatus: 'READY',
  compileStatus: 'NOT_COMPILED',
  governanceStatus: 'NORMAL',
  registeredBy: 1,
  registeredAt: '2026-10-26T09:00:00',
  updateTime: '2026-10-26T09:00:00',
};

const DETAIL: MaterialDetailRecord = {
  material: MATERIAL,
  versions: [
    {
      versionId: 'v-1',
      versionNo: 1,
      fileName: '护理管理制度.md',
      fileExt: 'md',
      sizeBytes: 2048,
      fingerprint: 'fp-0001',
      versionStatus: 'PARSED',
      registeredAt: '2026-10-26T09:00:00',
    },
  ],
  currentDraft: {
    draftId: 'draft-1',
    status: 'READY',
    parserName: 'local-text',
    parserVersion: 'v1',
    parsedAt: '2026-10-26T09:01:00',
    textContent: '# 护理管理制度\n护士长负责病区护理质量与排班管理。',
    textLength: 27,
  },
};

const CATEGORY_TREE: CategoryNode[] = [
  { categoryId: 'cat-1', name: '护理制度', sortNo: 1, children: [] },
];

function page(records: MaterialRecord[]) {
  return { records, total: records.length, size: 10, current: 1 };
}

function job(overrides: Partial<CompilationJobRecord> = {}): CompilationJobRecord {
  return {
    jobId: 'job-1',
    kbId: KB_ID,
    materialId: 'mat-1',
    materialVersionId: 'v-1',
    pipelineType: 'DOCUMENT',
    configVersion: 'cfg-1',
    compilerVersion: 'local-chunker-v2',
    runStatus: 'RUNNING',
    milestone: 'P2',
    currentStage: 'CHUNK',
    chunkCount: 0,
    reused: false,
    stages: [],
    ...overrides,
  };
}

/** 页脚「编译」按钮与页签同名，按 class + 文案定位。 */
function footerButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.className.includes('btn sm') && item.textContent?.trim() === text,
  );
  if (!button) {
    throw new Error(`未找到按钮：${text}`);
  }
  return button;
}

async function flushAsync() {
  await act(async () => {});
}

/** 挂载工作台并等待首屏列表与分类树落定。 */
async function renderWorkspace() {
  const view = render(<MaterialWorkspace kbId={KB_ID} canManage />);
  await screen.findByRole('button', { name: '护理管理制度' });
  await waitFor(() => expect(getCategoryTree).toHaveBeenCalledWith(KB_ID));
  expect(screen.getByText('护理制度')).toBeTruthy();
  return view;
}

describe('资料工作台页面链路', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pageMaterial).mockResolvedValue(page([MATERIAL]));
    vi.mocked(pageDeletedMaterials).mockResolvedValue(page([]));
    vi.mocked(getCategoryTree).mockResolvedValue(CATEGORY_TREE);
    vi.mocked(getMaterial).mockResolvedValue(DETAIL);
    vi.mocked(getCompilationByMaterial).mockResolvedValue(undefined);
    vi.mocked(getCompilationByJob).mockResolvedValue(undefined);
    vi.mocked(listCompilationChunks).mockResolvedValue([]);
    vi.mocked(isCompilationActive).mockImplementation((status?: string) =>
      status === 'QUEUED' || status === 'RUNNING' || status === 'PAUSED',
    );
    vi.mocked(uploadMaterials).mockResolvedValue([
      {
        fileName: '交接班规范.md',
        success: true,
        duplicated: false,
        materialId: 'mat-2',
        versionId: 'v-2',
        parseStatus: 'READY',
        message: '已登记',
      },
    ]);
    vi.mocked(removeMaterials).mockResolvedValue([
      { materialId: 'mat-1', success: true, message: '已删除' },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('加载资料列表：按库与类型取数，并渲染分类树、统计与状态', async () => {
    await renderWorkspace();

    expect(pageMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: KB_ID, materialType: 'DOCUMENT', current: 1 }),
    );
    expect(screen.getByText(/共 1 条/)).toBeTruthy();
    expect(screen.getByText('生效')).toBeTruthy();
    expect(screen.getByText('已解析')).toBeTruthy();
  });

  it('资料树把接入源与知识库节点渲染成只读来源节点', async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([
      {
        categoryId: 'src-1',
        name: '产品语雀',
        sortNo: 1,
        nodeKind: 'SOURCE',
        ext: { sourceId: 's-1', provider: 'YUQUE' },
        children: [
          {
            categoryId: 'book-1',
            parentId: 'src-1',
            name: '知识中台',
            sortNo: 1,
            nodeKind: 'SOURCE_BOOK',
            ext: { sourceId: 's-1', provider: 'YUQUE', namespace: 'xr4hwk/unn4rb' },
            children: [],
          },
        ],
      },
    ]);

    render(<MaterialWorkspace kbId={KB_ID} canManage />);

    expect(await screen.findByText('产品语雀')).toBeTruthy();
    expect(screen.getByText('知识中台')).toBeTruthy();
    expect(screen.queryByText('语雀')).toBeNull();
    expect(screen.queryByTitle('在「产品语雀」下新建子分类')).toBeNull();
    expect(screen.queryByTitle('在「知识中台」下新建子分类')).toBeNull();
    expect(screen.queryByTitle('重命名分类')).toBeNull();
    expect(screen.queryByTitle('删除该分类')).toBeNull();
  });

  it('搜索按关键字重新取列表，并回到第一页', async () => {
    await renderWorkspace();

    fireEvent.change(screen.getByPlaceholderText('搜索标题'), {
      target: { value: '护理' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));

    await waitFor(() =>
      expect(pageMaterial).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: '护理', current: 1 }),
      ),
    );
  });

  it('打开详情后可发起编译，轮询到完成后提示检索块并刷新列表', async () => {
    const { container } = await renderWorkspace();
    const before = vi.mocked(pageMaterial).mock.calls.length;

    vi.mocked(runCompilation).mockResolvedValue(job());
    vi.mocked(getCompilationByJob).mockResolvedValue(
      job({ runStatus: 'COMPLETED', milestone: 'P3', chunkCount: 6 }),
    );

    fireEvent.click(screen.getByRole('button', { name: '护理管理制度' }));
    expect(await screen.findByText('护理管理制度.md')).toBeTruthy();
    expect(await screen.findByText('未编译')).toBeTruthy();

    vi.useFakeTimers();
    fireEvent.click(footerButton(container, '编译'));
    await flushAsync();

    expect(runCompilation).toHaveBeenCalledWith('mat-1', 'v-1');
    expect(screen.getByText('编译已提交')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    // waitFor 在假定时器下会走真实计时，先恢复真实定时器再断言异步刷新。
    vi.useRealTimers();
    await flushAsync();

    expect(getCompilationByJob).toHaveBeenCalledWith('job-1');
    expect(listCompilationChunks).toHaveBeenCalledWith('mat-1', 'v-1');
    expect(screen.getByText('编译完成')).toBeTruthy();
    expect(screen.getByText(/M1 已达成 · 检索块 6 个/)).toBeTruthy();
    expect(vi.mocked(pageMaterial).mock.calls.length).toBeGreaterThan(before);
  });

  it('上传资料：选择文件后提交，成功后提示并刷新列表', async () => {
    await renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: /上传资料/ }));
    // 弹窗 portal 到 body，文件输入不在渲染容器内。
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['# 交接班规范'], '交接班规范.md', { type: 'text/markdown' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('交接班规范.md')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '开始上传' }));
    await flushAsync();

    expect(uploadMaterials).toHaveBeenCalledWith(KB_ID, undefined, [file]);
    expect(screen.getByText('上传完成')).toBeTruthy();
    await waitFor(() => expect(vi.mocked(pageMaterial).mock.calls.length).toBeGreaterThan(2));
  });

  it('删除资料需二次确认，确认后调用批量删除', async () => {
    await renderWorkspace();

    fireEvent.click(screen.getAllByTitle('删除')[0]);
    expect(await screen.findByText('删除资料')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await flushAsync();

    expect(removeMaterials).toHaveBeenCalledWith(KB_ID, ['mat-1']);
  });

  it('回收站弹窗：列出已删除资料，可取回或彻底删除', async () => {
    vi.mocked(pageDeletedMaterials).mockResolvedValue(page([{ ...MATERIAL, title: '过期制度' }]));
    vi.mocked(restoreMaterials).mockResolvedValue([
      { materialId: 'mat-1', success: true, message: '已恢复' },
    ]);
    vi.mocked(purgeMaterials).mockResolvedValue([
      { materialId: 'mat-1', success: true, message: '已彻底删除' },
    ]);
    await renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: /回收站/ }));

    expect(await screen.findByText('过期制度')).toBeTruthy();
    expect(pageDeletedMaterials).toHaveBeenCalledWith(
      expect.objectContaining({ kbId: KB_ID, materialType: 'DOCUMENT', current: 1 }),
    );

    fireEvent.change(screen.getByPlaceholderText('搜索已删除资料标题'), {
      target: { value: '过期' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('搜索已删除资料标题'), { key: 'Enter' });
    await waitFor(() =>
      expect(pageDeletedMaterials).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: '过期', current: 1 }),
      ),
    );
    await screen.findByText('过期制度');

    fireEvent.click(screen.getByTitle('取回'));
    await flushAsync();
    expect(restoreMaterials).toHaveBeenCalledWith(KB_ID, ['mat-1']);

    await screen.findByText('过期制度');
    fireEvent.click(screen.getByTitle('彻底删除'));
    expect(await screen.findByText('彻底删除资料')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认彻底删除' }));
    await flushAsync();

    expect(purgeMaterials).toHaveBeenCalledWith(KB_ID, ['mat-1']);
  });
});
