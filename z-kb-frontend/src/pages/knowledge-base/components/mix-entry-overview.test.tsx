import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaterialDetailRecord, MaterialRecord } from '@/services/material';
import type { MixEntry } from '../mix-entry-model';
import MixEntryOverview from './mix-entry-overview';

vi.mock('@/pages/ai/agent-ask', () => ({
  AgentAskButton: ({ label }: { label?: string }) => (
    <button type="button">{label || '问 AI'}</button>
  ),
}));

const MATERIAL: MaterialRecord = {
  materialId: 'mat-1',
  kbId: 'kb-1',
  materialType: 'DOCUMENT',
  title: '排班管理制度',
  sourceType: 'UPLOAD',
  categoryId: null,
  materialStatus: 'ACTIVE',
  fingerprint: 'fp-1',
  currentVersionId: 'v-1',
  versionNo: 1,
  versionStatus: 'ACTIVE',
  fileName: '排班管理制度.md',
  fileExt: 'md',
  sizeBytes: 1024,
  parseStatus: 'READY',
  compileStatus: 'NONE',
  governanceStatus: 'NORMAL',
  registeredBy: 1,
  registeredAt: '2026-10-01T10:00:00',
  updateTime: '2026-10-02T11:00:00',
};

const ENTRY: MixEntry = { material: MATERIAL, type: 'document' };

const DETAIL: MaterialDetailRecord = {
  material: MATERIAL,
  versions: [
    {
      versionId: 'v-1',
      versionNo: 1,
      fileName: '排班管理制度.md',
      sizeBytes: 1024,
      fingerprint: 'fp-1',
      versionStatus: 'ACTIVE',
    },
  ],
  currentDraft: {
    draftId: 'd-1',
    status: 'READY',
    parserName: 'MinerU',
    parserVersion: '2.1',
    parsedAt: '2026-10-01T10:05:00',
    textContent: '排'.repeat(1500),
    textLength: 1500,
  },
};

