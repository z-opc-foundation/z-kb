import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MixEntryWorkspace from './mix-entry-workspace';
import { getCategoryTree } from '@/services/category';
import {
  getMaterial,
  pageMaterial,
  uploadMaterials,
  type MaterialDetailRecord,
  type MaterialRecord,
} from '@/services/material';

vi.mock('@/services/category', () => ({
  getCategoryTree: vi.fn(),
  createCategory: vi.fn(),
  removeCategory: vi.fn(),
}));

vi.mock('@/services/material', () => ({
  pageMaterial: vi.fn(),
  getMaterial: vi.fn(),
  uploadMaterials: vi.fn(),
  reparseMaterial: vi.fn(),
  downloadMaterial: vi.fn(),
}));

vi.mock('@/services/compilation', () => ({
  runCompilation: vi.fn(),
  getCompilationByJob: vi.fn(),
  isCompilationActive: vi.fn(() => false),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

vi.mock('@/pages/ai/agent-ask', () => ({
  AgentAskButton: ({ label }: { label?: string }) => (
    <button type="button">{label || '问 AI'}</button>
  ),
}));

function material(
  partial: Partial<MaterialRecord> & Pick<MaterialRecord, 'materialId' | 'title'>,
): MaterialRecord {
  return {
    kbId: 'kb-mix',
    materialType: 'DOCUMENT',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp',
    compileStatus: 'NONE',
    governanceStatus: 'NONE',
    registeredBy: 1,
    ...partial,
  };
}

const docMaterial = material({
  materialId: 'mat-doc',
  title: '排班管理制度',
  entryType: 'DOCUMENT',
  categoryId: 'dir-1',
  fileName: '排班管理制度.pdf',
  fileExt: 'pdf',
  sizeBytes: 4096,
  versionNo: 1,
  versionStatus: 'ACTIVE',
  parseStatus: 'READY',
});

const tableMaterial = material({
  materialId: 'mat-table',
  title: '门诊排班表',
  entryType: 'TABLE',
  categoryId: 'dir-1',
  materialType: 'DATA_TABLE',
  fileName: '门诊排班表.xlsx',
  fileExt: 'xlsx',
  sizeBytes: 20480,
  parseStatus: 'PARSING',
});

const detail: MaterialDetailRecord = {
  material: docMaterial,
  versions: [
    {
      versionId: 'v1',
      versionNo: 1,
      fileName: '排班管理制度.pdf',
      fileExt: 'pdf',
      sizeBytes: 4096,
      fingerprint: 'fp',
      versionStatus: 'ACTIVE',
    },
  ],
  currentDraft: {
    draftId: 'draft-1',
    status: 'READY',
    parserName: 'MinerU',
    parserVersion: '2.1',
    parsedAt: '2026-10-01 10:00:00',
    textContent: '第一条 为规范门诊排班，特制定本制度。',
    textLength: 18,
  },
};

function mockLibrary(records: MaterialRecord[]) {
  vi.mocked(getCategoryTree).mockResolvedValue([
    { categoryId: 'dir-1', name: '院级制度', sortNo: 1, children: [] },
  ]);
  vi.mocked(pageMaterial).mockResolvedValue({
    records,
    total: records.length,
    size: 100,
    current: 1,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMaterial).mockResolvedValue(detail);
  vi.mocked(uploadMaterials).mockResolvedValue([
    {
      fileName: 'a.png',
      success: true,
      duplicated: false,
      message: '已登记',
    },
  ]);
});

afterEach(() => {
  cleanup();
});

describe('混合库条目树工作区', () => {
  it('按目录展开条目，点击条目后展示原始数据概览', async () => {
    mockLibrary([docMaterial, tableMaterial]);
    render(<MixEntryWorkspace kbId="kb-mix" canWrite />);

    await screen.findByText('院级制度');
    expect(screen.getByText('排班管理制度')).toBeInTheDocument();
    expect(screen.getByText('门诊排班表')).toBeInTheDocument();

    fireEvent.click(screen.getByText('排班管理制度'));

    await screen.findByText('原始数据概览');
    expect(screen.getByText('文档（document）')).toBeInTheDocument();
    expect(screen.getByText('4.0 KB')).toBeInTheDocument();
    expect(await screen.findByText('MinerU@2.1')).toBeInTheDocument();
    expect(getMaterial).toHaveBeenCalledWith('mat-doc');
  });

  it('搜索无命中时树与概览都给出筛选空态', async () => {
    mockLibrary([docMaterial, tableMaterial]);
    render(<MixEntryWorkspace kbId="kb-mix" />);

    await screen.findByText('院级制度');
    const search = screen.getByPlaceholderText('搜索条目名称');

    fireEvent.change(search, { target: { value: '排班表' } });
    expect(screen.queryByText('排班管理制度')).not.toBeInTheDocument();
    expect(screen.getByText('门诊排班表')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: '不存在的条目' } });
    expect(await screen.findByText('没有匹配的条目')).toBeInTheDocument();
    expect(screen.getByText('当前筛选下没有条目')).toBeInTheDocument();
  });

  it('在选中目录下上传文件并把目录 ID 传给上传服务', async () => {
    mockLibrary([docMaterial, tableMaterial]);
    render(<MixEntryWorkspace kbId="kb-mix" canWrite />);

    await screen.findByText('院级制度');
    fireEvent.click(screen.getByText('院级制度'));
    fireEvent.click(screen.getByTitle('上传条目'));

    const dialog = await screen.findByRole('dialog');
    const file = new File(['png'], 'a.png', { type: 'image/png' });
    const input = dialog.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('已选 1 个文件');
    fireEvent.click(screen.getByText('开始上传'));

    await waitFor(() =>
      expect(uploadMaterials).toHaveBeenCalledWith('kb-mix', 'dir-1', [file]),
    );
    expect(await screen.findByText('已登记')).toBeInTheDocument();
  });

  it('空混合库不展示示例目录或条目', async () => {
    mockLibrary([]);
    vi.mocked(getCategoryTree).mockResolvedValue([]);
    render(<MixEntryWorkspace kbId="kb-mix" canWrite />);

    expect(await screen.findByText('这个混合库还没有条目')).toBeInTheDocument();
    expect(screen.getByText('还没有目录或条目')).toBeInTheDocument();
    expect(screen.queryByText('院级制度')).not.toBeInTheDocument();
    expect(screen.queryByText('排班管理制度')).not.toBeInTheDocument();
  });
});
