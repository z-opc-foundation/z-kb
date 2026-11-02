import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiChatStreamCallbacks } from '@/services/ai';
import type { KbOverview } from '@/services/overview';
import { KnowledgeAssistant } from './knowledge-assistant';

vi.mock('@/services/ai', () => ({
  getAiRuntimeStatus: vi.fn().mockResolvedValue({
    runtime: 'local-standin',
    model: 'local-standin',
    realModel: false,
  }),
  streamAiChat: vi.fn(),
  interruptAiChat: vi.fn(),
}));

import { getAiRuntimeStatus, streamAiChat } from '@/services/ai';

const stats: KbOverview = {
  kbId: 'kb-1',
  fileCount: 4,
  compiledCount: 1,
  partialCount: 1,
  notCompiledCount: 2,
  wikiCount: 1,
  runningTaskCount: 1,
  failedCount: 0,
  recentMaterials: [
    {
      materialId: 'mat-1',
      kbId: 'kb-1',
      materialType: 'DOCUMENT',
      title: '排班管理制度',
      sourceType: 'UPLOAD',
      materialStatus: 'ACTIVE',
      fingerprint: 'f1',
      compileStatus: 'PENDING',
      governanceStatus: 'NORMAL',
      registeredBy: 1,
      registeredAt: '2026-10-27T10:00:00',
      parseStatus: 'READY',
      updateTime: '2026-10-27T10:00:00',
    },
  ],
  refreshedAt: '2026-10-27T10:00:00',
};

const baseProps = {
  kbId: 'kb-1',
  kbName: '临床知识库',
  canWrite: true,
  onUpload: vi.fn(),
  onGoTasks: vi.fn(),
  onRefresh: vi.fn(),
};

function renderAssistant(overrides: Partial<Parameters<typeof KnowledgeAssistant>[0]> = {}) {
  return render(<KnowledgeAssistant {...baseProps} stats={stats} {...overrides} />);
}

/** 等待运行时状态这类挂载后的异步更新落定，避免 act 告警。 */
async function flushAsyncUpdates() {
  await act(async () => {});
}

describe('知识助手面板', () => {
  beforeEach(() => {
    vi.mocked(streamAiChat).mockReset();
    vi.mocked(getAiRuntimeStatus).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('按库统计展示编译缺口与运行中任务', async () => {
    renderAssistant();
    await flushAsyncUpdates();
    expect(screen.getByText('知识助手')).toBeTruthy();
    expect(screen.getByText(/1 个编译任务在跑/)).toBeTruthy();
    expect(screen.getByText('3 未完成')).toBeTruthy();
    expect(screen.getByText('排班管理制度')).toBeTruthy();
  });

  it('「还差什么」走本地汇总，不调用模型', async () => {
    renderAssistant();
    await flushAsyncUpdates();
    fireEvent.click(screen.getByText('还差什么'));
    expect(streamAiChat).not.toHaveBeenCalled();
    expect(screen.getByText(/资料 4 份：已编译 1，部分编译 1，未编译 2/)).toBeTruthy();
  });

  it('提问时带当前库调用问答智能体，流式回答并显示引用数', async () => {
    let callbacks: AiChatStreamCallbacks | undefined;
    vi.mocked(streamAiChat).mockImplementation((payload, cbs) => {
      callbacks = cbs;
      return { abort: vi.fn(), done: Promise.resolve() };
    });
    renderAssistant({ stats: null });
    await flushAsyncUpdates();

    fireEvent.change(screen.getByPlaceholderText(/问这个库/), {
      target: { value: '排班规则有哪些限制？' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTitle('发送'));
    });

    expect(streamAiChat).toHaveBeenCalledWith(
      expect.objectContaining({
        agentCode: 'kb_qa_assistant',
        kbId: 'kb-1',
        userInput: '排班规则有哪些限制？',
      }),
      expect.any(Object),
    );

    act(() => {
      callbacks?.onEvent({
        type: 'meta',
        data: { conversationId: 'conv-1' },
      });
      callbacks?.onEvent({ type: 'token', data: { text: '排班需提前一天提交。' } });
      callbacks?.onEvent({
        type: 'tool_result',
        data: { result: { hits: [{ title: '排班管理制度' }, { title: '交接班规范' }] } },
      });
      callbacks?.onEvent({ type: 'done', data: {} });
    });

    expect(screen.getByText(/排班需提前一天提交/)).toBeTruthy();
    expect(screen.getByText(/本轮引用 2 条/)).toBeTruthy();
  });
});
