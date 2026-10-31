import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import type { KnowledgeBaseRecord } from '@/services/knowledgeBase';
import type { KnowledgeBaseEffectiveRecord } from '@/services/member';
import { renderAt } from '@/test/render';

vi.mock('@/services/knowledgeBase', () => ({
  getKnowledgeBase: vi.fn(),
  updateKnowledgeBase: vi.fn(),
  archiveKnowledgeBase: vi.fn(),
  restoreKnowledgeBase: vi.fn(),
  removeKnowledgeBase: vi.fn(),
}));

vi.mock('@/services/member', () => ({
  getEffectiveAccess: vi.fn(),
  roleLabel: (role?: string) => (role ? `角色:${role}` : '—'),
}));

vi.mock('./source-config-panel', () => ({
  default: ({ kbId, canManage }: { kbId: string; canManage: boolean }) => (
    <div data-testid="source-config-panel">
      接入源 {kbId} · {canManage ? '可管理' : '只读'}
    </div>
  ),
}));

vi.mock('./task-config-panel', () => ({
  default: ({ kbId }: { kbId: string }) => (
    <div data-testid="task-config-panel">任务配置 {kbId}</div>
  ),
}));

vi.mock('./components/member-panel', () => ({
  default: ({ kbId, canManage }: { kbId: string; canManage: boolean }) => (
    <div data-testid="member-panel">
      成员 {kbId} · {canManage ? '可管理' : '只读'}
    </div>
  ),
}));

import {
  archiveKnowledgeBase,
  getKnowledgeBase,
  removeKnowledgeBase,
  restoreKnowledgeBase,
  updateKnowledgeBase,
} from '@/services/knowledgeBase';
import { getEffectiveAccess } from '@/services/member';
import KnowledgeBaseSettingsPage from './settings';

const ACTIVE_KB: KnowledgeBaseRecord = {
  kbId: 'kb-1',
  tenantCode: 'future_hospital',
  name: '护理知识库',
  code: 'kb_nursing',
  type: 'FILE',
  status: 'ACTIVE',
  description: '护理制度与流程',
  ownerId: 7,
  embeddingModel: 'bge-m3',
  createBy: 7,
  createTime: '2026-09-01T08:00:00',
  updateBy: 7,
  updateTime: '2026-10-01T09:30:00',
  canManage: true,
};

const ARCHIVED_KB: KnowledgeBaseRecord = {
  ...ACTIVE_KB,
  status: 'ARCHIVED',
  archivedAt: '2026-10-02T10:00:00',
};

const EFFECTIVE: KnowledgeBaseEffectiveRecord = {
  kbId: 'kb-1',
  actorId: 7,
  role: 'KB_ADMIN',
  owner: true,
  canEnter: true,
  canManageKb: true,
  canManageDoc: true,
  canReview: true,
  actions: ['material.write', 'compilation.run'],
};

function renderSettings(route = '/knowledge-bases/kb-1/settings') {
  return renderAt(
    <Routes>
      <Route path="/knowledge-bases" element={<div>知识库列表页</div>} />
      <Route path="/knowledge-bases/:kbId" element={<div>知识库详情页</div>} />
      <Route path="/knowledge-bases/:kbId/settings" element={<KnowledgeBaseSettingsPage />} />
    </Routes>,
    { route },
  );
}

