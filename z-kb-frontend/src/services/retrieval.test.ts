import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { retrieveKnowledge } from './retrieval';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/knowledgeBase/retrieve';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('知识检索接口', () => {
  it('默认使用密集检索模式', async () => {
    const result = { kbId: 'kb-1', query: '怎么退款', hits: [] };
    vi.mocked(request).mockResolvedValue(result as never);

    await expect(
      retrieveKnowledge({ kbId: 'kb-1', query: '怎么退款', topK: 5, minScore: 0.2 }),
    ).resolves.toBe(result);
    expect(request).toHaveBeenCalledWith(BASE, {
      method: 'post',
      data: {
        kbId: 'kb-1',
        query: '怎么退款',
        topK: 5,
        minScore: 0.2,
        mode: 'dense',
      },
      headers,
    });
  });

  it('显式模式覆盖默认值', async () => {
    vi.mocked(request).mockResolvedValue({} as never);
    await retrieveKnowledge({ kbId: 'kb-1', query: 'q', topK: 3, minScore: 0, mode: 'hybrid' });
    expect(request).toHaveBeenCalledWith(BASE, {
      method: 'post',
      data: { kbId: 'kb-1', query: 'q', topK: 3, minScore: 0, mode: 'hybrid' },
      headers,
    });
  });

  it('失败时提示检索失败并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(
      retrieveKnowledge({ kbId: 'kb-1', query: 'q', topK: 5, minScore: 0.1 }),
    ).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('检索失败', 'boom', 'error');
  });
});
