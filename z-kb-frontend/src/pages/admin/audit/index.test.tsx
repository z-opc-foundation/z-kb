import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuditLog,
  pageAuditLogs,
  type AuditLogRecord,
} from '@/services/audit';
import { listMembers } from '@/services/identity';
import AuditLogPage from './index';

vi.mock('@/services/audit', () => ({
  pageAuditLogs: vi.fn(),
  getAuditLog: vi.fn(),
}));

vi.mock('@/services/identity', () => ({
  listMembers: vi.fn(),
}));

const records: AuditLogRecord[] = [
  {
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
    requestUri: '/v1/material/upload',
    success: 1,
    durationMs: 12,
    traceId: 'trace-1',
    createTime: '2026-10-29T10:00:00',
  },
  {
    id: '2',
    tenantCode: 'tenant-a',
    type: 'SYS',
    actorId: 9,
    action: 'TENANT_UPDATE',
    actionDesc: '更新租户',
    targetClass: 'TenantController',
    targetMethod: 'update',
    httpMethod: 'PUT',
    requestUri: '/v1/tenant/update',
    success: 0,
    errorMessage: '租户编码重复',
    durationMs: 8,
    createTime: '2026-10-29T09:00:00',
  },
];

beforeEach(() => {
  vi.mocked(listMembers).mockResolvedValue([
    { staffId: 9, name: '张三', jobNumber: 'A001', roleCodes: [] },
  ]);
  vi.mocked(pageAuditLogs).mockResolvedValue({
    records,
    total: records.length,
    size: 20,
    current: 1,
  });
  vi.mocked(getAuditLog).mockImplementation(async (id) => {
    const record = records.find((item) => item.id === id);
    return record
      ? {
          ...record,
          requestParams: '{"file":"手册.pdf"}',
          responseResult: '{"ok":true}',
        }
      : null;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('系统审计页', () => {
  it('按平台级范围加载并展示归属、操作人与结果', async () => {
    render(<AuditLogPage />);

    expect(await screen.findByText('上传资料')).toBeInTheDocument();
    expect(pageAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined, bizRef: undefined, current: 1, size: 20 }),
    );
    expect(screen.getByText('归属')).toBeInTheDocument();
    expect(screen.getAllByText('知识库').length).toBeGreaterThan(0);
    expect(screen.getAllByText('系统').length).toBeGreaterThan(0);
    expect(screen.getByText('kb-1')).toBeInTheDocument();
    expect(screen.getAllByText('张三')).toHaveLength(2);
    expect(screen.getByText('更新租户')).toBeInTheDocument();
    expect(screen.getByText('租户编码重复')).toBeInTheDocument();
    expect(screen.getByText(/共 2 条/)).toBeInTheDocument();
  });

  it('点击查看打开详情抽屉并按 ID 拉取完整报文', async () => {
    render(<AuditLogPage />);
    await screen.findByText('上传资料');

    fireEvent.click(screen.getAllByRole('button', { name: '查看' })[0]);

    expect(await screen.findByText('操作详情')).toBeInTheDocument();
    expect(getAuditLog).toHaveBeenCalledWith('1');
    expect(await screen.findByText(/"file": "手册.pdf"/)).toBeInTheDocument();
  });

  it('无数据时展示当前租户空态', async () => {
    vi.mocked(pageAuditLogs).mockResolvedValue({
      records: [],
      total: 0,
      size: 20,
      current: 1,
    });
    render(<AuditLogPage />);

    expect(await screen.findByText('当前租户还没有审计记录')).toBeInTheDocument();
    expect(screen.getByText(/共 0 条/)).toBeInTheDocument();
  });

  it('加载失败展示错误，重试重新请求', async () => {
    vi.mocked(pageAuditLogs)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ records, total: records.length, size: 20, current: 1 });
    render(<AuditLogPage />);

    expect(await screen.findByText('操作日志加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getByText('上传资料')).toBeInTheDocument());
    expect(pageAuditLogs).toHaveBeenCalledTimes(2);
  });
});
