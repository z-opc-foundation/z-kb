import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNode } from '@/services/category';
import type { MaterialRecord } from '@/services/material';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';
import MaterialTreePanel from './material-tree-panel';

const TREE: CategoryNode[] = [
  {
    categoryId: 'cat-1',
    name: '护理制度',
    sortNo: 1,
    children: [{ categoryId: 'cat-2', parentId: 'cat-1', name: '心血管', sortNo: 1 }],
  },
];

const MATERIALS: MaterialRecord[] = [
  {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '排班管理制度',
    sourceType: 'UPLOAD',
    categoryId: 'cat-1',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-1',
    fileExt: 'md',
    parseStatus: 'READY',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  {
    materialId: 'mat-2',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '交接班规范',
    sourceType: 'UPLOAD',
    categoryId: null,
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-2',
    fileExt: 'txt',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
];

function createCtrl(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tree: TREE,
    categoryId: '',
    canWrite: true,
    canCompile: true,
    materialsByCategory: new Map([
      ['cat-1', [MATERIALS[0]]],
      ['', [MATERIALS[1]]],
    ]),
    categoryCounts: new Map([
      ['cat-1', 1],
      ['cat-2', 0],
    ]),
    collapsed: new Set<string>(),
    dragMaterialId: '',
    dragCategoryId: '',
    dropTargetId: null,
    editingCategoryId: '',
    editingCategoryName: '',
    treeMaterials: MATERIALS,
    libraryTotal: 5,
    recycle: { count: 2, openRecycle: vi.fn() },
    setEditingCategoryName: vi.fn(),
    setDragMaterialId: vi.fn(),
    setDragCategoryId: vi.fn(),
    setDropTargetId: vi.fn(),
    selectCategory: vi.fn(),
    toggleCollapsed: vi.fn(),
    openDetail: vi.fn(),
    openCreateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    beginRename: vi.fn(),
    cancelRename: vi.fn(),
    commitRename: vi.fn(),
    dropProps: vi.fn(() => ({})),
    rootDropProps: {},
    openNodeBatch: vi.fn(),
    syncSource: vi.fn(),
    ...overrides,
  } as unknown as MaterialWorkspaceController;
}

afterEach(() => {
  cleanup();
});

describe('资料树面板', () => {
  it('按分类层级渲染文件夹、资料与计数，并提示树外总数', () => {
    render(<MaterialTreePanel ctrl={createCtrl()} />);

    expect(screen.getByText('护理制度')).toBeTruthy();
    expect(screen.getByText('心血管')).toBeTruthy();
    expect(screen.getByText('排班管理制度')).toBeTruthy();
    expect(screen.getByText('交接班规范')).toBeTruthy();
    expect(screen.getByText('树内先展示 2 条，共 5 条资料')).toBeTruthy();
    expect(screen.getByText('回收站')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('折叠分类后隐藏子分类与资料节点', () => {
    render(<MaterialTreePanel ctrl={createCtrl({ collapsed: new Set(['cat-1']) })} />);

    expect(screen.getByText('护理制度')).toBeTruthy();
    expect(screen.queryByText('心血管')).toBeNull();
    expect(screen.queryByText('排班管理制度')).toBeNull();
    expect(screen.getByText('交接班规范')).toBeTruthy();
  });

  it('正在查看的资料在树里标记为选中行', () => {
    const { container } = render(<MaterialTreePanel ctrl={createCtrl({ detailId: 'mat-1' })} />);

    const rows = container.querySelectorAll('.tree-item.tree-leaf.active');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('排班管理制度');
  });

  it('选中、折叠、详情、新建、重命名、删除与批任务都触发控制器回调', () => {
    const ctrl = createCtrl({ categoryId: 'cat-1' });
    render(<MaterialTreePanel ctrl={ctrl} />);

    fireEvent.click(screen.getByText('护理制度'));
    expect(ctrl.selectCategory).toHaveBeenCalledWith('');
    fireEvent.click(screen.getByText('心血管'));
    expect(ctrl.selectCategory).toHaveBeenLastCalledWith('cat-2');

    fireEvent.click(screen.getAllByLabelText('收起分类')[0]);
    expect(ctrl.toggleCollapsed).toHaveBeenCalledWith('cat-1');

    fireEvent.click(screen.getByText('排班管理制度'));
    expect(ctrl.openDetail).toHaveBeenCalledWith('mat-1');

    fireEvent.click(screen.getByTitle('新建分类（根目录）'));
    expect(ctrl.openCreateCategory).toHaveBeenCalledWith();
    fireEvent.click(screen.getByTitle('在「护理制度」下新建子分类'));
    expect(ctrl.openCreateCategory).toHaveBeenCalledWith('cat-1');

    fireEvent.doubleClick(screen.getByText('护理制度'));
    expect(ctrl.beginRename).toHaveBeenCalled();
    // 重命名只走双击，行内不再留铅笔按钮
    expect(screen.queryByTitle('重命名分类')).toBeNull();

    // 批任务与删除收进右键菜单，点空白处的行内按钮已不存在
    expect(screen.queryByTitle('按此分类发起批任务')).toBeNull();
    expect(screen.queryByTitle('删除该分类')).toBeNull();
    fireEvent.contextMenu(screen.getByText('护理制度'));
    expect(screen.getByRole('menuitem', { name: '发起批任务' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: '发起批任务' }));
    expect(ctrl.openNodeBatch).toHaveBeenCalled();

    fireEvent.contextMenu(screen.getByText('护理制度'));
    fireEvent.click(screen.getByRole('menuitem', { name: '删除分类' }));
    expect(ctrl.deleteCategory).toHaveBeenCalledWith('cat-1');

    fireEvent.click(screen.getByRole('button', { name: /回收站/ }));
    expect(ctrl.recycle.openRecycle).toHaveBeenCalled();
  });

  it('重命名输入回车提交、Esc 取消', () => {
    const ctrl = createCtrl({
      editingCategoryId: 'cat-1',
      editingCategoryName: '护理制度',
    });
    render(<MaterialTreePanel ctrl={ctrl} />);

    const input = screen.getByLabelText('分类名称');
    fireEvent.change(input, { target: { value: '护理核心制度' } });
    expect(ctrl.setEditingCategoryName).toHaveBeenCalledWith('护理核心制度');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(ctrl.commitRename).toHaveBeenCalledWith(TREE[0]);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(ctrl.cancelRename).toHaveBeenCalled();
  });

  it('接入源节点只读：来源由节点图标表达，不另加文案标签', () => {
    const sourceTree: CategoryNode[] = [
      {
        categoryId: 'src-1',
        name: '产品语雀',
        sortNo: 1,
        nodeKind: 'SOURCE',
        ext: { provider: 'YUQUE' },
      },
    ];
    render(
      <MaterialTreePanel
        ctrl={createCtrl({
          tree: sourceTree,
          materialsByCategory: new Map(),
          categoryCounts: new Map(),
          treeMaterials: [],
          libraryTotal: 0,
        })}
      />,
    );

    expect(screen.getByText('产品语雀')).toBeTruthy();
    expect(screen.queryByText('语雀')).toBeNull();
    expect(screen.queryByText('来源')).toBeNull();
    expect(screen.queryByTitle('在「产品语雀」下新建子分类')).toBeNull();
    expect(screen.queryByTitle('重命名分类')).toBeNull();
    expect(screen.queryByTitle('删除该分类')).toBeNull();
    expect(screen.queryByText('树内先展示 0 条，共 5 条资料')).toBeNull();
  });

  it('语雀接入源节点提供同步入口，点击回调该节点', () => {
    const sourceTree: CategoryNode[] = [
      {
        categoryId: 'src-1',
        name: '产品语雀',
        sortNo: 1,
        nodeKind: 'SOURCE',
        ext: { provider: 'YUQUE', sourceId: 's-1' },
        children: [
          {
            categoryId: 'book-1',
            parentId: 'src-1',
            name: '知识中台',
            sortNo: 1,
            nodeKind: 'SOURCE_BOOK',
            ext: { provider: 'YUQUE', sourceId: 's-1', namespace: 'xr4hwk/unn4rb' },
          },
        ],
      },
    ];
    const onSyncSource = vi.fn();
    const ctrl = createCtrl({
      tree: sourceTree,
      materialsByCategory: new Map(),
      categoryCounts: new Map(),
      treeMaterials: [],
      libraryTotal: 0,
    });
    const { container } = render(<MaterialTreePanel ctrl={ctrl} onSyncSource={onSyncSource} />);

    const sync = screen.getByTitle('同步「产品语雀」：勾选要同步的语雀知识库与文章');
    expect(screen.getAllByTitle(/^同步「/)).toHaveLength(1);
    expect(screen.queryByTitle('同步「知识中台」：勾选要同步的语雀知识库与文章')).toBeNull();
    const sourceRow = container.querySelectorAll('.tree-bound')[0];
    expect(sourceRow.querySelector('[title^="按此分类发起批任务"]')).toBeNull();
    fireEvent.click(sync);
    expect(onSyncSource).toHaveBeenCalledWith(sourceTree[0]);
    expect(ctrl.openNodeBatch).not.toHaveBeenCalled();
  });

  it('Git 接入源节点同步整个仓库，项目节点只读且可发起批任务', () => {
    const sourceTree: CategoryNode[] = [
      {
        categoryId: 'src-git',
        name: '代码库',
        sortNo: 1,
        nodeKind: 'SOURCE',
        ext: { provider: 'GIT', sourceId: 's-git' },
        children: [
          {
            categoryId: 'repo-1',
            parentId: 'src-git',
            name: 'c2f/future-brain',
            sortNo: 1,
            nodeKind: 'SOURCE_REPO',
            ext: { provider: 'GIT', sourceId: 's-git', repo: 'c2f/future-brain' },
          },
        ],
      },
    ];
    const ctrl = createCtrl({
      tree: sourceTree,
      materialsByCategory: new Map(),
      categoryCounts: new Map(),
      treeMaterials: [],
      libraryTotal: 0,
    });
    render(<MaterialTreePanel ctrl={ctrl} />);

    fireEvent.click(screen.getByTitle('同步「代码库」：拉取仓库最新的项目结构与文档'));
    expect(ctrl.syncSource).toHaveBeenCalledWith('s-git');
    expect(screen.queryByTitle('同步「c2f/future-brain」：拉取仓库最新的项目结构与文档')).toBeNull();
    expect(screen.queryByTitle('重命名分类')).toBeNull();
    // 只读的接入源/仓库节点右键仍可发起批任务，但没有改名与删除
    fireEvent.contextMenu(screen.getByText('代码库'));
    expect(screen.getByRole('menuitem', { name: '发起批任务' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: '重命名' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: '删除分类' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.contextMenu(screen.getByText('c2f/future-brain'));
    fireEvent.click(screen.getByRole('menuitem', { name: '发起批任务' }));
    expect(ctrl.openNodeBatch).toHaveBeenCalledWith(sourceTree[0].children?.[0]);
  });

  it('无写权限时不展示新建入口与回收站', () => {
    render(<MaterialTreePanel ctrl={createCtrl({ canWrite: false, canCompile: false })} />);

    expect(screen.queryByTitle('新建分类（根目录）')).toBeNull();
    expect(screen.queryByText('回收站')).toBeNull();
  });

  it('接入源下的资料与子分类沿用语雀结构，不允许拖动', () => {
    const sourceTree: CategoryNode[] = [
      {
        categoryId: 'src-1',
        name: '产品语雀',
        sortNo: 1,
        nodeKind: 'SOURCE',
        ext: { provider: 'YUQUE' },
        children: [
          {
            categoryId: 'book-1',
            parentId: 'src-1',
            name: '知识中台',
            sortNo: 1,
            nodeKind: 'SOURCE_BOOK',
            children: [{ categoryId: 'sub-1', parentId: 'book-1', name: '一期', sortNo: 1 }],
          },
        ],
      },
    ];
    const yuqueDoc = { ...MATERIALS[0], materialId: 'mat-y', title: 'AI信息流', categoryId: 'book-1', sourceType: 'YUQUE' };
    const nestedDoc = { ...MATERIALS[0], materialId: 'mat-n', title: '嵌套文章', categoryId: 'sub-1', sourceType: 'YUQUE' };
    const localFile = { ...MATERIALS[0], materialId: 'mat-l', title: '本地上传', categoryId: null, sourceType: 'LOCAL' };
    render(
      <MaterialTreePanel
        ctrl={createCtrl({
          tree: sourceTree,
          materialsByCategory: new Map([
            ['book-1', [yuqueDoc]],
            ['sub-1', [nestedDoc]],
            ['', [localFile]],
          ]),
          categoryCounts: new Map(),
          treeMaterials: [yuqueDoc, nestedDoc, localFile],
          libraryTotal: 3,
        })}
      />,
    );

    const rowOf = (title: string) =>
      screen.getByText(title).closest('.tree-item') as HTMLElement;
    expect(rowOf('AI信息流').getAttribute('draggable')).toBe('false');
    expect(rowOf('嵌套文章').getAttribute('draggable')).toBe('false');
    expect(rowOf('一期').getAttribute('draggable')).toBe('false');
    expect(rowOf('本地上传').getAttribute('draggable')).toBe('true');
  });
});
