import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AiChatEvent,
  AiChatStreamCallbacks,
  AiChatStreamHandle,
  AiChatStreamPayload,
} from '@/services/ai';

vi.mock('@/services/ai', () => ({
  streamAiChat: vi.fn(),
  interruptAiChat: vi.fn(),
}));

import { interruptAiChat, streamAiChat } from '@/services/ai';
import { useKnowledgeAssistantChat } from './use-knowledge-assistant-chat';

interface StreamCall {
  payload: AiChatStreamPayload;
  callbacks: AiChatStreamCallbacks;
  handle: AiChatStreamHandle;
  resolve: () => void;
}

let streams: StreamCall[] = [];

function emit(index: number, event: AiChatEvent) {
  act(() => {
    streams[index].callbacks.onEvent(event);
  });
}

beforeEach(() => {
  streams = [];
  vi.clearAllMocks();
  vi.mocked(streamAiChat).mockImplementation((payload, callbacks) => {
    let resolve: () => void = () => {};
    const done = new Promise<void>((settle) => {
      resolve = settle;
    });
    const handle: AiChatStreamHandle = { abort: vi.fn(), done };
    streams.push({ payload, callbacks, handle, resolve });
    return handle;
  });
  vi.mocked(interruptAiChat).mockResolvedValue(true);
});

afterEach(() => {
  streams.forEach((stream) => stream.resolve());
  vi.clearAllMocks();
});

describe('useKnowledgeAssistantChat', () => {
  it('提问携带页面上下文，token、命中与 done 汇总到助手消息', async () => {
    const { result } = renderHook(() =>
      useKnowledgeAssistantChat('kb-1', { view: 'workspace' }),
    );

    act(() => result.current.ask('  护理制度有哪些？ '));
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0]).toMatchObject({
      role: 'user',
      content: '护理制度有哪些？',
      status: 'done',
    });
    expect(result.current.turns[1]).toMatchObject({
      role: 'assistant',
      content: '',
      status: 'streaming',
    });
    expect(result.current.streaming).toBe(true);
    expect(streams).toHaveLength(1);
    expect(streams[0].payload).toMatchObject({
      agentCode: 'kb_qa_assistant',
      kbId: 'kb-1',
      userInput: '护理制度有哪些？',
      context: { view: 'workspace' },
    });
    expect(streams[0].payload.conversationId).toBeUndefined();

    emit(0, { type: 'meta', data: { conversationId: 'conv-1' } });
    emit(0, { type: 'token', data: { text: '护理' } });
    emit(0, { type: 'token', data: { text: '制度' } });
    expect(result.current.turns[1].content).toBe('护理制度');

    emit(0, {
      type: 'tool_result',
      data: { result: { hits: [{ title: '制度A' }, { title: '' }, { title: '制度B' }] } },
    });
    expect(result.current.turns[1].hits).toEqual(['制度A', '制度B']);

    emit(0, { type: 'done', data: { content: '完整回答内容' } });
    expect(result.current.turns[1]).toMatchObject({
      content: '完整回答内容',
      status: 'done',
    });

    streams[0].resolve();
    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.turns[1].status).toBe('done');
  });

  it('后续提问沿用首轮返回的 conversationId', async () => {
    const { result } = renderHook(() => useKnowledgeAssistantChat('kb-1'));

    act(() => result.current.ask('第一问'));
    emit(0, { type: 'meta', data: { conversationId: 'conv-9' } });
    emit(0, { type: 'done', data: { content: '第一答' } });
    streams[0].resolve();
    await waitFor(() => expect(result.current.streaming).toBe(false));

    act(() => result.current.ask('第二问'));
    expect(streams).toHaveLength(2);
    expect(streams[1].payload.conversationId).toBe('conv-9');
    expect(streams[1].payload.userInput).toBe('第二问');
    expect(result.current.turns).toHaveLength(4);

    streams[1].resolve();
    await waitFor(() => expect(result.current.streaming).toBe(false));
  });

  it('流式回调报错时记录错误状态与原因', async () => {
    const { result } = renderHook(() => useKnowledgeAssistantChat('kb-1'));

    act(() => result.current.ask('护理制度'));
    act(() => streams[0].callbacks.onError?.('网络异常'));
    expect(result.current.turns[1]).toMatchObject({
      status: 'error',
      error: '网络异常',
    });

    streams[0].resolve();
    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.turns[1].status).toBe('error');
  });

  it('停止生成时中断流并调用后端中断接口', async () => {
    const { result } = renderHook(() => useKnowledgeAssistantChat('kb-1'));

    act(() => result.current.ask('护理制度'));
    emit(0, { type: 'meta', data: { conversationId: 'conv-stop' } });
    act(() => result.current.stop());

    expect(streams[0].handle.abort).toHaveBeenCalled();
    expect(result.current.streaming).toBe(false);
    expect(result.current.turns[1].status).toBe('stopped');
    expect(interruptAiChat).toHaveBeenCalledWith('kb_qa_assistant', 'conv-stop');

    streams[0].resolve();
    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.turns[1].status).toBe('stopped');
  });

  it('重置会中断当前流、清空消息并丢弃会话 ID', async () => {
    const { result } = renderHook(() => useKnowledgeAssistantChat('kb-1'));

    act(() => result.current.ask('第一问'));
    emit(0, { type: 'meta', data: { conversationId: 'conv-reset' } });
    act(() => result.current.reset());

    expect(streams[0].handle.abort).toHaveBeenCalled();
    expect(result.current.turns).toEqual([]);
    expect(result.current.streaming).toBe(false);

    streams[0].resolve();
    await act(async () => {});

    act(() => result.current.ask('重新开始'));
    expect(streams).toHaveLength(2);
    expect(streams[1].payload.conversationId).toBeUndefined();
    streams[1].resolve();
    await waitFor(() => expect(result.current.streaming).toBe(false));
  });

  it('本地汇总回答直接追加完成消息，不请求模型', () => {
    const { result } = renderHook(() => useKnowledgeAssistantChat('kb-1'));

    act(() => result.current.answerLocally('资料缺口', '本地汇总：暂无资料'));

    expect(streamAiChat).not.toHaveBeenCalled();
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0]).toMatchObject({ role: 'user', content: '资料缺口' });
    expect(result.current.turns[1]).toMatchObject({
      role: 'assistant',
      content: '本地汇总：暂无资料',
      status: 'done',
    });
    expect(result.current.streaming).toBe(false);
  });

  it('空白提问被忽略，流式期间不重复发起请求', async () => {
    const { result } = renderHook(() => useKnowledgeAssistantChat('kb-1'));

    act(() => result.current.ask('   '));
    expect(result.current.turns).toEqual([]);
    expect(streams).toHaveLength(0);

    act(() => result.current.ask('第一问'));
    act(() => result.current.ask('第二问'));
    expect(streams).toHaveLength(1);
    expect(result.current.turns).toHaveLength(2);

    streams[0].resolve();
    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.turns[1]).toMatchObject({
      status: 'error',
      error: '连接已结束但没有收到模型回复，请重试',
    });
  });

  it('组件卸载时中断仍在进行的流', () => {
    const { result, unmount } = renderHook(() => useKnowledgeAssistantChat('kb-1'));

    act(() => result.current.ask('护理制度'));
    unmount();

    expect(streams[0].handle.abort).toHaveBeenCalled();
    streams[0].resolve();
  });
});
