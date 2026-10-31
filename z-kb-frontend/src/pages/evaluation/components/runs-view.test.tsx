import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EvalOverview, EvalRunRecord } from '@/services/evaluation';
import RunsView from './runs-view';

const OVERVIEW: EvalOverview = {
  kbId: 'kb-1',
  kbName: '护理知识库',
  dataset: { versionNo: 'v3', status: 'PUBLISHED', caseCount: 12 },
  lastRun: {
    runId: 'run-1',
    status: 'COMPLETED',
    resultUsable: true,
    finishedAt: '2026-10-20T10:00:00',
  },
};

const RUNS: EvalRunRecord[] = [
  {
    runId: 'run-1',
    kbId: 'kb-1',
    status: 'COMPLETED',
    resultUsable: true,
    datasetVersionNo: 'v3',
    configVersion: 'cfg-9',
    judgeMode: 'RULE',
    judgeVersion: 'j1',
    snapshotId: 'snap-1',
    durationMs: 65000,
    finishedAt: '2026-10-20T10:00:00',
  },
  {
    runId: 'run-0',
    kbId: 'kb-1',
    status: 'FAILED',
    resultUsable: false,
    datasetVersionNo: 'v2',
    finishedAt: '2026-10-18T10:00:00',
  },
];

function renderView(overrides: Partial<ComponentProps<typeof RunsView>> = {}) {
  const props = {
    overview: OVERVIEW,
    runs: RUNS,
    currentRunId: 'run-1',
    baselineRunId: '',
    onOpenRun: vi.fn(),
    onSetBaseline: vi.fn(),
    onCreateRun: vi.fn(),
    ...overrides,
  };
  return { ...render(<RunsView {...props} />), props };
}

afterEach(() => {
  cleanup();
});

describe('RunsView', () => {
  it('空跑批列表展示空态与发起入口', () => {
    const { props } = renderView({ runs: [], currentRunId: '' });
    expect(screen.getByText('还没有已加载的跑批记录')).toBeInTheDocument();
    expect(screen.getByText('本会话已知跑批')).toBeInTheDocument();
    expect(screen.getByText('未指定')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /发起跑批/ })[0]);
    expect(props.onCreateRun).toHaveBeenCalledTimes(1);
  });

  it('展示跑批记录、当前/基线标记与版本信息', () => {
    renderView();
    expect(screen.getAllByText('run-1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('本次')).toBeInTheDocument();
    expect(screen.getByText('run-0')).toBeInTheDocument();
    expect(screen.getAllByText('v3').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('cfg-9')).toBeInTheDocument();
    expect(screen.getByText('RULE · j1')).toBeInTheDocument();
    expect(screen.getByText('snap-1')).toBeInTheDocument();
    expect(screen.getByText('1m 5s')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getAllByText('失败').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('可用')).toBeInTheDocument();
    expect(screen.getByText('2 条 · 会话缓存按租户与知识库隔离')).toBeInTheDocument();
  });

  it('点击行 / 查看打开跑批，设为基线回调', () => {
    const { props } = renderView();
    fireEvent.click(screen.getByText('run-0'));
    expect(props.onOpenRun).toHaveBeenCalledWith('run-0');

    fireEvent.click(screen.getAllByRole('button', { name: '查看' })[0]);
    expect(props.onOpenRun).toHaveBeenCalledWith('run-1');

    fireEvent.click(screen.getAllByRole('button', { name: '设为基线' })[0]);
    expect(props.onSetBaseline).toHaveBeenCalledWith('run-1');
  });

  it('切换基线下拉框', () => {
    const { props } = renderView();
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('');
    fireEvent.change(select, { target: { value: 'run-0' } });
    expect(props.onSetBaseline).toHaveBeenCalledWith('run-0');
    fireEvent.change(select, { target: { value: '' } });
    expect(props.onSetBaseline).toHaveBeenCalledWith(undefined);
  });

  it('已选基线时展示基线标记并支持取消', () => {
    const { props } = renderView({ baselineRunId: 'run-0' });
    expect(screen.getByText('基线')).toBeInTheDocument();
    expect(screen.getByText('run-0', { selector: 'span.mono' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('run-0');
    fireEvent.click(screen.getByRole('button', { name: '取消基线' }));
    expect(props.onSetBaseline).toHaveBeenCalledWith(undefined);
  });
});
