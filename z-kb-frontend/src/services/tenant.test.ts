import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import {
  changeTenantStatus,
  deleteTenant,
  listTenants,
  saveTenant,
} from './tenant';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/identity/tenants';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('租户管理接口', () => {
  it('查询列表透传关键字与状态', async () => {
    vi.mocked(request).mockResolvedValue([] as never);
    await listTenants({ keyword: '新区', status: 'ACTIVE' });
    expect(request).toHaveBeenCalledWith(BASE, {
      headers,
      params: { keyword: '新区', status: 'ACTIVE' },
    });
  });

  it('查询列表忽略空筛选项', async () => {
    vi.mocked(request).mockResolvedValue([] as never);
    await listTenants({ keyword: '', status: undefined });
    expect(request).toHaveBeenCalledWith(BASE, {
      headers,
      params: { keyword: undefined, status: undefined },
    });
  });

  it('保存新建与编辑共用同一入口', async () => {
    vi.mocked(request).mockResolvedValue('7' as never);
    await expect(
      saveTenant({ code: 'tenant-b', name: '第二租户', description: '' }),
    ).resolves.toBe('7');
    expect(request).toHaveBeenCalledWith(`${BASE}/save`, {
      method: 'POST',
      data: { code: 'tenant-b', name: '第二租户', description: '' },
      headers,
    });
  });

  it('切换状态与删除按租户 ID 提交', async () => {
    vi.mocked(request).mockResolvedValue(undefined as never);
    await changeTenantStatus('7', 'DISABLED');
    expect(request).toHaveBeenCalledWith(`${BASE}/7/status`, {
      method: 'POST',
      data: { status: 'DISABLED' },
      headers,
    });
    await deleteTenant('7');
    expect(request).toHaveBeenCalledWith(`${BASE}/7/delete`, {
      method: 'POST',
      headers,
    });
  });
});
