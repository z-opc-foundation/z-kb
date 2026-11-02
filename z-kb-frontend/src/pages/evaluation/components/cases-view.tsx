import Icon from '@/components/icon';
import {
  listEvalBadcases,
  pageEvalCaseResults,
  updateEvalBadcase,
  type EvalBadcaseRecord,
  type EvalCaseResultRecord,
  type EvalOverview,
  type EvalRunDetail,
} from '@/services/evaluation';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  badcaseStatusMeta,
  behaviorMeta,
  DrawerShell,
  EmptyState,
  ErrorState,
  fmtDuration,
  LoadingState,
  normalizeCitations,
  normalizeKeyValues,
  normalizeRetrieved,
  normalizeStageTrace,
  severityMeta,
  StatusTag,
  Tag,
} from './shared';

interface CasesViewProps {
  kbId: string;
  runDetail?: EvalRunDetail | null;
  overview?: EvalOverview | null;
  statusFilter: string;
  caseId: string;
  onStatusChange: (status: string) => void;
  onOpenCase: (caseId: string) => void;
  onCloseCase: () => void;
  onBadcaseUpdated: () => void;
  onCreateRun: () => void;
}

const STATUS_OPTIONS = [
  { key: '', label: '全部' },
  { key: 'OPEN', label: '待修复' },
  { key: 'FIXED', label: '已修复' },
  { key: 'REGRESSED', label: '回归' },
];

