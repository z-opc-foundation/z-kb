import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  cancelCompilation,
  cancelCompilationBatch,
  createCompilationBatch,
  getCompilationBatch,
  getCompilationByJob,
  getCompilationByMaterial,
  hasRunningCompilationBatch,
  isCompilationActive,
  listCompilationBatches,
  listCompilationChunks,
  listCompilationJobs,
  pageCompilationBatches,
  retryCompilation,
  runCompilation,
  searchCompilationChunks,
} from './compilation';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/compilation';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

describe('知识编译接口', () => {
  it('运行、重试与取消携带任务参数和超时', async () => {
    await runCompilation('m1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/run`, {
      method: 'post',
      data: { materialId: 'm1' },
      headers,
      timeout: 15_000,
    });

    await runCompilation('m1', 'v1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/run`, {
      method: 'post',
      data: { materialId: 'm1', versionId: 'v1' },
      headers,
      timeout: 15_000,
    });

    await retryCompilation('j1', 'PARSE');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/retry`, {
      method: 'post',
      data: { jobId: 'j1', startStage: 'PARSE' },
      headers,
      timeout: 15_000,
    });

    await cancelCompilation('j1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/cancel`, {
      method: 'post',
      data: { jobId: 'j1' },
      headers,
      timeout: 15_000,
    });

    await cancelCompilationBatch('b1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/cancelBatch`, {
      method: 'post',
      data: { batchId: 'b1' },
      headers,
      timeout: 15_000,
    });
  });

  it('查询编译任务与片段时拼接可选版本和限制', async () => {
    await getCompilationByMaterial('m1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryByMaterial`, {
      method: 'get',
      params: { materialId: 'm1' },
      headers,
    });

    await getCompilationByMaterial('m1', 'v1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryByMaterial`, {
      method: 'get',
      params: { materialId: 'm1', versionId: 'v1' },
      headers,
    });

    await getCompilationByJob('j1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryByJob`, {
      method: 'get',
      params: { jobId: 'j1' },
      headers,
    });

    await listCompilationJobs('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listByKb`, {
      method: 'get',
      params: { kbId: 'kb-1', limit: 20 },
      headers,
    });

    await listCompilationJobs('kb-1', 'm1', 5);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listByKb`, {
      method: 'get',
      params: { kbId: 'kb-1', materialId: 'm1', limit: 5 },
      headers,
    });

    await listCompilationChunks('m1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listChunks`, {
      method: 'get',
      params: { materialId: 'm1', limit: 100 },
      headers,
    });

    await listCompilationChunks('m1', 'v1', 10);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listChunks`, {
      method: 'get',
      params: { materialId: 'm1', versionId: 'v1', limit: 10 },
      headers,
    });

    await searchCompilationChunks('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/search`, {
      method: 'get',
      params: { kbId: 'kb-1', limit: 20 },
      headers,
    });

    await searchCompilationChunks('kb-1', '关键词', 5);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/search`, {
      method: 'get',
      params: { kbId: 'kb-1', keyword: '关键词', limit: 5 },
      headers,
    });
  });

  it('批量任务创建、列表、分页与运行状态查询', async () => {
    const payload = { kbId: 'kb-1', materialIds: ['m1'], scopeType: 'MATERIAL' };
    await createCompilationBatch(payload);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/createBatch`, {
      method: 'post',
      data: payload,
      headers,
      timeout: 15_000,
    });

    await listCompilationBatches('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listBatches`, {
      method: 'get',
      params: { kbId: 'kb-1', limit: 20 },
      headers,
    });

    await pageCompilationBatches('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/pageBatches`, {
      method: 'get',
      params: { kbId: 'kb-1', pageNo: 1, pageSize: 20 },
      headers,
    });

    await pageCompilationBatches('kb-1', 3, 10);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/pageBatches`, {
      method: 'get',
      params: { kbId: 'kb-1', pageNo: 3, pageSize: 10 },
      headers,
    });

    await getCompilationBatch('b1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryBatch`, {
      method: 'get',
      params: { batchId: 'b1' },
      headers,
    });

    await hasRunningCompilationBatch('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/hasRunningBatch`, {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });
  });

  it.each([
    ['QUEUED', true],
    ['RUNNING', true],
    ['SUCCESS', false],
    [undefined, false],
  ])('任务状态 %s 是否活跃为 %s', (status, expected) => {
    expect(isCompilationActive(status)).toBe(expected);
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(runCompilation('m1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
