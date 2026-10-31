import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getConcept, listConceptsByKb } from './concept';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('概念接口', () => {
  it('按知识库列出概念，空关键字不传', async () => {
    const concepts = [{ conceptId: 'c1', name: '概念', conceptType: 'TERM', status: 'CONFIRMED', mentionCount: 1, materialCount: 1 }];
    vi.mocked(request).mockResolvedValue(concepts as never);

    await expect(listConceptsByKb('kb-1')).resolves.toBe(concepts);
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/concept/listByKb', {
      method: 'get',
      params: { kbId: 'kb-1', keyword: undefined },
      headers,
    });

    await listConceptsByKb('kb-1', '术语');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/concept/listByKb', {
      method: 'get',
      params: { kbId: 'kb-1', keyword: '术语' },
      headers,
    });
  });

  it('读取概念详情', async () => {
    const detail = { concept: { conceptId: 'c1' }, mentions: [] };
    vi.mocked(request).mockResolvedValue(detail as never);
    await expect(getConcept('kb-1', 'c1')).resolves.toBe(detail);
    expect(request).toHaveBeenCalledWith('/future-brain/v1/concept/queryById', {
      method: 'get',
      params: { kbId: 'kb-1', conceptId: 'c1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(getConcept('kb-1', 'c1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
