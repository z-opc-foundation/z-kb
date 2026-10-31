import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import type { KnowledgeBaseRecord } from '@/services/knowledgeBase';
import type { KbOverview } from '@/services/overview';
import type { MaterialRecord } from '@/services/material';
import { renderAt } from '@/test/render';

vi.mock('@/services/knowledgeBase', () => ({
  getKnowledgeBase: vi.fn(),
  createKnowledgeBase: vi.fn(),
  updateKnowledgeBase: vi.fn(),
}));

vi.mock('@/services/overview', () => ({
  getKbOverview: vi.fn(),
}));

vi.mock('@/pages/ai/agent-ask', () => ({
  AgentAskButton: () => <button type="button">问 AI</button>,
}));

vi.mock('./material-workspace', () => ({
  default: (props: { materialType: string }) => (
    <div data-testid="material-workspace">资料工作台 · {props.materialType}</div>
  ),
}));
vi.mock('./mix-entry-workspace', () => ({
  default: () => <div data-testid="mix-entry-workspace">混合库条目树</div>,
}));
vi.mock('./wiki-workspace', () => ({
  default: () => <div data-testid="wiki-workspace">Wiki 工作区</div>,
}));
vi.mock('./wiki-lineage-workspace', () => ({
  default: () => <div data-testid="wiki-lineage-workspace">Wiki 图谱工作区</div>,
}));
vi.mock('./retrieval-workspace', () => ({
  default: () => <div data-testid="retrieval-workspace">知识检索工作区</div>,
}));
vi.mock('./task-manager', () => ({
  default: () => <div data-testid="task-manager">任务管理</div>,
}));
vi.mock('./components/knowledge-assistant', () => ({
  KnowledgeAssistant: () => <div data-testid="knowledge-assistant" />,
}));

import { getKnowledgeBase, updateKnowledgeBase } from '@/services/knowledgeBase';
import { getKbOverview } from '@/services/overview';
import KnowledgeBaseDetailPage from './detail';

const KB: KnowledgeBaseRecord = {
  kbId: 'kb-1',
  tenantCode: 'future_hospital',
  name: '心内科知识库',
  code: 'kb_cardio',
  type: 'FILE',
  status: 'ACTIVE',
  description: '心内科制度、指南与临床路径',
  ownerId: 7,
  embeddingModel: 'bge-m3',
  primaryGraphSpaceKey: 'gs-cardio',
  createBy: 7,
  createTime: '2026-09-01T08:00:00',
  updateBy: 7,
  updateTime: '2026-10-01T09:30:00',
  canManage: true,
};

const MATERIAL: MaterialRecord = {
  materialId: 'mat-1',
  kbId: 'kb-1',
  materialType: 'DOCUMENT',
  title: '急性胸痛诊疗规范',
  sourceType: 'LOCAL',
  materialStatus: 'ACTIVE',
  fingerprint: 'fp-1',
  compileStatus: 'COMPILED',
  governanceStatus: 'NORMAL',
  parseStatus: 'READY',
  fileExt: 'pdf',
  registeredAt: '2026-09-30T10:00:00',
  registeredBy: 7,
};

const OVERVIEW: KbOverview = {
  kbId: 'kb-1',
  fileCount: 12,
  compiledCount: 8,
  partialCount: 2,
  notCompiledCount: 4,
  wikiCount: 5,
  runningTaskCount: 1,
  failedCount: 0,
  recentMaterials: [MATERIAL],
  refreshedAt: '2026-10-01T10:00:00',
};

function renderDetail(route = '/knowledge-bases/kb-1') {
  return renderAt(
    <Routes>
      <Route path="/knowledge-bases" element={<div>知识库列表页</div>} />
      <Route path="/knowledge-bases/:kbId/settings" element={<div>设置页</div>} />
      <Route path="/knowledge-bases/:kbId" element={<KnowledgeBaseDetailPage />} />
      <Route path="/knowledge-bases/:kbId/:tab" element={<KnowledgeBaseDetailPage />} />
    </Routes>,
    { route },
  );
}

