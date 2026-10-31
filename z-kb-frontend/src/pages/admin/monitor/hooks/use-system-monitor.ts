import {
  buildMonitorSnapshot,
  type MonitorRange,
  type MonitorSnapshot,
} from '@/pages/admin/monitor/mock';
import { useEffect, useState } from 'react';

interface MonitorState {
  loading: boolean;
  snapshot?: MonitorSnapshot;
}

/** 样本生成是同步的，这里仍走一次异步节奏，保持与真实接口一致的加载态。 */
export function useSystemMonitor(range: MonitorRange) {
  const [state, setState] = useState<MonitorState>({ loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    const timer = window.setTimeout(() => {
      const snapshot = buildMonitorSnapshot(range, Date.now(), 5100 + tick * 29);
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
