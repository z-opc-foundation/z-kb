import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  generateWiki,
  getWikiDetail,
  getWikiLineage,
  listWikiByMaterial,
  listWikiPages,
} from './wiki';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/z***REMOVED***/v1/wiki';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

describe('Wiki 接口', () => {
  it('生成 Wiki 提交知识库与资料', async () => {
    await generateWiki('***REMOVED***-1', ['m1', 'm2']);
    expect(request).toHaveBeenCalledWith(`${BASE}/generate`, {
      method: 'post',
      data: { ***REMOVED***Id: '***REMOVED***-1', materialIds: ['m1', 'm2'] },
      headers,
    });
  });

  it('Wiki 列表默认限制 50 条，空关键字不传', async () => {
    await listWikiPages('***REMOVED***-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/list`, {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1', keyword: undefined, limit: 50 },
      headers,
    });

    await listWikiPages('***REMOVED***-1', '手册', 10);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/list`, {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1', keyword: '手册', limit: 10 },
      headers,
    });
  });

  it('详情、按资料列表与血缘', async () => {
    await getWikiDetail('w1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/detail`, {
      method: 'get',
      params: { wikiId: 'w1' },
      headers,
    });

    await listWikiByMaterial('m1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listByMaterial`, {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });

    await getWikiLineage({ ***REMOVED***Id: '***REMOVED***-1' });
    expect(request).toHaveBeenLastCalledWith(`${BASE}/lineage`, {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1' },
      headers,
    });

    await getWikiLineage({ wikiId: 'w1' });
    expect(request).toHaveBeenLastCalledWith(`${BASE}/lineage`, {
      method: 'get',
      params: { wikiId: 'w1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(listWikiPages('***REMOVED***-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
