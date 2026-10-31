import { getOntologyDetail, type OntologyDetail } from '@/services/ontology';
import {
  BIZ_TYPE_MODELING,
  pageAgentSessions,
  type AgentSessionRecord,
} from '@/services/ontology-modeling';
import { useCallback, useEffect, useState } from 'react';
import { ChatPanel } from './components/chat-panel';
import { OrderPanel } from './components/order-panel';
import { ProposalPanel } from './components/proposal-panel';
import { SessionList } from './components/session-list';
import { useModelingChat } from './hooks/use-modeling-chat';
import './ontology-modeling.less';

type TabKey = 'chat' | 'proposal' | 'order';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'chat', label: '对话建模' },
  { key: 'proposal', label: '提案管理' },
  { key: 'order', label: '工单管理' },
];

export default function OntologyModelingPage() {
  const [tab, setTab] = useState<TabKey>('chat');
  const [detail, setDetail] = useState<OntologyDetail | null | undefined>(undefined);
  const [detailFailed, setDetailFailed] = useState(false);
  const [detailTick, setDetailTick] = useState(0);
  const [sessions, setSessions] = useState<AgentSessionRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [proposalTick, setProposalTick] = useState(0);
  const [orderTick, setOrderTick] = useState(0);

  const reloadDetail = useCallback(() => {
    setDetail(undefined);
    setDetailFailed(false);
    setDetailTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    void getOntologyDetail().then((result) => {
      if (alive) {
        setDetail(result);
        setDetailFailed(result === undefined);
      }
    });
    return () => {
      alive = false;
    };
  }, [detailTick]);

  const ontologyCode = detail?.code || '';

  const loadSessions = useCallback(async () => {
    if (!ontologyCode) {
      return;
    }
    setSessionsLoading(true);
    const result = await pageAgentSessions({
      ontologyCode,
      bizType: BIZ_TYPE_MODELING,
      current: 1,
      size: 50,
    });
    setSessions(result?.records || []);
    setSessionsLoading(false);
  }, [ontologyCode]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleProposal = useCallback(() => {
    setProposalTick((value) => value + 1);
  }, []);

  const chat = useModelingChat(ontologyCode, handleProposal);

  const selectSession = (session: AgentSessionRecord) => {
    chat.resume(session.conversationId, session.conversationName);
  };

  const loading = detail === undefined;
  const notOpen = detail === null;

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>本体建模</h1>
          <p className="sub">
            与本体建模师多轮对话产出提案：提案冻结编译为工单，工单审批通过自动执行，
            Schema 与实例变更回写图库并在本体概览可检索。
          </p>
        </div>
      </div>

      {loading ? (
        <section className="panel om-page-state">正在加载本体信息…</section>
      ) : detailFailed ? (
        <section className="panel om-page-state">
          本体信息加载失败，请稍后重试。
          <button className="btn" type="button" onClick={reloadDetail}>
            重新加载
          </button>
        </section>
      ) : notOpen ? (
        <section className="panel om-page-state">
          当前租户尚未开通本体，请先在「本体概览」开通后再使用建模对话。
        </section>
      ) : (
        <>
          <div className="om-tabs">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`om-tab ${tab === item.key ? 'active' : ''}`}
                onClick={() => {
                  setTab(item.key);
                  if (item.key === 'proposal') {
                    setProposalTick((value) => value + 1);
                  }
                  if (item.key === 'order') {
                    setOrderTick((value) => value + 1);
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'chat' ? (
            <section className="panel om-chat-layout">
              <SessionList
                sessions={sessions}
                loading={sessionsLoading}
                activeConversationId={chat.conversationId}
                onSelect={selectSession}
                onCreate={() => {
                  chat.reset();
                  void loadSessions();
                }}
              />
              <ChatPanel
                messages={chat.messages}
                streaming={chat.streaming}
                conversationName={chat.conversationName}
                onSend={chat.send}
                onStop={chat.stop}
              />
            </section>
          ) : null}

          {tab === 'proposal' ? (
            <ProposalPanel
              refreshTick={proposalTick}
            />
          ) : null}

          {tab === 'order' ? <OrderPanel refreshTick={orderTick} /> : null}
        </>
      )}
    </div>
  );
}
