import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAt } from '@/test/render';
import { getCategoryTree } from '@/services/category';
import { pageMaterial } from '@/services/material';
import {
  generateWiki,
  getWikiDetail,
  getWikiLineage,
  listWikiPages,
} from '@/services/wiki';
import { toast } from '@/utils/toast';
import WikiWorkspace from './wiki-workspace';

vi.mock('@/services/wiki', () => ({
  listWikiPages: vi.fn(),
  getWikiDetail: vi.fn(),
  getWikiLineage: vi.fn(),
  generateWiki: vi.fn(),
}));
vi.mock('@/services/material', () => ({ pageMaterial: vi.fn() }));
vi.mock('@/services/category', () => ({ getCategoryTree: vi.fn() }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));
vi.mock('@/pages/ai/agent-ask', () => ({
  AgentAskButton: ({ label }: { label: string }) => (
    <button type="button" data-testid="agent-ask">{label}</button>
  ),
}));
vi.mock('./components/wiki-graph-tab', () => ({
  default: ({ kbId, sourceMaterialIds }: { kbId: string; sourceMaterialIds: string[] }) => (
    <div data-testid="wiki-graph-tab">
      图谱 {kbId} · {sourceMaterialIds.length} 份来源
    </div>
  ),
}));

const PAGES = [
  {
    wikiId: 'wiki-1',
    kbId: 'kb-1',
    materialId: 'mat-1',
    title: '护理排班制度',
    summary: '排班与值班要求',
    pointCount: 8,
    charCount: 2400,
    versionNo: 2,
    sourceCount: 2,
    status: 'READY',
    updateTime: '2026-03-01T08:00:00',
  },
  {
    wikiId: 'wiki-2',
    kbId: 'kb-1',
    materialId: 'mat-2',
    title: '交接班规范',
    summary: null,
    pointCount: 3,
    versionNo: 1,
    status: 'READY',
    updateTime: '2026-02-28T08:00:00',
  },
  {
    wikiId: 'wiki-3',
    kbId: 'kb-1',
    materialId: 'mat-404',
    title: '孤儿页面',
    pointCount: 1,
    versionNo: 1,
    status: 'READY',
  },
];

