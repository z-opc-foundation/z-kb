import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getExtractionByMaterial } from './extraction';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('资料抽取接口', () => {
  it('按资料读取抽取结果', async () => {
    const record = {
      materialId: 'm1',
      milestone: 'DONE',
      counts: { summary: 1, question: 0, term: 0, faq: 0, graphNode: 0, graphEdge: 0 },
      questions: [],
      terms: [],
      faqs: [],
    };
    vi.mocked(request).mockResolvedValue(record as never);
    await expect(getExtractionByMaterial('m1')).resolves.toBe(record);
    expect(request).toHaveBeenCalledWith('/future-brain/v1/extraction/queryByMaterial', {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(getExtractionByMaterial('m1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
