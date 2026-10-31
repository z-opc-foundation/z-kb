import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { fetchKbActivityHeatmap } from './kbActivity';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('知识库活跃度接口', () => {
  it('批量查询默认 168 天并静默请求', async () => {
    const heatmap = { 'kb-1': [{ date: '2026-01-01', count: 2 }] };
    vi.mocked(request).mockResolvedValue(heatmap as never);
    await expect(fetchKbActivityHeatmap(['kb-1', 'kb-2'])).resolves.toBe(heatmap);
    expect(request).toHaveBeenCalledWith('/future-brain/v1/knowledgeBase/activity', {
      method: 'post',
      data: { kbIds: ['kb-1', 'kb-2'], days: 168 },
      headers,
      silent: true,
    });
  });

  it('支持自定义统计天数', async () => {
    vi.mocked(request).mockResolvedValue({} as never);
    await fetchKbActivityHeatmap(['kb-1'], 30);
    expect(request).toHaveBeenCalledWith('/future-brain/v1/knowledgeBase/activity', {
      method: 'post',
      data: { kbIds: ['kb-1'], days: 30 },
      headers,
      silent: true,
    });
  });
});
