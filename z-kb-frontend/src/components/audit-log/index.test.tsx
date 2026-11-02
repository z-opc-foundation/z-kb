import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageAuditLogs, type AuditLogRecord } from '@/services/audit';
import { listMembers } from '@/services/identity';
import AuditLogPanel from './index';

vi.mock('@/services/audit', () => ({
  pageAuditLogs: vi.fn(),
  getAuditLog: vi.fn(),
}));

vi.mock('@/services/identity', () => ({
  listMembers: vi.fn().mockResolvedValue([]),
}));

const records: AuditLogRecord[] = [
  {
    id: '1',
    tenantCode: 'tenant-a',
    type: 'KB',
    bizRef: 'kb-1',
    actorId: 9,
    action: 'MATERIAL_UPLOAD',
    actionDesc: '上传资料',
    targetMethod: 'upload',
    requestUri: '/v1/material/upload',
    success: 1,
    durationMs: 12,
    createTime: '2026-10-29T10:00:00',
  },
  {
    id: '2',
    tenantCode: 'tenant-a',
    type: 'SYS',
    actorId: 9,
    action: 'TENANT_UPDATE',
    actionDesc: '更新租户',
    targetMethod: 'update',
    requestUri: '/v1/tenant/update',
    success: 1,
    durationMs: 8,
    createTime: '2026-10-29T09:00:00',
  },
];

describe('操作日志列表', () => {
  beforeEach(() => {
    vi.mocked(pageAuditLogs).mockResolvedValue({
      records,
      total: records.length,
      size: 20,
      current: 1,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('知识库页签固定 type=KB 与 bizRef，不展示归属列', async () => {
    render(<AuditLogPanel type="KB" bizRef="kb-1" />);

    await waitFor(() => expect(screen.getByText('上传资料')).toBeTruthy());
    expect(pageAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'KB', bizRef: 'kb-1' }),
    );
    expect(screen.queryByText('归属')).toBeNull();
  });

  it('系统审计不限定类型，归属列区分系统级与知识库级', async () => {
    render(<AuditLogPanel showType />);

    await waitFor(() => expect(screen.getByText('归属')).toBeTruthy());
    expect(pageAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ type: undefined, bizRef: undefined }),
    );
    expect(screen.getByText('知识库')).toBeTruthy();
    expect(screen.getByText('系统')).toBeTruthy();
    expect(screen.getByText('kb-1')).toBeTruthy();
  });

  it('切到统计页签按当前范围汇总，切回明细恢复列表', async () => {
    render(<AuditLogPanel showType />);

    await waitFor(() => expect(screen.getByText('上传资料')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /统计/ }));

    await waitFor(() => expect(screen.getByText('高频动作')).toBeTruthy());
    expect(screen.getByText('匹配记录')).toBeTruthy();
    expect(screen.getByText('统计覆盖全部 2 条匹配记录')).toBeTruthy();
    expect(document.querySelector('.audit-detail-table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /明细/ }));
    expect(await screen.findByText('上传资料')).toBeTruthy();
  });

  it('刷新时的加载提示留在页签行，不挤进筛选行改变表格高度', async () => {
    render(<AuditLogPanel showType />);
    await waitFor(() => expect(screen.getByText('上传资料')).toBeTruthy());

    vi.mocked(pageAuditLogs).mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));

    await waitFor(() => {
      expect(document.querySelector('.audit-tabs-status .audit-loading')?.textContent).toContain(
        '加载中…',
      );
    });
    expect(document.querySelector('.filter-bar .audit-loading')).toBeNull();
  });

  it('操作人按姓名搜索出候选，选中后按 actorId 过滤，可清除', async () => {
    vi.mocked(listMembers).mockResolvedValue([
      { staffId: 9, name: '张三', jobNumber: 'A001', roleCodes: [] },
      { staffId: 10, name: '李四', jobNumber: 'A002', roleCodes: [] },
    ]);
    render(<AuditLogPanel showType />);

    const input = await screen.findByRole('combobox', { name: '操作人' });
    fireEvent.focus(input);
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.change(input, { target: { value: '张' } });
    await waitFor(() =>
      expect(listMembers).toHaveBeenCalledWith('张', { silent: true }),
    );
    fireEvent.click(await screen.findByRole('option', { name: /张三/ }));

    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ actorId: 9 }),
      ),
    );
    expect((input as HTMLInputElement).value).toBe('张三');

    fireEvent.click(screen.getByRole('button', { name: '清除操作人' }));
    await waitFor(() =>
      expect(pageAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ actorId: undefined }),
      ),
    );
    expect((input as HTMLInputElement).value).toBe('');
  });
});
