import Icon from '@/components/icon';
import { MarkdownLite } from '@/pages/ai/markdown';
import { AiRuntimeTag } from '@/pages/ai/shared';
import '@/pages/ai/ai.less';
import { getAiRuntimeStatus, type AiRuntimeStatus } from '@/services/ai';
import type { KbOverview } from '@/services/overview';
import { useEffect, useRef, useState } from 'react';
import { useKnowledgeAssistantChat } from '../hooks/use-knowledge-assistant-chat';
import { formatShortDateTime } from '@/utils/format';

const QUICK_QUESTIONS = ['这个库讲了什么', '有哪些证据可以引用'];

/** 资料缺口汇总走本地规则，不消耗模型配额，数字与库统计同源。 */
function shortageSummary(stats: KbOverview | null): string {
  if (!stats) {
    return '库状态还在读取，稍等再问一次。';
  }
  if (!stats.fileCount) {
    return `${stats.wikiCount} 篇 Wiki，还没有登记资料。先上传第一份资料，编译后这里会跟着更新。`;
  }
  const lines = [
    `资料 ${stats.fileCount} 份：已编译 ${stats.compiledCount}，部分编译 ${stats.partialCount}，未编译 ${stats.notCompiledCount}。`,
  ];
  if (stats.runningTaskCount) {
    lines.push(`当前有 ${stats.runningTaskCount} 个编译任务在跑，任务跑完再判断缺口。`);
  }
  if (stats.failedCount) {
    lines.push(`${stats.failedCount} 份编译失败，到任务管理里看失败阶段再重跑。`);
  }
  if (!stats.runningTaskCount && !stats.failedCount) {
    lines.push(
      stats.notCompiledCount + stats.partialCount
        ? '下一步：在资料页勾选未完成的资料发起知识编译。'
        : '资料都已编译，可以直接去 Wiki 视图或检索里确认质量。',
    );
  }
  lines.push(`产出 Wiki ${stats.wikiCount} 篇。`);
  return lines.join('\n');
}

