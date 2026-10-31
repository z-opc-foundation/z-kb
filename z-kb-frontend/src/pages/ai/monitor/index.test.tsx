import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CallMonitorPage from '@/pages/ai/monitor/index';
import type {
  CallEvent,
  MonitorSnapshot,
} from '@/pages/ai/monitor/mock';
import { useCallMonitor } from '@/pages/ai/monitor/hooks/use-call-monitor';

vi.mock('@/pages/ai/monitor/hooks/use-call-monitor', () => ({
  useCallMonitor: vi.fn(),
}));

vi.mock('@/pages/ai/shared', async () => {
  const React = await import('react');
  return {
    AiLoading: ({ text }: { text: string }) =>
      React.createElement('div', null, text),
    AiEmpty: ({
      title,
      action,
    }: {
      title: string;
      action?: ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('b', null, title),
        action,
      ),
  };
});

const NOW = new Date('2026-10-28T10:00:00+08:00').getTime();

function makeEvent(
  id: string,
  status: CallEvent['status'],
  overrides: Partial<CallEvent> = {},
): CallEvent {
  return {
    id,
    at: NOW - 60_000,
    toolCode: 'knowledge_search',
    toolName: '知识库检索',
    agentCode: 'agent_fb_qa_assistant',
    agentName: '知识库问答助手',
    status,
    durationMs: 320,
    args: { kbId: 'kb_1', query: '排班制度' },
    resultSummary: '命中 2 条',
    ...overrides,
  };
}

const events: CallEvent[] = [
  makeEvent('req_1', 'success'),
  makeEvent('req_2', 'failed', {
    durationMs: 2500,
    resultSummary: '未返回业务结果',
    errorLabel: '无权限访问知识库',
    errorMessage: '检索失败：当前租户无权访问知识库 kb_1',
  }),
  makeEvent('req_3', 'timeout', {
    toolCode: 'future_brain_knowledge_search',
    toolName: '知识库检索（远端）',
    durationMs: 9000,
    resultSummary: '未返回业务结果',
    errorLabel: '调用超时（> 8s）',
    errorMessage: '工具调用超时',
  }),
  makeEvent('req_4', 'success', {
    toolCode: 'current_time',
    toolName: '当前时间',
    durationMs: 12,
    args: { timezone: 'Asia/Shanghai' },
    resultSummary: '10-28 10:00:00 +08:00',
  }),
];

const snapshot: MonitorSnapshot = {
  events,
  stats: {
    total: 4,
    success: 2,
    failed: 2,
    successRate: 50,
    avgMs: 2958,
    p95Ms: 9000,
  },
  trend: [
    { key: 't1', label: '09:00', success: 2, failed: 1, total: 3 },
    { key: 't2', label: '10:00', success: 0, failed: 1, total: 1 },
  ],
  toolStats: [
    {
      toolCode: 'knowledge_search',
      toolName: '知识库检索',
      calls: 2,
      successRate: 50,
      avgMs: 1410,
      p95Ms: 2500,
    },
    {
      toolCode: 'future_brain_knowledge_search',
      toolName: '知识库检索（远端）',
      calls: 1,
      successRate: 0,
      avgMs: 9000,
      p95Ms: 9000,
    },
    {
      toolCode: 'current_time',
      toolName: '当前时间',
      calls: 1,
      successRate: 100,
      avgMs: 12,
      p95Ms: 12,
    },
  ],
  failureStats: [
    { label: '调用超时（> 8s）', count: 1, share: 50 },
    { label: '无权限访问知识库', count: 1, share: 50 },
  ],
};

const previous: MonitorSnapshot = {
  events: [],
  stats: {
    total: 5,
    success: 4,
    failed: 1,
    successRate: 80,
    avgMs: 1200,
    p95Ms: 3000,
  },
  trend: [],
  toolStats: [],
  failureStats: [],
};

const refresh = vi.fn();

function setMonitorState(state: {
  loading: boolean;
  snapshot?: MonitorSnapshot;
  previous?: MonitorSnapshot;
}) {
  vi.mocked(useCallMonitor).mockReturnValue({ ...state, refresh });
}

describe('CallMonitorPage', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(useCallMonitor).mockReset();
  });

  it('首次加载展示加载提示', () => {
    setMonitorState({ loading: true });
    render(<CallMonitorPage />);
    expect(screen.getByText('正在汇总调用记录…')).toBeInTheDocument();
    expect(useCallMonitor).toHaveBeenCalledWith('24h');
  });

  it('加载成功后渲染统计、趋势、排行、失败原因与明细', () => {
    setMonitorState({ loading: false, snapshot, previous });
    render(<CallMonitorPage />);

    expect(screen.getByText('共 4 次 · 失败 2 次')).toBeInTheDocument();
    expect(screen.getByText('调用趋势')).toBeInTheDocument();
    expect(screen.getAllByText('成功').length).toBeGreaterThan(0);
    expect(screen.getByText('工具调用排行')).toBeInTheDocument();
    expect(screen.getByText('失败原因分布')).toBeInTheDocument();
    expect(screen.getByText('调用明细')).toBeInTheDocument();
    expect(screen.getByText('req_1')).toBeInTheDocument();
    expect(screen.getByText('req_2')).toBeInTheDocument();
    expect(screen.getByText('req_3')).toBeInTheDocument();
    expect(screen.getByText('req_4')).toBeInTheDocument();
  });

  it('切换范围与刷新会调用 hook', () => {
    setMonitorState({ loading: false, snapshot, previous });
    render(<CallMonitorPage />);

    fireEvent.click(screen.getByRole('button', { name: '最近 7 天' }));
    expect(useCallMonitor).toHaveBeenLastCalledWith('7d');
    expect(screen.getAllByText('最近 7 天').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('按状态与关键字筛选明细，并可清空筛选', () => {
    setMonitorState({ loading: false, snapshot, previous });
    render(<CallMonitorPage />);

    fireEvent.click(screen.getByRole('button', { name: /^失败/ }));
    expect(screen.getByText('req_2')).toBeInTheDocument();
    expect(screen.queryByText('req_1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^全部/ }));
    fireEvent.change(
      screen.getByPlaceholderText('搜索工具、智能体或调用 ID'),
      { target: { value: 'req_3' } },
    );
    expect(screen.getByText('req_3')).toBeInTheDocument();
    expect(screen.queryByText('req_1')).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText('搜索工具、智能体或调用 ID'),
      { target: { value: '不存在的关键字' } },
    );
    expect(screen.getByText('没有匹配的调用')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
    expect(screen.getByText('req_1')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('搜索工具、智能体或调用 ID'),
    ).toHaveValue('');
  });

  it('点击工具排行按工具筛选，并可通过芯片清除', () => {
    setMonitorState({ loading: false, snapshot, previous });
    const { container } = render(<CallMonitorPage />);

    const rankingRows = Array.from(
      container.querySelectorAll<HTMLElement>('.ai-monitor-ranking tbody tr'),
    );
    const remoteRow = rankingRows.find((row) =>
      row.textContent?.includes('future_brain_knowledge_search'),
    ) as HTMLElement;
    fireEvent.click(remoteRow);

    expect(
      screen.getByText('工具：future_brain_knowledge_search'),
    ).toBeInTheDocument();
    expect(screen.getByText('req_3')).toBeInTheDocument();
    expect(screen.queryByText('req_1')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /工具：future_brain_knowledge_search/,
      }),
    );
    expect(screen.getByText('req_1')).toBeInTheDocument();
    expect(screen.queryByText(/工具：future_brain/)).not.toBeInTheDocument();
  });

  it('打开调用详情抽屉并关闭', () => {
    setMonitorState({ loading: false, snapshot, previous });
    render(<CallMonitorPage />);

    fireEvent.click(screen.getAllByRole('button', { name: /详情/ })[0]);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('调用详情')).toBeInTheDocument();
    expect(within(dialog).getByText('req_1')).toBeInTheDocument();
    expect(within(dialog).getByText(/排班制度/)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('时间范围内没有调用时展示空态', () => {
    setMonitorState({
      loading: false,
      snapshot: {
        ...snapshot,
        events: [],
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          successRate: 0,
          avgMs: 0,
          p95Ms: 0,
        },
        trend: [],
        toolStats: [],
        failureStats: [],
      },
      previous,
    });
    render(<CallMonitorPage />);

    expect(screen.getByText('该时间范围内没有调用')).toBeInTheDocument();
    expect(screen.getByText('共 0 次 · 失败 0 次')).toBeInTheDocument();
  });

  it('明细超过 30 条时可加载更多', () => {
    const many = Array.from({ length: 35 }, (_, index) =>
      makeEvent(`bulk_${index + 1}`, 'success', { at: NOW - index * 1000 }),
    );
    setMonitorState({
      loading: false,
      snapshot: {
        ...snapshot,
        events: many,
        stats: {
          total: 35,
          success: 35,
          failed: 0,
          successRate: 100,
          avgMs: 320,
          p95Ms: 320,
        },
        trend: [],
        toolStats: [],
        failureStats: [],
      },
      previous,
    });
    render(<CallMonitorPage />);

    expect(screen.getByText('显示 30 / 35 条')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /加载更多/ }));
    expect(screen.getByText('显示 35 / 35 条')).toBeInTheDocument();
    expect(screen.getByText('已到末尾')).toBeInTheDocument();
  });
});
