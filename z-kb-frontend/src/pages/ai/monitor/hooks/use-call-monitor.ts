import {
  buildSnapshot,
  rangeSpanMs,
  type MonitorRange,
  type MonitorSnapshot,
} from '@/pages/ai/monitor/mock';
import { useEffect, useState } from 'react';

interface MonitorState {
  loading: boolean;
  snapshot?: MonitorSnapshot;
  previous?: MonitorSnapshot;
}

/** 样本生成是同步的，这里仍走一次异步节奏，保持与真实接口一致的加载态。 */
export function useCallMonitor(range: MonitorRange) {
  const [state, setState] = useState<MonitorState>({ loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const seed = 1000 + tick * 31;
      const snapshot = buildSnapshot(range, now, seed);
      const previous = buildSnapshot(range, now - rangeSpanMs(range), seed + 7);
      if (alive) {
        setState({ loading: false, snapshot, previous });
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