function renderOverview(overrides: Partial<Parameters<typeof MixEntryOverview>[0]> = {}) {
  return render(
    <MixEntryOverview
      kbId="kb-1"
      entry={ENTRY}
      detail={DETAIL}
      detailLoading={false}
      entryPath="院级制度 / 排班管理制度.md"
      scopeEntries={[ENTRY]}
      scopeLabel="全部条目"
      folderCount={1}
      total={1}
      filterActive={false}
      activeFolderId=""
      canWrite
      canCompile
      compileBusy={false}
      reparseBusy={false}
      onUpload={vi.fn()}
      onNewFolder={vi.fn()}
      onClearFilters={vi.fn()}
      onDownload={vi.fn()}
      onReparse={vi.fn()}
      onCompile={vi.fn()}
      onOpenDetail={vi.fn()}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('混合库条目概览', () => {
  it('展示条目原始数据、类型属性与解析文本预览', () => {
    renderOverview();

    expect(screen.getByText('排班管理制度')).toBeTruthy();
    expect(screen.getByText('文档')).toBeTruthy();
    expect(screen.getAllByText('院级制度 / 排班管理制度.md')).toHaveLength(2);
    expect(screen.getByText('条目 ID')).toBeTruthy();
    expect(screen.getByText('mat-1')).toBeTruthy();
    expect(screen.getByText('文档（document）')).toBeTruthy();
    expect(screen.getByText('1.0 KB')).toBeTruthy();
    expect(screen.getByText('v1 · ACTIVE')).toBeTruthy();
    expect(screen.getByText('actorId 1')).toBeTruthy();
    expect(screen.getByText('2026-10-01 10:00')).toBeTruthy();
    expect(screen.getByText('fp-1')).toBeTruthy();

    expect(screen.getByText('MinerU@2.1')).toBeTruthy();
    expect(screen.getByText('1500 字')).toBeTruthy();
    expect(screen.getByText('仅展示前 1200 字，共 1500 字。')).toBeTruthy();
    expect(document.querySelector('.mix-preview')?.textContent).toHaveLength(1200);
  });

  it('概览操作按钮回传条目', () => {
    const onDownload = vi.fn();
    const onReparse = vi.fn();
    const onCompile = vi.fn();
    const onOpenDetail = vi.fn();
    renderOverview({ onDownload, onReparse, onCompile, onOpenDetail });

    fireEvent.click(screen.getByRole('button', { name: '下载原件' }));
    expect(onDownload).toHaveBeenCalledWith(ENTRY);
    fireEvent.click(screen.getByRole('button', { name: 'Wiki' }));
    expect(onOpenDetail).toHaveBeenCalledWith(ENTRY, 'wiki');
    fireEvent.click(screen.getByRole('button', { name: '图谱' }));
    expect(onOpenDetail).toHaveBeenCalledWith(ENTRY, 'graph');
    fireEvent.click(screen.getByRole('button', { name: '编译' }));
    expect(onCompile).toHaveBeenCalledWith(ENTRY);
    fireEvent.click(screen.getByRole('button', { name: '重新解析' }));
    expect(onReparse).toHaveBeenCalledWith(ENTRY);
    expect(screen.getByRole('button', { name: '问 AI' })).toBeTruthy();
  });

  it('详情加载中或失败时给出提示，失败条目显示重试解析', () => {
    const view = renderOverview({ detail: null, detailLoading: true });
    expect(screen.getByText('正在加载版本与解析稿…')).toBeTruthy();
    expect(screen.getByText('正在加载解析文本…')).toBeTruthy();

    view.unmount();
    renderOverview({
      detail: null,
      detailLoading: false,
      entry: { material: { ...MATERIAL, parseStatus: 'FAILED' }, type: 'document' },
    });
    expect(screen.getByText('详情未加载成功，当前仅展示列表字段。')).toBeTruthy();
    expect(screen.getByText('当前没有可展示的解析文本。')).toBeTruthy();
    expect(screen.getByText('重试解析')).toBeTruthy();
    expect(screen.getAllByText('解析失败')).toHaveLength(2);
  });

  it('未选中条目时展示范围统计与类型分布', () => {
    const tableEntry: MixEntry = {
      material: {
        ...MATERIAL,
        materialId: 'mat-2',
        title: '排班表',
        materialType: 'DATA_TABLE',
        fileExt: 'xlsx',
        parseStatus: 'PARSING',
      },
      type: 'table',
    };
    const { container } = renderOverview({
      entry: null,
      detail: null,
      detailLoading: false,
      scopeEntries: [ENTRY, tableEntry],
      total: 5,
      folderCount: 2,
    });

    expect(screen.getByText('全部条目')).toBeTruthy();
    expect(screen.getByText('2 条 · 全库 5 条')).toBeTruthy();
    const values = Array.from(container.querySelectorAll('.stat .value')).map(
      (node) => node.textContent,
    );
    expect(values).toEqual(['2', '2', '2', '1']);
    expect(screen.getByText('类型分布')).toBeTruthy();
    expect(screen.getByText('表格')).toBeTruthy();
    expect(screen.getByText('文档')).toBeTruthy();
  });

  it('无条目时按筛选、目录与空库展示不同空态', () => {
    const view = renderOverview({
      entry: null,
      detail: null,
      scopeEntries: [],
      filterActive: true,
      onClearFilters: vi.fn(),
    });
    expect(screen.getByText('当前筛选下没有条目')).toBeTruthy();
    const clear = screen.getByRole('button', { name: '清空筛选' });
    fireEvent.click(clear);

    view.unmount();
    const upload = vi.fn();
    const view2 = renderOverview({
      entry: null,
      detail: null,
      scopeEntries: [],
      activeFolderId: 'cat-1',
      onUpload: upload,
    });
    expect(screen.getByText('这个目录还没有条目')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '上传到此目录' }));
    expect(upload).toHaveBeenCalled();

    view2.unmount();
    renderOverview({
      entry: null,
      detail: null,
      scopeEntries: [],
      folderCount: 2,
    });
    expect(screen.getByText('目录已就绪，还没有条目')).toBeTruthy();
    expect(screen.getByRole('button', { name: '新建目录' })).toBeTruthy();
  });
});