describe('知识库详情页', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getKnowledgeBase).mockResolvedValue(KB);
    vi.mocked(getKbOverview).mockResolvedValue(OVERVIEW);
    vi.mocked(updateKnowledgeBase).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('加载后展示库档案、统计与最近资料', async () => {
    renderDetail();

    expect(screen.getByText('正在加载知识库…')).toBeTruthy();
    expect(await screen.findByText(/心内科知识库/)).toBeTruthy();

    expect(getKnowledgeBase).toHaveBeenCalledWith('kb-1');
    expect(getKbOverview).toHaveBeenCalledWith('kb-1');
    expect(screen.getAllByText('运行中').length).toBeGreaterThan(0);
    expect(screen.getByText('心内科制度、指南与临床路径')).toBeTruthy();
    expect(screen.getByText('gs-cardio')).toBeTruthy();
    expect(await screen.findByText('急性胸痛诊疗规范')).toBeTruthy();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/已解析/).length).toBeGreaterThan(0);
  });

  it('kbId 查不到时展示不可用空态并可返回列表', async () => {
    vi.mocked(getKnowledgeBase).mockResolvedValue(undefined);
    renderDetail('/knowledge-bases/kb-missing');

    expect(await screen.findByText('找不到这个知识库')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '回到知识库列表' }));
    expect(await screen.findByText('知识库列表页')).toBeTruthy();
  });

  it('页签切换到知识工作台，并可切换资料 / Wiki / 图谱 / 检索视图', async () => {
    const { container } = renderDetail();
    await screen.findByText(/心内科知识库/);

    fireEvent.click(screen.getByRole('button', { name: '知识工作台' }));
    expect(await screen.findByTestId('material-workspace')).toBeTruthy();
    expect(screen.getByTestId('material-workspace').textContent).toContain('DOCUMENT');

    const workspaceButtons = () =>
      Array.from(container.querySelectorAll('.subtabs button')) as HTMLElement[];

    fireEvent.click(workspaceButtons().find((item) => item.textContent?.includes('Wiki'))!);
    expect(await screen.findByTestId('wiki-workspace')).toBeTruthy();

    fireEvent.click(
      workspaceButtons().find((item) => item.textContent?.includes('Wiki 图谱'))!,
    );
    expect(await screen.findByTestId('wiki-lineage-workspace')).toBeTruthy();

    fireEvent.click(
      workspaceButtons().find((item) => item.textContent?.includes('知识检索'))!,
    );
    expect(await screen.findByTestId('retrieval-workspace')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /任务管理/ }));
    expect(await screen.findByTestId('task-manager')).toBeTruthy();
  });

  it('编辑基本信息后提交名称与描述，并重新加载详情', async () => {
    renderDetail();
    await screen.findByText(/心内科知识库/);

    fireEvent.click(screen.getByRole('button', { name: /编辑基本信息/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('编辑知识库 · 心内科知识库');

    fireEvent.change(screen.getByDisplayValue('心内科知识库'), {
      target: { value: '心内科知识库（修订）' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() =>
      expect(updateKnowledgeBase).toHaveBeenCalledWith({
        kbId: 'kb-1',
        name: '心内科知识库（修订）',
        description: '心内科制度、指南与临床路径',
      }),
    );
    await waitFor(() => expect(getKnowledgeBase).toHaveBeenCalledTimes(2));
  });

  it('收藏按钮切换文案并写入本地存储', async () => {
    renderDetail();
    await screen.findByText(/心内科知识库/);

    fireEvent.click(screen.getByRole('button', { name: /^收藏$/ }));
    expect(await screen.findByRole('button', { name: /已收藏/ })).toBeTruthy();
    expect(localStorage.getItem('future-knowledge.favorite-kbs')).toContain('kb-1');

    fireEvent.click(screen.getByRole('button', { name: /已收藏/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^收藏$/ })).toBeTruthy(),
    );
  });

  it('members 旧深链重定向到设置页权限分区', async () => {
    renderDetail('/knowledge-bases/kb-1/members');
    expect(await screen.findByText('设置页')).toBeTruthy();
  });
});
