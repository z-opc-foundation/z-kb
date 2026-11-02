import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMemberAuthorization,
  type MemberAuthorization,
} from '@/services/identity';
import { useMemberAuthorization } from './use-member-authorization';

vi.mock('@/services/identity', () => ({
  getMemberAuthorization: vi.fn(),
}));

const authorization: MemberAuthorization = {
  staffId: 11,
  name: '张三',
  jobNumber: 'A001',
  roles: [{ id: 1, roleCode: 'kb_admin', roleName: '知识库管理员', enabled: true }],
  rolePermittedCodes: ['menu.space', 'menu.kb'],
  directCodes: ['kb.create'],
  inheritedCodes: [{ code: 'menu.space', source: 'UNIT' }],
};

beforeEach(() => {
  vi.mocked(getMemberAuthorization).mockResolvedValue(authorization);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useMemberAuthorization', () => {
  it('未选中成员时不发请求且保持空态', () => {
    const { result } = renderHook(() => useMemberAuthorization(null));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('');
    expect(getMemberAuthorization).not.toHaveBeenCalled();
  });

  it('按 staffId 加载授权，切换为空时清空旧数据', async () => {
    const { result, rerender } = renderHook(
      ({ staffId }: { staffId: number | null }) => useMemberAuthorization(staffId),
      { initialProps: { staffId: 11 as number | null } },
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(authorization));
    expect(result.current.loading).toBe(false);
    expect(getMemberAuthorization).toHaveBeenCalledWith(11);

    rerender({ staffId: null });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(getMemberAuthorization).toHaveBeenCalledTimes(1);
  });

  it('切换成员时先清空旧授权再加载新成员', async () => {
    const second: MemberAuthorization = {
      ...authorization,
      staffId: 12,
      name: '李四',
      directCodes: [],
    };
    vi.mocked(getMemberAuthorization).mockImplementation(async (staffId) =>
      staffId === 12 ? second : authorization,
    );

    const { result, rerender } = renderHook(
      ({ staffId }: { staffId: number }) => useMemberAuthorization(staffId),
      { initialProps: { staffId: 11 } },
    );
    await waitFor(() => expect(result.current.data?.staffId).toBe(11));

    rerender({ staffId: 12 });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.data?.staffId).toBe(12));
    expect(getMemberAuthorization).toHaveBeenLastCalledWith(12);
  });

  it('加载失败给出错误，reload 后恢复数据', async () => {
    vi.mocked(getMemberAuthorization)
      .mockRejectedValueOnce(new Error('授权接口异常'))
      .mockResolvedValueOnce(authorization);

    const { result } = renderHook(() => useMemberAuthorization(11));

    await waitFor(() => expect(result.current.error).toBe('授权接口异常'));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toEqual(authorization));
    expect(result.current.error).toBe('');
    expect(getMemberAuthorization).toHaveBeenCalledTimes(2);
  });

  it('非 Error 异常回退为成员授权加载失败', async () => {
    vi.mocked(getMemberAuthorization).mockRejectedValueOnce('boom');
    const { result } = renderHook(() => useMemberAuthorization(11));

    await waitFor(() => expect(result.current.error).toBe('成员授权加载失败'));
  });
});
