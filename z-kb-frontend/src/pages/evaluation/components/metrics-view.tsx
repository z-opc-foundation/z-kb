import Icon from '@/components/icon';
import type { EvalMetricRecord, EvalRunDetail } from '@/services/evaluation';
import {
  baselineMetricMap,
  collectMetrics,
  deltaMeta,
  EmptyState,
  ErrorState,
  fmtMetricValue,
  layerMeta,
  LoadingState,
  metricStatusMeta,
  StatusTag,
} from './shared';

export const METRIC_LAYERS = [
  { key: 'CORE', label: '核心结果' },
  { key: 'PRECONDITION', label: '前置条件' },
  { key: 'DIAGNOSTIC', label: '诊断' },
  { key: 'RUNTIME', label: '运行' },
  { key: 'STAGE', label: '阶段' },
] as const;

interface MetricsViewProps {
  runDetail?: EvalRunDetail | null;
  loading: boolean;
  error: boolean;
  layer: string;
  onLayerChange: (layer: string) => void;
  onRetry: () => void;
  onCreateRun: () => void;
}

export default function MetricsView({
  runDetail,
  loading,
  error,
  layer,
  onLayerChange,
  onRetry,
  onCreateRun,
}: MetricsViewProps) {
  if (loading) {
    return (
      <section className="panel">
        <LoadingState title="正在加载指标总览…" />
      </section>
    );
  }
  if (!runDetail) {
    if (error) {
      return (
        <section className="panel">
          <ErrorState
            title="指标数据加载失败"
            description="queryRun 未返回本次跑批指标；页面不会用示例数字补齐。"
            onRetry={onRetry}
          />
        </section>
      );
    }
    return (
      <section className="panel">
        <EmptyState
          icon="bar-chart"
          title="尚未发起跑批"
          description="指标总览基于一次固定的跑批结果；先发起跑批再查看分层指标。"
          action={
            <button className="btn primary" type="button" onClick={onCreateRun}>
              <Icon name="play" size={13} />
              发起跑批
            </button>
          }
        />
      </section>
    );
  }

  const metrics = sortMetrics(collectMetrics(runDetail));
  const baseline = baselineMetricMap(runDetail.baseline);
  const comparable = runDetail.comparable === true;
  const hasBaseline = !!runDetail.baseline;
  const activeLayer = layer.toUpperCase();
  const filtered = activeLayer
    ? metrics.filter(
        (metric) => String(metric.metricLayer || '').toUpperCase() === activeLayer,
      )
    : metrics;
  const counts = METRIC_LAYERS.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = metrics.filter(
      (metric) => String(metric.metricLayer || '').toUpperCase() === item.key,
    ).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="eval-context">
        <div className="ec-left">
          <b className="mono">{runDetail.run.runId}</b>
          <span>共 {metrics.length} 项指标</span>
          <span>
            {!hasBaseline
              ? '未设置基线，只展示本次'
              : comparable
                ? `基线 ${runDetail.baseline?.runId || '—'} · 同口径`
                : '数据集 / 配置 / Judge / 范围不同，不显示 Δ'}
          </span>
        </div>
        <div className="ec-right">
          <div className="eval-layer-chips">
            <button
              type="button"
              className={`eval-layer-chip ${!activeLayer ? 'active' : ''}`}
              onClick={() => onLayerChange('')}
            >
              全部 · {metrics.length}
            </button>
            {METRIC_LAYERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`eval-layer-chip ${activeLayer === item.key ? 'active' : ''}`}
                onClick={() => onLayerChange(item.key)}
              >
                {item.label} · {counts[item.key] || 0}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasBaseline && !comparable ? (
        <div className="callout mb-16">
          <Icon name="git-compare" size={15} />
          <div className="ct">
            <b>不可直接比较</b>
            <p>
              本次与基线在数据集 / 配置 / Judge / 覆盖范围上存在差异，不计算 Δ，只并列展示数值。
            </p>
          </div>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>
            <Icon name="bar-chart" size={14} />
            指标总览
            <span className="hint">
              {filtered.length} / {metrics.length} 项 · 层与层不做加权总分
            </span>
          </h3>
        </div>
        <div className="table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>指标</th>
                <th>层</th>
                <th>本次</th>
                <th>基线</th>
                {comparable ? <th>Δ</th> : null}
                <th>目标</th>
                <th>状态</th>
                <th>归属</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((metric) => {
                  const status = metricStatusMeta(metric.status);
                  const baselineValue = baseline.get(metric.metricCode)?.value;
                  const delta = comparable
                    ? deltaMeta(metric.value, baselineValue, metric.unit)
                    : null;
                  return (
                    <tr key={`${metric.stageCode || ''}-${metric.metricCode}`}>
                      <td>
                        <b>{metric.metricName || metric.metricCode}</b>
                        <small className="mono-sm" style={{ display: 'block' }}>
                          {metric.metricCode}
                          {metric.stageCode ? ` · ${metric.stageCode}` : ''}
                        </small>
                      </td>
                      <td>
                        <StatusTag meta={layerMeta(metric.metricLayer)} />
                      </td>
                      <td>
                        <b className={valueTone(status.tone)}>
                          {fmtMetricValue(metric.value, metric.unit)}
                        </b>
                      </td>
                      <td className="mono-sm">
                        {fmtMetricValue(baselineValue, metric.unit)}
                      </td>
                      {comparable ? (
                        <td className={delta?.direction === 'flat' ? 'note' : ''}>
                          {delta?.text || '—'}
                        </td>
                      ) : null}
                      <td className="mono-sm">
                        {fmtMetricValue(metric.targetValue, metric.unit)}
                      </td>
                      <td>
                        <StatusTag meta={status} />
                      </td>
                      <td>
                        <span className="note">{metric.attribution || '—'}</span>
                      </td>
                      <td>
                        <span className="note">{metric.note || '—'}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={comparable ? 9 : 8}>
                    <EmptyState
                      icon="filter"
                      title="当前层级没有指标"
                      description="切换层级或等待后端返回该层指标；页面不补造指标。"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel-foot">
          <span className="mono">{runDetail.run.runId}</span>
          <span>核心 / 前置 / 诊断 / 运行 / 阶段分层展示，不加权汇总</span>
        </div>
      </section>

      <div className="callout mt-16">
        <Icon name="info" size={15} />
        <div className="ct">
          <b>三问 + 一条时间轴</b>
          <p>
            前置回答“能不能信”，核心回答“答得好不好”，诊断回答“问题在哪”，运行只是环境旁证；历史 Δ
            只加时间轴，不是第五层。
          </p>
        </div>
      </div>
    </div>
  );
}

function sortMetrics(metrics: EvalMetricRecord[]): EvalMetricRecord[] {
  const order = ['CORE', 'PRECONDITION', 'DIAGNOSTIC', 'STAGE', 'RUNTIME'];
  return metrics
    .map((metric, index) => ({ metric, index }))
    .sort((a, b) => {
      const layerDiff =
        order.indexOf(String(a.metric.metricLayer || '').toUpperCase()) -
        order.indexOf(String(b.metric.metricLayer || '').toUpperCase());
      return layerDiff || a.index - b.index;
    })
    .map((item) => item.metric);
}

function valueTone(tone: string): string {
  if (tone === 'red' || tone === 'amber' || tone === 'green') {
    return `c-${tone}`;
  }
  return '';
}
