import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialExtractionRecord } from '@/services/extraction';

vi.mock('@/services/extraction', () => ({
  getExtractionByMaterial: vi.fn(),
}));

import { getExtractionByMaterial } from '@/services/extraction';
import MaterialKnowledgeTab from './material-knowledge-tab';

const EXTRACTION: MaterialExtractionRecord = {
  materialId: 'mat-1',
  milestone: 'M2',
  counts: { summary: 1, question: 1, term: 1, faq: 1, graphNode: 4, graphEdge: 2 },
  summary: { title: '制度摘要', content: '摘要正文', evidence: '{"chunk":1}' },
  questions: [
    {
      seq: 1,
      title: '排班周期？',
      content: '按周排班。',
      conceptId: 'c-1',
      conceptName: '排班',
      conceptStatus: 'CONFIRMED',
      evidence: '原文',
    },
  ],
  terms: [{ seq: 2, title: '交接班', evidence: '原文' }],
  faqs: [{ seq: 1, title: '如何请假？', content: '提前一天提交。' }],
};

beforeEach(() => {
  vi.mocked(getExtractionByMaterial).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('资料知识点页签', () => {
  it('展示里程碑、计数、摘要与三类条目', async () => {
    vi.mocked(getExtractionByMaterial).mockResolvedValue(EXTRACTION);
    const { container } = render(<MaterialKnowledgeTab materialId="mat-1" />);

    expect(screen.getByText('正在加载知识点…')).toBeTruthy();
    expect(await screen.findByText('M2 已达成')).toBeTruthy();
    expect(getExtractionByMaterial).toHaveBeenCalledWith('mat-1');
    expect(screen.getByText('摘要 1')).toBeTruthy();
    expect(screen.getByText('问句 1')).toBeTruthy();
    expect(screen.getByText('术语 1')).toBeTruthy();
    expect(screen.getByText('FAQ 1')).toBeTruthy();
    expect(screen.getByText('图谱节点 4')).toBeTruthy();
    expect(screen.getByText('图谱关系 2')).toBeTruthy();

    expect(screen.getByText('制度摘要')).toBeTruthy();
    expect(screen.getByText('摘要正文')).toBeTruthy();
    expect(screen.getByText('排班周期？')).toBeTruthy();
    expect(screen.getByText('按周排班。')).toBeTruthy();
    expect(screen.getByText('交接班')).toBeTruthy();
    expect(screen.getByText('如何请假？')).toBeTruthy();

    const seq = Array.from(container.querySelectorAll('.tag.blue.mono')).map(
      (node) => node.textContent,
    );
    expect(seq).toEqual(['01', '02', '01']);
  });

  it('点击概念标签把概念 ID 交给上层', async () => {
    vi.mocked(getExtractionByMaterial).mockResolvedValue(EXTRACTION);
    const onOpenConcept = vi.fn();
    render(
      <MaterialKnowledgeTab materialId="mat-1" onOpenConcept={onOpenConcept} />,
    );

    fireEvent.click(await screen.findByText('排班 · 已确认'));
    expect(onOpenConcept).toHaveBeenCalledWith('c-1');
  });

  it('M1 里程碑展示失败说明与告警', async () => {
    vi.mocked(getExtractionByMaterial).mockResolvedValue({
      ...EXTRACTION,
      milestone: 'M1',
      summary: null,
      questions: [],
      terms: [],
      faqs: [],
    });
    render(<MaterialKnowledgeTab materialId="mat-1" failureSummary="P4 未产出产物" />);

    expect(await screen.findByText('M1 已达成')).toBeTruthy();
    expect(screen.getByText('M2 未达成')).toBeTruthy();
    expect(screen.getByText(/编译失败说明：P4 未产出产物/)).toBeTruthy();
    expect(screen.getByText('暂无摘要。')).toBeTruthy();
    expect(screen.getByText('暂无问句。')).toBeTruthy();
    expect(screen.getByText('暂无术语。')).toBeTruthy();
    expect(screen.getByText('暂无 FAQ。')).toBeTruthy();
  });

  it('没有萃取记录时展示空态', async () => {
    vi.mocked(getExtractionByMaterial).mockResolvedValue(undefined);
    render(<MaterialKnowledgeTab materialId="mat-1" />);

    expect(await screen.findByText('暂无萃取结果')).toBeTruthy();
    expect(screen.getByText(/资料完成编译后才会产生摘要/)).toBeTruthy();
  });
});
