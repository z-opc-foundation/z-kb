import Icon from '@/components/icon';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type ModelingMessage } from '../hooks/use-modeling-chat';

function MessageBody({ message }: { message: ModelingMessage }) {
  if (message.kind === 'tool_call') {
    return (
      <div className="om-msg-tool">
        <div className="om-tool-head">
          <Icon name="workflow" size={12} />
          调用工具 <b className="mono">{message.toolName}</b>
        </div>
        {message.content ? (
          <pre className="om-tool-json">{message.content}</pre>
        ) : null}
      </div>
    );
  }
  if (message.kind === 'proposal') {
    return (
      <div className="om-msg-proposal">
        <div className="om-proposal-head">
          <Icon name="file-text" size={14} />
          <b>提案已生成</b>
          <span className="tag green sm">待提交</span>
        </div>
        <div className="om-proposal-body">
          提案编码
          <code className="mono">{message.proposalCode}</code>
          已落库，可在「提案管理」中查看详情并冻结提交为工单。
        </div>
      </div>
    );
  }
  if (message.kind === 'tool_result') {
    return (
      <details className="om-msg-tool">
        <summary className="om-tool-head">
          <Icon name="zap" size={12} />
          工具返回 <b className="mono">{message.toolName}</b>
        </summary>
        <pre className="om-tool-json">{message.content}</pre>
      </details>
    );
  }
  if (message.status === 'error') {
    return <div className="om-msg-error">{message.error || '对话失败'}</div>;
  }
  if (!message.content && message.status === 'streaming') {
    return <div className="om-msg-typing">正在思考…</div>;
  }
  return <div className="om-msg-text">{message.content}</div>;
}

function MessageRow({ message }: { message: ModelingMessage }) {
  if (message.role === 'tool') {
    return (
      <div className="om-msg tool">
        <MessageBody message={message} />
      </div>
    );
  }
  const isUser = message.role === 'user';
  return (
    <div className={`om-msg ${isUser ? 'user' : 'assistant'}`}>
      <div className="om-msg-avatar">
        <Icon name={isUser ? 'user' : 'brain'} size={14} />
      </div>
      <div className="om-msg-main">
        <MessageBody message={message} />
      </div>
    </div>
  );
}

const PROMPT_CHIPS = [
  '补全 Disease 类型的属性',
  '查找 Drug 与 Disease 之间的关系',
  '对照已有类型新增 Symptom',
];

export function ChatPanel({
  messages,
  streaming,
  conversationName,
  onSend,
  onStop,
}: {
  messages: ModelingMessage[];
  streaming: boolean;
  conversationName: string;
  onSend: (input: string) => void;
  onStop: () => void;
}): ReactNode {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) {
      return;
    }
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="om-chat-panel">
      <div className="om-chat-head">
        <b>{conversationName || '新对话'}</b>
        <span className="tag blue sm">本体建模师</span>
        <span className="om-chat-hint">对话是生产界面：提案由模型经工具落库，人工在提案管理中审批</span>
      </div>
      <div className="om-chat-body">
        {!messages.length ? (
          <div className="om-chat-welcome">
            <Icon name="brain" size={22} />
            <b>和本体建模师开始对话</b>
            <p>可以说「先看看当前有哪些对象类型」，或直接描述要新增的结构与实例。</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="om-chat-input">
        <div className="om-chat-chips">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="om-chip"
              disabled={streaming}
              onClick={() => onSend(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="om-chat-input-row">
          <textarea
            className="input om-chat-textarea"
            rows={3}
            placeholder="描述要建模的对象类型、关系或实例（Enter 发送，Shift+Enter 换行）"
            value={input}
            disabled={streaming}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {streaming ? (
            <button className="btn" type="button" onClick={onStop}>
              <Icon name="stop" size={13} />
              停止
            </button>
          ) : (
            <button
              className="btn primary"
              type="button"
              disabled={!input.trim()}
              onClick={submit}
            >
              <Icon name="send" size={13} />
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
