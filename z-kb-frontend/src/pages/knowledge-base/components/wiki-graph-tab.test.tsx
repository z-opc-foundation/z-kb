import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraphRecord } from '@/services/graph';

vi.mock('@/services/graph', () => ({
  getGraphByKb: vi.fn(),
}));

import { getGraphByKb } from '@/services/graph';
import WikiGraphTab from './wiki-graph-tab';

const GRAPH: KnowledgeGraphRecord = {
  kbId: 'kb-1',
  graphSpaceKey: 'space-1',
  nodeCount: 9,
  edgeCount: 2,
  truncated: true,
  nodes: [
    {
      nodeId: 'n1',
      nodeType: 'DISEASE',
      name: '高血压',
      materialId: 'mat-1',
      evidence: '{"chunk":1}',
    },
    {
      nodeId: 'n2',
      nodeType: 'DRUG',
      name: '氨氯地平',
      materialId: 'mat-2',
      conceptId: 'c-2',
      evidence: '一段原文',
    },
    {
      nodeId: 'n3',
      nodeType: 'DISEASE',
      name: '其他资料节点',
      materialId: 'mat-3',
    },
  ],
  edges: [
    {
      edgeId: 'e1',
      edgeType: '治疗',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      evidence: '{"chunk":2}',
    },
    { edgeId: 'e2', edgeType: '相关', sourceNodeId: 'n1', targetNodeId: 'n3' },
  ],
};

beforeEach(() => {
  vi.mocked(getGraphByKb).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('Wiki 同源图谱页签', () => {
  it('只展示来源资料命中的节点与同源关系', async () => {
    vi.mocked(getGraphByKb).mockResolvedValue(GRAPH);
    render(<WikiGraphTab kbId="kb-1" sourceMaterialIds={['mat-1', 'mat-2']} />);

    expect(screen.getByText('正在加载同源图谱…')).toBeTruthy();
    expect(await screen.findByText('2 个同源节点')).toBeTruthy();
    expect(getGraphByKb).toHaveBeenCalledWith('kb-1');
    expect(screen.getByText('1 条关系')).toBeTruthy();
    expect(screen.getByText('库内 9 个节点')).toBeTruthy();
    expect(screen.getByText('库内图谱已截断')).toBeTruthy();
    expect(screen.getByText('高血压')).toBeTruthy();
    expect(screen.getByText('氨氯地平')).toBeTruthy();
    expect(screen.queryByText('其他资料节点')).toBeNull();

    expect(screen.getByText('疾病')).toBeTruthy();
    expect(screen.getByText('药物')).toBeTruthy();
    expect(screen.getByText('治疗')).toBeTruthy();
    expect(screen.getByText('e1')).toBeTruthy();
  });

  it('来源资料没有命中节点时展示空态', async () => {
    vi.mocked(getGraphByKb).mockResolvedValue(GRAPH);
    render(<WikiGraphTab kbId="kb-1" sourceMaterialIds={['mat-x']} />);

    expect(await screen.findByText('该 Wiki 来源资料暂无图谱节点')).toBeTruthy();
    expect(screen.queryByText('同源关系')).toBeNull();
  });

  it('有节点但无关系时提示暂无可展示关系', async () => {
    vi.mocked(getGraphByKb).mockResolvedValue({ ...GRAPH, edges: [] });
    render(<WikiGraphTab kbId="kb-1" sourceMaterialIds={['mat-1']} />);

    expect(await screen.findByText('1 个同源节点')).toBeTruthy();
    expect(screen.getByText('0 条关系')).toBeTruthy();
    expect(screen.getByText('同源节点之间暂无可展示关系。')).toBeTruthy();
  });
});