export default function CasesView({
  kbId,
  runDetail,
  overview,
  statusFilter,
  caseId,
  onStatusChange,
  onOpenCase,
  onCloseCase,
  onBadcaseUpdated,
  onCreateRun,
}: CasesViewProps) {
  const [records, setRecords] = useState<EvalBadcaseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    listEvalBadcases(kbId, statusFilter || undefined).then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      if (result === undefined) {
        setFailed(true);
        setRecords([]);
        setTotal(0);
        return;
      }
      const rows = Array.isArray(result) ? result : result.records || [];
      setRecords(rows);
      setTotal(Array.isArray(result) ? rows.length : result.total ?? rows.length);
    });
    return () => {
      alive = false;
    };
  }, [kbId, statusFilter]);

  useEffect(() => load(), [load, tick]);

  const counts = runDetail?.badcaseCounts || overview?.badcaseCounts;
  const selectedBadcase = records.find((item) => item.caseId === caseId);
  const effectiveRunId =
    selectedBadcase?.lastSeenRunId || runDetail?.run.runId || '';
  const statusTitle = useMemo(
    () => STATUS_OPTIONS.find((item) => item.key === statusFilter)?.label || '全部',
    [statusFilter],
  );

  return (
    <div>
      <div className="grid grid-3 mb-16">
        {[
          {
            label: '待修复',
            value: counts?.open ?? '—',
            tone: 'amber',
            icon: 'alert-triangle',
            foot: '关闭前必须完成回归',
          },
          {
            label: '已修复',
            value: counts?.fixed ?? '—',
            tone: 'green',
            icon: 'check-circle',
            foot: '本周期已闭环',
          },
          {
            label: '回归',
            value: counts?.regressed ?? '—',
            tone: 'red',
            icon: 'refresh',
            foot: '修复后重新出现',
          },
        ].map((item) => (
          <div className={`stat ${item.tone}`} key={item.label}>
            <div className="label">{item.label}</div>
            <div className="value tnum">{item.value}</div>
            <div className="foot">{item.foot}</div>
            <div className="s-icon">
              <Icon name={item.icon} size={15} />
            </div>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>
            <Icon name="alert-triangle" size={14} />
            坏例台账
            <span className="hint">
              {statusTitle} · {loading ? '加载中' : `${records.length} / ${total}`}
            </span>
          </h3>
          <div className="actions">
            <div className="eval-layer-chips">
              {STATUS_OPTIONS.map((item) => (
                <button
                  key={item.key || 'all'}
                  type="button"
                  className={`eval-layer-chip ${statusFilter === item.key ? 'active' : ''}`}
                  onClick={() => onStatusChange(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="btn xs"
              type="button"
              onClick={() => setTick((value) => value + 1)}
            >
              <Icon name="refresh" size={11} />
              刷新
            </button>
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <LoadingState title="正在加载坏例台账…" />
          ) : failed ? (
            <ErrorState
              title="坏例台账加载失败"
              description="listBadcases 返回异常；页面不使用本地坏例补齐。"
              onRetry={() => setTick((value) => value + 1)}
            />
          ) : records.length ? (
            <table className="list-table">
              <thead>
                <tr>
                  <th>题号 / 问题</th>
                  <th>阶段</th>
                  <th>分类</th>
                  <th>严重度</th>
                  <th>状态</th>
                  <th>负责人</th>
                  <th>出现次数</th>
                  <th>最近跑批</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((item) => {
                  const status = badcaseStatusMeta(item.status);
                  const severity = severityMeta(item.severity);
                  return (
                    <tr
                      key={item.badcaseId}
                      className="c-pointer"
                      onClick={() => item.caseId && onOpenCase(item.caseId)}
                    >
                      <td>
                        <b>{item.question || item.caseId || '未返回问题'}</b>
                        <small
                          className="mono-sm"
                          style={{ display: 'block' }}
                        >
                          {item.caseId || '—'}
                        </small>
                      </td>
                      <td className="mono-sm">{item.stageCode || '—'}</td>
                      <td>{item.category || '—'}</td>
                      <td>
                        <Tag tone={severity.tone} className="sm">
                          {severity.label}
                        </Tag>
                      </td>
                      <td>
                        <StatusTag meta={status} />
                      </td>
                      <td>{item.owner || '未指派'}</td>
                      <td className="mono-sm">{item.occurrenceCount ?? '—'}</td>
                      <td>
                        <span className="mono-sm">
                          {item.lastSeenRunId || '—'}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          className="btn xs ghost"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (item.caseId) {
                              onOpenCase(item.caseId);
                            }
                          }}
                        >
                          明细
                          <Icon name="chevron-right" size={10} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon="check-circle"
              title={statusFilter ? '当前筛选下没有坏例' : '尚无坏例记录'}
              description="坏例只归因，不在这里直接修改产物；修复回对应业务页面，关闭前按同一数据集回归。"
              action={
                !runDetail && !overview?.lastRun?.runId ? (
                  <button className="btn" type="button" onClick={onCreateRun}>
                    <Icon name="play" size={13} />
                    发起跑批
                  </button>
                ) : statusFilter ? (
                  <button className="btn" type="button" onClick={() => onStatusChange('')}>
                    清除筛选
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
        <div className="panel-foot">
          <span>坏例不是线上事故；修复动作回对应页面，关闭前须回归</span>
          <span className="mono">{effectiveRunId || '—'}</span>
        </div>
      </section>

      {caseId ? (
        <CaseDetailDrawer
          kbId={kbId}
          caseId={caseId}
          badcase={selectedBadcase}
          runId={effectiveRunId}
          onClose={onCloseCase}
          onUpdated={() => {
            setTick((value) => value + 1);
            onBadcaseUpdated();
          }}
        />
      ) : null}
    </div>
  );
}

function CaseDetailDrawer({
  kbId,
  caseId,
  badcase,
  runId,
  onClose,
  onUpdated,
}: {
  kbId: string;
  caseId: string;
  badcase?: EvalBadcaseRecord;
  runId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<EvalCaseResultRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!runId) {
      setDetail(null);
      setLoading(false);
      setFailed(false);
      setNotFound(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setFailed(false);
    setNotFound(false);
    pageEvalCaseResults({
      runId,
      current: 1,
      size: 200,
      onlyBad: false,
    }).then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      if (result === undefined) {
        setFailed(true);
        setDetail(null);
        return;
      }
      const rows = Array.isArray(result) ? result : result.records || [];
      const match = rows.find((item) => item.caseId === caseId);
      setDetail(match || null);
      setNotFound(!match);
    });
    return () => {
      alive = false;
    };
  }, [caseId, runId]);

  const retrieved = normalizeRetrieved(detail?.retrieved);
  const citations = normalizeCitations(detail?.citations);
  const metricRows = normalizeKeyValues(detail?.metrics);
  const stageTrace = normalizeStageTrace(detail?.stageTrace);
  const question = detail?.question || badcase?.question || '未返回问题';
  const refused = detail?.answerMode === 'REFUSED';

  const openRetrieval = () => {
    const query = question ? `&query=${encodeURIComponent(question)}` : '';
    navigate(
      `/knowledge-bases/${encodeURIComponent(kbId)}/workspace?view=retrieval${query}`,
    );
  };

  const openMaterial = (materialId: string) => {
    navigate(
      `/knowledge-bases/${encodeURIComponent(kbId)}/workspace?view=materials&materialId=${encodeURIComponent(
        materialId,
      )}&materialTab=draft`,
    );
  };

  return (
    <DrawerShell
      icon="alert-triangle"
      width={900}
      title={
        <>
          坏例明细
          <span className="tag gray sm mono">{caseId}</span>
        </>
      }
      sub={
        <>
          <span className="mono">{runId || '无跑批'}</span>
          {detail?.caseNo != null ? <span>题号 {detail.caseNo}</span> : null}
          {detail?.latencyMs != null ? <span>耗时 {fmtDuration(detail.latencyMs)}</span> : null}
          {badcase ? <StatusTag meta={badcaseStatusMeta(badcase.status)} /> : null}
        </>
      }
      onClose={onClose}
      footLeft="深链回跳资料解析与检索；本页不直接修产物"
      footRight={
        <>
          <button className="btn" type="button" onClick={openRetrieval}>
            <Icon name="search" size={12} />
            回检索工作台
          </button>
          <button className="btn primary-soft" type="button" onClick={onClose}>
            关闭
          </button>
        </>
      }
      body={
        <div>
          <div className="eval-case-question">
            <div className="label">问题</div>
            <p>{question}</p>
            {badcase?.category || badcase?.stageCode || badcase?.severity ? (
              <div className="tag-list mt-8">
                {badcase?.stageCode ? (
                  <Tag tone="blue" className="sm">
                    {badcase.stageCode}
                  </Tag>
                ) : null}
                {badcase?.category ? (
                  <Tag tone="gray" className="sm">
                    {badcase.category}
                  </Tag>
                ) : null}
                {badcase?.severity ? (
                  <Tag tone={severityMeta(badcase.severity).tone} className="sm">
                    严重度 {severityMeta(badcase.severity).label}
                  </Tag>
                ) : null}
              </div>
            ) : null}
          </div>

          {loading ? (
            <LoadingState title="正在加载逐题结果…" />
          ) : failed ? (
            <ErrorState
              title="逐题结果加载失败"
              description="pageCaseResults 返回异常；上方坏例元信息仍来自真实台账。"
            />
          ) : notFound ? (
            <div className="callout warn mt-16">
              <Icon name="alert-triangle" size={15} />
              <div className="ct">
                <b>本次跑批未返回该题明细</b>
                <p>
                  可能该题来自更早的跑批。请到「测评跑批」选择对应 runId，或按最近跑批重新查询。
                </p>
              </div>
            </div>
          ) : null}

          {detail?.errorMessage ? (
            <div className="callout danger mt-16">
              <Icon name="x-circle" size={15} />
              <div className="ct">
                <b>逐题执行错误</b>
                <p>{detail.errorMessage}</p>
              </div>
            </div>
          ) : null}

          <section className="eval-detail-section">
            <h4>抽取答案</h4>
            <div className="eval-answer">
              {detail?.answer ||
                (loading
                  ? '加载中…'
                  : refused
                    ? '拒答：本次未生成答案。'
                    : '接口未返回答案')}
            </div>
            <div className="row gap-6 mt-8" style={{ flexWrap: 'wrap' }}>
              {detail?.answerMode ? (
                <Tag tone="violet" className="sm">
                  模式 {behaviorMeta(detail.answerMode).label}
                </Tag>
              ) : null}
              {(detail?.badcaseStages || []).map((stage) => (
                <Tag key={stage} tone="amber" className="sm">
                  坏例阶段 {stage}
                </Tag>
              ))}
            </div>
          </section>

          <section className="eval-detail-section">
            <h4>命中证据</h4>
            {retrieved.length ? (
              <div className="eval-evidence-list">
                {retrieved.map((item, index) => (
                  <div className="eval-evidence-item" key={`${item.chunkId || index}`}>
                    <div className="row between">
                      <b>
                        #{item.rank ?? index + 1}{' '}
                        {item.title || item.chunkId || '未返回标题'}
                      </b>
                      <span className="note">
                        {item.score != null ? `score ${item.score}` : ''}
                      </span>
                    </div>
                    {item.content ? <p>{item.content}</p> : null}
                    <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                      {item.materialId ? (
                        <button
                          className="btn xs"
                          type="button"
                          onClick={() => openMaterial(item.materialId!)}
                        >
                          <Icon name="file-text" size={11} />
                          回跳资料解析
                        </button>
                      ) : null}
                      {item.chunkId ? (
                        <span className="mono-sm">{item.chunkId}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="note">
                {refused ? '拒答：本次检索无命中证据。' : '接口未返回命中证据。'}
              </div>
            )}
            {citations.length ? (
              <div className="mt-12">
                <div className="note" style={{ marginBottom: 5 }}>
                  引用
                </div>
                <div className="tag-list">
                  {citations.map((item, index) => (
                    <Tag key={`${item}-${index}`} tone="blue" className="sm">
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="eval-detail-section">
            <h4>逐题指标</h4>
            {metricRows.length ? (
              <div className="table-wrap">
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>指标</th>
                      <th>值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricRows.map((row, index) => (
                      <tr key={`${row.label}-${index}`}>
                        <td>{row.label}</td>
                        <td className="mono-sm">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="note">接口未返回逐题指标。</div>
            )}
          </section>

          <section className="eval-detail-section">
            <h4>阶段轨迹</h4>
            {stageTrace.length ? (
              <div className="eval-trace">
                {stageTrace.map((item, index) => (
                  <div className="eval-trace-item" key={`${item.stageCode}-${index}`}>
                    <span className="mono-sm">{item.stageCode}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{item.stageName || item.stageCode}</b>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </div>
                    {item.status ? (
                      <Tag tone="gray" className="sm">
                        {item.status}
                      </Tag>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="note">接口未返回阶段轨迹。</div>
            )}
          </section>

          {badcase ? (
            <BadcaseUpdateForm
              badcase={badcase}
              onUpdated={onUpdated}
            />
          ) : (
            <div className="callout mt-16">
              <Icon name="info" size={15} />
              <div className="ct">
                <b>当前不是坏例台账记录</b>
                <p>
                  该 caseId 通过深链打开，未在 listBadcases 中找到对应坏例，因此不提供状态修改。
                </p>
              </div>
            </div>
          )}

          <div className="note mt-16">
            最近观察：{badcase?.lastSeenRunId || runId || '—'}
            {badcase?.lastSeenRunId ? '' : ' · 无单独坏例记录'}
          </div>
        </div>
      }
    />
  );
}

function BadcaseUpdateForm({
  badcase,
  onUpdated,
}: {
  badcase: EvalBadcaseRecord;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState(badcase.status || 'OPEN');
  const [owner, setOwner] = useState(badcase.owner || '');
  const [note, setNote] = useState(badcase.note || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(badcase.status || 'OPEN');
    setOwner(badcase.owner || '');
    setNote(badcase.note || '');
  }, [badcase]);

  const submit = async () => {
    setSaving(true);
    const result = await updateEvalBadcase({
      badcaseId: badcase.badcaseId,
      status,
      owner: owner.trim(),
      note: note.trim(),
    });
    setSaving(false);
    if (result === undefined) {
      toast('坏例更新失败', 'updateBadcase 返回异常，未修改本地状态。', 'error');
      return;
    }
    toast('坏例已更新', `${badcase.caseId || badcase.badcaseId} · ${status}`, 'success');
    onUpdated();
  };

  return (
    <section className="eval-detail-section">
      <h4>坏例处置</h4>
      <div className="eval-form-grid">
        <div className="field">
          <label>状态</label>
          <select
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="OPEN">待修复</option>
            <option value="FIXED">已修复</option>
            <option value="REGRESSED">回归</option>
          </select>
        </div>
        <div className="field">
          <label>负责人</label>
          <input
            className="input"
            value={owner}
            placeholder="不填写则保持未指派"
            onChange={(event) => setOwner(event.target.value)}
          />
        </div>
      </div>
      <div className="field mt-12">
        <label>备注</label>
        <textarea
          className="textarea"
          value={note}
          placeholder="记录修复动作或回归结论"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="row between mt-12">
        <span className="note">
          关闭坏例前需要按同一数据集复跑回归；本页不改业务产物。
        </span>
        <button
          className="btn primary-soft"
          type="button"
          disabled={saving}
          onClick={() => void submit()}
        >
          {saving ? <span className="spinner" /> : <Icon name="check" size={12} />}
          保存处置
        </button>
      </div>
    </section>
  );
}
