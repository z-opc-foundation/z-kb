import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraphRecord } from '@/services/graph';

vi.mock('@/services/graph', () => ({
  getGraphByMaterial: vi.fn(),
}));

import { getGraphByMaterial } from '@/services/graph';
import MaterialGraphTab from './material-graph-tab';

const GRAPH: KnowledgeGraphRecord = {
  kbId: 'kb-1',
  graphSpaceKey: 'space-1',
  nodeCount: 3,
  edgeCount: 1,
  truncated: true,
  nodes: [
    { nodeId: 'n1', nodeType: 'DISEASE', name: '高血压', conceptId: 'c1', evidence: '{"chunk":1}' },
    { nodeId: 'n2', nodeType: 'DRUG', name: '氨氯地平', materialId: 'mat-1' },
    { nodeId: 'n3', nodeType: 'DISEASE', name: '', materialId: 'mat-1' },
  ],
  edges: [
    { edgeId: 'e1', edgeType: '治疗', sourceNodeId: 'n1', targetNodeId: 'n2', evidence: '原文' },
  ],
};

beforeEach(() => {
  vi.mocked(getGraphByMaterial).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('资料图谱页签', () => {
  it('展示节点统计、按类型分组与关系', async () => {
    vi.mocked(getGraphByMaterial).mockResolvedValue(GRAPH);
    render(<MaterialGraphTab materialId="mat-1" />);

    expect(screen.getByText('正在加载图谱…')).toBeTruthy();
    expect(await screen.findByText('3 个节点')).toBeTruthy();
    expect(getGraphByMaterial).toHaveBeenCalledWith('mat-1');
    expect(screen.getByText('1 条关系')).toBeTruthy();
    expect(screen.getByText('已截断')).toBeTruthy();
    expect(screen.getByText('space-1')).toBeTruthy();
    expect(screen.getByText('2 个')).toBeTruthy();
    expect(screen.getByText('n3 · 资料 mat-1')).toBeTruthy();
    expect(screen.getByText('n1 · 概念 c1')).toBeTruthy();
    expect(screen.getByText('治疗')).toBeTruthy();
    expect(screen.getByText('e1')).toBeTruthy();
  });

  it('没有节点时展示空态说明', async () => {
    vi.mocked(getGraphByMaterial).mockResolvedValue({
      ...GRAPH,
      nodes: [],
      edges: [],
      nodeCount: 0,
      edgeCount: 0,
      truncated: false,
    });
    render(<MaterialGraphTab materialId="mat-1" />);

    expect(await screen.findByText('本次编译未抽取到图谱节点')).toBeTruthy();
    expect(screen.getByText(/图谱由编译阶段从检索块抽取/)).toBeTruthy();
  });

  it('有节点但无关系时展示关系空态', async () => {
    vi.mocked(getGraphByMaterial).mockResolvedValue({ ...GRAPH, edges: [] });
    render(<MaterialGraphTab materialId="mat-1" />);

    expect(await screen.findByText('3 个节点')).toBeTruthy();
    expect(screen.getByText('本次编译未抽取到图谱关系。')).toBeTruthy();
  });
});
