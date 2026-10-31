import {
  buildMetricsSnapshot,
  type MetricsRange,
  type MetricsSnapshot,
} from '@/pages/ai/metrics/mock';
import { useEffect, useState } from 'react';

interface MetricsState {
  loading: boolean;
  snapshot?: MetricsSnapshot;
}

/** 样本生成是同步的，这里仍走一次异步节奏，保持与真实接口一致的加载态。 */
export function useMetrics(range: MetricsRange) {
  const [state, setState] = useState<MetricsState>({ loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    const timer = window.setTimeout(() => {
      const snapshot = buildMetricsSnapshot(range, Date.now(), 2400 + tick * 37);
      if (alive) {
        setState({ loading: false, snapshot });
      }
    }, 260);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [range, tick]);

  return {
    ...state,
    refresh: () => setTick((value) => value + 1),
  };
}
