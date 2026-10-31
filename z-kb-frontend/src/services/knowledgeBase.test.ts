import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  archiveKnowledgeBase,
  createKnowledgeBase,
  getKnowledgeBase,
  pageKnowledgeBase,
  removeKnowledgeBase,
  restoreKnowledgeBase,
  updateKnowledgeBase,
} from './knowledgeBase';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/knowledgeBase';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

describe('知识库接口', () => {
  it('分页查询提交筛选条件', async () => {
    const page = { records: [], total: 0, size: 20, current: 1 };
    vi.mocked(request).mockResolvedValueOnce(page as never);
    const query = { current: 1, size: 20, keyword: '手册', type: 'FILE', status: 'ACTIVE' };
    await expect(pageKnowledgeBase(query)).resolves.toBe(page);
    expect(request).toHaveBeenCalledWith(`${BASE}/page`, {
      method: 'post',
      data: query,
      headers,
    });
  });

  it('分页查询可选择把错误抛给调用方', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(pageKnowledgeBase({}, { rethrow: true })).rejects.toThrow('boom');
    expect(toast).not.toHaveBeenCalled();
  });

  it('详情、新建、更新、归档、恢复与删除', async () => {
    await getKnowledgeBase('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryDetailById`, {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });

    const create = { name: '手册', code: 'manual', type: 'FILE' as const };
    await createKnowledgeBase(create);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/add`, {
      method: 'post',
      data: create,
      headers,
    });

    const update = { kbId: 'kb-1', name: '新名字' };
    await updateKnowledgeBase(update);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/update`, {
      method: 'post',
      data: update,
      headers,
    });

    await archiveKnowledgeBase('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/archive`, {
      method: 'post',
      data: { kbId: 'kb-1' },
      headers,
    });

    await restoreKnowledgeBase('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/restore`, {
      method: 'post',
      data: { kbId: 'kb-1' },
      headers,
    });

    await removeKnowledgeBase('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/remove`, {
      method: 'post',
      data: { kbId: 'kb-1' },
      headers,
    });
  });

  it('默认失败提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(removeKnowledgeBase('kb-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');

    vi.mocked(request).mockRejectedValueOnce('bad');
    await expect(getKnowledgeBase('kb-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenLastCalledWith('请求失败', '服务器错误', 'error');
  });
});
