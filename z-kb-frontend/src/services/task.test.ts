import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getTaskSummary, pageTasks } from './task';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/taskMonitor';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('调度任务接口', () => {
  it('分页查询透传筛选条件与租户头', async () => {
    const page = { records: [], total: 0, pageNo: 1, pageSize: 20 };
    vi.mocked(request).mockResolvedValue(page as never);
    const query = { kbId: 'kb-1', taskType: 'COMPILE', status: 'RUNNING', pageNo: 2, pageSize: 10 };

    await expect(pageTasks(query)).resolves.toBe(page);
    expect(request).toHaveBeenCalledWith(`${BASE}/page`, {
      method: 'get',
      params: query,
      headers,
    });
  });

  it('分页失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(pageTasks({ kbId: 'kb-1' })).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('调度任务加载失败', 'boom', 'error');
  });

  it('角标统计失败静默返回 undefined', async () => {
    vi.mocked(request).mockResolvedValueOnce({ groupTotal: 1, jobTotal: 2, taskTotal: 3 } as never);
    await expect(getTaskSummary('kb-1')).resolves.toEqual({
      groupTotal: 1,
      jobTotal: 2,
      taskTotal: 3,
    });
    expect(request).toHaveBeenCalledWith(`${BASE}/summary`, {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });

    vi.mocked(request).mockRejectedValueOnce(new Error('offline'));
    await expect(getTaskSummary('kb-1')).resolves.toBeUndefined();
    expect(toast).not.toHaveBeenCalled();
  });
});
