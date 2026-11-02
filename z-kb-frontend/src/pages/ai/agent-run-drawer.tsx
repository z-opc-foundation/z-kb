import Icon from '@/components/icon';
import {
  interruptAiChat,
  streamAiChat,
  type AiAgentRecord,
  type AiChatEvent,
  type AiChatStreamHandle,
  type AiRuntimeStatus,
  type AiSkillRecord,
  type AiToolRecord,
} from '@/services/ai';
import {
  AiRuntimeTag,
  AiStatusTag,
  KbSelect,
  asRecord,
  textOf,
  useKnowledgeBaseOptions,
} from '@/pages/ai/shared';
import { MarkdownLite } from '@/pages/ai/markdown';
import { useEscapeKey } from '@/hooks/use-escape-key';
import '@/pages/ai/ai.less';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** 知识库问答的默认智能体编码；A-01 种子数据中的已发布智能体。 */
export const AI_QA_AGENT_CODE = 'kb_qa_assistant';

interface ChatActivity {
  id: string;
  name: string;
  arguments?: unknown;
  result?: unknown;
  error?: boolean;
}

interface AiHit {
  rank: number;
  title: string;
  wikiTitle: string;
  content: string;
  score?: number;
  materialId: string;
  wikiId: string;
}

type ChatTurnStatus = 'streaming' | 'done' | 'stopped' | 'error';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought: string;
  activities: ChatActivity[];
  hits: AiHit[];
  status: ChatTurnStatus;
  error?: string;
}

const SAMPLE_QUESTIONS = [
  '这个知识库里主要讲了什么？',
  '把相关内容按主题梳理一下',
  '有哪些内容可以作为依据引用？',
];

function extractHits(result: unknown): AiHit[] {
  // galaxy 把工具返回按字符串透传：{code,data:{hits}} 需要先解一层 JSON
  const outer = asRecord(safeJson(result));
  // 工具返回的是 Result 信封 {code,data:{hits}}，galaxy 也可能直接给 data 段
  const record = asRecord(outer?.data) ?? outer;
  const rawHits = record?.hits;
  if (!Array.isArray(rawHits)) {
    return [];
  }
  const hits: AiHit[] = [];
  rawHits.forEach((item) => {
    const hit = asRecord(item);
    if (!hit) {
      return;
    }
    const scoreValue = Number(hit.score);
    hits.push({
      rank:
        typeof hit.rank === 'number' && Number.isFinite(hit.rank)
          ? hit.rank
          : hits.length + 1,
      title: textOf(hit.title) || textOf(hit.materialTitle),
      wikiTitle: textOf(hit.wikiTitle),
      content: textOf(hit.content),
      score: Number.isFinite(scoreValue) ? scoreValue : undefined,
      materialId: textOf(hit.materialId),
      wikiId: textOf(hit.wikiId),
    });
  });
  return hits;
}

function safeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

const CREDENTIAL_KEY = /session|cookie|token|secret|authorization/i;

/** 工具参数可能带着登录凭据，展示前统一打码，避免把会话回显在页面上。 */
function maskCredentials(value: unknown): unknown {
  const parsed = safeJson(value);
  if (Array.isArray(parsed)) {
    return parsed.map(maskCredentials);
  }
  const record = asRecord(parsed);
  if (!record) {
    return parsed;
  }
  const next: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, item]) => {
    next[key] =
      CREDENTIAL_KEY.test(key) && typeof item === 'string' && item
        ? '***'
        : maskCredentials(item);
  });
  return next;
}

