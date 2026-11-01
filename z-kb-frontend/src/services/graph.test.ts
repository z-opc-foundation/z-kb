import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getGraphBy***REMOVED***, getGraphByMaterial } from './graph';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('知识图谱接口', () => {
  it('按资料与知识库读取图谱', async () => {
    const graph = { ***REMOVED***Id: '***REMOVED***-1', nodeCount: 0, edgeCount: 0, truncated: false, nodes: [], edges: [] };
    vi.mocked(request).mockResolvedValue(graph as never);

    await expect(getGraphByMaterial('m1')).resolves.toBe(graph);
    expect(request).toHaveBeenLastCalledWith('/z***REMOVED***/v1/graph/queryByMaterial', {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });

    await getGraphBy***REMOVED***('***REMOVED***-1');
    expect(request).toHaveBeenLastCalledWith('/z***REMOVED***/v1/graph/queryBy***REMOVED***', {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(getGraphBy***REMOVED***('***REMOVED***-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
