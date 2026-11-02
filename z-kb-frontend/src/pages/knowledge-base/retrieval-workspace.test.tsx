import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderAt } from '@/test/render';
import { retrieveKnowledge } from '@/services/retrieval';
import { getWikiLineage } from '@/services/wiki';
import { toast } from '@/utils/toast';
import RetrievalWorkspace from './retrieval-workspace';

vi.mock('@/services/retrieval', () => ({ retrieveKnowledge: vi.fn() }));
vi.mock('@/services/wiki', () => ({ getWikiLineage: vi.fn() }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));
vi.mock('@/pages/ai/agent-ask', () => ({
  AgentAskButton: ({ label }: { label: string }) => (
    <button type="button" data-testid="agent-ask">{label}</button>
  ),
}));

const HITS = [
  {
    rank: 1,
    chunkId: 'chunk-1',
    materialId: 'mat-1',
    materialTitle: '护理管理规范',
    materialVersionId: 'mv-1',
    artifactId: 'art-1',
    ordinal: 3,
    heading: '护士长的职责',
    content: '护士长负责排班与质量检查。',
    charCount: 120,
    score: 0.8734,
    matchedTerms: ['护士长'],
    explanation: '命中章节标题与正文',
    wikiId: 'wiki-9',
    wikiTitle: '护理管理 Wiki',
    indexState: 'INDEXED',
    indexedAt: '2026-03-01T08:00:00',
  },
  {
    rank: 2,
    chunkId: 'chunk-2',
    materialId: 'mat-2',
    materialVersionId: 'mv-2',
    artifactId: 'art-2',
    ordinal: 5,
    heading: null,
    content: '交接班流程与记录要求。',
    charCount: 80,
    score: 0.4123,
    matchedTerms: [],
    explanation: '仅命中正文',
    wikiId: null,
    indexState: 'INDEXED',
    indexedAt: '2026-03-01T08:00:00',
  },
];

const RESULT = {
  kbId: 'kb-1',
  query: '护士长职责',
  mode: 'dense',
  embeddingModel: 'bge-m3',
  topK: 10,
  minScore: 0.1,
  totalCandidates: 30,
  scanned: 24,
  returned: 2,
  truncated: true,
  tookMs: 18,
  hits: HITS,
};

const LINEAGE = {
  wikiId: 'wiki-9',
  title: '护理管理 Wiki',
  nodes: [
    { nodeId: 'node-1', nodeType: 'WIKI', label: '护士长的职责', refId: 'wiki-9' },
    { nodeId: 'node-2', nodeType: 'GRAPH', label: '排班制度', refId: 'g-2' },
  ],
  edges: [{ fromNodeId: 'node-1', toNodeId: 'node-2', relation: 'EVIDENCE' }],
  relationTypes: ['EVIDENCE'],
  sourceCount: 1,
  graphNodeCount: 1,
};

function Probe() {
  const location = useLocation();
  return (
    <div>
      <div data-testid="location-search">{location.search}</div>
      <RetrievalWorkspace kbId="kb-1" />
    </div>
  );
}

function renderRetrieval(route = '/knowledge-bases/kb-1/workspace') {
  return renderAt(
    <Routes>
      <Route path="/knowledge-bases/:kbId/workspace" element={<Probe />} />
    </Routes>,
    { route },
  );
}

