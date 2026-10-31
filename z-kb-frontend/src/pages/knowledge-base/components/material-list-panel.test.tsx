import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaterialRecord } from '@/services/material';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';
import MaterialListPanel from './material-list-panel';

const RECORDS: MaterialRecord[] = [
  {
    materialId: 'mat-123456789',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '排班管理制度',
    sourceType: 'UPLOAD',
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
  {
    materialId: 'mat-2',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '交接班规范',
    sourceType: 'UPLOAD',
    categoryId: null,
    materialStatus: 'REGISTERED',
    fingerprint: 'fp-2',
    sizeBytes: 1024,
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
    registeredAt: '2026-10-27T10:30:00',
  },
];

function createCtrl(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    keyword: '',
    setKeyword: vi.fn(),
    queryKeyword: '',
    page: 1,
    setPage: vi.fn(),
    records: RECORDS,
    total: 2,
    totalPages: 1,
    loading: false,
    selected: [],
    busy: false,
    currentCategory: undefined,
    categoryId: '',
    canWrite: true,
    canCompile: true,
    materialType: 'DOCUMENT',
    refreshAll: vi.fn(),
    applySearch: vi.fn(),
    clearSearch: vi.fn(),
    selectCategory: vi.fn(),
    openUpload: vi.fn(),
    openBatch: vi.fn(),
    askRemove: vi.fn(),
    setMoveOpen: vi.fn(),
    toggleAll: vi.fn(),
    toggleSelected: vi.fn(),
    openDetail: vi.fn(),
    download: vi.fn(),
    ...overrides,
  } as unknown as MaterialWorkspaceController;
}

afterEach(() => {
  cleanup();
});

describe('资料列表面板', () => {
  it('把资料字段映射成表格行与状态标签', () => {
    render(<MaterialListPanel ctrl={createCtrl()} />);

    expect(screen.getByText('排班管理制度')).toBeTruthy();
    expect(screen.getByText('mat-1234')).toBeTruthy();
    expect(screen.getByText('交接班规范')).toBeTruthy();
    expect(screen.getAllByText('文档')).toHaveLength(2);
    expect(screen.getByText('2.0 KB')).toBeTruthy();
    expect(screen.getByText('1.0 KB')).toBeTruthy();
    expect(screen.getByText('生效')).toBeTruthy();
    expect(screen.getByText('已登记')).toBeTruthy();
    expect(screen.getByText('已解析')).toBeTruthy();
    expect(screen.getByText('10-26 09:00')).toBeTruthy();
    expect(screen.getByText('共 2 条 · 第 1/1 页')).toBeTruthy();
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  });

  it('搜索、全选、单选、分类筛选与翻页都转成控制器回调', () => {
    const ctrl = createCtrl({ total: 25, totalPages: 3, selected: ['mat-2'] });
    render(<MaterialListPanel ctrl={ctrl} />);

    fireEvent.change(screen.getByPlaceholderText('搜索标题'), {
      target: { value: '排班' },
    });
    expect(ctrl.setKeyword).toHaveBeenCalledWith('排班');
    fireEvent.keyDown(screen.getByPlaceholderText('搜索标题'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(ctrl.applySearch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByLabelText('全选'));
    expect(ctrl.toggleAll).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('选择 交接班规范'));
    expect(ctrl.toggleSelected).toHaveBeenCalledWith('mat-2');

    fireEvent.click(screen.getByRole('button', { name: /移动分类/ }));
    expect(ctrl.setMoveOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: /知识编译/ }));
    expect(ctrl.openBatch).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    const updater = vi.mocked(ctrl.setPage).mock.calls[0][0] as (prev: number) => number;
    expect(updater(1)).toBe(2);
    expect(screen.getByText('共 25 条 · 第 1/3 页')).toBeTruthy();
  });

  it('已选分类展示筛选标签，点击后清除分类', () => {
    const ctrl = createCtrl({ categoryId: 'cat-1', currentCategory: { categoryId: 'cat-1', name: '护理制度', sortNo: 1 } });
    render(<MaterialListPanel ctrl={ctrl} />);

    fireEvent.click(screen.getByRole('button', { name: /护理制度/ }));
    expect(ctrl.selectCategory).toHaveBeenCalledWith('');
  });

  it('行内操作打开详情、下载与删除，空态按原因区分', () => {
    const ctrl = createCtrl();
    const view = render(<MaterialListPanel ctrl={ctrl} />);

    fireEvent.click(screen.getByRole('button', { name: '排班管理制度' }));
    expect(ctrl.openDetail).toHaveBeenCalledWith('mat-123456789');
    fireEvent.click(screen.getAllByTitle('下载原件')[0]);
    expect(ctrl.download).toHaveBeenCalledWith('mat-123456789', '排班管理制度.md');
    fireEvent.click(screen.getAllByTitle('删除')[0]);
    expect(ctrl.askRemove).toHaveBeenCalledWith(['mat-123456789']);

    view.unmount();
    const emptyCtrl = createCtrl({ records: [], queryKeyword: 'x' });
    render(<MaterialListPanel ctrl={emptyCtrl} />);
    expect(screen.getByText('没有匹配的资料')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清空搜索' }));
    expect(emptyCtrl.clearSearch).toHaveBeenCalled();
  });
});
