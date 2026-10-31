import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth';
import { confirmAction } from '@/components/confirm';
import { fetchAuthContext } from '@/services/identity';
import {
  changeTenantStatus,
  deleteTenant,
  listTenants,
  saveTenant,
  type TenantRecord,
} from '@/services/tenant';
import { toast } from '@/utils/toast';
import TenantAdminPage from './index';

vi.mock('@/services/identity', () => ({ fetchAuthContext: vi.fn() }));
vi.mock('@/components/confirm', () => ({ confirmAction: vi.fn() }));
vi.mock('@/services/tenant', () => ({
  listTenants: vi.fn(),
  saveTenant: vi.fn(),
  changeTenantStatus: vi.fn(),
  deleteTenant: vi.fn(),
}));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const baseRecords: TenantRecord[] = [
  {
    id: '1',
    code: 'future_hospital',
    name: '未来医院',
    status: 'ACTIVE',
    description: '总院',
    createTime: '2026-10-20T10:00:00',
  },
  {
    id: '2',
    code: 'xq_hospital',
    name: '新区医院',
    status: 'DISABLED',
    description: '',
    createTime: '2026-10-21T10:00:00',
  },
  {
    id: '3',
    code: 'dc_hospital',
    name: '东城医院',
    status: 'ACTIVE',
    description: '东城院区',
    createTime: '2026-10-22T10:00:00',
  },
];

function renderPage() {
  return render(
    <AuthProvider>
      <TenantAdminPage />
    </AuthProvider>,
  );
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchAuthContext).mockResolvedValue(null);
  vi.mocked(listTenants).mockResolvedValue(baseRecords);
  vi.mocked(saveTenant).mockResolvedValue('9');
  vi.mocked(changeTenantStatus).mockResolvedValue(undefined);
  vi.mocked(deleteTenant).mockResolvedValue(undefined);
  vi.mocked(confirmAction).mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe('全局管理 · 租户管理', () => {
  it('渲染租户列表并标记当前租户', async () => {
    renderPage();

    await screen.findByText('新区医院');
    expect(screen.getByText('共 3 个 · 启用 2')).toBeInTheDocument();
    expect(within(rowOf('未来医院')).getByText('当前')).toBeInTheDocument();
    expect(within(rowOf('未来医院')).getByRole('switch')).toBeDisabled();
    expect(within(rowOf('新区医院')).getByText('停用')).toBeInTheDocument();
  });

  it('按关键字与状态筛选，分页固定在列表底部', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      code: `tenant_${index + 1}`,
      name: `租户 ${index + 1}`,
      status: index % 2 === 0 ? ('ACTIVE' as const) : ('DISABLED' as const),
    }));
    vi.mocked(listTenants).mockResolvedValue(many);
    renderPage();

    await screen.findByText('租户 1');
    expect(screen.getByText(/共 12 个租户 · 第 1 \/ 2 页/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('租户 11')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索租户名称或编码'), {
      target: { value: '租户 11' },
    });
    expect(screen.queryByText('租户 1')).toBeNull();
    expect(screen.getByText('租户 11')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '停用' }));
    expect(screen.getByText('没有匹配的租户')).toBeInTheDocument();
  });

  it('新建租户提交编码、名称与说明', async () => {
    renderPage();
    await screen.findByText('新区医院');

    fireEvent.click(screen.getByRole('button', { name: /新建租户/ }));
    const dialog = screen.getByRole('dialog', { name: '新建租户' });
    fireEvent.change(within(dialog).getByPlaceholderText('如 future_hospital'), {
      target: { value: 'xc_hospital' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('如 未来医院'), {
      target: { value: '西城医院' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('租户用途或对接说明，最长 500 字'), {
      target: { value: '西城院区' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(saveTenant).toHaveBeenCalledWith({
        id: undefined,
        code: 'xc_hospital',
        name: '西城医院',
        description: '西城院区',
      }),
    );
    expect(toast).toHaveBeenCalledWith('租户已创建', '西城医院 · xc_hospital', 'success');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('编辑租户时编码不可修改', async () => {
    renderPage();
    await screen.findByText('新区医院');

    fireEvent.click(within(rowOf('新区医院')).getByRole('button', { name: '编辑' }));
    const dialog = screen.getByRole('dialog', { name: /编辑租户/ });
    const codeInput = within(dialog).getByDisplayValue('xq_hospital');
    expect(codeInput).toBeDisabled();

    fireEvent.change(within(dialog).getByDisplayValue('新区医院'), {
      target: { value: '新区人民医院' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /保存/ }));

    await waitFor(() =>
      expect(saveTenant).toHaveBeenCalledWith({
        id: '2',
        code: undefined,
        name: '新区人民医院',
        description: '',
      }),
    );
    expect(toast).toHaveBeenCalledWith('租户已更新', '新区人民医院 · xq_hospital', 'success');
  });

  it('停用与删除都需要确认，当前租户不可操作', async () => {
    renderPage();
    await screen.findByText('新区医院');

    expect(within(rowOf('未来医院')).getByRole('button', { name: '删除' })).toBeDisabled();

    fireEvent.click(within(rowOf('东城医院')).getByRole('switch'));
    await waitFor(() => expect(changeTenantStatus).toHaveBeenCalledWith('3', 'DISABLED'));
    expect(confirmAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: '停用租户「东城医院」？' }),
    );

    fireEvent.click(within(rowOf('新区医院')).getByRole('button', { name: '删除' }));
    await waitFor(() => expect(deleteTenant).toHaveBeenCalledWith('2'));
    expect(toast).toHaveBeenCalledWith('租户已删除', '新区医院', 'success');
  });

  it('列表加载失败时给出重试入口', async () => {
    vi.mocked(listTenants).mockRejectedValueOnce(new Error('租户编码重复'));
    renderPage();

    expect(await screen.findByText('租户编码重复')).toBeInTheDocument();
    vi.mocked(listTenants).mockResolvedValue(baseRecords);
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    await screen.findByText('新区医院');
  });
});
