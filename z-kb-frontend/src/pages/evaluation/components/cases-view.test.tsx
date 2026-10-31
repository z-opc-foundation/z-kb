import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvalOverview, EvalRunDetail } from '@/services/evaluation';
import {
  listEvalBadcases,
  pageEvalCaseResults,
  updateEvalBadcase,
} from '@/services/evaluation';
import { toast } from '@/utils/toast';
import { renderAt } from '@/test/render';
import CasesView from './cases-view';

vi.mock('@/services/evaluation', () => ({
  listEvalBadcases: vi.fn(),
  pageEvalCaseResults: vi.fn(),
  updateEvalBadcase: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const listMock = vi.mocked(listEvalBadcases);
const pageCasesMock = vi.mocked(pageEvalCaseResults);
const updateMock = vi.mocked(updateEvalBadcase);
const toastMock = vi.mocked(toast);

const RUN_DETAIL: EvalRunDetail = {
  run: {
    runId: 'run-1',
    kbId: 'kb-1',
    status: 'COMPLETED',
    resultUsable: true,
    finishedAt: '2026-10-20T10:00:00',
  },
  badcaseCounts: { open: 2, fixed: 3, regressed: 1 },
};

const OVERVIEW: EvalOverview = {
  kbId: 'kb-1',
  kbName: '护理知识库',
  lastRun: { runId: 'run-1', status: 'COMPLETED', resultUsable: true },
  badcaseCounts: { open: 2, fixed: 3, regressed: 1 },
};

const BADCASES = {
  records: [
    {
      badcaseId: 'bc-1',
      caseId: 'case-1',
      question: '发热患者如何分级？',
      stageCode: 'RETRIEVAL',
      category: '召回问题',
      severity: 'HIGH',
      status: 'OPEN',
      owner: '张三',
      note: '待确认',
      occurrenceCount: 3,
      lastSeenRunId: 'run-1',
    },
  ],
  total: 1,
};

const CASE_PAGE = {
  records: [
    {
      caseId: 'case-1',
      caseNo: 1,
      question: '发热患者如何分级？',
      answer: '按体温分级处理。',
      answerMode: 'ANSWER',
      metrics: [{ metricName: '准确率', value: 0.8, unit: 'ratio' }],
      retrieved: {
        hits: [
          {
            materialId: 'mat-1',
            chunkId: 'chunk-1',
            materialTitle: '分级制度',
            snippet: '体温超过 39 度进入高热门诊。',
            score: 0.9,
          },
        ],
      },
      citations: ['分级制度'],
      stageTrace: [
        {
          stageCode: 'RETRIEVAL',
          stageName: '召回',
          status: 'PASS',
          detail: '命中 2 条',
        },
      ],
      latencyMs: 1200,
      badcaseStages: ['RETRIEVAL'],
    },
  ],
  total: 1,
};

function renderView(
  overrides: Partial<ComponentProps<typeof CasesView>> = {},
) {
  const props = {
    kbId: 'kb-1',
    runDetail: RUN_DETAIL,
    overview: OVERVIEW,
    statusFilter: '',
    caseId: '',
    onStatusChange: vi.fn(),
    onOpenCase: vi.fn(),
    onCloseCase: vi.fn(),
    onBadcaseUpdated: vi.fn(),
    onCreateRun: vi.fn(),
    ...overrides,
  };
  return { ...renderAt(<CasesView {...props} />), props };
}

beforeEach(() => {
  listMock.mockReset();
  pageCasesMock.mockReset();
  updateMock.mockReset();
  toastMock.mockClear();
  listMock.mockResolvedValue(BADCASES);
  pageCasesMock.mockResolvedValue(CASE_PAGE);
  updateMock.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe('CasesView', () => {
  it('加载后展示坏例台账行与计数', async () => {
    renderView();
    expect(await screen.findByText('发热患者如何分级？')).toBeInTheDocument();
    expect(screen.getByText('召回问题')).toBeInTheDocument();
    expect(screen.getByText('高')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('全部 · 1 / 1')).toBeInTheDocument();
    expect(screen.getByText('RETRIEVAL')).toBeInTheDocument();
    expect(screen.getAllByText('run-1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('待修复').length).toBeGreaterThanOrEqual(1);
    expect(listMock).toHaveBeenCalledWith('kb-1', undefined);
  });

  it('状态筛选、行点击与明细按钮触发回调', async () => {
    const { props } = renderView();
    await screen.findByText('发热患者如何分级？');

    fireEvent.click(screen.getByRole('button', { name: '已修复' }));
    expect(props.onStatusChange).toHaveBeenCalledWith('FIXED');

    fireEvent.click(screen.getByText('发热患者如何分级？'));
    expect(props.onOpenCase).toHaveBeenCalledWith('case-1');

    fireEvent.click(screen.getByRole('button', { name: /明细/ }));
    expect(props.onOpenCase).toHaveBeenCalledTimes(2);
  });

  it('传入状态筛选时按状态查询', async () => {
    renderView({ statusFilter: 'OPEN' });
    await screen.findByText('发热患者如何分级？');
    expect(listMock).toHaveBeenCalledWith('kb-1', 'OPEN');
    expect(screen.getByText('待修复 · 1 / 1')).toBeInTheDocument();
  });

  it('无坏例时按是否有跑批展示不同动作', async () => {
    listMock.mockResolvedValue({ records: [], total: 0 });
    const { props } = renderView({
      runDetail: null,
      overview: { kbId: 'kb-1', lastRun: null },
    });
    expect(await screen.findByText('尚无坏例记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));
    expect(props.onCreateRun).toHaveBeenCalledTimes(1);

    cleanup();
    const second = renderView({ statusFilter: 'OPEN' });
    expect(await screen.findByText('当前筛选下没有坏例')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(second.props.onStatusChange).toHaveBeenCalledWith('');
  });

  it('加载失败可重试，刷新重新请求', async () => {
    listMock.mockResolvedValue(undefined);
    renderView();
    expect(await screen.findByText('坏例台账加载失败')).toBeInTheDocument();
    const before = listMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('打开坏例明细抽屉并展示逐题结果', async () => {
    renderView({ caseId: 'case-1' });
    const dialog = await screen.findByRole('dialog');
    const view = within(dialog);
    expect(view.getByText('坏例明细')).toBeInTheDocument();
    expect(await view.findByText('按体温分级处理。')).toBeInTheDocument();
    expect(view.getByText('模式 作答')).toBeInTheDocument();
    expect(view.getByText('坏例阶段 RETRIEVAL')).toBeInTheDocument();
    expect(view.getByText('#1 分级制度')).toBeInTheDocument();
    expect(view.getByText('score 0.9')).toBeInTheDocument();
    expect(view.getByText('chunk-1')).toBeInTheDocument();
    expect(view.getByText('准确率')).toBeInTheDocument();
    expect(view.getByText('80%')).toBeInTheDocument();
    expect(view.getByText('命中 2 条')).toBeInTheDocument();
    expect(pageCasesMock).toHaveBeenCalledWith({
      runId: 'run-1',
      current: 1,
      size: 200,
      onlyBad: false,
    });
  });

  it('坏例处置保存后刷新并回调', async () => {
    const { props } = renderView({ caseId: 'case-1' });
    const dialog = await screen.findByRole('dialog');
    const view = within(dialog);
    await view.findByText('按体温分级处理。');

    fireEvent.change(view.getByRole('combobox'), { target: { value: 'FIXED' } });
    fireEvent.change(view.getByPlaceholderText('不填写则保持未指派'), {
      target: { value: '李四' },
    });
    fireEvent.change(view.getByPlaceholderText('记录修复动作或回归结论'), {
      target: { value: '已回归验证' },
    });
    fireEvent.click(view.getByRole('button', { name: /保存处置/ }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock).toHaveBeenCalledWith({
      badcaseId: 'bc-1',
      status: 'FIXED',
      owner: '李四',
      note: '已回归验证',
    });
    await waitFor(() => expect(props.onBadcaseUpdated).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(
      '坏例已更新',
      'case-1 · FIXED',
      'success',
    );
  });

  it('逐题结果未命中或加载失败时给出提示', async () => {
    pageCasesMock.mockResolvedValue({ records: [], total: 0 });
    renderView({ caseId: 'case-9' });
    expect(
      await screen.findByText('本次跑批未返回该题明细'),
    ).toBeInTheDocument();
    expect(screen.getByText('当前不是坏例台账记录')).toBeInTheDocument();

    cleanup();
    pageCasesMock.mockResolvedValue(undefined);
    renderView({ caseId: 'case-8' });
    expect(await screen.findByText('逐题结果加载失败')).toBeInTheDocument();
  });

  it('无跑批时明细抽屉提示缺少逐题数据', async () => {
    listMock.mockResolvedValue({
      records: [{ badcaseId: 'bc-2', caseId: 'case-2', status: 'OPEN' }],
      total: 1,
    });
    renderView({
      caseId: 'case-1',
      runDetail: null,
      overview: { kbId: 'kb-1', lastRun: null },
    });
    const dialog = await screen.findByRole('dialog');
    const view = within(dialog);
    expect(view.getByText('无跑批')).toBeInTheDocument();
    expect(await view.findByText('接口未返回答案')).toBeInTheDocument();
    expect(view.getByText('接口未返回命中证据。')).toBeInTheDocument();
    expect(view.getByText('接口未返回逐题指标。')).toBeInTheDocument();
    expect(view.getByText('接口未返回阶段轨迹。')).toBeInTheDocument();
    expect(pageCasesMock).not.toHaveBeenCalled();
    fireEvent.click(view.getAllByRole('button', { name: '关闭' })[0]);
  });
});
