import { AI_QA_AGENT_CODE } from '@/pages/ai/agent-run-drawer';
import { asRecord, textOf } from '@/pages/ai/shared';
import {
  interruptAiChat,
  streamAiChat,
  type AiChatEvent,
  type AiChatStreamHandle,
} from '@/services/ai';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 知识助手的一轮消息：只保留正文与命中标题，逐条证据仍在检索调试里看。 */
export interface AssistantTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  hits: string[];
  status: 'streaming' | 'done' | 'stopped' | 'error';
  error?: string;
}

function hitTitles(result: unknown): string[] {
  const record = asRecord(result);
  const rawHits = record?.hits;
  if (!Array.isArray(rawHits)) {
    return [];
  }
  const titles: string[] = [];
  rawHits.forEach((item) => {
    const title = textOf(asRecord(item)?.title);
    if (title) {
      titles.push(title);
    }
  });
  return titles;
}

/**
 * 知识助手对话：把问答智能体的 SSE 会话收成「用户问 + 助手答」两列消息。
 *
 * <p>会话 ID 由后端在首轮返回，后续轮次沿用它；关闭面板只中断当前流，不删后端会话。
 * 页面上下文每轮随请求下发，后端并入提示词变量，让助手知道用户当前在看什么。
 */
/** 模型迟迟不出字时停止等待，避免气泡一直空着。 */
const NO_CONTENT_TIMEOUT_MS = 90000;

export function useKnowledgeAssistantChat(
  kbId: string,
  pageContext?: Record<string, string>,
) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<AiChatStreamHandle | null>(null);
  const abortedRef = useRef(false);
  const conversationRef = useRef('');
  const counterRef = useRef(0);
  const pageContextRef = useRef<Record<string, string> | undefined>(pageContext);

  useEffect(() => {
    pageContextRef.current = pageContext;
  }, [pageContext]);

  useEffect(
    () => () => {
      streamRef.current?.abort();
    },
    [],
  );

  const updateTurn = (id: string, updater: (turn: AssistantTurn) => AssistantTurn) => {
    setTurns((prev) => prev.map((turn) => (turn.id === id ? updater(turn) : turn)));
  };

  const applyEvent = (turnId: string, event: AiChatEvent) => {
    const data = asRecord(event.data);
    switch (event.type) {
      case 'meta': {
        const next = textOf(data?.conversationId);
        if (next) {
          conversationRef.current = next;
        }
        return;
      }
      case 'token': {
        const text = textOf(data?.text);
        if (text) {
          updateTurn(turnId, (turn) => ({ ...turn, content: turn.content + text }));
        }
        return;
      }
      case 'tool_result': {
        const titles = hitTitles(data?.result);
        if (titles.length) {
          updateTurn(turnId, (turn) => ({ ...turn, hits: titles }));
        }
        return;
      }
      case 'done': {
        const content = textOf(data?.content);
        updateTurn(turnId, (turn) => ({
          ...turn,
          content: content || turn.content,
          status: 'done',
        }));
        return;
      }
      case 'error': {
        updateTurn(turnId, (turn) => ({
          ...turn,
          status: 'error',
          error: textOf(data?.message) || '问答失败',
        }));
        return;
      }
      default:
        return;
    }
  };

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || streamRef.current) {
        return;
      }
      const stamp = Date.now() + counterRef.current++;
      const answerId = `assistant-${stamp}`;
      setTurns((prev) => [
        ...prev,
        {
          id: `user-${stamp}`,
          role: 'user',
          content: trimmed,
          hits: [],
          status: 'done',
        },
        {
          id: answerId,
          role: 'assistant',
          content: '',
          hits: [],
          status: 'streaming',
        },
      ]);
      setStreaming(true);
      abortedRef.current = false;
      const handle = streamAiChat(
        {
          agentCode: AI_QA_AGENT_CODE,
          conversationId: conversationRef.current || undefined,
          kbId,
          userInput: trimmed,
          context: pageContextRef.current,
        },
        {
          onEvent: (event) => applyEvent(answerId, event),
          onError: (message) =>
            updateTurn(answerId, (turn) => ({ ...turn, status: 'error', error: message })),
        },
      );
      streamRef.current = handle;
      const watchdog = window.setTimeout(() => {
        if (streamRef.current !== handle) {
          return;
        }
        abortedRef.current = true;
        handle.abort();
        streamRef.current = null;
        setStreaming(false);
        updateTurn(answerId, (turn) =>
          turn.status === 'streaming'
            ? {
                ...turn,
                status: 'error',
                error: '模型服务 90 秒没有返回内容，已停止等待，请重试或换一种问法',
              }
            : turn,
        );
      }, NO_CONTENT_TIMEOUT_MS);
      void handle.done.finally(() => {
        window.clearTimeout(watchdog);
        if (streamRef.current === handle) {
          streamRef.current = null;
        }
        setStreaming(false);
        // 流结束但没收到 done/error：有正文按完成收尾，空正文如实报错，别留空气泡
        if (abortedRef.current) {
          abortedRef.current = false;
          return;
        }
        updateTurn(answerId, (turn) =>
          turn.status === 'streaming'
            ? turn.content
              ? { ...turn, status: 'done' }
              : { ...turn, status: 'error', error: '连接已结束但没有收到模型回复，请重试' }
            : turn,
        );
      });
    },
    [kbId],
  );

  /** 本地汇总类回答（资料缺口）不走模型，直接落一条助手消息。 */
  const answerLocally = useCallback((question: string, content: string) => {
    const stamp = Date.now() + counterRef.current++;
    setTurns((prev) => [
      ...prev,
      { id: `user-${stamp}`, role: 'user', content: question, hits: [], status: 'done' },
      {
        id: `assistant-${stamp}`,
        role: 'assistant',
        content,
        hits: [],
        status: 'done',
      },
    ]);
  }, []);

  const stop = useCallback(() => {
    abortedRef.current = true;
    streamRef.current?.abort();
    streamRef.current = null;
    setTurns((prev) =>
      prev.map((turn) =>
        turn.status === 'streaming' ? { ...turn, status: 'stopped' } : turn,
      ),
    );
    setStreaming(false);
    if (conversationRef.current) {
      void interruptAiChat(AI_QA_AGENT_CODE, conversationRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    abortedRef.current = true;
    streamRef.current?.abort();
    streamRef.current = null;
    conversationRef.current = '';
    setTurns([]);
    setStreaming(false);
  }, []);

  return { turns, streaming, ask, answerLocally, stop, reset };
}
