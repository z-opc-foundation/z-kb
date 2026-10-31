import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import { getConcept, listConceptsBy***REMOVED*** } from './concept';

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

    await expect(listConceptsBy***REMOVED***('***REMOVED***-1')).resolves.toBe(concepts);
    expect(request).toHaveBeenLastCalledWith('/***REMOVED***/v1/concept/listBy***REMOVED***', {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1', keyword: undefined },
      headers,
    });

    await listConceptsBy***REMOVED***('***REMOVED***-1', '术语');
    expect(request).toHaveBeenLastCalledWith('/***REMOVED***/v1/concept/listBy***REMOVED***', {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1', keyword: '术语' },
      headers,
    });
  });

  it('读取概念详情', async () => {
    const detail = { concept: { conceptId: 'c1' }, mentions: [] };
    vi.mocked(request).mockResolvedValue(detail as never);
    await expect(getConcept('***REMOVED***-1', 'c1')).resolves.toBe(detail);
    expect(request).toHaveBeenCalledWith('/***REMOVED***/v1/concept/queryById', {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1', conceptId: 'c1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(getConcept('***REMOVED***-1', 'c1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
