import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSystemMonitor } from '@/pages/admin/monitor/hooks/use-system-monitor';
import SystemMonitorPage from '@/pages/admin/monitor/index';
import type { MonitorSnapshot } from '@/pages/admin/monitor/mock';

vi.mock('@/pages/admin/monitor/hooks/use-system-monitor', () => ({
  useSystemMonitor: vi.fn(),
}));

const stats = {
  servicesUp: 7,
  servicesTotal: 8,
  peakQps: 17.4,
  p95Ms: 820,
  errorRate: 0.31,
  alertsFiring: 2,
};

const snapshot: MonitorSnapshot = {
  stats,
  previous: { ...stats, peakQps: 16.2, p95Ms: 780, alertsFiring: 1 },
  trend: [
    { key: 'a', label: '10:00', ok: 12, failed: 0, total: 12 },
    { key: 'b', label: '11:00', ok: 16, failed: 1, total: 17 },
  ],
  services: [
    {
      key: 'kb',
      name: '知识库服务',
      code: 'kb-service',
      group: '业务服务',
      status: 'degraded',
      instances: '5 / 6',
      uptime: 99.62,
      latencyMs: 186,
      errorRate: 0.18,
      version: 'v2.31.0',
    },
  ],
  resources: [
    {
      key: 'cpu',
      label: '集群 CPU',
      used: 48,
      capacity: 100,
      unit: '%',
      note: '8 vCPU',
    },
  ],
  queues: [
    {
      key: 'compile',
      label: '编译任务',
      waiting: 12,
      running: 6,
      failed: 1,
      capacity: 200,
    },
  ],
  endpoints: [
    {
      key: 'retrieve',
      method: 'POST',
      path: '/kapi/kb/retrieve',
      qps: 5.2,
      p95Ms: 504,
      errorRate: 0.16,
    },
  ],
  alerts: [
    {
      id: 'alt_1',
      level: 'warning',
      target: '编译执行器',
      title: '编译任务积压 12 条，高于 10 条阈值',
      sinceAt: Date.UTC(2026, 9, 30, 10, 0),
      durationMin: 42,
      status: 'firing',
    },
  ],
};

const refresh = vi.fn();

function setMonitorState(state: { loading: boolean; snapshot?: MonitorSnapshot }) {
  vi.mocked(useSystemMonitor).mockReturnValue({ ...state, refresh });
}

describe('SystemMonitorPage', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(useSystemMonitor).mockReset();
  });

  it('首次加载展示加载提示', () => {
    setMonitorState({ loading: true });
    render(<SystemMonitorPage />);
    expect(screen.getByText('正在汇总运行状态…')).toBeInTheDocument();
    expect(useSystemMonitor).toHaveBeenCalledWith('24h');
  });

  it('加载成功后渲染各监测区块', () => {
    setMonitorState({ loading: false, snapshot });
    render(<SystemMonitorPage />);

    expect(screen.getByText('服务在线')).toBeInTheDocument();
    expect(screen.getByText('请求量趋势')).toBeInTheDocument();
    expect(screen.getByText('资源水位')).toBeInTheDocument();
    expect(screen.getByText('服务健康')).toBeInTheDocument();
    expect(screen.getByText('接口性能')).toBeInTheDocument();
    expect(screen.getByText('队列与调度')).toBeInTheDocument();
    expect(screen.getByText('知识库服务')).toBeInTheDocument();
    expect(screen.getByText('降级')).toBeInTheDocument();
    expect(screen.getByText('5 / 6')).toBeInTheDocument();
    expect(screen.getByText('/kapi/kb/retrieve')).toBeInTheDocument();
    expect(
      screen.getByText('编译任务积压 12 条，高于 10 条阈值'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('最近 24 小时').length).toBeGreaterThan(0);
  });

  it('切换时间范围会用新范围重新加载', () => {
    setMonitorState({ loading: false, snapshot });
    render(<SystemMonitorPage />);

    fireEvent.click(screen.getByRole('button', { name: '最近 7 天' }));

    expect(useSystemMonitor).toHaveBeenLastCalledWith('7d');
    expect(screen.getAllByText('最近 7 天').length).toBeGreaterThan(0);
  });

  it('点击刷新调用 hook 的 refresh', () => {
    setMonitorState({ loading: false, snapshot });
    render(<SystemMonitorPage />);

    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
