import Icon from '@/components/icon';
import type { MetricsSummary } from '@/pages/ai/metrics/mock';

interface SummaryCardsProps {
  summary?: MetricsSummary;
  previous?: MetricsSummary;
}

function pctChange(current: number | undefined, before: number | undefined) {
  if (current === undefined || before === undefined || before === 0) {
    return null;
  }
  return ((current - before) / before) * 100;
}

function Delta({
  value,
  suffix,
  lowerIsBetter = false,
}: {
  value: number | null;
  suffix: string;
  lowerIsBetter?: boolean;
}) {
  if (value === null || Number.isNaN(value)) {
    return <span>暂无可比周期</span>;
  }
  if (Math.abs(value) < 0.05) {
    return <span>与上一周期持平</span>;
  }
  const rising = value > 0;
  const good = lowerIsBetter ? !rising : rising;
  return (
    <>
      <span className={good ? 'up' : 'down'}>
        {rising ? '↑' : '↓'} {Math.abs(value).toFixed(1)}
        {suffix}
      </span>
      较上一周期
    </>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  return value.toLocaleString();
}

export default function SummaryCards({ summary, previous }: SummaryCardsProps) {
  const cards = [
    {
      key: 'calls',
      tone: '',
      icon: 'activity',
      label: '总调用',
      value: summary ? formatCompact(summary.calls) : '—',
      unit: '次',
      delta: (
        <Delta value={pctChange(summary?.calls, previous?.calls)} suffix="%" />
      ),
    },
    {
      key: 'tokens',
      tone: 'violet',
      icon: 'braces',
      label: 'Token 消耗',
      value: summary ? formatCompact(summary.tokens) : '—',
      unit: 'tokens',
      delta: (
        <Delta value={pctChange(summary?.tokens, previous?.tokens)} suffix="%" />
      ),
    },
    {
      key: 'avg',
      tone: 'amber',
      icon: 'clock',
      label: '平均延迟',
      value: summary ? summary.avgMs.toLocaleString() : '—',
      unit: 'ms',
      delta: (
        <Delta
          value={pctChange(summary?.avgMs, previous?.avgMs)}
          suffix="%"
          lowerIsBetter
        />
      ),
    },
    {
      key: 'p95',
      tone: 'amber',
      icon: 'zap',
      label: 'P95 延迟',
      value: summary ? summary.p95Ms.toLocaleString() : '—',
      unit: 'ms',
      delta: (
        <Delta
          value={pctChange(summary?.p95Ms, previous?.p95Ms)}
          suffix="%"
          lowerIsBetter
        />
      ),
    },
    {
      key: 'success',
      tone: 'green',
      icon: 'check-circle',
      label: '成功率',
      value: summary ? summary.successRate.toFixed(2) : '—',
      unit: '%',
      delta: (
        <Delta
          value={
            summary && previous ? summary.successRate - previous.successRate : null
          }
          suffix="pp"
        />
      ),
    },
    {
      key: 'retrieval',
      tone: 'green',
      icon: 'search',
      label: '检索命中率',
      value: summary ? summary.retrievalHitRate.toFixed(1) : '—',
      unit: '%',
      delta: (
        <Delta
          value={
            summary && previous
              ? summary.retrievalHitRate - previous.retrievalHitRate
              : null
          }
          suffix="pp"
        />
      ),
    },
    {
      key: 'cache',
      tone: 'violet',
      icon: 'layers',
      label: '缓存命中率',
      value: summary ? summary.cacheHitRate.toFixed(1) : '—',
      unit: '%',
      delta: (
        <Delta
          value={
            summary && previous
              ? summary.cacheHitRate - previous.cacheHitRate
              : null
          }
          suffix="pp"
        />
      ),
    },
    {
      key: 'limited',
      tone: 'red',
      icon: 'shield',
      label: '限流拦截',
      value: summary ? summary.rateLimited.toLocaleString() : '—',
      unit: '次',
      delta: (
        <Delta
          value={pctChange(summary?.rateLimited, previous?.rateLimited)}
          suffix="%"
          lowerIsBetter
        />
      ),
    },
  ];

  return (
    <div className="grid grid-4 ai-metrics-cards">
      {cards.map((card) => (
        <div className={`stat ${card.tone}`.trim()} key={card.key}>
          <div className="label">
            <Icon name={card.icon} size={13} />
            {card.label}
          </div>
          <div className="value">
            {card.value}
            <small>{card.unit}</small>
          </div>
          <div className="foot">{card.delta}</div>
          <span className="s-icon">
            <Icon name={card.icon} size={15} />
          </span>
        </div>
      ))}
    </div>
  );
}