export function KnowledgeAssistant({
  kbId,
  stats,
  canWrite,
  pageContext,
  onUpload,
  onGoTasks,
  onRefresh,
}: {
  kbId: string;
  kbName: string;
  stats: KbOverview | null;
  canWrite: boolean;
  pageContext?: Record<string, string>;
  onUpload: () => void;
  onGoTasks: () => void;
  onRefresh: () => void;
}) {
  const { turns, streaming, ask, answerLocally, stop } =
    useKnowledgeAssistantChat(kbId, pageContext);
  const [draft, setDraft] = useState('');
  const [runtime, setRuntime] = useState<AiRuntimeStatus | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void getAiRuntimeStatus().then((result) => {
      if (alive) {
        setRuntime(result);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns]);

  const unfinished = stats ? stats.notCompiledCount + stats.partialCount : 0;
  const running = stats?.runningTaskCount ?? 0;
  const failed = stats?.failedCount ?? 0;
  const ready = !!stats && !running && !failed && !unfinished;

  const submit = () => {
    const question = draft.trim();
    if (!question || streaming) {
      return;
    }
    setDraft('');
    ask(question);
  };

  const compileCard = !stats ? (
    <div className="wb-ai-card">
      <div className="wb-ai-card-head">
        <b>正在读取库状态…</b>
      </div>
    </div>
  ) : running ? (
    <div className="wb-ai-card">
      <div className="wb-ai-card-head">
        <b>
          <Icon name="layers" size={13} /> {running} 个编译任务在跑
        </b>
        <span className="tag blue sm">执行中</span>
      </div>
      <p>任务不在面板里假装跑完；结果出来后概览与 Wiki 数量会跟着更新。</p>
      <div className="row gap-6">
        <button className="btn primary" type="button" onClick={onGoTasks}>
          <Icon name="activity" size={11} />
          去任务
        </button>
      </div>
    </div>
  ) : unfinished ? (
    <div className="wb-ai-card amber">
      <div className="wb-ai-card-head">
        <b>
          <Icon name="zap" size={13} /> {unfinished} 份资料还没编译完
        </b>
        <span className="tag amber sm">待编译</span>
      </div>
      <p>在资料页勾选这些资料再点「知识编译」；同一库有运行中组别时会被拒绝。</p>
      <div className="row gap-6">
        {canWrite ? (
          <button className="btn primary" type="button" onClick={onUpload}>
            <Icon name="upload" size={11} />
            上传资料
          </button>
        ) : null}
        <button className="btn ghost" type="button" onClick={onRefresh}>
          <Icon name="refresh" size={11} />
          刷新状态
        </button>
      </div>
    </div>
  ) : ready ? (
    <div className="wb-ai-card green">
      <div className="wb-ai-card-head">
        <b>
          <Icon name="check-circle" size={13} /> {stats.fileCount} 份资料都已编译
        </b>
      </div>
      <p>可以上传新资料，或去 Wiki 与检索里确认产出质量。</p>
      {canWrite ? (
        <div className="row gap-6">
          <button className="btn" type="button" onClick={onUpload}>
            <Icon name="upload" size={11} />
            上传资料
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  const failureCard = failed ? (
    <div className="wb-ai-card" style={{ borderColor: '#f3d2cf' }}>
      <div className="wb-ai-card-head">
        <b>
          <Icon name="alert-triangle" size={13} /> {failed} 份编译失败
        </b>
        <span className="tag red sm">失败</span>
      </div>
      <p>失败阶段与重跑入口在任务管理；助手不替你重跑或改产物。</p>
      <div className="row gap-6">
        <button className="btn" type="button" onClick={onGoTasks}>
          <Icon name="activity" size={11} />
          看失败原因
        </button>
      </div>
    </div>
  ) : null;

  const recent = (stats?.recentMaterials || []).slice(0, 3);

  return (
    <aside className="wb-ai kb-workspace-ai">
      <div className="wb-ai-head">
        <div className="wb-ai-orb">
          <Icon name="sparkles" size={15} />
        </div>
        <div className="copy">
          <b>知识助手</b>
          <small>只读本库 · 不写库、不发布</small>
        </div>
        <span className={`tag ${ready ? 'green' : 'amber'} sm`}>
          {unfinished ? `${unfinished} 未完成` : ready ? '已就绪' : '读取中'}
        </span>
      </div>
      <div className="wb-ai-scroll" ref={scrollRef}>
        {compileCard}
        {failureCard}
        {recent.length ? (
          <div className="wb-ai-card">
            <div className="wb-ai-card-head">
              <b>
                <Icon name="activity" size={12} /> 最近动态
              </b>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 5 }}>
              {recent.map((item) => (
                <div
                  key={item.materialId}
                  style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9 }}
                >
                  <span
                    className={`wb-dot ${item.parseStatus === 'READY' ? 'g' : 'a'}`}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </span>
                  <span className="mono-sm" style={{ color: 'var(--muted-2)' }}>
                    {formatShortDateTime(item.registeredAt || item.updateTime)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {turns.map((turn) =>
          turn.role === 'user' ? (
            <div key={turn.id} className="wb-chat-msg me">
              {turn.content}
            </div>
          ) : (
            <div key={turn.id} className="wb-chat-msg ai">
              {turn.content ? <MarkdownLite content={turn.content} /> : null}
              {turn.status === 'error' ? (
                <p className="note" style={{ color: 'var(--red)', marginTop: 4 }}>
                  {turn.error || '问答失败'}
                </p>
              ) : null}
              {turn.status === 'stopped' ? (
                <p className="note" style={{ marginTop: 4 }}>
                  已停止本轮回答。
                </p>
              ) : null}
              {turn.hits.length ? (
                <p className="note" style={{ marginTop: 5 }}>
                  本轮引用 {turn.hits.length} 条：{turn.hits.slice(0, 2).join('、')}
                  {turn.hits.length > 2 ? ' 等' : ''}
                </p>
              ) : null}
            </div>
          ),
        )}
        {streaming &&
        turns.length &&
        turns[turns.length - 1].role === 'assistant' &&
        !turns[turns.length - 1].content ? (
          <div className="wb-typing">
            <i />
            <i />
            <i />
          </div>
        ) : null}
      </div>
      <div className="wb-ai-compose">
        <div className="wb-quick">
          {QUICK_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => ask(question)}
              disabled={streaming}
            >
              {question}
            </button>
          ))}
          <button
            type="button"
            onClick={() => answerLocally('还差什么', shortageSummary(stats))}
          >
            还差什么
          </button>
        </div>
        <div className="wb-chat-row">
          <textarea
            rows={1}
            value={draft}
            placeholder="问这个库，例如：排班规则有哪些限制？"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {streaming ? (
            <button className="wb-send" type="button" title="停止" onClick={stop}>
              <Icon name="x" size={14} />
            </button>
          ) : (
            <button
              className="wb-send"
              type="button"
              title="发送"
              disabled={!draft.trim()}
              onClick={submit}
            >
              <Icon name="send" size={14} />
            </button>
          )}
        </div>
        <div className="wb-ai-foot">
          回答基于当前库检索命中的原文与 Wiki，不做审批决定。
          <br />
          <AiRuntimeTag status={runtime} />
        </div>
      </div>
    </aside>
  );
}
