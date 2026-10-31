import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveRole, type AuthRole } from '@/services/identity';
import { toast } from '@/utils/toast';
import { renderAt } from '@/test/render';
import RoleFormModal from './role-form';

vi.mock('@/services/identity', () => ({
  saveRole: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

function renderForm(role?: AuthRole) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  renderAt(<RoleFormModal role={role} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(label), { target: { value } });
}

beforeEach(() => {
  vi.mocked(saveRole).mockResolvedValue(9);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RoleFormModal', () => {
  it('必填校验拦截空表单，不调用保存接口', () => {
    const { onSaved } = renderForm();

    expect(screen.getByText('新建角色')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    expect(screen.getByText('角色编码与名称必填')).toBeInTheDocument();
    expect(saveRole).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('新建时校验角色编码格式', () => {
    renderForm();
    fill('如 kb_operator', '1 bad');
    fill('如 知识库运营', '运营角色');

    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    expect(
      screen.getByText('角色编码以字母开头，仅支持字母、数字、下划线、点与中划线'),
    ).toBeInTheDocument();
    expect(saveRole).not.toHaveBeenCalled();
  });

  it('新建角色提交完整表单并回传保存结果', async () => {
    const { onSaved } = renderForm();
    fill('如 kb_operator', 'kb_operator');
    fill('如 知识库运营', '知识库运营');
    fill('角色职责说明，便于审计', '负责知识库日常运营');

    const status = screen.getByRole('dialog').querySelector('.switch') as HTMLElement;
    fireEvent.click(status);
    expect(status).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('停用（保留授权，不生效）')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(saveRole).toHaveBeenCalledWith({
        id: undefined,
        roleCode: 'kb_operator',
        roleName: '知识库运营',
        description: '负责知识库日常运营',
        enabled: false,
        type: undefined,
      }),
    );
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({
        id: 9,
        roleCode: 'kb_operator',
        roleName: '知识库运营',
        description: '负责知识库日常运营',
        type: undefined,
        enabled: false,
      }),
    );
    expect(toast).toHaveBeenCalledWith(
      '角色已创建',
      '知识库运营 · kb_operator',
      'success',
    );
  });

  it('编辑已有角色时编码只读，保存携带角色 ID', async () => {
    const role: AuthRole = {
      id: 3,
      roleCode: 'kb_admin',
      roleName: '知识库管理员',
      description: '管理员',
      type: 4,
      enabled: true,
    };
    const { onSaved } = renderForm(role);

    expect(screen.getByText('编辑角色 · 知识库管理员')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('如 kb_operator')).toBeDisabled();
    fill('如 知识库运营', '知识库主管');
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(saveRole).toHaveBeenCalledWith({
        id: 3,
        roleCode: 'kb_admin',
        roleName: '知识库主管',
        description: '管理员',
        enabled: true,
        type: 4,
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, roleCode: 'kb_admin', roleName: '知识库主管' }),
    );
    expect(toast).toHaveBeenCalledWith(
      '角色已更新',
      '知识库主管 · kb_admin',
      'success',
    );
  });

  it('取消关闭弹窗且不提交', () => {
    const { onClose } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(saveRole).not.toHaveBeenCalled();
  });

  it('保存失败在表单内展示错误信息', async () => {
    vi.mocked(saveRole).mockRejectedValueOnce(new Error('Apex 不可用'));
    const { onSaved } = renderForm();
    fill('如 kb_operator', 'kb_operator');
    fill('如 知识库运营', '知识库运营');

    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    expect(await screen.findByText('Apex 不可用')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
