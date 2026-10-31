import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CallLogPanel from '@/pages/ai/monitor/components/call-log-panel';
import type { CallEvent } from '@/pages/ai/monitor/mock';

vi.mock('@/pages/ai/shared', async () => {
  const React = await import('react');
  return {
    AiEmpty: ({
      title,
      action,
    }: {
      title: string;
      action?: ReactNode;
    }) => React.createElement('div', null, React.createElement('b', null, title), action),
  };
});

const events: CallEvent[] = [
  {
    id: 'req_1',
    at: Date.now(),
    toolCode: 'knowledge_search',
    toolName: '知识库检索',
    agentCode: 'agent_qa',
    agentName: '问答助手',
    status: 'success',
    durationMs: 320,
    args: {},
    resultSummary: '命中 2 条',
  },
  {
    id: 'req_2',
    at: Date.now(),
    toolCode: 'future_brain_knowledge_search',
    toolName: '知识库检索（远端）',
    agentCode: 'agent_qa',
    agentName: '问答助手',
    status: 'failed',
    durationMs: 2500,
    args: {},
    resultSummary: '未返回业务结果',
    errorLabel: '无权限访问知识库',
  },
  {
    id: 'req_3',
    at: Date.now(),
    toolCode: 'current_time',
    toolName: '当前时间',
    agentCode: 'agent_qa',
    agentName: '问答助手',
    status: 'timeout',
    durationMs: 9000,
    args: {},
    resultSummary: '未返回业务结果',
    errorLabel: '调用超时（> 8s）',
  },
];

const counts = { all: 3, success: 1, failed: 1, timeout: 1 };

function renderPanel(overrides: Partial<React.ComponentProps<typeof CallLogPanel>> = {}) {
  const props = {
    events,
    totalEvents: 10,
    counts,
    keyword: '',
    onKeyword: vi.fn(),
    status: 'all' as const,
    onStatus: vi.fn(),
    toolCode: '',
    onClearTool: vi.fn(),
    visible: 2,
    onLoadMore: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<CallLogPanel {...props} />) };
}

describe('CallLogPanel', () => {
  it('渲染表格行、状态标签与分页信息', () => {
    const { container } = renderPanel();

    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    expect(screen.getByText('req_1')).toBeInTheDocument();
    expect(screen.getByText('req_2')).toBeInTheDocument();
    // visible=2，只展示前两条
    expect(screen.queryByText('req_3')).not.toBeInTheDocument();
    const tbody = container.querySelector('tbody') as HTMLElement;
    expect(within(tbody).getByText('成功')).toBeInTheDocument();
    expect(within(tbody).getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('2,500 ms')).toHaveClass('slow');
    expect(screen.getByText('显示 2 / 3 条')).toBeInTheDocument();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /加载更多/ })).toBeInTheDocument();
  });

  it('交互回调：搜索、状态、清除工具、加载更多与查看详情', () => {
    const { props } = renderPanel();

    fireEvent.change(
      screen.getByPlaceholderText('搜索工具、智能体或调用 ID'),
      { target: { value: 'req_1' } },
    );
    expect(props.onKeyword).toHaveBeenCalledWith('req_1');

    fireEvent.click(screen.getByRole('button', { name: /^失败/ }));
    expect(props.onStatus).toHaveBeenCalledWith('failed');

    fireEvent.click(screen.getByRole('button', { name: /加载更多/ }));
    expect(props.onLoadMore).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: /详情/ })[0]);
    expect(props.onOpen).toHaveBeenCalledWith(events[0]);
  });

  it('存在工具筛选时展示筛选芯片并支持清除', () => {
    const { props } = renderPanel({ toolCode: 'current_time' });
    expect(screen.getByText('工具：current_time')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /工具：current_time/ }),
    );
    expect(props.onClearTool).toHaveBeenCalledTimes(1);
  });

  it('末尾时显示已到末尾且没有加载更多', () => {
    renderPanel({ visible: 3 });
    expect(screen.getByText('显示 3 / 3 条')).toBeInTheDocument();
    expect(screen.getByText('已到末尾')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /加载更多/ }),
    ).not.toBeInTheDocument();
  });

  it('无数据时区分「范围内为空」与「筛选无匹配」', () => {
    const { rerender, props } = renderPanel({
      events: [],
      totalEvents: 0,
      counts: { all: 0, success: 0, failed: 0, timeout: 0 },
    });
    expect(screen.getByText('该时间范围内没有调用')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '清空筛选' }),
    ).not.toBeInTheDocument();

    rerender(
      <CallLogPanel
        {...props}
        events={[]}
        totalEvents={0}
        counts={{ all: 0, success: 0, failed: 0, timeout: 0 }}
        keyword="不存在"
      />,
    );
    expect(screen.getByText('没有匹配的调用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
    expect(props.onKeyword).toHaveBeenCalledWith('');
    expect(props.onStatus).toHaveBeenCalledWith('all');
    expect(props.onClearTool).toHaveBeenCalledTimes(1);
  });
});
