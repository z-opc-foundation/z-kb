import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryEvalTrustEvidence } from '@/services/evaluation';
import TrustDrawer from './trust-drawer';

vi.mock('@/services/evaluation', () => ({
  queryEvalTrustEvidence: vi.fn(),
}));

const queryMock = vi.mocked(queryEvalTrustEvidence);

const ITEMS = [
  { code: 'VERSION', label: '版本钉住', status: 'AVAILABLE', detail: '数据集 v3 已钉住' },
  { code: 'COVERAGE', label: '覆盖范围', status: 'PARTIAL', detail: '缺 S8 反馈' },
  { code: 'JUDGE', label: '评分口径', status: 'PENDING', detail: null },
];

function renderDrawer(runId = 'run-1') {
  const onClose = vi.fn();
  return {
    ...render(<TrustDrawer runId={runId} onClose={onClose} />),
    onClose,
  };
}

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue({ items: ITEMS });
});

afterEach(() => {
  cleanup();
});

describe('TrustDrawer', () => {
  it('没有跑批时展示空态且不请求', () => {
    renderDrawer('');
    expect(screen.getByText('尚无可核验的跑批')).toBeInTheDocument();
    expect(screen.getByText('尚无跑批')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeDisabled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('加载中展示占位，返回后展示证据统计与明细', async () => {
    let resolve!: (value: unknown) => void;
    queryMock.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }) as never,
    );
    renderDrawer();
    expect(await screen.findByText('正在加载可信证据…')).toBeInTheDocument();
    resolve({ items: ITEMS });

    expect(await screen.findByText('版本钉住')).toBeInTheDocument();
    expect(queryMock).toHaveBeenCalledWith('run-1');
    expect(screen.getByText('数据集 v3 已钉住')).toBeInTheDocument();
    expect(screen.getAllByText('已具备').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('部分具备').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('待补 / 其他')).toBeInTheDocument();
    expect(screen.getByText('接口未返回说明')).toBeInTheDocument();
    expect(screen.getByText('五类证据口径')).toBeInTheDocument();
    expect(screen.getByText('不设发布门禁')).toBeInTheDocument();
  });

  it('兼容数组形式的证据返回', async () => {
    queryMock.mockResolvedValue([
      { code: 'A', label: '版本', status: 'AVAILABLE' },
      { code: 'B', label: '覆盖', status: 'READY' },
    ]);
    renderDrawer();
    expect(await screen.findByText('版本')).toBeInTheDocument();
    expect(screen.getAllByText('已具备').length).toBeGreaterThanOrEqual(3);
  });

  it('加载失败展示错误态并可重试', async () => {
    queryMock.mockResolvedValue(undefined);
    renderDrawer();
    expect(await screen.findByText('可信证据加载失败')).toBeInTheDocument();
    const before = queryMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    await waitFor(() =>
      expect(queryMock.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('接口返回空证据时展示空态', async () => {
    queryMock.mockResolvedValue({ items: [] });
    renderDrawer();
    expect(await screen.findByText('接口未返回证据项')).toBeInTheDocument();
  });

  it('刷新会重新请求，关闭触发回调', async () => {
    const { onClose } = renderDrawer();
    await screen.findByText('版本钉住');
    const before = queryMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() =>
      expect(queryMock.mock.calls.length).toBeGreaterThan(before),
    );
    fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
