import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  getEffectiveAccess,
  grantMember,
  listMembers,
  roleLabel,
  ROLE_META,
  ROLE_ORDER,
  revokeMember,
  searchMemberCandidates,
} from './member';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/***REMOVED***/v1/knowledgeBase/member';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

describe('知识库成员接口', () => {
  it('成员列表与候选人搜索', async () => {
    await listMembers('***REMOVED***-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/list`, {
      method: 'post',
      data: { ***REMOVED***Id: '***REMOVED***-1' },
      headers,
    });

    await searchMemberCandidates('***REMOVED***-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/candidates`, {
      method: 'post',
      data: { ***REMOVED***Id: '***REMOVED***-1', keyword: '' },
      headers,
    });

    await searchMemberCandidates('***REMOVED***-1', '张三');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/candidates`, {
      method: 'post',
      data: { ***REMOVED***Id: '***REMOVED***-1', keyword: '张三' },
      headers,
    });
  });

  it('授权、移除与读取有效权限', async () => {
    await grantMember('***REMOVED***-1', 9, 'EDITOR');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/grant`, {
      method: 'post',
      data: { ***REMOVED***Id: '***REMOVED***-1', principalId: 9, role: 'EDITOR' },
      headers,
    });

    await revokeMember('***REMOVED***-1', 9);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/revoke`, {
      method: 'post',
      data: { ***REMOVED***Id: '***REMOVED***-1', principalId: 9 },
      headers,
    });

    await getEffectiveAccess('***REMOVED***-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/effective`, {
      method: 'get',
      params: { ***REMOVED***Id: '***REMOVED***-1' },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(listMembers('***REMOVED***-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});

describe('知识库角色元数据', () => {
  it('角色标签覆盖全部角色', () => {
    expect(ROLE_ORDER).toEqual(['***REMOVED***ADMIN', 'EDITOR', 'CONTRIBUTOR', 'REVIEWER', 'READER']);
    ROLE_ORDER.forEach((role) => {
      expect(ROLE_META[role].label).toBeTruthy();
      expect(roleLabel(role)).toBe(ROLE_META[role].label);
    });
  });

  it('空角色显示占位，未知角色原样返回', () => {
    expect(roleLabel()).toBe('—');
    expect(roleLabel('')).toBe('—');
    expect(roleLabel('CUSTOM')).toBe('CUSTOM');
  });
});
