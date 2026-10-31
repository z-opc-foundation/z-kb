import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listMembers, type OrgMember } from '@/services/identity';
import { useMembers } from './use-members';

vi.mock('@/services/identity', () => ({
  listMembers: vi.fn(),
}));

const members: OrgMember[] = [
  { staffId: 11, name: '张三', jobNumber: 'A001', roleCodes: ['kb_admin'] },
  { staffId: 12, name: '李四', jobNumber: 'A002', roleCodes: [] },
];

beforeEach(() => {
  vi.mocked(listMembers).mockResolvedValue(members);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useMembers', () => {
  it('首次加载经历 loading，成功后写入成员且不传关键字', async () => {
    const { result } = renderHook(() => useMembers());

    expect(result.current.loading).toBe(true);
    expect(result.current.members).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members).toEqual(members);
    expect(result.current.error).toBe('');
    expect(listMembers).toHaveBeenCalledWith(undefined);
  });

  it('关键字去掉首尾空格后延迟查询，并更新列表', async () => {
    const { result } = renderHook(() => useMembers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setKeyword('  张  '));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(listMembers).toHaveBeenLastCalledWith('张'));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('接口异常时给出可重试错误，reload 重新发起请求', async () => {
    vi.mocked(listMembers).mockRejectedValueOnce(new Error('成员接口异常'));
    const { result } = renderHook(() => useMembers());

    await waitFor(() => expect(result.current.error).toBe('成员接口异常'));
    expect(result.current.loading).toBe(false);

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.members).toEqual(members));
    expect(result.current.error).toBe('');
    expect(listMembers).toHaveBeenCalledTimes(2);
  });

  it('非 Error 异常回退为成员加载失败，refreshTick 变化会刷新', async () => {
    vi.mocked(listMembers).mockRejectedValueOnce('boom');
    const { result, rerender } = renderHook(
      ({ tick }: { tick: number }) => useMembers(tick),
      { initialProps: { tick: 0 } },
    );

    await waitFor(() => expect(result.current.error).toBe('成员加载失败'));

    rerender({ tick: 1 });
    await waitFor(() => expect(result.current.members).toEqual(members));
    expect(listMembers).toHaveBeenCalledTimes(2);
  });
});