function ActivityBlock({ activity }: { activity: ChatActivity }) {
  const maskedArgs = maskCredentials(activity.arguments);
  const argsText =
    maskedArgs === undefined
      ? ''
      : typeof maskedArgs === 'string'
        ? maskedArgs
        : JSON.stringify(maskedArgs);
  return (
    <div className="ai-call">
      <div className="ai-call-head">
        <Icon name="workflow" size={12} />
        <b>{activity.name || '工具调用'}</b>
        {argsText ? <span className="mono">{argsText}</span> : null}
        {activity.error ? (
          <span className="tag red sm">失败</span>
        ) : activity.result !== undefined ? (
          <span className="tag green sm">返回</span>
        ) : (
          <span className="tag gray sm">执行中</span>
        )}
      </div>
      {activity.result !== undefined ? (
        <details>
          <summary>查看工具返回</summary>
          <pre>
            {(() => {
              const shown = safeJson(activity.result);
              return typeof shown === 'string'
                ? shown
                : JSON.stringify(shown, null, 2);
            })()}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function EvidenceBlock({ hits }: { hits: AiHit[] }) {
  if (!hits.length) {
    return null;
  }
  return (
    <div className="ai-evidence">
      <div className="ai-evidence-head">
        <Icon name="database" size={12} />
        检索证据（{hits.length}）
      </div>
      {hits.map((hit, index) => (
        <div className="ai-hit" key={`${hit.materialId}-${hit.rank}-${index}`}>
          <div className="ai-hit-top">
            <span className="idx">{index + 1}</span>
            <b>{hit.title || '未命名资料'}</b>
            {hit.wikiTitle ? (
              <span className="tag gray sm">Wiki · {hit.wikiTitle}</span>
            ) : null}
            {hit.score !== undefined ? (
              <span className="score">score {hit.score.toFixed(4)}</span>
            ) : null}
          </div>
          {hit.content ? <p>{hit.content}</p> : null}
          <div className="hit-meta">
            {hit.materialId ? `material ${hit.materialId}` : ''}
            {hit.wikiId ? ` · wiki ${hit.wikiId}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 智能体运行抽屉：任意知识库页面都可打开，带上当前库与可选的首个问题。
 *
 * <p>会话仍在后端进程内存中，关闭抽屉不丢会话；「新对话」会清空前端上下文。
 */
export function AgentRunDrawer({
  agent,
  skills,
  tools,
  runtime,
  initialKbId,
  initialQuestion,
  title = '试运行',
  onClose,
}: {
  agent: AiAgentRecord;
  skills: AiSkillRecord[];
  tools: AiToolRecord[];
  runtime?: AiRuntimeStatus;
  initialKbId?: string;
  initialQuestion?: string;
  title?: string;
  onClose: () => void;
}) {
  const { kbs, loading: kbLoading } = useKnowledgeBaseOptions();
  const [kbChoice, setKbChoice] = useState(
    initialKbId || agent.kbId || '',
  );
  const [conversationId, setConversationId] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [runMeta, setRunMeta] = useState<Record<string, unknown> | null>(null);
  const streamRef = useRef<AiChatStreamHandle | null>(null);
  const conversationRef = useRef('');
  const counterRef = useRef(0);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const requiresKb = agent.toolCodes.includes('knowledge_search');
  // 从某个知识库页面打开时范围就是那个库，不再给下拉；试运行没有指定库时才让用户选。
  const scopeLocked = !!initialKbId;
  const lockedKbName =
    kbs.find((kb) => kb.kbId === initialKbId)?.name || initialKbId || '';
  const skillNames = useMemo(() => {
    const map = new Map<string, string>();
    skills.forEach((item) => map.set(item.code, item.name));
    return map;
  }, [skills]);
  const toolNames = useMemo(() => {
    const map = new Map<string, string>();
    tools.forEach((item) => map.set(item.code, item.name));
    return map;
  }, [tools]);

  useEffect(
    () => () => {
      streamRef.current?.abort();
    },
    [],
  );

  useEscapeKey(() => {
    streamRef.current?.abort();
    onClose();
  });

  // 流式回答持续变高：只要用户没有主动上翻，就跟随到底部。
  useEffect(() => {
    const el = threadRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns]);

  const handleThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 48;
  };

  const updateTurn = (id: string, updater: (turn: ChatTurn) => ChatTurn) => {
    setTurns((prev) =>
      prev.map((turn) => (turn.id === id ? updater(turn) : turn)),
    );
  };

  const applyEvent = (turnId: string, event: AiChatEvent) => {
    const data = asRecord(event.data);
    switch (event.type) {
      case 'meta': {
        const nextConversation = textOf(data?.conversationId);
        if (nextConversation) {
          conversationRef.current = nextConversation;
          setConversationId(nextConversation);
        }
        setRunMeta(data);
        return;
      }
      case 'token': {
        const text = textOf(data?.text);
        if (text) {
          updateTurn(turnId, (turn) => ({
            ...turn,
            content: turn.content + text,
          }));
        }
        return;
      }
      case 'thought': {
        const text = textOf(data?.text);
        if (text) {
          updateTurn(turnId, (turn) => ({
            ...turn,
            thought: turn.thought + text,
          }));
        }
        return;
      }
      case 'tool_call': {
        const name = textOf(data?.name);
        const id =
          textOf(data?.id) || `call-${counterRef.current++}-${name || 'tool'}`;
        const args = data?.arguments;
        updateTurn(turnId, (turn) => ({
          ...turn,
          activities: [
            ...turn.activities,
            { id, name: name || '工具调用', arguments: args },
          ],
        }));
        return;
      }
      case 'tool_result': {
        const id = textOf(data?.id);
        const name = textOf(data?.name);
        const result = data?.result;
        const failed = data?.error === true;
        const hits = extractHits(result);
        updateTurn(turnId, (turn) => {
          // galaxy 的工具帧只有 tool 名、没有 id：先按 id 精确匹配，再回落到同名/最后一个待返回的调用
          const pending = turn.activities.filter((item) => item.result === undefined);
          const target =
            turn.activities.find((item) => id && item.id === id) ||
            [...pending].reverse().find((item) => name && item.name === name) ||
            pending[pending.length - 1];
          if (!target) {
            return turn;
          }
          return {
            ...turn,
            activities: turn.activities.map((item) =>
              item.id === target.id
                ? { ...item, name: item.name || name || '工具调用', result, error: failed }
                : item,
            ),
            hits: hits.length ? hits : turn.hits,
          };
        });
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
        const message = textOf(data?.message) || 'Agent 运行时异常';
        updateTurn(turnId, (turn) => ({
          ...turn,
          status: 'error',
          error: message,
        }));
        return;
      }
      default:
        return;
    }
  };

  const applyError = (turnId: string, message: string) => {
    updateTurn(turnId, (turn) => ({
      ...turn,
      status: 'error',
      error: message,
    }));
  };

  const send = (override?: string) => {
    const question = (override ?? input).trim();
    if (!question || streaming) {
      return;
    }
    if (requiresKb && !kbChoice) {
      return;
    }
    const stamp = Date.now() + counterRef.current++;
    const assistantId = `assistant-${stamp}`;
    stickToBottomRef.current = true;
    setInput('');
    setTurns((prev) => [
      ...prev,
      {
        id: `user-${stamp}`,
        role: 'user',
        content: question,
        thought: '',
        activities: [],
        hits: [],
        status: 'done',
      },
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        thought: '',
        activities: [],
        hits: [],
        status: 'streaming',
      },
    ]);
    setStreaming(true);
    const handle = streamAiChat(
      {
        agentCode: agent.code,
        conversationId: conversationRef.current || undefined,
        kbId: kbChoice || undefined,
        userInput: question,
      },
      {
        onEvent: (event) => applyEvent(assistantId, event),
        onError: (message) => applyError(assistantId, message),
      },
    );
    streamRef.current = handle;
    void handle.done.finally(() => {
      if (streamRef.current === handle) {
        streamRef.current = null;
      }
      setStreaming(false);
      updateTurn(assistantId, (turn) =>
        turn.status === 'streaming'
          ? {
              ...turn,
              status: 'error',
              error: '流式连接已结束但未收到完成事件，请重试',
            }
          : turn,
      );
    });
  };

  // 从知识库页面带入的问题：等抽屉挂载后自动发一轮，避免用户重复输入。
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) {
      return;
    }
    seededRef.current = true;
    const seed = initialQuestion?.trim();
    if (!seed) {
      return;
    }
    const timer = window.setTimeout(() => send(seed), 160);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    streamRef.current?.abort();
    setTurns((prev) =>
      prev.map((turn) =>
        turn.status === 'streaming' ? { ...turn, status: 'stopped' } : turn,
      ),
    );
    setStreaming(false);
    const current = conversationRef.current;
    if (current) {
      void interruptAiChat(agent.code, current);
    }
  };

  const resetConversation = () => {
    if (streaming) {
      stop();
    }
    conversationRef.current = '';
    setConversationId('');
    setTurns([]);
    setRunMeta(null);
  };

  const canSend = !!input.trim() && !streaming && (!requiresKb || !!kbChoice);

  // 抽屉挂在 body 上：入口可能位于带 z-index 的容器里，留在原地会盖不住同层的兄弟节点
  return createPortal(
    <div
      className="overlay drawer-overlay"
      onMouseDown={() => {
        streamRef.current?.abort();
        onClose();
      }}
    >
      <div
        className="drawer ai-run-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="d-top">
            <div className="d-icon">
              <Icon name="brain" size={18} />
            </div>
            <div className="d-copy">
              <h2>
                {title} · {agent.name}
                <AiStatusTag status={agent.status} label={agent.statusLabel} />
              </h2>
              <div className="d-sub">
                <span className="mono">{agent.code}</span>
                <span>·</span>
                <span className="ai-runtime-inline">
                  <AiRuntimeTag status={runtime} />
                </span>
                <span>·</span>
                <span>会话 {conversationId || '尚未创建'}</span>
              </div>
            </div>
            <div className="d-actions">
              <button
                className="btn xs ghost"
                type="button"
                onClick={resetConversation}
                title="开始新对话"
              >
                <Icon name="refresh" size={12} />
                新对话
              </button>
              <button
                className="close-btn"
                type="button"
                aria-label="关闭"
                onClick={() => {
                  streamRef.current?.abort();
                  onClose();
                }}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>
        </div>

        <div
          className="drawer-body ai-run-body"
          ref={threadRef}
          onScroll={handleThreadScroll}
        >
          <div className="ai-run-meta">
            <div>
              <small>运行时</small>
              <b>{textOf(runMeta?.runtime) || textOf(runtime?.runtime) || 'local-standin'}</b>
            </div>
            <div>
              <small>模型</small>
              <b>{textOf(runMeta?.model) || agent.llmCode || 'local-standin'}</b>
            </div>
            <div>
              <small>技能</small>
              <b>
                {agent.skillCodes.length
                  ? agent.skillCodes
                      .map((code) => skillNames.get(code) || code)
                      .join('、')
                  : '未绑定'}
              </b>
            </div>
            <div>
              <small>工具</small>
              <b>
                {agent.toolCodes.length
                  ? agent.toolCodes
                      .map((code) => toolNames.get(code) || code)
                      .join('、')
                  : '未绑定'}
              </b>
            </div>
          </div>

          <div className="ai-run-scope">
            <label>知识库范围</label>
            {scopeLocked ? (
              <>
                <b className="ai-run-scope-value">{lockedKbName}</b>
                <span className="note">当前知识库，不跨库检索</span>
              </>
            ) : (
              <>
                <KbSelect
                  value={kbChoice}
                  onChange={setKbChoice}
                  options={kbs}
                  loading={kbLoading}
                  disabled={streaming}
                />
                {requiresKb && !kbChoice ? (
                  <span className="tag red sm">knowledge_search 必须选择库</span>
                ) : null}
                {!kbLoading && !kbs.length ? (
                  <span className="note">
                    当前租户没有知识库，请先在「知识库」创建并上传资料。
                  </span>
                ) : null}
              </>
            )}
          </div>

          <div className="ai-thread">
            {!turns.length ? (
              <div className="ai-samples">
                {SAMPLE_QUESTIONS.map((question) => (
                  <button
                    className="ai-sample"
                    type="button"
                    key={question}
                    disabled={requiresKb && !kbChoice}
                    onClick={() => send(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}

            {turns.map((turn) =>
              turn.role === 'user' ? (
                <div className="ai-msg user" key={turn.id}>
                  <div className="ai-bubble">{turn.content}</div>
                  <div className="ai-avatar">
                    <Icon name="user" size={14} />
                  </div>
                </div>
              ) : (
                <div className="ai-msg assistant" key={turn.id}>
                  <div className="ai-avatar">
                    <Icon name="sparkles" size={14} />
                  </div>
                  <div className="ai-bubble">
                    {turn.thought ? (
                      <details className="ai-thought">
                        <summary>思考过程</summary>
                        <pre>{turn.thought}</pre>
                      </details>
                    ) : null}
                    {turn.activities.map((activity) => (
                      <ActivityBlock activity={activity} key={activity.id} />
                    ))}
                    {turn.content ? (
                      <div className="ai-answer">
                        <MarkdownLite content={turn.content} />
                      </div>
                    ) : turn.status === 'streaming' ? (
                      <div className="ai-answer">
                        <span className="spinner" /> 正在检索并组织回答…
                        <span className="ai-cursor" />
                      </div>
                    ) : null}
                    <EvidenceBlock hits={turn.hits} />
                    {turn.error ? (
                      <div className="ai-msg-error">{turn.error}</div>
                    ) : null}
                    <div className="ai-msg-foot">
                      {turn.status === 'streaming' ? (
                        <>
                          <span className="spinner" />
                          生成中
                        </>
                      ) : turn.status === 'stopped' ? (
                        <>
                          <Icon name="stop" size={10} />
                          已中断
                        </>
                      ) : turn.status === 'error' ? (
                        <>
                          <Icon name="alert-triangle" size={10} />
                          执行失败
                        </>
                      ) : (
                        <>
                          <Icon name="check" size={10} />
                          {runMeta?.realModel === true || runtime?.realModel
                            ? '模型回答完成'
                            : '本地替身完成'}
                        </>
                      )}
                      {turn.hits.length ? (
                        <span>· 命中 {turn.hits.length} 条</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="ai-composer">
          <textarea
            className="textarea"
            value={input}
            placeholder={
              requiresKb && !kbChoice
                ? '请先选择知识库，再输入问题'
                : '输入问题，Enter 发送，Shift+Enter 换行'
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <div className="ai-composer-actions">
            <span className="spacer" />
            {streaming ? (
              <button className="btn danger" type="button" onClick={stop}>
                <Icon name="stop" size={13} />
                中断
              </button>
            ) : null}
            <button
              className="btn primary"
              type="button"
              disabled={!canSend}
              onClick={() => send()}
            >
              <Icon name="send" size={13} />
              发送
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
