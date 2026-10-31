import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listMembers } from '@/services/identity';
import { useActorNames } from './use-actor-names';

vi.mock('@/services/identity', () => ({ listMembers: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useActorNames', () => {
  it('把操作人 ID 映射成成员姓名并忽略缺字段项', async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { staffId: 9, name: '张三', roleCodes: [] },
      { staffId: 10, roleCodes: [] },
      { staffId: 11, name: '李四', roleCodes: [] },
    ]);

    const { result } = renderHook(() => useActorNames());

    await waitFor(() => expect(result.current).toEqual({ 9: '张三', 11: '李四' }));
    expect(listMembers).toHaveBeenCalledWith(undefined, { silent: true });
  });

  it('名册接口失败时保持空表', async () => {
    vi.mocked(listMembers).mockRejectedValue(new Error('403'));

    const { result } = renderHook(() => useActorNames());

    await waitFor(() => expect(listMembers).toHaveBeenCalledOnce());
    expect(result.current).toEqual({});
  });
});
