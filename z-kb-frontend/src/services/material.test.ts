import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl, downloadFile, request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  downloadMaterial,
  getMaterial,
  listDrafts,
  listRecentMaterials,
  materialDownloadUrl,
  pageDeletedMaterials,
  pageMaterial,
  purgeMaterials,
  removeMaterials,
  reparseMaterial,
  restoreMaterials,
  reviseMaterial,
  updateMaterialCategory,
  uploadMaterials,
} from './material';

vi.mock('@/services/http', () => ({
  request: vi.fn(),
  downloadFile: vi.fn(),
  buildApiUrl: vi.fn(
    (path: string, params?: URLSearchParams) =>
      `https://api.test/kapi${path}?${params?.toString() ?? ''}`,
  ),
}));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/material';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

describe('资料查询接口', () => {
  it('分页查询提交筛选条件', async () => {
    await pageMaterial({ kbId: 'kb-1', current: 1, size: 20, keyword: '手册' });
    expect(request).toHaveBeenLastCalledWith(`${BASE}/page`, {
      method: 'post',
      data: { kbId: 'kb-1', current: 1, size: 20, keyword: '手册' },
      headers,
    });
  });

  it('详情与最近资料', async () => {
    await getMaterial('m1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryDetailById`, {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });

    await listRecentMaterials('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listRecent`, {
      method: 'get',
      params: { kbId: 'kb-1', limit: 5 },
      headers,
    });

    await listRecentMaterials('kb-1', 10);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listRecent`, {
      method: 'get',
      params: { kbId: 'kb-1', limit: 10 },
      headers,
    });

    await listDrafts('m1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listDrafts`, {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });

    await listDrafts('m1', 'v1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listDrafts`, {
      method: 'get',
      params: { materialId: 'm1', versionId: 'v1' },
      headers,
    });

    await pageDeletedMaterials({ kbId: 'kb-1', size: 10 });
    expect(request).toHaveBeenLastCalledWith(`${BASE}/pageDeleted`, {
      method: 'post',
      data: { kbId: 'kb-1', size: 10 },
      headers,
    });
  });
});

describe('资料上传与修订接口', () => {
  const file = new File(['内容'], 'a.txt', { type: 'text/plain' });

  it('多文件上传使用 FormData 并拼接可选分类', async () => {
    const second = new File(['b'], 'b.txt');
    await uploadMaterials('kb-1', 'c1', [file, second]);

    const [url, options] = vi.mocked(request).mock.calls[0];
    expect(url).toBe(`${BASE}/upload?kbId=kb-1&categoryId=c1`);
    expect(options).toMatchObject({ method: 'post', headers, timeout: 120_000 });
    const form = options?.data as FormData;
    expect(form.getAll('files')).toEqual([file, second]);
  });

  it('未选分类时只传 kbId', async () => {
    await uploadMaterials('kb-1', undefined, [file]);
    expect(vi.mocked(request).mock.calls[0][0]).toBe(`${BASE}/upload?kbId=kb-1`);
  });

  it('修订资料附带来源版本', async () => {
    await reviseMaterial('kb-1', 'm1', file, 'v2');
    const [url, options] = vi.mocked(request).mock.calls[0];
    expect(url).toBe(`${BASE}/revise?kbId=kb-1&materialId=m1&sourceVersion=v2`);
    const form = options?.data as FormData;
    expect(form.get('file')).toBe(file);

    await reviseMaterial('kb-1', 'm1', file);
    expect(vi.mocked(request).mock.calls[1][0]).toBe(
      `${BASE}/revise?kbId=kb-1&materialId=m1`,
    );
  });

  it('重解析可指定版本', async () => {
    await reparseMaterial('m1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/reparse`, {
      method: 'post',
      data: { materialId: 'm1' },
      headers,
    });

    await reparseMaterial('m1', 'v1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/reparse`, {
      method: 'post',
      data: { materialId: 'm1', versionId: 'v1' },
      headers,
    });
  });
});

describe('资料批量操作接口', () => {
  it('调整分类、删除、恢复与彻底删除', async () => {
    await updateMaterialCategory('kb-1', ['m1'], 'c1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/updateCategory`, {
      method: 'post',
      data: { kbId: 'kb-1', materialIds: ['m1'], categoryId: 'c1' },
      headers,
    });

    await updateMaterialCategory('kb-1', ['m1']);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/updateCategory`, {
      method: 'post',
      data: { kbId: 'kb-1', materialIds: ['m1'], categoryId: undefined },
      headers,
    });

    await removeMaterials('kb-1', ['m1', 'm2']);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/remove`, {
      method: 'post',
      data: { kbId: 'kb-1', materialIds: ['m1', 'm2'] },
      headers,
    });

    await restoreMaterials('kb-1', ['m1']);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/restore`, {
      method: 'post',
      data: { kbId: 'kb-1', materialIds: ['m1'] },
      headers,
    });

    await purgeMaterials('kb-1', ['m1']);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/purge`, {
      method: 'post',
      data: { kbId: 'kb-1', materialIds: ['m1'] },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(removeMaterials('kb-1', ['m1'])).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});

describe('资料下载接口', () => {
  it('生成下载地址时编码版本参数', () => {
    materialDownloadUrl('m1');
    expect(buildApiUrl).toHaveBeenLastCalledWith(`${BASE}/download`, expect.any(URLSearchParams));
    const params = vi.mocked(buildApiUrl).mock.calls[0][1] as URLSearchParams;
    expect(params.get('materialId')).toBe('m1');
    expect(params.has('versionId')).toBe(false);

    expect(materialDownloadUrl('m1', 'v1')).toBe(
      'https://api.test/kapi/future-brain/v1/material/download?materialId=m1&versionId=v1',
    );
  });

  it('下载文件返回 Blob 并携带版本', async () => {
    const blob = new Blob(['资料']);
    vi.mocked(downloadFile).mockResolvedValue(blob);

    await expect(downloadMaterial('m1')).resolves.toBe(blob);
    expect(downloadFile).toHaveBeenLastCalledWith(`${BASE}/download`, {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });

    await downloadMaterial('m1', 'v1');
    expect(downloadFile).toHaveBeenLastCalledWith(`${BASE}/download`, {
      method: 'get',
      params: { materialId: 'm1', versionId: 'v1' },
      headers,
    });
  });
});
