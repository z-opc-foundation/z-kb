import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialDetailRecord } from '@/services/material';
import type { MaterialExtractionRecord } from '@/services/extraction';
import type { WikiPageRecord } from '@/services/wiki';

vi.mock('@/services/wiki', () => ({
  listWikiByMaterial: vi.fn(),
}));

vi.mock('@/services/extraction', () => ({
  getExtractionByMaterial: vi.fn(),
}));

import { getExtractionByMaterial } from '@/services/extraction';
import { listWikiByMaterial } from '@/services/wiki';
import MaterialEvidenceCompare from './material-evidence-compare';

const DETAIL: MaterialDetailRecord = {
  material: {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '排班管理制度',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp',
    compileStatus: 'NONE',
    governanceStatus: 'NONE',
    registeredBy: 1,
  },
  versions: [],
  currentDraft: {
    draftId: 'd-1',
    status: 'READY',
    parserName: 'MinerU',
    parserVersion: '2.1',
    textContent: '第一条 为规范门诊排班，特制定本制度。',
    textLength: 20,
  },
};

const EXTRACTION: MaterialExtractionRecord = {
  materialId: 'mat-1',
  milestone: 'M2',
  counts: { summary: 1, question: 1, term: 1, faq: 1, graphNode: 0, graphEdge: 0 },
  summary: { title: '制度摘要', content: '摘要正文', evidence: '{"chunk":1}' },
  questions: [{ seq: 1, title: '如何排班？', evidence: '原文' }],
  terms: [{ seq: 1, title: '排班', evidence: '原文' }],
  faqs: [{ seq: 1, title: '排班频率？', evidence: '原文' }],
};

const WIKI: WikiPageRecord[] = [
  {
    wikiId: 'w-1',
    kbId: 'kb-1',
    materialId: 'mat-1',
    title: '排班管理制度 Wiki',
    pointCount: 3,
    versionNo: 1,
    status: 'READY',
  },
];

beforeEach(() => {
  vi.mocked(listWikiByMaterial).mockReset();
  vi.mocked(getExtractionByMaterial).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('资料加工对照页签', () => {
  it('并列解析稿、检索块、Wiki 与知识点证据', async () => {
    vi.mocked(listWikiByMaterial).mockResolvedValue(WIKI);
    vi.mocked(getExtractionByMaterial).mockResolvedValue(EXTRACTION);

    render(
      <MaterialEvidenceCompare
        materialId="mat-1"
        detail={DETAIL}
        chunks={[
          {
            chunkId: 'c-1',
            materialId: 'mat-1',
            materialVersionId: 'v-1',
            artifactId: 'a-1',
            ordinal: 1,
            heading: '总则',
            content: '第一条 为规范门诊排班。',
            charCount: 12,
            indexState: 'INDEXED',
          },
        ]}
        compilationLoading={false}
        onOpenTab={vi.fn()}
      />,
    );

    expect(await screen.findByText('排班管理制度 Wiki')).toBeTruthy();
    expect(listWikiByMaterial).toHaveBeenCalledWith('mat-1');
    expect(getExtractionByMaterial).toHaveBeenCalledWith('mat-1');

    expect(screen.getByText('20 字符')).toBeTruthy();
    expect(screen.getByText('第一条 为规范门诊排班，特制定本制度。')).toBeTruthy();
    expect(screen.getByText('总则')).toBeTruthy();
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('v1 · 3 个要点')).toBeTruthy();
    expect(screen.getByText('制度摘要')).toBeTruthy();
    expect(screen.getByText('问句 · 如何排班？')).toBeTruthy();
    expect(screen.getByText('术语 · 排班')).toBeTruthy();
    expect(screen.getByText('FAQ · 排班频率？')).toBeTruthy();
  });

  it('解析稿预览分渲染态与文本态，默认渲染', async () => {
    vi.mocked(listWikiByMaterial).mockResolvedValue([]);
    vi.mocked(getExtractionByMaterial).mockResolvedValue(undefined);
    const { container } = render(
      <MaterialEvidenceCompare
        materialId="mat-1"
        detail={DETAIL}
        chunks={[]}
        compilationLoading={false}
        onOpenTab={vi.fn()}
      />,
    );

    expect(container.querySelector('.compare-draft')).toBeTruthy();
    expect(container.querySelector('.compare-draft-text')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '文本' }));
    expect(container.querySelector('.compare-draft')).toBeNull();
    expect(container.querySelector('.compare-draft-text')?.textContent).toBe(
      '第一条 为规范门诊排班，特制定本制度。',
    );

    fireEvent.click(screen.getByRole('button', { name: '渲染' }));
    expect(container.querySelector('.compare-draft')).toBeTruthy();
  });

  it('三个入口按钮把目标页签交给上层', async () => {
    vi.mocked(listWikiByMaterial).mockResolvedValue(WIKI);
    vi.mocked(getExtractionByMaterial).mockResolvedValue(EXTRACTION);
    const onOpenTab = vi.fn();

    render(
      <MaterialEvidenceCompare
        materialId="mat-1"
        detail={DETAIL}
        chunks={[]}
        compilationLoading={false}
        onOpenTab={onOpenTab}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '去编译' }));
    fireEvent.click(screen.getByRole('button', { name: '去 Wiki' }));
    fireEvent.click(screen.getByRole('button', { name: '去知识点' }));
    fireEvent.click(await screen.findByText('排班管理制度 Wiki'));
    fireEvent.click(screen.getByText('制度摘要'));
    expect(onOpenTab.mock.calls).toEqual([['compile'], ['wiki'], ['knowledge'], ['wiki'], ['knowledge']]);
  });

  it('没有解析稿与产物时展示空态', async () => {
    vi.mocked(listWikiByMaterial).mockResolvedValue([]);
    vi.mocked(getExtractionByMaterial).mockResolvedValue(undefined);

    render(
      <MaterialEvidenceCompare
        materialId="mat-1"
        detail={{ ...DETAIL, currentDraft: null }}
        chunks={[]}
        compilationLoading
        onOpenTab={vi.fn()}
      />,
    );

    expect(screen.getByText('正在加载检索块…')).toBeTruthy();
    expect(screen.getByText('正在加载 Wiki…')).toBeTruthy();
    expect(screen.getByText('正在加载知识点…')).toBeTruthy();
    expect(await screen.findByText('没有解析稿')).toBeTruthy();
    expect(screen.getByText('无解析稿')).toBeTruthy();
    expect(await screen.findByText('暂无 Wiki。')).toBeTruthy();
    expect(screen.getByText('暂无知识点证据。')).toBeTruthy();
  });
});
