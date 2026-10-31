import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeBaseRecord } from '@/services/knowledgeBase';
import { renderAt } from '@/test/render';

vi.mock('@/components/auth', () => ({
  Can: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/services/knowledgeBase', () => ({
  pageKnowledgeBase: vi.fn(),
  getKnowledgeBase: vi.fn(),
  createKnowledgeBase: vi.fn(),
  updateKnowledgeBase: vi.fn(),
  archiveKnowledgeBase: vi.fn(),
  restoreKnowledgeBase: vi.fn(),
  removeKnowledgeBase: vi.fn(),
}));

vi.mock('@/services/kbActivity', () => ({
  fetchKbActivityHeatmap: vi.fn(),
}));

vi.mock('@/services/sso', () => ({
  queryCurrentUser: vi.fn(),
}));

import {
  createKnowledgeBase,
  pageKnowledgeBase,
  removeKnowledgeBase,
} from '@/services/knowledgeBase';
import { fetchKbActivityHeatmap } from '@/services/kbActivity';
import { queryCurrentUser } from '@/services/sso';
import KnowledgeBaseListPage from './index';

function record(overrides: Partial<KnowledgeBaseRecord>): KnowledgeBaseRecord {
  return {
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
    ...overrides,
  };
}

const ANESTHESIA = record({
  kbId: 'kb-2',
  name: '麻醉知识库',
  code: 'kb_anesthesia',
  type: 'MIX',
  status: 'ARCHIVED',
  updateTime: '2026-09-20T10:00:00',
  canManage: false,
  embeddingModel: '',
});

const NURSING = record({ kbId: 'kb-1', name: '护理知识库' });

function page(records: KnowledgeBaseRecord[]) {
  return { records, total: records.length, size: 500, current: 1 };
}

describe('知识库列表页', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(queryCurrentUser).mockResolvedValue({ name: '张三' });
    vi.mocked(fetchKbActivityHeatmap).mockResolvedValue({
      'kb-1': [{ date: '2026-10-01', count: 3 }],
    });
    vi.mocked(createKnowledgeBase).mockResolvedValue(NURSING);
    vi.mocked(removeKnowledgeBase).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('先展示加载态，成功后按更新时间倒序渲染卡片与统计', async () => {
    let resolveLoad: (value: ReturnType<typeof page>) => void = () => {};
    vi.mocked(pageKnowledgeBase).mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const { container } = renderAt(<KnowledgeBaseListPage />);

    expect(screen.getByText('正在加载知识库…')).toBeTruthy();
    expect(pageKnowledgeBase).toHaveBeenCalledWith({ current: 1, size: 500 }, { rethrow: true });

    await act(async () => {
      resolveLoad(page([ANESTHESIA, NURSING]));
    });

    expect(await screen.findByText('护理知识库')).toBeTruthy();
    const cards = container.querySelectorAll('.kb-card');
    expect(cards).toHaveLength(2);
    // 更新时间新的排前面
    expect(cards[0].textContent).toContain('护理知识库');
    expect(cards[1].textContent).toContain('麻醉知识库');
    expect(screen.getAllByText('运行中').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已归档').length).toBeGreaterThan(0);
    expect(screen.getByText('可管理')).toBeTruthy();
    expect(screen.getByText('只读')).toBeTruthy();
    expect(screen.getByText('默认模型')).toBeTruthy();
    expect(screen.getByText(/共 2 个知识库 · 第 1 \/ 1 页/)).toBeTruthy();
    await waitFor(() =>
      expect(fetchKbActivityHeatmap).toHaveBeenCalledWith(['kb-1', 'kb-2'], 168),
    );
  });

  it('卡片与表格视图可切换，表格展示类型、状态与模型列', async () => {
    vi.mocked(pageKnowledgeBase).mockResolvedValue(page([NURSING, ANESTHESIA]));
    const { container } = renderAt(<KnowledgeBaseListPage />);
    await screen.findByText('护理知识库');

    fireEvent.click(screen.getByRole('button', { name: /表格/ }));
    expect(await screen.findByText('嵌入模型')).toBeTruthy();
    expect(screen.getByText('文件库')).toBeTruthy();
    expect(screen.getByText('混合库')).toBeTruthy();
    expect(screen.getAllByText('运行中').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.list-table tbody tr')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /卡片/ }));
    await waitFor(() => expect(container.querySelectorAll('.kb-card')).toHaveLength(2));
  });

  it('收藏卡片后可在「我收藏的」筛选中看到，收藏写入本地存储', async () => {
    vi.mocked(pageKnowledgeBase).mockResolvedValue(page([NURSING, ANESTHESIA]));
    const { container } = renderAt(<KnowledgeBaseListPage />);
    await screen.findByText('护理知识库');

    fireEvent.click(container.querySelectorAll('.fav-btn')[0]);

    expect(localStorage.getItem('future-knowledge.favorite-kbs')).toContain('kb-1');
    fireEvent.click(screen.getByRole('button', { name: /我收藏的/ }));

    const cards = container.querySelectorAll('.kb-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('护理知识库');
  });

  it('关键词无匹配时展示空态，清空筛选后恢复列表', async () => {
    vi.mocked(pageKnowledgeBase).mockResolvedValue(page([NURSING]));
    const { container } = renderAt(<KnowledgeBaseListPage />);
    await screen.findByText('护理知识库');

    fireEvent.change(screen.getByPlaceholderText('搜索名称、编码、类型或嵌入模型'), {
      target: { value: '不存在的库' },
    });
    expect(await screen.findByText('没有匹配的知识库')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
    await waitFor(() => expect(container.querySelectorAll('.kb-card')).toHaveLength(1));
  });

  it('新建知识库：打开弹窗、提交后刷新列表', async () => {
    vi.mocked(pageKnowledgeBase).mockResolvedValue(page([]));
    renderAt(<KnowledgeBaseListPage />);
    expect(await screen.findByText('当前账号下暂无可访问的知识库')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /新建知识库|在当前租户新建/ })[0]);
    expect(await screen.findByRole('dialog')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('例如：心内科诊疗知识库'), {
      target: { value: '新建测试库' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建知识库' }));

    await waitFor(() =>
      expect(createKnowledgeBase).toHaveBeenCalledWith(
        expect.objectContaining({ name: '新建测试库', type: 'FILE' }),
      ),
    );
    await waitFor(() => expect(pageKnowledgeBase).toHaveBeenCalledTimes(2));
  });

  it('加载失败展示错误态，重新加载可恢复', async () => {
    vi.mocked(pageKnowledgeBase).mockRejectedValueOnce(new Error('租户上下文失效'));
    renderAt(<KnowledgeBaseListPage />);

    expect(await screen.findByText('知识库列表加载失败')).toBeTruthy();
    expect(screen.getByText('租户上下文失效')).toBeTruthy();

    vi.mocked(pageKnowledgeBase).mockResolvedValue(page([NURSING]));
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(await screen.findByText('护理知识库')).toBeTruthy();
  });
});
