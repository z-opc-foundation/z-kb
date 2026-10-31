import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getGraphByKb, getGraphByMaterial } from './graph';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('知识图谱接口', () => {
  it('按资料与知识库读取图谱', async () => {
    const graph = { kbId: 'kb-1', nodeCount: 0, edgeCount: 0, truncated: false, nodes: [], edges: [] };
    vi.mocked(request).mockResolvedValue(graph as never);

    await expect(getGraphByMaterial('m1')).resolves.toBe(graph);
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/graph/queryByMaterial', {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });

    await getGraphByKb('kb-1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/graph/queryByKb', {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(getGraphByKb('kb-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