const MATERIALS = [
  {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '护理排班制度原稿',
    sourceType: 'UPLOAD',
    categoryId: 'c1',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-1',
    parseStatus: 'READY',
    compileStatus: 'COMPILED',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  {
    materialId: 'mat-2',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '交接班规范原稿',
    sourceType: 'UPLOAD',
    categoryId: 'c1',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-2',
    parseStatus: 'READY',
    compileStatus: 'COMPILED',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  {
    materialId: 'mat-3',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '制度汇编',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-3',
    parseStatus: 'READY',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  {
    materialId: 'mat-4',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '待解析制度',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-4',
    parseStatus: 'PARSING',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
];

const DETAIL = {
  page: PAGES[0],
  points: [
    { heading: '排班原则', text: '按班次公平分配。' },
    { heading: '值班要求', text: '节假日双人值班。' },
  ],
  sources: [
    { materialId: 'mat-1', materialVersionId: 'mv-1', materialTitle: '护理排班制度原稿', sourceVersionNo: 3 },
  ],
  graphNodeCount: 4,
};

const LINEAGE = {
  wikiId: 'wiki-1',
  title: '护理排班制度',
  nodes: [
    { nodeId: 'n1', nodeType: 'MATERIAL', label: '护理排班制度原稿', refId: 'mat-1' },
    { nodeId: 'n2', nodeType: 'WIKI', label: '护理排班制度', refId: 'wiki-1' },
    { nodeId: 'n3', nodeType: 'GRAPH', label: '排班公平', refId: 'g-1' },
  ],
  edges: [
    { fromNodeId: 'n1', toNodeId: 'n2', relation: 'SUPPORTS' },
    { fromNodeId: 'n2', toNodeId: 'n3', relation: 'RELATES' },
  ],
  relationTypes: ['SUPPORTS', 'RELATES'],
  sourceCount: 1,
  graphNodeCount: 1,
};

const GENERATED_PAGE = {
  wikiId: 'wiki-9',
  kbId: 'kb-1',
  materialId: 'mat-3',
  title: '制度汇编',
  summary: '新生成的 Wiki',
  pointCount: 1,
  versionNo: 1,
  status: 'READY',
  updateTime: '2026-03-03T08:00:00',
};

function renderWiki(canManage = true, initialWikiId?: string) {
  return renderAt(
    <WikiWorkspace kbId="kb-1" canManage={canManage} initialWikiId={initialWikiId} onChanged={vi.fn()} />,
    { route: '/knowledge-bases/kb-1/workspace' },
  );
}

function leftPanel() {
  return document.querySelector('.wiki-left') as HTMLElement;
}

describe('Wiki 工作区', () => {
  beforeEach(() => {
    vi.mocked(listWikiPages).mockResolvedValue(PAGES as never);
    vi.mocked(getWikiDetail).mockImplementation((wikiId: string) =>
      Promise.resolve(
        (wikiId === 'wiki-9'
          ? { ...DETAIL, page: GENERATED_PAGE }
          : { ...DETAIL, page: PAGES.find((item) => item.wikiId === wikiId) || PAGES[0] }) as never,
      ),
    );
    vi.mocked(getWikiLineage).mockResolvedValue(LINEAGE as never);
    vi.mocked(pageMaterial).mockResolvedValue({
      records: MATERIALS,
      total: MATERIALS.length,
      current: 1,
      size: 100,
    } as never);
    vi.mocked(getCategoryTree).mockResolvedValue([
      { categoryId: 'c1', name: '护理制度', sortNo: 1, children: [] },
    ] as never);
    vi.mocked(generateWiki).mockResolvedValue({
      totalCount: 1,
      successCount: 1,
      failedCount: 0,
      items: [{ materialId: 'mat-3', title: '制度汇编', wikiId: 'wiki-9', status: 'READY' }],
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('加载后展示 Wiki 列表与卡片，并支持关键词搜索', async () => {
    let resolvePages: (value: unknown) => void = () => undefined;
    vi.mocked(listWikiPages).mockImplementation(
      () => new Promise((resolve) => { resolvePages = resolve as (value: unknown) => void; }) as never,
    );

    renderWiki();

    expect(screen.getAllByText('正在加载 Wiki…').length).toBeGreaterThan(0);
    resolvePages(PAGES);

    expect(await screen.findByText('排班与值班要求')).toBeTruthy();
    expect(listWikiPages).toHaveBeenCalledWith('kb-1', undefined, 100);
    expect(pageMaterial).toHaveBeenCalledWith({ kbId: 'kb-1', current: 1, size: 100 });
    expect(getCategoryTree).toHaveBeenCalledWith('kb-1');
    expect(screen.getAllByText('护理排班制度').length).toBeGreaterThan(0);
    expect(screen.getAllByText('交接班规范').length).toBeGreaterThan(0);
    expect(screen.getAllByText('暂无摘要').length).toBe(2);
    expect(screen.getByText('8 个要点')).toBeTruthy();
    expect(screen.getByText('2 份来源')).toBeTruthy();
    expect(screen.getByRole('button', { name: /生成 Wiki/ })).toBeTruthy();

    vi.mocked(listWikiPages).mockResolvedValue([]);
    const search = within(leftPanel()).getByPlaceholderText('搜索标题或摘要');
    fireEvent.change(search, { target: { value: ' 排班 ' } });
    fireEvent.click(within(leftPanel()).getByRole('button', { name: '搜索' }));

    await waitFor(() => expect(listWikiPages).toHaveBeenLastCalledWith('kb-1', '排班', 100));
    expect((await screen.findAllByText('没有匹配的 Wiki')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('关键词：排班').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /生成 Wiki/ })).toBeTruthy();
  });

  it('目录模式按分类分组并可折叠', async () => {
    renderWiki();
    await screen.findByText('排班与值班要求');

    fireEvent.click(within(leftPanel()).getByRole('button', { name: '目录' }));

    expect(within(leftPanel()).getByText('护理制度')).toBeTruthy();
    expect(within(leftPanel()).getByText('目录未覆盖')).toBeTruthy();
    const group = within(leftPanel()).getByText('护理制度');
    expect(within(leftPanel()).getByText('护理排班制度')).toBeTruthy();

    fireEvent.click(group);
    await waitFor(() => expect(within(leftPanel()).queryByText('护理排班制度')).toBeNull());
    expect(within(leftPanel()).getByText('目录未覆盖')).toBeTruthy();

    fireEvent.click(group);
    expect(await within(leftPanel()).findByText('护理排班制度')).toBeTruthy();

    fireEvent.click(within(leftPanel()).getByRole('button', { name: '列表' }));
    expect(within(leftPanel()).getByText('孤儿页面')).toBeTruthy();
  });

  it('选中 Wiki 后查看基本信息、正文、来源、图谱与来源证据', async () => {
    renderWiki();
    await screen.findByText('排班与值班要求');

    fireEvent.click(within(leftPanel()).getByText('护理排班制度'));

    expect(await screen.findByText('v2 · READY')).toBeTruthy();
    expect(getWikiDetail).toHaveBeenCalledWith('wiki-1');
    expect(screen.getByText('排班与值班要求')).toBeTruthy();
    expect(screen.getByText('8 个要点 · 2400 字')).toBeTruthy();
    expect(screen.getByText('1 份')).toBeTruthy();
    expect(screen.getByText('4 个')).toBeTruthy();
    expect(screen.getByTestId('agent-ask')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '正文' }));
    expect(screen.getByText('排班原则')).toBeTruthy();
    expect(screen.getByText('按班次公平分配。')).toBeTruthy();
    expect(screen.getByText('节假日双人值班。')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '来源资料' }));
    expect(screen.getByText('护理排班制度原稿')).toBeTruthy();
    expect(screen.getByText(/mat-1 · v3/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '图谱' }));
    expect(screen.getByTestId('wiki-graph-tab').textContent).toContain('1 份来源');

    fireEvent.click(screen.getByRole('button', { name: '来源证据' }));
    expect(getWikiLineage).toHaveBeenCalledWith({ wikiId: 'wiki-1' });
    expect(await screen.findByText('只读来源证据')).toBeTruthy();
    expect(screen.getByText('排班公平')).toBeTruthy();
    expect(screen.getByText(/SUPPORTS/)).toBeTruthy();
    expect(screen.getByText('同源图谱节点')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '返回索引' }));
    expect(await screen.findByText('排班与值班要求')).toBeTruthy();
    expect(screen.getByText('8 个要点')).toBeTruthy();
  });

  it('空库展示空态且只读身份隐藏生成入口', async () => {
    vi.mocked(listWikiPages).mockResolvedValue([]);

    renderWiki(false);

    expect(await screen.findByText('这个库还没有 Wiki')).toBeTruthy();
    expect(within(leftPanel()).getByText('还没有生成 Wiki')).toBeTruthy();
    expect(screen.getByText('选择已解析的资料生成 Wiki，正文按标题切分为要点。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /生成 Wiki/ })).toBeNull();
  });

  it('无已解析资料时生成入口禁用并给出空弹窗', async () => {
    vi.mocked(listWikiPages).mockResolvedValue([]);
    vi.mocked(pageMaterial).mockResolvedValue({
      records: [MATERIALS[3]],
      total: 1,
      current: 1,
      size: 100,
    } as never);

    renderWiki(true);

    expect(await screen.findByText('这个库还没有 Wiki')).toBeTruthy();
    const buttons = await screen.findAllByRole('button', { name: /生成 Wiki/ });
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(buttons[1]);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('解析未就绪')).toBeTruthy();
    expect((screen.getByLabelText('选择 待解析制度') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /开始生成/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('生成 Wiki 时默认选未生成资料并提交选中项', async () => {
    renderWiki();
    await screen.findByText('排班与值班要求');

    fireEvent.click(screen.getByRole('button', { name: /生成 Wiki/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('已选 1 份');
    expect((screen.getByLabelText('选择 制度汇编') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('选择 护理排班制度原稿') as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByText('已有 Wiki，内容未变会复用').length).toBe(2);
    expect(screen.getAllByText('尚未生成 Wiki').length).toBe(2);
    expect((screen.getByLabelText('选择 待解析制度') as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: '全选可生成' }));
    expect(dialog.textContent).toContain('已选 3 份');
    fireEvent.click(within(dialog).getByRole('button', { name: '清空' }));
    expect(dialog.textContent).toContain('已选 0 份');
    expect((within(dialog).getByRole('button', { name: /开始生成/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('选择 制度汇编'));
    fireEvent.click(within(dialog).getByRole('button', { name: /开始生成（1）/ }));

    await waitFor(() => expect(generateWiki).toHaveBeenCalledWith('kb-1', ['mat-3']));
    expect(toast).toHaveBeenCalledWith('Wiki 已生成', '1/1 篇成功', 'success');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(listWikiPages).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('v1 · READY')).toBeTruthy();
    expect(getWikiDetail).toHaveBeenCalledWith('wiki-9');
  });
});