describe('知识库设置页', () => {
  beforeEach(() => {
    vi.mocked(getKnowledgeBase).mockResolvedValue(ACTIVE_KB);
    vi.mocked(getEffectiveAccess).mockResolvedValue(EFFECTIVE);
    vi.mocked(updateKnowledgeBase).mockResolvedValue(true);
    vi.mocked(archiveKnowledgeBase).mockResolvedValue(true);
    vi.mocked(restoreKnowledgeBase).mockResolvedValue(true);
    vi.mocked(removeKnowledgeBase).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('加载后展示基本信息与租户归属，保存时提交名称与描述', async () => {
    renderSettings();
    expect(screen.getByText('正在加载设置…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: '基本信息' })).toBeTruthy();

    expect(getKnowledgeBase).toHaveBeenCalledWith('kb-1');
    expect(getEffectiveAccess).toHaveBeenCalledWith('kb-1');
    expect(screen.getByText('kb_nursing')).toBeTruthy();
    expect(screen.getByText('bge-m3')).toBeTruthy();
    expect(screen.getByText('future_hospital')).toBeTruthy();
    expect(screen.getAllByText(/未来医院/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/知识库名称/), {
      target: { value: '护理知识库（新）' },
    });
    fireEvent.change(screen.getByLabelText('描述'), {
      target: { value: '新的描述' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存基本信息/ }));

    await waitFor(() =>
      expect(updateKnowledgeBase).toHaveBeenCalledWith({
        kbId: 'kb-1',
        name: '护理知识库（新）',
        description: '新的描述',
      }),
    );
    await waitFor(() => expect(getKnowledgeBase).toHaveBeenCalledTimes(2));
  });

  it('名称过短时不提交并提示', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: '基本信息' });
    const nameInput = screen.getByLabelText(/知识库名称/);
    fireEvent.change(nameInput, { target: { value: '护' } });
    fireEvent.click(screen.getByRole('button', { name: /保存基本信息/ }));

    expect(await screen.findByText('知识库名称至少 2 个字符')).toBeTruthy();
    expect(updateKnowledgeBase).not.toHaveBeenCalled();
  });

  it('权限与版本分区渲染成员面板、当前判定与版本入口', async () => {
    renderSettings('/knowledge-bases/kb-1/settings?section=access');
    await screen.findByText('成员与角色');

    const panel = screen.getByTestId('member-panel');
    expect(panel.textContent).toContain('成员 kb-1');
    expect(panel.textContent).toContain('可管理');
    expect(screen.getByText('我的角色：角色:KB_ADMIN')).toBeTruthy();
    expect(screen.getAllByText('角色:KB_ADMIN').length).toBeGreaterThan(0);
    expect(screen.getByText('material.write')).toBeTruthy();
    expect(screen.getByText('compilation.run')).toBeTruthy();
    expect(screen.getByText('true')).toBeTruthy();
    expect(screen.getByRole('button', { name: /进入版本管理/ })).toBeTruthy();
  });

  it('接入源与任务配置分区挂载对应面板', async () => {
    renderSettings('/knowledge-bases/kb-1/settings?section=source');
    expect(await screen.findByTestId('source-config-panel')).toBeTruthy();
    expect(screen.getByTestId('source-config-panel').textContent).toContain('接入源 kb-1');

    fireEvent.click(screen.getByRole('button', { name: /任务配置/ }));
    expect(await screen.findByTestId('task-config-panel')).toBeTruthy();
    expect(screen.getByTestId('task-config-panel').textContent).toContain('任务配置 kb-1');
  });

  it('危险区：运行中可归档，归档后恢复与删除；删除需输入编码', async () => {
    vi.mocked(getKnowledgeBase)
      .mockResolvedValueOnce(ACTIVE_KB)
      .mockResolvedValue(ARCHIVED_KB);

    renderSettings('/knowledge-bases/kb-1/settings?section=danger');
    await screen.findByRole('heading', { name: '危险区' });
    expect(screen.getByText('归档知识库')).toBeTruthy();
    expect(screen.getByRole('button', { name: '删除知识库' })).toBeDisabled();
    expect(screen.getByText('运行中的库不能直接删除')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '归档' }));
    await waitFor(() => expect(archiveKnowledgeBase).toHaveBeenCalledWith('kb-1'));
    expect(await screen.findByText('恢复知识库')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '删除知识库' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = screen.getByRole('button', { name: '确认删除' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('kb_nursing'), {
      target: { value: 'kb_wrong' },
    });
    expect(screen.getByRole('button', { name: '确认删除' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('kb_nursing'), {
      target: { value: 'kb_nursing' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(removeKnowledgeBase).toHaveBeenCalledWith('kb-1'));
    expect(await screen.findByText('知识库列表页')).toBeTruthy();
    expect(dialog).toBeTruthy();
  });

  it('知识库不存在时展示不可打开提示', async () => {
    vi.mocked(getKnowledgeBase).mockResolvedValue(undefined);
    renderSettings('/knowledge-bases/kb-missing/settings');
    expect(await screen.findByText('无法打开设置')).toBeTruthy();
  });
});