describe('检索工作区', () => {
  beforeEach(() => {
    vi.mocked(retrieveKnowledge).mockResolvedValue(RESULT as never);
    vi.mocked(getWikiLineage).mockResolvedValue(LINEAGE as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('初始空态展示检索说明与默认参数', () => {
    renderRetrieval();

    expect(screen.getByText('输入问题开始检索')).toBeTruthy();
    expect(screen.getByText('输入问题后检索')).toBeTruthy();
    expect((screen.getByLabelText('topK') as HTMLSelectElement).value).toBe('10');
    expect((screen.getByLabelText('minScore') as HTMLInputElement).value).toBe('0.1');
    expect((screen.getByLabelText('检索模式') as HTMLSelectElement).value).toBe('dense');
    expect(screen.getByTestId('agent-ask').textContent).toBe('问 AI');
    expect(retrieveKnowledge).not.toHaveBeenCalled();
  });

  it('空查询提交给出提示且不发起请求', () => {
    renderRetrieval();

    fireEvent.click(screen.getByRole('button', { name: /检索/ }));

    expect(toast).toHaveBeenCalledWith(
      '请输入检索内容',
      '向量检索需要一个问题或关键词，避免空查询返回全库块。',
      'error',
    );
    expect(retrieveKnowledge).not.toHaveBeenCalled();
  });

  it('提交检索后展示加载态、统计与命中结果', async () => {
    let resolveResult: (value: unknown) => void = () => undefined;
    vi.mocked(retrieveKnowledge).mockImplementation(
      () => new Promise((resolve) => { resolveResult = resolve as (value: unknown) => void; }) as never,
    );

    renderRetrieval();
    fireEvent.change(screen.getByLabelText('检索内容'), {
      target: { value: '  护士长职责  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /检索/ }));

    expect(screen.getByText('正在计算库内相似度…')).toBeTruthy();
    expect(retrieveKnowledge).toHaveBeenCalledWith({
      kbId: 'kb-1',
      query: '护士长职责',
      topK: 10,
      minScore: 0.1,
      mode: 'dense',
    });

    resolveResult(RESULT);

    expect(await screen.findByText(/负责排班与质量检查/)).toBeTruthy();
    expect(screen.getByText('「护士长职责」 · 2 条命中')).toBeTruthy();
    expect(screen.getByText('候选块 30')).toBeTruthy();
    expect(screen.getByText('扫描 24')).toBeTruthy();
    expect(screen.getByText('耗时 18 ms')).toBeTruthy();
    expect(screen.getByText('模型 bge-m3')).toBeTruthy();
    expect(screen.getByText('minScore 0.1')).toBeTruthy();
    expect(screen.getByText('扫描超过 2000 块，已截断')).toBeTruthy();

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('余弦 0.873')).toBeTruthy();
    expect(screen.getByText('余弦 0.412')).toBeTruthy();
    expect(screen.getAllByText('Wiki')).toHaveLength(1);
    expect(screen.getByText('第 5 块')).toBeTruthy();
    expect(screen.getByText('护理管理规范')).toBeTruthy();
    expect(screen.getByText('物料 mat-2')).toBeTruthy();
    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('120 字')).toBeTruthy();
    expect(screen.getByText('命中章节标题与正文')).toBeTruthy();
    expect(screen.getByText('Wiki：护理管理 Wiki')).toBeTruthy();
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(document.querySelector('mark')?.textContent).toBe('护士长');
    expect(screen.getByTestId('agent-ask').textContent).toBe('用 AI 总结');

    const wikiButtons = screen.getAllByRole('button', { name: /查看 Wiki/ });
    expect((wikiButtons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((wikiButtons[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('检索无命中时提示降低 minScore', async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue({
      ...RESULT,
      returned: 0,
      scanned: 3,
      truncated: false,
      hits: [],
    } as never);

    renderRetrieval();
    fireEvent.change(screen.getByLabelText('检索内容'), { target: { value: '不存在的主题' } });
    fireEvent.click(screen.getByRole('button', { name: /检索/ }));

    expect(await screen.findByText('没有达到 minScore 的命中')).toBeTruthy();
    expect(screen.getByText(/降低 minScore 或换一种问法再试/)).toBeTruthy();
    expect(screen.getByText('「不存在的主题」 · 0 条命中')).toBeTruthy();
    expect(screen.queryByText('扫描超过 2000 块，已截断')).toBeNull();
  });

  it('已检索后调整 topK 与 minScore 会重新检索', async () => {
    renderRetrieval();
    fireEvent.change(screen.getByLabelText('检索内容'), { target: { value: '护士长职责' } });
    fireEvent.click(screen.getByRole('button', { name: /检索/ }));
    await screen.findByText(/负责排班与质量检查/);

    fireEvent.change(screen.getByLabelText('minScore'), { target: { value: '2' } });
    expect((screen.getByLabelText('minScore') as HTMLInputElement).value).toBe('1');
    fireEvent.change(screen.getByLabelText('minScore'), { target: { value: '-3' } });
    expect((screen.getByLabelText('minScore') as HTMLInputElement).value).toBe('0');
    expect(retrieveKnowledge).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('topK'), { target: { value: '50' } });

    await waitFor(() =>
      expect(retrieveKnowledge).toHaveBeenLastCalledWith({
        kbId: 'kb-1',
        query: '护士长职责',
        topK: 50,
        minScore: 0,
        mode: 'dense',
      }),
    );
  });

  it('带 query 深链自动检索并打开只读图谱抽屉', async () => {
    renderRetrieval('/knowledge-bases/kb-1/workspace?query=%E6%8A%A4%E5%A3%AB%E9%95%BF%E8%81%8C%E8%B4%A3');

    expect(await screen.findByText(/负责排班与质量检查/)).toBeTruthy();
    expect(retrieveKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ query: '护士长职责', topK: 10 }),
    );

    fireEvent.click(screen.getAllByRole('button', { name: /只读图谱/ })[0]);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '只读图谱' })).toBeTruthy();
    expect(getWikiLineage).toHaveBeenCalledWith({ wikiId: 'wiki-9' });
    expect(await screen.findByText('节点 2 · 关系 1 · 只读展示，图谱节点仅用于召回定位')).toBeTruthy();
    expect(screen.getByText('护士长的职责')).toBeTruthy();
    expect(screen.getByText('排班制度')).toBeTruthy();
    expect(screen.getByText('node-1 → node-2 · EVIDENCE')).toBeTruthy();
    expect(screen.getByText('原文块：#3 · 护士长的职责 · 120 字')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /打开 Wiki/ }));
    expect(screen.getByTestId('location-search').textContent).toContain('view=wiki');
    expect(screen.getByTestId('location-search').textContent).toContain('wikiId=wiki-9');

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('无 Wiki 的命中在抽屉中说明无法组装图谱', async () => {
    renderRetrieval();
    fireEvent.change(screen.getByLabelText('检索内容'), { target: { value: '护士长职责' } });
    fireEvent.click(screen.getByRole('button', { name: /检索/ }));
    await screen.findByText('第 5 块');

    fireEvent.click(screen.getAllByRole('button', { name: /只读图谱/ })[1]);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText(/该命中未生成 Wiki，无法组装 Wiki 与图谱节点/),
    ).toBeTruthy();
    expect(getWikiLineage).not.toHaveBeenCalled();
  });
});
