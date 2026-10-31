import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WikiLineageWorkspace from './wiki-lineage-workspace';
import { getWikiLineage, listWikiPages } from '@/services/wiki';
import {
  getConcept,
  listConceptsByKb,
  type ConceptRecord,
} from '@/services/concept';

vi.mock('@/services/wiki', () => ({
  getWikiLineage: vi.fn(),
  listWikiPages: vi.fn(),
}));

vi.mock('@/services/concept', () => ({
  listConceptsByKb: vi.fn(),
  getConcept: vi.fn(),
}));

const concept: ConceptRecord = {
  conceptId: 'cpt-1',
  name: '排班',
  conceptType: 'TERM',
  status: 'CONFIRMED',
  definition: '门诊排班的规则集合。',
  mentionCount: 3,
  materialCount: 1,
  graphNodeId: 'concept:cpt-1',
};

const lineage = {
  title: '库内 Wiki 图谱',
  nodes: [
    {
      nodeId: 'material:mat-1',
      nodeType: 'MATERIAL',
      label: '排班管理制度',
      refId: 'mat-1',
    },
    {
      nodeId: 'concept:cpt-1',
      nodeType: 'CONCEPT',
      label: '排班',
      refId: 'mat-1',
    },
    {
      nodeId: 'wiki:wiki-1',
      nodeType: 'WIKI',
      label: '门诊排班 Wiki',
      refId: 'wiki-1',
    },
  ],
  edges: [
    {
      fromNodeId: 'material:mat-1',
      toNodeId: 'wiki:wiki-1',
      relation: 'SOURCED_FROM',
    },
    {
      fromNodeId: 'material:mat-1',
      toNodeId: 'concept:cpt-1',
      relation: 'MENTIONS',
    },
  ],
  relationTypes: ['SOURCED_FROM', 'MENTIONS'],
  sourceCount: 1,
  graphNodeCount: 1,
  note: '',
};

describe('Wiki 图谱工作区', () => {
  beforeEach(() => {
    vi.mocked(listWikiPages).mockResolvedValue([]);
    vi.mocked(getWikiLineage).mockResolvedValue(lineage);
    vi.mocked(listConceptsByKb).mockResolvedValue([concept]);
    vi.mocked(getConcept).mockResolvedValue({
      concept,
      mentions: [
        {
          mentionId: 'mention-1',
          conceptId: concept.conceptId,
          materialId: 'mat-1',
          materialTitle: '排班管理制度',
          materialVersionId: 'ver-1',
          chunkOrdinal: 1,
          occurrenceCount: 3,
          evidence: '{"chunk":1,"start":0,"end":12}',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('在节点树中展示概念，并可从概念节点打开详情', async () => {
    const { container } = render(<WikiLineageWorkspace kbId="kb-1" />);

    const tree = await waitFor(() => {
      const el = container.querySelector('.tree') as HTMLElement | null;
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    const conceptTreeItem = await waitFor(() => {
      const item = [...tree.querySelectorAll('.tree-item')].find(
        (el) => el.querySelector('span')?.textContent?.trim() === '排班',
      );
      expect(item).toBeTruthy();
      return item as HTMLElement;
    });
    expect(tree.textContent).toContain('概念');
    fireEvent.click(conceptTreeItem);

    expect(await screen.findByText('已确认')).toBeTruthy();
    expect(screen.getByText('提及 3')).toBeTruthy();
    expect(screen.getByText('来源资料 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /查看概念详情/ }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('概念 · 排班')).toBeTruthy();
    expect(within(dialog).getByText('排班管理制度')).toBeTruthy();
    expect(within(dialog).getByText('概念定义')).toBeTruthy();
  });

  it('右上角固定元类型图例可整类显隐并切换箭头', async () => {
    const { container } = render(<WikiLineageWorkspace kbId="kb-1" />);

    const panel = await waitFor(() => {
      const el = container.querySelector('.wb-network-panel');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(panel.textContent).toContain('3 / 3 个节点');
    expect(container.querySelectorAll('.wb-network-node')).toHaveLength(3);
    expect(
      container.querySelector('.wb-network-edge')?.getAttribute('marker-end'),
    ).toBe('url(#lineage-arrow)');

    fireEvent.click(within(panel).getByRole('button', { name: /概念/ }));
    await waitFor(() => {
      expect(container.querySelectorAll('.wb-network-node')).toHaveLength(2);
      expect(container.querySelectorAll('.wb-network-edge')).toHaveLength(1);
      expect(
        container.querySelector('.wb-network-count')?.textContent,
      ).toContain('2 / 3');
    });

    fireEvent.click(within(panel).getByRole('button', { name: /隐藏箭头/ }));
    await waitFor(() => {
      expect(
        container.querySelector('.wb-network-edge')?.getAttribute('marker-end'),
      ).toBeNull();
      expect(
        within(panel).getByRole('button', { name: /显示箭头/ }),
      ).toBeTruthy();
    });
  });

  it('conceptId 深链直接选中对应的概念节点', async () => {
    render(
      <WikiLineageWorkspace kbId="kb-1" focusConceptId={concept.conceptId} />,
    );

    expect(await screen.findByText('门诊排班的规则集合。')).toBeTruthy();
    expect(screen.getByRole('button', { name: /查看概念详情/ })).toBeTruthy();
    expect(screen.queryByText('概念 · 排班')).toBeNull();
  });
});
