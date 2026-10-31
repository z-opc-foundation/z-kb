import Icon from '@/components/icon';
import {
  CompilationJobRecord,
  RetrievalChunkRecord,
} from '@/services/compilation';
import { MaterialDetailRecord } from '@/services/material';
import { JOB_STATUS, STAGE_LABEL, STAGE_STATUS } from '../material-status';
import { formatShortDateTime } from '@/utils/format';

interface Props {
  detail: MaterialDetailRecord;
  compilation: CompilationJobRecord | null;
  compilationLoading: boolean;
  chunks: RetrievalChunkRecord[];
  canManage: boolean;
  compileBusy: boolean;
  onCompile: () => void;
}

export default function MaterialCompilationSection({
  detail,
  compilation,
  compilationLoading,
  chunks,
  canManage,
  compileBusy,
  onCompile,
}: Props) {
  if (compilationLoading) {
    return (
      <div className="empty">
        <b>正在加载编译任务…</b>
      </div>
    );
  }

  if (!compilation) {
    return (
      <div className="mt-20">
        <h4 className="drawer-section-title">编译任务</h4>
        <div className="empty">
          <b>尚未编译</b>
          <p>
            编译按 P0 登记 → P1 解析 → P2 切块 → P3 索引执行，P4 萃取使用本地规则抽取知识点与图谱；
            未接 Agent / LLM，完成后按实际产物判定 M1 / M2。
          </p>
          {canManage && detail.currentDraft?.status === 'READY' ? (
            <button
              className="btn primary sm"
              type="button"
              style={{ marginTop: 12 }}
              disabled={compileBusy}
              onClick={onCompile}
            >
              <Icon name="play" size={12} />
              {compileBusy ? '编译中…' : '开始编译'}
            </button>
          ) : (
            <p className="hint" style={{ marginTop: 8 }}>
              {detail.currentDraft?.status === 'READY'
                ? '当前账号无管理权限，不能触发编译。'
                : '解析稿就绪后才能编译。'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-20">
      <h4 className="drawer-section-title">编译任务</h4>
      <div
        className="meta mb-12"
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <span className={`tag ${JOB_STATUS[compilation.runStatus]?.tag || 'gray'}`}>
          {JOB_STATUS[compilation.runStatus]?.label || compilation.runStatus}
        </span>
        <span className={`tag ${compilation.milestone === 'NONE' ? 'gray' : 'green'}`}>
          {compilation.milestone === 'M2'
            ? 'M2 已达成'
            : compilation.milestone === 'M1'
              ? 'M1 已达成'
              : '未达里程碑'}
        </span>
        <span className="tag gray">{compilation.chunkCount} 个检索块</span>
        <span className="tag gray mono">
          {compilation.compilerVersion} / {compilation.configVersion}
        </span>
        {compilation.taskStatus ? (
          <span className="tag gray mono">调度 {compilation.taskStatus}</span>
        ) : null}
        <span className="mono-sm" style={{ marginLeft: 'auto' }}>
          {formatShortDateTime(compilation.finishedAt || compilation.startedAt)}
        </span>
      </div>

      {compilation.failureSummary ? (
        <div className="callout warn mb-12">
          <Icon name="alert-triangle" size={14} />
          <div className="ct">
            <b>编译未完成</b>
            <p>{compilation.failureSummary}</p>
          </div>
        </div>
      ) : null}

      {compilation.milestone === 'M1' ? (
        <div className="callout warn mb-12">
          <Icon name="info" size={14} />
          <div className="ct">
            <b>M2 未达成</b>
            <p>
              本次编译未产出萃取类产物；知识点与图谱由本地规则抽取，未接 Agent / LLM。
            </p>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <h3>
            <Icon name="play" size={14} />
            阶段
          </h3>
          <span className="hint">P0–P4</span>
        </div>
        <div className="panel-body flush">
          <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>阶段</th>
                <th>状态</th>
                <th>说明</th>
                <th>完成时间</th>
              </tr>
            </thead>
            <tbody>
              {compilation.stages.map((stage, index) => {
                const status = STAGE_STATUS[stage.status] || {
                  label: stage.status,
                  tag: 'gray',
                };
                return (
                  <tr key={`${stage.stage}-${stage.attempt ?? index}`}>
                    <td>{STAGE_LABEL[stage.stage] || stage.stage}</td>
                    <td>
                      <span className={`tag ${status.tag}`}>{status.label}</span>
                    </td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 260 }}>
                      {stage.detail || '—'}
                    </td>
                    <td>{formatShortDateTime(stage.finishedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {compilation.ledger ? (
        <div className="panel mt-16">
          <div className="panel-head">
            <h3>
              <Icon name="inbox" size={14} />
              产物账本
            </h3>
            <span className="hint">{compilation.ledger.status}</span>
          </div>
          <div className="panel-body">
            <dl className="kv">
              <dt>规划 / 已结算</dt>
              <dd>
                {compilation.ledger.expectedCount} / {compilation.ledger.settledCount}
              </dd>
              <dt>失败 / 死信</dt>
              <dd>
                {compilation.ledger.failedCount} / {compilation.ledger.deadCount}
              </dd>
              <dt>平账</dt>
              <dd>
                {compilation.ledger.expectedCount === compilation.ledger.settledCount ? (
                  <span className="tag green">已平账</span>
                ) : (
                  <span className="tag amber">未平账</span>
                )}
              </dd>
            </dl>
          </div>
        </div>
      ) : null}

      {compilation.artifact ? (
        <div className="panel mt-16">
          <div className="panel-head">
            <h3>
              <Icon name="package" size={14} />
              产物
            </h3>
            <span className="hint">{compilation.artifact.artifactType}</span>
          </div>
          <div className="panel-body">
            <dl className="kv">
              <dt>标题</dt>
              <dd>{compilation.artifact.title}</dd>
              <dt>产物版本</dt>
              <dd>
                {compilation.artifact.versionNo
                  ? `v${compilation.artifact.versionNo}`
                  : '—'}
              </dd>
              <dt>生命周期 / 检索</dt>
              <dd>
                <span className="tag gray">
                  {compilation.artifact.lifecycleStatus}
                </span>{' '}
                <span className="tag green">
                  {compilation.artifact.retrievalState}
                </span>
              </dd>
              <dt>证据引用</dt>
              <dd className="mono" style={{ wordBreak: 'break-all' }}>
                {compilation.artifact.evidenceRef}
              </dd>
              <dt>内容指纹</dt>
              <dd className="mono">
                {compilation.artifact.contentHash
                  ? `${compilation.artifact.contentHash.slice(0, 16)}…`
                  : '—'}
              </dd>
            </dl>
          </div>
        </div>
      ) : null}

      <div className="panel mt-16">
        <div className="panel-head">
          <h3>
            <Icon name="layers" size={14} />
            检索块
          </h3>
          <span className="hint">最多展示 100 条</span>
        </div>
        <div className="panel-body flush">
          {chunks.length ? (
            <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>章节</th>
                  <th>内容</th>
                  <th>字数</th>
                </tr>
              </thead>
              <tbody>
                {chunks.map((chunk) => (
                  <tr key={chunk.chunkId}>
                    <td className="mono">{chunk.ordinal}</td>
                    <td>{chunk.heading || '—'}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 280 }}>
                      {chunk.content.length > 140
                        ? `${chunk.content.slice(0, 140)}…`
                        : chunk.content}
                    </td>
                    <td>{chunk.charCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              <p>暂无检索块</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
