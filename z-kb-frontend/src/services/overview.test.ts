import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getKbOverview } from './overview';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('知识库概览接口', () => {
  it('把大整数字段统一转成数字', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      kbId: 'kb-1',
      fileCount: '12',
      compiledCount: 8,
      partialCount: '3',
      notCompiledCount: '1',
      wikiCount: '0',
      runningTaskCount: '2',
      failedCount: 'not-a-number',
      recentMaterials: [],
      refreshedAt: '2026-01-01',
    } as never);

    await expect(getKbOverview('kb-1')).resolves.toEqual({
      kbId: 'kb-1',
      fileCount: 12,
      compiledCount: 8,
      partialCount: 3,
      notCompiledCount: 1,
      wikiCount: 0,
      runningTaskCount: 2,
      failedCount: 0,
      recentMaterials: [],
      refreshedAt: '2026-01-01',
    });
    expect(request).toHaveBeenCalledWith('/future-brain/v1/overview/kbStats', {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });
  });

  it('空响应保持原样返回', async () => {
    vi.mocked(request).mockResolvedValueOnce(null as never);
    await expect(getKbOverview('kb-1')).resolves.toBeNull();
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(getKbOverview('kb-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
