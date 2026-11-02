import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNode } from '@/services/category';
import type { MaterialRecord } from '@/services/material';
import { buildMixTree, MIX_ENTRY_TYPES, type MixEntry, type MixEntryType } from '../mix-entry-model';
import MixEntryTreePanel from './mix-entry-tree-panel';

const CATEGORIES: CategoryNode[] = [
  {
    categoryId: 'cat-1',
    name: '院级制度',
    sortNo: 1,
    children: [{ categoryId: 'cat-2', parentId: 'cat-1', name: '心血管', sortNo: 1 }],
  },
];

function material(
  id: string,
  title: string,
  categoryId: string | null,
  partial: Partial<MaterialRecord> = {},
): MaterialRecord {
  return {
    materialId: id,
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title,
    sourceType: 'UPLOAD',
    categoryId,
    materialStatus: 'ACTIVE',
    fingerprint: `fp-${id}`,
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
    ...partial,
  };
}

const ENTRIES: MixEntry[] = [
  { material: material('mat-1', '排班管理制度', 'cat-1', { parseStatus: 'READY' }), type: 'document' },
  { material: material('mat-2', '排班表', 'cat-2', { parseStatus: 'PARSING' }), type: 'table' },
  { material: material('mat-3', '排班图片', null, { parseStatus: 'FAILED' }), type: 'image' },
];

const MODEL = buildMixTree(CATEGORIES, ENTRIES);

const TYPE_COUNTS = MIX_ENTRY_TYPES.reduce(
  (acc, type) => {
    acc[type] = ENTRIES.filter((entry) => entry.type === type).length;
    return acc;
  },
  {} as Record<MixEntryType, number>,
);

function renderPanel(overrides: Partial<Parameters<typeof MixEntryTreePanel>[0]> = {}) {
  return render(
    <MixEntryTreePanel
      model={MODEL}
      allCount={3}
      loadedCount={3}
      total={3}
      truncated={false}
      typeCounts={TYPE_COUNTS}
      query=""
      onQueryChange={vi.fn()}
      typeFilter="all"
      onTypeFilterChange={vi.fn()}
      activeFolderId=""
      selectedEntryId=""
      collapsed={new Set()}
      onToggleFolder={vi.fn()}
      onSelectFolder={vi.fn()}
      onSelectEntry={vi.fn()}
      onUpload={vi.fn()}
      onNewFolder={vi.fn()}
      onRemoveFolder={vi.fn()}
      canWrite
      filterActive={false}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('混合库条目树', () => {
  it('按目录层级展示条目、计数与解析状态', () => {
    renderPanel();

    expect(screen.getByText('条目树')).toBeTruthy();
    expect(screen.getByText('院级制度')).toBeTruthy();
    expect(screen.getByText('心血管')).toBeTruthy();
    expect(screen.getByText('排班管理制度')).toBeTruthy();
    expect(screen.getByText('排班表')).toBeTruthy();
    expect(screen.getByText('未分类条目')).toBeTruthy();
    expect(screen.getByText('排班图片')).toBeTruthy();
    expect(screen.getByText('全部条目')).toBeTruthy();

    expect(screen.getByText('排班管理制度').closest('.tree-item')?.getAttribute('title')).toBe(
      '排班管理制度 · 文档 · 已解析',
    );
    expect(screen.getByText('排班表').closest('.tree-item')?.getAttribute('title')).toBe(
      '排班表 · 表格 · 解析中',
    );
  });

  it('目录切换、条目选中、搜索与类型筛选都触发回调', () => {
    const ctrl = {
      onQueryChange: vi.fn(),
      onTypeFilterChange: vi.fn(),
      onSelectFolder: vi.fn(),
      onSelectEntry: vi.fn(),
      onToggleFolder: vi.fn(),
    };
    renderPanel(ctrl);

    fireEvent.click(screen.getByText('院级制度'));
    expect(ctrl.onSelectFolder).toHaveBeenCalledWith('cat-1');
    fireEvent.click(screen.getByText('全部条目'));
    expect(ctrl.onSelectFolder).toHaveBeenCalledWith('');
    fireEvent.click(screen.getByText('排班表'));
    expect(ctrl.onSelectEntry).toHaveBeenCalledWith('mat-2');

    fireEvent.click(screen.getAllByLabelText('收起目录')[0]);
    expect(ctrl.onToggleFolder).toHaveBeenCalledWith('cat-1');

    fireEvent.change(screen.getByPlaceholderText('搜索条目名称'), {
      target: { value: '排班' },
    });
    expect(ctrl.onQueryChange).toHaveBeenCalledWith('排班');

    fireEvent.click(screen.getByRole('button', { name: /^表格/ }));
    expect(ctrl.onTypeFilterChange).toHaveBeenCalledWith('table');
    fireEvent.click(screen.getByRole('button', { name: /^全部/ }));
    expect(ctrl.onTypeFilterChange).toHaveBeenCalledWith('all');
  });

  it('折叠目录后隐藏子目录与条目，选中目录展示底部删除入口', () => {
    const onRemoveFolder = vi.fn();
    renderPanel({
      collapsed: new Set(['cat-1']),
      activeFolderId: 'cat-1',
      onRemoveFolder,
    });

    expect(screen.getByText('院级制度')).toBeTruthy();
    expect(screen.queryByText('心血管')).toBeNull();
    expect(screen.queryByText('排班管理制度')).toBeNull();
    expect(screen.getByText('院级制度 · 2 条')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '删除目录' }));
    expect(onRemoveFolder).toHaveBeenCalled();
  });

  it('空库、筛选无结果与截断提示分别展示', () => {
    const view = renderPanel({
      model: { roots: [], unclassified: [], folderCount: 0 },
      allCount: 0,
      typeCounts: MIX_ENTRY_TYPES.reduce(
        (acc, type) => ({ ...acc, [type]: 0 }),
        {} as Record<MixEntryType, number>,
      ),
    });
    expect(screen.getByText('还没有目录或条目')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '上传条目' }).length).toBeGreaterThan(0);

    view.unmount();
    const view2 = renderPanel({ filterActive: true, allCount: 0 });
    expect(screen.getByText('没有匹配的条目')).toBeTruthy();
    expect(screen.getByText('清空关键词或类型筛选再试。')).toBeTruthy();

    view2.unmount();
    renderPanel({ truncated: true, total: 9, loadedCount: 3 });
    expect(screen.getByText('仅加载前 3 条，共 9 条')).toBeTruthy();
  });

  it('无写权限时不展示新建、上传与删除入口', () => {
    renderPanel({ canWrite: false, activeFolderId: 'cat-1' });

    expect(screen.queryByTitle('新建目录')).toBeNull();
    expect(screen.queryByTitle('上传条目')).toBeNull();
    expect(screen.queryByRole('button', { name: '删除目录' })).toBeNull();
  });
});
