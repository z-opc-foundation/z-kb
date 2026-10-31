import Icon from '@/components/icon';
import { fmtAiTime } from '@/pages/ai/shared';
import { type AgentSessionRecord } from '@/services/ontology-modeling';

export function SessionList({
  sessions,
  loading,
  activeConversationId,
  onSelect,
  onCreate,
}: {
  sessions: AgentSessionRecord[];
  loading: boolean;
  activeConversationId: string;
  onSelect: (session: AgentSessionRecord) => void;
  onCreate: () => void;
}) {
  return (
    <div className="om-session-list">
      <div className="om-session-head">
        <span>历史会话</span>
        <button className="btn xs" type="button" onClick={onCreate}>
          <Icon name="plus" size={12} />
          新建对话
        </button>
      </div>
      <div className="om-session-items">
        {loading ? <div className="om-session-empty">正在加载会话…</div> : null}
        {!loading && !sessions.length ? (
          <div className="om-session-empty">还没有会话，先和建模师聊一轮</div>
        ) : null}
        {sessions.map((session) => (
          <button
            key={session.code}
            type="button"
            className={`om-session-item ${
              session.conversationId === activeConversationId ? 'active' : ''
            }`}
            onClick={() => onSelect(session)}
          >
            <span className="om-session-name">
              {session.conversationName || `会话 ${session.conversationId}`}
            </span>
            <span className="om-session-meta">
              {fmtAiTime(session.lastMessageTime || session.createTime)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
