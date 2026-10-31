import Icon from '@/components/icon';
import { queryEvalTrustEvidence, type EvalEvidenceItem } from '@/services/evaluation';
import { useEffect, useState } from 'react';
import {
  DrawerShell,
  EmptyState,
  ErrorState,
  evidenceStatusMeta,
  LoadingState,
  StatusTag,
} from './shared';

const EVIDENCE_KINDS = [
  '版本钉住',
  '覆盖范围',
  '评分口径',
  '逐题记录',
  '复现条件',
];

export default function TrustDrawer({
  runId,
  onClose,
}: {
  runId?: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<EvalEvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!runId) {
      setItems([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setFailed(false);
    queryEvalTrustEvidence(runId).then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      if (result === undefined) {
        setFailed(true);
        setItems([]);
        return;
      }
      setItems(
        Array.isArray(result)
          ? result
          : result.items || result.evidence || result.records || [],
      );
    });
    return () => {
      alive = false;
    };
  }, [runId, tick]);

  const available = items.filter(
    (item) => evidenceStatusMeta(item.status).tone === 'green',
  ).length;
  const partial = items.filter(
    (item) => evidenceStatusMeta(item.status).tone === 'amber',
  ).length;
  const pending = items.filter(
    (item) => evidenceStatusMeta(item.status).tone !== 'green' &&
      evidenceStatusMeta(item.status).tone !== 'amber',
  ).length;

  return (
    <DrawerShell
      icon="shield-check"
      width={660}
      title="凭什么可用"
      sub={
        <>
          <span className="mono">{runId || '尚无跑批'}</span>
          <span>五类测量证据 · 版本 / 覆盖 / 评分 / 逐题 / 复现</span>
        </>
      }
      onClose={onClose}
      footLeft="未录入证据标记为待补"
      footRight={
        <>
          <button
            className="btn"
            type="button"
            onClick={() => setTick((value) => value + 1)}
            disabled={!runId}
          >
            <Icon name="refresh" size={12} />
            刷新
          </button>
          <button className="btn primary-soft" type="button" onClick={onClose}>
            关闭
          </button>
        </>
      }
      body={
        <div>
          <div className="callout">
            <Icon name="shield" size={15} />
            <div className="ct">
              <b>本地规则判分（未校准），仅代表当前快照与配置下的相对参考</b>
              <p>
                结果可用只说明本次测量有效，不等于核心指标全部达标，也不代表线上全部流量。
              </p>
            </div>
          </div>

          {runId ? (
            <div className="grid grid-3 mt-16" style={{ gap: 8 }}>
              <div className="logic-cell">
                <label>已具备</label>
                <b className="c-green">{available}</b>
              </div>
              <div className="logic-cell">
                <label>部分具备</label>
                <b className="c-amber">{partial}</b>
              </div>
              <div className="logic-cell">
                <label>待补 / 其他</label>
                <b>{pending}</b>
              </div>
            </div>
          ) : null}

          <section className="eval-detail-section">
            <h4>五类证据口径</h4>
            <div className="tag-list">
              {EVIDENCE_KINDS.map((item) => (
                <span className="tag gray sm" key={item}>
                  {item}
                </span>
              ))}
            </div>
            <p className="note mt-8">
              每类证据的状态与说明完全取自 queryTrustEvidence；接口未返回的类别不补造状态。
            </p>
          </section>

          <section className="eval-detail-section">
            <h4>证据明细</h4>
            {!runId ? (
              <EmptyState
                icon="shield-check"
                title="尚无可核验的跑批"
                description="发起跑批后再查看版本、覆盖、评分、逐题与复现证据。"
              />
            ) : loading ? (
              <LoadingState title="正在加载可信证据…" />
            ) : failed ? (
              <ErrorState
                title="可信证据加载失败"
                description="queryTrustEvidence 返回异常；不把默认状态当作已验证。"
                onRetry={() => setTick((value) => value + 1)}
              />
            ) : items.length ? (
              <div className="eval-trust-list">
                {items.map((item, index) => {
                  const meta = evidenceStatusMeta(item.status);
                  return (
                    <div className="eval-trust-item" key={`${item.code}-${index}`}>
                      <div className="row between">
                        <div>
                          <b>{item.label || item.code}</b>
                          <small className="mono-sm" style={{ display: 'block' }}>
                            {item.code}
                          </small>
                        </div>
                        <StatusTag meta={meta} />
                      </div>
                      <p>{item.detail || '接口未返回说明'}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon="shield-check"
                title="接口未返回证据项"
                description="本次跑批没有可信证据明细；页面不展示假状态。"
              />
            )}
          </section>

          <div className="callout warn mt-16">
            <Icon name="info" size={15} />
            <div className="ct">
              <b>不设发布门禁</b>
              <p>
                证据状态只用于说明本次测量是否可解释；不会生成通过 / 阻断、豁免或发布审批结论。
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
