import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CallDetailDrawer from '@/pages/ai/monitor/components/call-detail-drawer';
import type { CallEvent } from '@/pages/ai/monitor/mock';

const baseEvent: CallEvent = {
  id: 'req_success_1',
  at: new Date('2026-10-28T10:20:30+08:00').getTime(),
  toolCode: 'knowledge_search',
  toolName: '知识库检索',
  agentCode: 'agent_fb_qa_assistant',
  agentName: '知识库问答助手',
  status: 'success',
  durationMs: 320,
  args: { kbId: 'kb_1', query: '排班制度' },
  resultSummary: '命中 2 条',
};

describe('CallDetailDrawer', () => {
  it('渲染成功调用的元信息、入参与返回摘要', () => {
    render(<CallDetailDrawer event={baseEvent} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('调用详情')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('知识库检索')).toBeInTheDocument();
    expect(screen.getByText('知识库问答助手')).toBeInTheDocument();
    expect(screen.getByText('320 ms')).toBeInTheDocument();
    expect(screen.getByText(/10-28 10:20:30/)).toBeInTheDocument();
    expect(screen.getByText(/kbId/)).toBeInTheDocument();
    expect(screen.getByText(/排班制度/)).toBeInTheDocument();
    expect(screen.getByText('命中 2 条')).toBeInTheDocument();
    // 成功调用没有错误提示
    expect(screen.queryByText('调用失败')).not.toBeInTheDocument();
    expect(screen.queryByText('调用超时')).not.toBeInTheDocument();
  });

  it('失败与超时调用展示状态与错误原因', () => {
    const { rerender } = render(
      <CallDetailDrawer
        event={{
          ...baseEvent,
          status: 'failed',
          errorLabel: '无权限访问知识库',
          errorMessage: '检索失败：当前租户无权访问知识库 kb_1',
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('调用失败')).toBeInTheDocument();
    expect(
      screen.getByText('检索失败：当前租户无权访问知识库 kb_1'),
    ).toBeInTheDocument();

    rerender(
      <CallDetailDrawer
        event={{
          ...baseEvent,
          status: 'timeout',
          errorMessage: '工具调用超时：等待上游响应超过 8s 被中断',
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('超时')).toBeInTheDocument();
    expect(screen.getByText('调用超时')).toBeInTheDocument();
    expect(
      screen.getByText('工具调用超时：等待上游响应超过 8s 被中断'),
    ).toBeInTheDocument();
  });

  it('关闭按钮、遮罩与 Esc 都会触发 onClose', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <CallDetailDrawer event={baseEvent} onClose={onClose} />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as Element);
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<CallDetailDrawer event={baseEvent} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
