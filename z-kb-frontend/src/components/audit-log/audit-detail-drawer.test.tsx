import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuditLog, type AuditLogRecord } from '@/services/audit';
import AuditDetailDrawer from './audit-detail-drawer';

vi.mock('@/services/audit', () => ({
  pageAuditLogs: vi.fn(),
  getAuditLog: vi.fn(),
}));

const record: AuditLogRecord = {
  id: '1',
  tenantCode: 'tenant-a',
  type: 'KB',
  bizRef: 'kb-1',
  actorId: 9,
  action: 'MATERIAL_UPLOAD',
  actionDesc: '上传资料',
  targetClass: 'MaterialController',
  targetMethod: 'upload',
  httpMethod: 'POST',
  requestUri: '/kapi/v1/material/upload',
  clientIp: '127.0.0.1',
  success: 1,
  durationMs: 12,
  traceId: 'trace-1',
  createTime: '2026-10-29T10:00:00',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('审计详情抽屉', () => {
  it('先展示加载态，再展示格式化后的出入参与归属信息', async () => {
    let resolveDetail: (value: AuditLogRecord) => void = () => {};
    vi.mocked(getAuditLog).mockReturnValue(
      new Promise<AuditLogRecord>((resolve) => {
        resolveDetail = resolve;
      }) as never,
    );

    const { container } = render(
      <AuditDetailDrawer record={record} actorName="张三" onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('正在读取完整出入参…')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('知识库级')).toBeInTheDocument();
    expect(screen.getByText('kb-1')).toBeInTheDocument();
    expect(getAuditLog).toHaveBeenCalledWith('1');

    await act(async () => {
      resolveDetail({
        ...record,
        requestParams: '{"kbId":"kb-1","files":2}',
        responseResult: 'not-json',
      });
    });

    await waitFor(() => expect(screen.queryByText('正在读取完整出入参…')).toBeNull());
    const pres = container.querySelectorAll('pre');
    expect(pres[0]).toHaveTextContent('"kbId": "kb-1"');
    expect(pres[1]).toHaveTextContent('not-json');
  });

  it('失败记录展示异常摘要，未记录返回值有兜底文案', async () => {
    vi.mocked(getAuditLog).mockResolvedValue({
      ...record,
      success: 0,
      errorMessage: '文件格式不支持',
      type: 'SYS',
      bizRef: null,
    });

    const { container } = render(<AuditDetailDrawer record={record} onClose={vi.fn()} />);

    expect(await screen.findByText('失败')).toHaveClass('tag', 'red');
    expect(await screen.findByText('业务异常')).toBeInTheDocument();
    expect(screen.getByText('文件格式不支持')).toBeInTheDocument();
    expect(screen.getByText('系统级')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();

    await waitFor(() => expect(container.querySelectorAll('pre')).toHaveLength(2));
    expect(container.querySelectorAll('pre')[0]).toHaveTextContent('该调用未记录入参');
    expect(container.querySelectorAll('pre')[1]).toHaveTextContent('调用失败，无返回值');
  });

  it('完整报文读取失败时保留摘要并提示重试', async () => {
    vi.mocked(getAuditLog).mockResolvedValue(null);

    render(<AuditDetailDrawer record={record} onClose={vi.fn()} />);

    expect(await screen.findByText('完整出入参读取失败')).toBeInTheDocument();
    expect(screen.getByText('摘要信息仍然可用；关闭抽屉后重新打开可重试。')).toBeInTheDocument();
  });

  it('关闭按钮、遮罩与 Esc 均可关闭', async () => {
    vi.mocked(getAuditLog).mockResolvedValue(record);
    const onClose = vi.fn();
    render(<AuditDetailDrawer record={record} onClose={onClose} />);
    await waitFor(() => expect(getAuditLog).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.mouseDown(document.querySelector('.drawer-overlay') as Element);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
