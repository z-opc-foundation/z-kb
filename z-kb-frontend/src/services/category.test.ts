import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  createCategory,
  getCategoryTree,
  moveCategory,
  removeCategory,
  renameCategory,
} from './category';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('资料分类接口', () => {
  it('读取分类树', async () => {
    const tree = [{ categoryId: 'c1', name: '根', sortNo: 1 }];
    vi.mocked(request).mockResolvedValue(tree as never);
    await expect(getCategoryTree('kb-1')).resolves.toBe(tree);
    expect(request).toHaveBeenCalledWith('/future-brain/v1/materialCategory/tree', {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });
  });

  it('新建、重命名、移动与删除携带分类参数', async () => {
    vi.mocked(request).mockResolvedValue(true as never);

    await createCategory('kb-1', '新目录', 'parent-1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/materialCategory/add', {
      method: 'post',
      data: { kbId: 'kb-1', name: '新目录', parentId: 'parent-1' },
      headers,
    });

    await renameCategory('c1', '改名');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/materialCategory/update', {
      method: 'post',
      data: { categoryId: 'c1', name: '改名' },
      headers,
    });

    await moveCategory('c1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/materialCategory/move', {
      method: 'post',
      data: { categoryId: 'c1', parentId: null },
      headers,
    });

    await moveCategory('c1', 'p2');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/materialCategory/move', {
      method: 'post',
      data: { categoryId: 'c1', parentId: 'p2' },
      headers,
    });

    await removeCategory('c1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/materialCategory/remove', {
      method: 'post',
      data: { categoryId: 'c1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(getCategoryTree('kb-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
