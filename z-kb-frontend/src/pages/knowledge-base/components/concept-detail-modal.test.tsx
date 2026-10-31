import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConceptDetailRecord } from '@/services/concept';

vi.mock('@/services/concept', () => ({
  getConcept: vi.fn(),
}));

import { getConcept } from '@/services/concept';
import ConceptDetailModal from './concept-detail-modal';

const DETAIL: ConceptDetailRecord = {
  concept: {
    conceptId: 'concept-1',
    name: '高血压',
    conceptType: 'DISEASE',
    status: 'CONFIRMED',
    definition: '以体循环动脉压升高为主要表现的临床综合征。',
    mentionCount: 3,
    materialCount: 2,
    graphNodeId: 'node-1',
  },
  mentions: [
    {
      mentionId: 'mention-1',
      conceptId: 'concept-1',
      materialId: 'mat-1',
      materialTitle: '高血压诊疗指南',
      materialVersionId: 'v-1',
      chunkOrdinal: 1,
      occurrenceCount: 2,
      evidence: '{"chunk":3,"start":10,"end":20}',
    },
    {
      mentionId: 'mention-2',
      conceptId: 'concept-1',
      materialId: 'mat-2',
      materialVersionId: 'v-2',
      chunkOrdinal: 2,
      occurrenceCount: 1,
      evidence: '一段无法解析的证据',
    },
  ],
};

beforeEach(() => {
  vi.mocked(getConcept).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('概念详情弹窗', () => {
  it('加载概念后展示状态、统计、定义与来源提及', async () => {
    vi.mocked(getConcept).mockResolvedValue(DETAIL);
    render(<ConceptDetailModal kbId="kb-1" conceptId="concept-1" onClose={vi.fn()} />);

    expect(screen.getByText('正在加载概念…')).toBeTruthy();
    expect(await screen.findByText('概念 · 高血压')).toBeTruthy();
    expect(getConcept).toHaveBeenCalledWith('kb-1', 'concept-1');

    expect(screen.getByText('已确认')).toBeTruthy();
    expect(screen.getByText('提及 3')).toBeTruthy();
    expect(screen.getByText('来源资料 2')).toBeTruthy();
    expect(screen.getAllByText('node-1')).toHaveLength(2);
    expect(screen.getByText('以体循环动脉压升高为主要表现的临床综合征。')).toBeTruthy();

    expect(screen.getByText('高血压诊疗指南')).toBeTruthy();
    expect(
      screen.getByText(/mat-1 · 出现 2 次 · 证据 块 3 · 10-20/),
    ).toBeTruthy();
    expect(screen.getByText(/mat-2 · 出现 1 次 · 证据 一段无法解析的证据/)).toBeTruthy();
  });

  it('点击资料与图谱按钮回传对应资料 ID', async () => {
    vi.mocked(getConcept).mockResolvedValue(DETAIL);
    const onOpenMaterial = vi.fn();
    const onOpenMaterialGraph = vi.fn();
    render(
      <ConceptDetailModal
        kbId="kb-1"
        conceptId="concept-1"
        onClose={vi.fn()}
        onOpenMaterial={onOpenMaterial}
        onOpenMaterialGraph={onOpenMaterialGraph}
      />,
    );

    await screen.findByText('高血压诊疗指南');
    fireEvent.click(screen.getAllByRole('button', { name: '资料' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: '图谱' })[1]);
    expect(onOpenMaterial).toHaveBeenCalledWith('mat-1');
    expect(onOpenMaterialGraph).toHaveBeenCalledWith('mat-2');
  });

  it('没有来源提及时给出空态，未知状态原样展示', async () => {
    vi.mocked(getConcept).mockResolvedValue({
      concept: { ...DETAIL.concept, status: 'EMERGING', definition: null, graphNodeId: null },
      mentions: [],
    });
    render(<ConceptDetailModal kbId="kb-1" conceptId="concept-9" onClose={vi.fn()} />);

    expect(await screen.findByText('涌现中')).toBeTruthy();
    expect(screen.getByText('无图谱节点')).toBeTruthy();
    expect(screen.getByText('这条概念还没有来源提及。')).toBeTruthy();
    expect(screen.getByText('未关联图谱节点')).toBeTruthy();
  });
});
