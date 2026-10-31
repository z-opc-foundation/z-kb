import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getAuditLog, pageAuditLogs } from './audit';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('审计日志接口', () => {
  it('分页查询携带筛选条件与租户头', async () => {
    const page = { records: [], total: 0, size: 20, current: 1 };
    vi.mocked(request).mockResolvedValue(page as never);

    const query = {
      current: 2,
      size: 20,
      keyword: '上传',
      type: 'KB' as const,
      bizRef: 'kb-1',
      actorId: 9,
      success: 1 as const,
      startTime: 100,
      endTime: 200,
    };
    await expect(pageAuditLogs(query)).resolves.toBe(page);
    expect(request).toHaveBeenCalledWith('/future-brain/v1/auditLog/page', {
      method: 'post',
      data: query,
      headers,
    });
  });

  it('按主键读取明细', async () => {
    const record = { id: '1', tenantCode: 'tenant-a', action: 'A', targetMethod: 'm', success: 1, createTime: '2026-01-01' };
    vi.mocked(request).mockResolvedValue(record as never);
    await expect(getAuditLog('1')).resolves.toBe(record);
    expect(request).toHaveBeenCalledWith('/future-brain/v1/auditLog/get', {
      method: 'get',
      params: { id: '1' },
      headers,
    });
  });

  it('查询失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(pageAuditLogs({})).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');

    vi.mocked(request).mockRejectedValueOnce('bad');
    await expect(getAuditLog('1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenLastCalledWith('请求失败', '服务器错误', 'error');
  });
});
