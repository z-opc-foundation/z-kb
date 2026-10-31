import { type AiChatEvent } from '@/services/ai';
import {
  BIZ_TYPE_MODELING,
  interruptOntologyAgentChat,
  ONTOLOGY_MODELING_AGENT_CODE,
  streamOntologyAgentChat,
  type OntologyChatStreamHandle,
} from '@/services/ontology-modeling';
import { asRecord, textOf } from '@/pages/ai/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 一条消息：用户/助手正文，或工具调用与提案卡片等结构化消息。 */
export interface ModelingMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  kind?: 'tool_call' | 'tool_result' | 'proposal';
  content: string;
  toolName?: string;
  proposalCode?: string;
  proposalRowCount?: number;
  status: 'streaming' | 'done' | 'stopped' | 'error';
  error?: string;
}

/** 模型迟迟不出字时停止等待，避免气泡一直空着。 */
const NO_CONTENT_TIMEOUT_MS = 90000;

function findProposalCode(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProposalCode(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const direct = textOf(record.proposalCode);
  if (direct) {
    return direct;
  }
  for (const item of Object.values(record)) {
    const found = findProposalCode(item);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function resultText(data: Record<string, unknown>): string {
  const raw = data.result ?? data.content ?? data;
  try {
    const text = JSON.stringify(raw, null, 2);
    return text.length > 2000 ? `${text.slice(0, 2000)}\n…（已截断）` : text;
  } catch {
    return textOf(raw);
  }
}

/**
 * 本体建模多轮对话：消费 /v1/ontology/agent/chat/stream 的 SSE 事件流。
 * conversationId 由 galaxy-ai 首轮 meta 事件返回，续接轮随请求回传；
 * 工具调用与结果以结构化消息展示，提案落库信号通过 onProposal 回调通知外层刷新。
 */
export function useModelingChat(
  ontologyCode: string,
  onProposal?: (proposalCode: string) => void,
) {
  const [messages, setMessages] = useState<ModelingMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const streamRef = useRef<OntologyChatStreamHandle | null>(null);
  const abortedRef = useRef(false);
  const conversationRef = useRef('');
  const [conversationId, setConversationId] = useState('');
  const [conversationName, setConversationName] = useState('');
  const counterRef = useRef(0);
  const proposalRef = useRef(onProposal);
  useEffect(() => {
    proposalRef.current = onProposal;
  }, [onProposal]);

  useEffect(
    () => () => {
      streamRef.current?.abort();
    },
    [],
  );

  const update = (id: string, updater: (m: ModelingMessage) => ModelingMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  };

  const applyEvent = (answerId: string, event: AiChatEvent) => {
    const data = asRecord(event.data);
    switch (event.type) {
      case 'meta':
      case 'conversationMeta': {
        const next = data?.conversationId ? textOf(data.conversationId) : '';
        if (next) {
          conversationRef.current = next;
          setConversationId(next);
        }
        if (data?.conversationName) {
          setConversationName(textOf(data.conversationName));
        }
        return;
      }
      case 'token': {
        const text = textOf(data?.text);
        if (text) {
          update(answerId, (m) => ({ ...m, content: m.content + text }));
        }
        return;
      }
      case 'tool_call': {
        const name = textOf(data?.name) || textOf(data?.toolName) || '工具调用';
        setMessages((prev) => [
          ...prev,
          {
            id: `${answerId}-call-${counterRef.current++}`,
            role: 'tool',
            kind: 'tool_call',
            content: textOf(data?.arguments) || '',
            toolName: name,
            status: 'done',
          },
        ]);
        return;
      }
      case 'tool_result': {
        const name = textOf(data?.name) || textOf(data?.toolName) || '工具结果';
        const proposalCode = findProposalCode(data);
        setMessages((prev) => [
          ...prev,
          {
            id: `${answerId}-result-${counterRef.current++}`,
            role: 'tool',
            kind: proposalCode ? 'proposal' : 'tool_result',
            content: resultText(data || {}),
            toolName: name,
            proposalCode,
            status: 'done',
          },
        ]);
        if (proposalCode) {
          proposalRef.current?.(proposalCode);
        }
        return;
      }
      case 'done': {
        const content = textOf(data?.content);
        update(answerId, (m) => ({
          ...m,
          content: content || m.content,
          status: 'done',
        }));
        return;
      }
      case 'error': {
        update(answerId, (m) => ({
          ...m,
          status: 'error',
          error: textOf(data?.message) || '对话失败',
        }));
        return;
      }
      default:
        return;
    }
  };

  const send = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed || streamRef.current || !ontologyCode) {
        return;
      }
      const stamp = Date.now() + counterRef.current++;
      const answerId = `assistant-${stamp}`;
      setMessages((prev) => [
        ...prev,
        { id: `user-${stamp}`, role: 'user', content: trimmed, status: 'done' },
        { id: answerId, role: 'assistant', content: '', status: 'streaming' },
      ]);
      setStreaming(true);
      abortedRef.current = false;
      // 先占位，handle 创建后再绑真正的重置逻辑；任何事件到达都会重置看门狗
      let armWatchdog: () => void = () => {};
      const handle = streamOntologyAgentChat(
        {
          agentCode: ONTOLOGY_MODELING_AGENT_CODE,
          conversationId: conversationRef.current || undefined,
          ontologyCode,
          bizType: BIZ_TYPE_MODELING,
          userInput: trimmed,
        },
        {
          onEvent: (event) => {
            armWatchdog();
            applyEvent(answerId, event);
          },
          onError: (message) =>
            update(answerId, (m) => ({ ...m, status: 'error', error: message })),
        },
      );
      streamRef.current = handle;
      // 看门狗按最近一次事件计时：只要 token/工具事件还在到达就不打断，只在真正静默时超时
      let watchdog: number | undefined;
      armWatchdog = () => {
        if (watchdog !== undefined) {
          window.clearTimeout(watchdog);
        }
        watchdog = window.setTimeout(() => {
          if (streamRef.current !== handle) {
            return;
          }
          abortedRef.current = true;
          handle.abort();
          streamRef.current = null;
          setStreaming(false);
          update(answerId, (m) =>
            m.status === 'streaming'
              ? {
                  ...m,
                  status: 'error',
                  error: `模型服务 ${NO_CONTENT_TIMEOUT_MS / 1000} 秒没有返回内容，已停止等待，请重试或换一种问法`,
                }
              : m,
          );
        }, NO_CONTENT_TIMEOUT_MS);
      };
      armWatchdog();
      void handle.done.finally(() => {
        if (watchdog !== undefined) {
          window.clearTimeout(watchdog);
        }
        if (streamRef.current === handle) {
          streamRef.current = null;
        }
        setStreaming(false);
        if (abortedRef.current) {
          abortedRef.current = false;
          return;
        }
        update(answerId, (m) =>
          m.status === 'streaming'
            ? m.content
              ? { ...m, status: 'done' }
              : { ...m, status: 'error', error: '连接已结束但没有收到模型回复，请重试' }
            : m,
        );
      });
    },
    [ontologyCode],
  );

  const stop = useCallback(() => {
    abortedRef.current = true;
    streamRef.current?.abort();
    streamRef.current = null;
    setMessages((prev) =>
      prev.map((m) => (m.status === 'streaming' ? { ...m, status: 'stopped' } : m)),
    );
    setStreaming(false);
    if (conversationRef.current) {
      void interruptOntologyAgentChat(
        ONTOLOGY_MODELING_AGENT_CODE,
        conversationRef.current,
      );
    }
  }, []);

  /** 新建对话：中断当前流并清空本地消息（会话绑定仍保留在服务端列表）。 */
  const reset = useCallback(() => {
    abortedRef.current = true;
    streamRef.current?.abort();
    streamRef.current = null;
    conversationRef.current = '';
    setConversationId('');
    setConversationName('');
    setMessages([]);
    setStreaming(false);
  }, []);

  /** 续接历史会话：本地从空白消息开始，后续轮次走 galaxy 侧历史。 */
  const resume = useCallback(
    (nextConversationId: string, name?: string) => {
      reset();
      conversationRef.current = nextConversationId;
      setConversationId(nextConversationId);
      setConversationName(name || '');
    },
    [reset],
  );

  return {
    messages,
    streaming,
    send,
    stop,
    reset,
    resume,
    conversationId,
    conversationName,
  };
}
