import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentRunDrawer } from '@/pages/ai/agent-run-drawer';
import type { AiAgentRecord, AiChatEvent, AiChatStreamCallbacks } from '@/services/ai';

vi.mock('@/services/knowledgeBase', () => ({
  pageKnowledgeBase: vi.fn().mockResolvedValue({
    records: [{ kbId: 'kb-1', name: '测试库' }],
    total: 1,
    size: 100,
    current: 1,
  }),
}));

vi.mock('@/services/ai', () => ({
  getAiRuntimeStatus: vi.fn(),
  interruptAiChat: vi.fn(),
  streamAiChat: vi.fn((_payload: unknown, callbacks: AiChatStreamCallbacks) => {
    window.setTimeout(() => {
      const emit = (event: AiChatEvent) => callbacks.onEvent(event);
      emit({ type: 'meta', data: { conversationId: 'conv-1' } } as AiChatEvent);
      emit({
        type: 'tool_call',
        data: {
          name: 'future_brain_knowledge_search',
          // galaxy 下发的 arguments 也是 JSON 字符串
          arguments: JSON.stringify({
            query: '门诊退费',
            'header:X-User-Session': 'secret-cookie-value',
          }),
        },
      } as AiChatEvent);
      emit({
        type: 'tool_result',
        data: {
          name: 'future_brain_knowledge_search',
          error: false,
          // galaxy 把工具返回按 JSON 字符串透传
          result: JSON.stringify({
            code: 200,
            data: {
              hits: [
                {
                  rank: 1,
                  materialTitle: 'MIS业务操作手册.pdf',
                  wikiTitle: '门诊退费流程',
                  content: '选择退费功能键',
                  score: 0.42,
                  materialId: 'm1',
                  wikiId: 'w1',
                },
                {
                  rank: 2,
                  materialTitle: '药事业务操作手册.pdf',
                  wikiTitle: '库存调整',
                  content: '库存冲正',
                  score: 0.2,
                  materialId: 'm2',
                  wikiId: 'w2',
                },
              ],
            },
          }),
        },
      } as AiChatEvent);
      emit({ type: 'token', data: { text: '按退费功能键操作。' } } as AiChatEvent);
      emit({
        type: 'done',
        data: { content: '按退费功能键操作。' },
      } as AiChatEvent);
    }, 0);
    return { abort: vi.fn(), done: Promise.resolve() };
  }),
}));

const agent: AiAgentRecord = {
  code: 'kb_qa_assistant',
  name: '知识库问答助手',
  status: 'published',
  statusLabel: '已发布',
  skillCodes: [],
  toolCodes: ['knowledge_search'],
};

describe('AgentRunDrawer 工具调用展示', () => {
  it('字符串返回也能回填结果卡片与检索证据，并对凭据打码', async () => {
    render(
      <AgentRunDrawer
        agent={agent}
        skills={[]}
        tools={[]}
        initialKbId="kb-1"
        initialQuestion="门诊退费怎么操作？"
        onClose={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('返回')).toBeTruthy());
    expect(screen.queryByText('执行中')).toBeNull();
    expect(screen.getByText('检索证据（2）')).toBeTruthy();
    expect(screen.getByText('MIS业务操作手册.pdf')).toBeTruthy();
    expect(screen.getByText('药事业务操作手册.pdf')).toBeTruthy();

    const text = document.body.textContent || '';
    expect(text).not.toContain('secret-cookie-value');
    expect(text).toContain('"header:X-User-Session":"***"');
  });
});
