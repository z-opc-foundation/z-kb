import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  KnowledgeBaseEffectiveRecord,
  KnowledgeBaseMemberRecord,
} from '@/services/member';

vi.mock('@/services/member', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/member')>();
  return {
    ...actual,
    getEffectiveAccess: vi.fn(),
    listMembers: vi.fn(),
    searchMemberCandidates: vi.fn(),
    grantMember: vi.fn(),
    revokeMember: vi.fn(),
  };
});

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

import {
  getEffectiveAccess,
  grantMember,
  listMembers,
  revokeMember,
  searchMemberCandidates,
} from '@/services/member';
import { toast } from '@/utils/toast';
import KbMemberPanel from './member-panel';

const EFFECTIVE: KnowledgeBaseEffectiveRecord = {
  kbId: 'kb-1',
  actorId: 1,
  role: 'READER',
  owner: false,
  canEnter: true,
  canManageKb: false,
  canManageDoc: false,
  canReview: false,
  actions: [],
};

const MEMBERS: KnowledgeBaseMemberRecord[] = [
  {
    principalId: 1,
    principalType: 'USER',
    name: '张三',
    employeeId: 'E001',
    dept: '护理部',
    role: 'KB_ADMIN',
    owner: true,
    grantedAt: '2026-10-01T10:00:00',
  },
  {
    principalId: 2,
    principalType: 'USER',
    name: '李四',
    employeeId: 'E002',
    dept: '门诊部',
    role: 'EDITOR',
    owner: false,
    grantedAt: '2026-10-02T09:30:00',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEffectiveAccess).mockResolvedValue(EFFECTIVE);
  vi.mocked(listMembers).mockResolvedValue(MEMBERS);
  vi.mocked(searchMemberCandidates).mockResolvedValue([
    { principalId: 5, name: '王五', employeeId: 'E005', dept: '药学部' },
  ]);
  vi.mocked(grantMember).mockResolvedValue({
    principalId: 5,
    principalType: 'USER',
    name: '王五',
    role: 'EDITOR',
    owner: false,
  });
  vi.mocked(revokeMember).mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe('知识库成员面板', () => {
  it('无管理权限时只展示角色说明，不请求成员列表', async () => {
    render(<KbMemberPanel kbId="kb-1" canManage={false} />);

    expect(await screen.findByText('当前角色无权查看成员')).toBeTruthy();
    expect(screen.getByText(/你当前的角色为 只读/)).toBeTruthy();
    expect(getEffectiveAccess).toHaveBeenCalledWith('kb-1');
    expect(listMembers).not.toHaveBeenCalled();
  });

  it('展示成员表格，支持关键词与角色筛选并可展开详情', async () => {
    render(<KbMemberPanel kbId="kb-1" canManage />);

    expect(await screen.findByText('张三')).toBeTruthy();
    expect(listMembers).toHaveBeenCalledWith('kb-1');
    expect(screen.getByText('2 / 2 名成员')).toBeTruthy();
    expect(screen.getByText('E001')).toBeTruthy();
    expect(screen.getByText('护理部')).toBeTruthy();
    expect(screen.getByText('创建者')).toBeTruthy();
    expect(screen.getByText('2026-10-02 09:30')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('搜索姓名、工号或部门'), {
      target: { value: '李四' },
    });
    expect(screen.getByText('1 / 2 名成员')).toBeTruthy();
    expect(screen.queryByText('张三')).toBeNull();

    fireEvent.change(screen.getByDisplayValue('全部角色'), {
      target: { value: 'KB_ADMIN' },
    });
    expect(await screen.findByText('没有匹配的成员')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
    expect(await screen.findByText('张三')).toBeTruthy();

    fireEvent.click(screen.getAllByTitle('成员详情')[0]);
    expect(screen.getByText('主体 ID')).toBeTruthy();
    expect(screen.getByText('1 · USER')).toBeTruthy();
    expect(screen.getByText('长期有效')).toBeTruthy();
  });

  it('添加成员：检索候选、选择角色并确认授权后刷新', async () => {
    render(<KbMemberPanel kbId="kb-1" canManage />);
    await screen.findByText('张三');

    fireEvent.click(screen.getByRole('button', { name: '添加成员' }));
    expect(await screen.findByText('王五')).toBeTruthy();
    expect(searchMemberCandidates).toHaveBeenCalledWith('kb-1', '');

    fireEvent.click(screen.getByText('王五'));
    fireEvent.change(screen.getByLabelText('新成员角色'), {
      target: { value: 'EDITOR' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }));

    await waitFor(() => expect(grantMember).toHaveBeenCalledWith('kb-1', 5, 'EDITOR'));
    expect(toast).toHaveBeenCalledWith(
      '成员已加入',
      '王五 · 编辑',
      'success',
    );
    await waitFor(() => expect(listMembers).toHaveBeenCalledTimes(2));
    expect(screen.queryByDisplayValue('王五')).toBeNull();
  });

  it('移除成员需二次确认，确认后撤销授权并刷新', async () => {
    render(<KbMemberPanel kbId="kb-1" canManage />);
    await screen.findByText('张三');

    fireEvent.click(screen.getAllByTitle('移除成员')[0]);
    expect(screen.getByText('移除成员 · 李四？')).toBeTruthy();
    expect(screen.getByText(/当前角色 编辑/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '确认移除' }));
    await waitFor(() => expect(revokeMember).toHaveBeenCalledWith('kb-1', 2));
    expect(toast).toHaveBeenCalledWith(
      '已移除成员',
      '李四 的授权立即失效',
      'success',
    );
    await waitFor(() => expect(listMembers).toHaveBeenCalledTimes(2));
  });

  it('角色下拉变更时调用授权接口', async () => {
    render(<KbMemberPanel kbId="kb-1" canManage />);
    await screen.findByText('张三');

    fireEvent.change(screen.getByLabelText('李四 的角色'), {
      target: { value: 'REVIEWER' },
    });
    await waitFor(() =>
      expect(grantMember).toHaveBeenCalledWith('kb-1', 2, 'REVIEWER'),
    );
    await waitFor(() => expect(listMembers).toHaveBeenCalledTimes(2));
  });
});
