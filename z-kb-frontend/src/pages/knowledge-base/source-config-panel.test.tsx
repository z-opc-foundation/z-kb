import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SourceConfigPanel from './source-config-panel';
import {
  listKnowledgeBaseSources,
  loadYuqueCatalog,
  loadYuqueCatalogDocs,
  saveKnowledgeBaseSources,
  syncKnowledgeBaseSource,
  testKnowledgeBaseSource,
} from '@/services/knowledgeBaseSource';
import { toast } from '@/utils/toast';

vi.mock('@/services/knowledgeBaseSource', () => ({
  listKnowledgeBaseSources: vi.fn(),
  loadYuqueCatalog: vi.fn(),
  loadYuqueCatalogDocs: vi.fn(),
  saveKnowledgeBaseSources: vi.fn(),
  syncKnowledgeBaseSource: vi.fn(),
  testKnowledgeBaseSource: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const listMock = vi.mocked(listKnowledgeBaseSources);
const catalogMock = vi.mocked(loadYuqueCatalog);
const catalogDocsMock = vi.mocked(loadYuqueCatalogDocs);
const saveMock = vi.mocked(saveKnowledgeBaseSources);
const testMock = vi.mocked(testKnowledgeBaseSource);
const syncMock = vi.mocked(syncKnowledgeBaseSource);

function renderPanel(canManage = true) {
  return render(<SourceConfigPanel kbId="kb-1" canManage={canManage} />);
}

beforeEach(() => {
  vi.mocked(toast).mockClear();
  listMock.mockResolvedValue([
    {
      sourceId: 's-1',
      category: 'DOC_PLATFORM',
      provider: 'YUQUE',
      name: '产品文档库',
      enabled: true,
      scope: { namespace: 'come-future', book: 'come-future/product' },
      credentialType: 'TOKEN',
      hasSecret: true,
    },
  ]);
  saveMock.mockReset();
  testMock.mockReset();
  catalogMock.mockReset();
  catalogDocsMock.mockReset();
  syncMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SourceConfigPanel', () => {
  it('按分类展示已保存的接入源，凭据只显示是否已配置', async () => {
    renderPanel();
    expect(await screen.findByText('产品文档库')).toBeInTheDocument();
    expect(screen.getByText('文档平台')).toBeInTheDocument();
    expect(screen.getByText('TOKEN · 已配置')).toBeInTheDocument();
    expect(screen.getByText('团队空间 come-future · 1 个知识库')).toBeInTheDocument();
    expect(screen.getByText('已启用')).toBeInTheDocument();
  });

  it('新增一条 Git 接入源后全量保存', async () => {
    saveMock.mockResolvedValue([]);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /新增接入源/ }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'GIT' } });
    fireEvent.change(screen.getByPlaceholderText('如 产品文档库'), {
      target: { value: '代码仓库' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://git.example.com/group/repo.git'), {
      target: { value: 'https://git.example.com/team/repo.git' },
    });
    fireEvent.change(screen.getByPlaceholderText('填写后保存即生效'), {
      target: { value: 'token-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /加入列表/ }));

    fireEvent.click(screen.getByRole('button', { name: /保存变更/ }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    const [kbId, sources] = saveMock.mock.calls[0];
    expect(kbId).toBe('kb-1');
    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({ sourceId: 's-1', provider: 'YUQUE', secret: undefined });
    expect(sources[1]).toMatchObject({
      provider: 'GIT',
      category: 'CODE_REPO',
      name: '代码仓库',
      secret: 'token-123',
      scope: { repo: 'https://git.example.com/team/repo.git' },
    });
    expect(sources[1].sourceId).toBeUndefined();
  });

  it('缺少必填范围时不进入列表', async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /新增接入源/ }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'GIT' } });
    fireEvent.change(screen.getByPlaceholderText('如 产品文档库'), {
      target: { value: '代码仓库' },
    });
    fireEvent.click(screen.getByRole('button', { name: /加入列表/ }));

    expect(screen.getByRole('button', { name: /保存变更/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /加入列表/ })).toBeInTheDocument();
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      '不能添加',
      'Git 仓库缺少仓库地址',
      'warn',
    );
  });

  it('测试连接失败时显示不通', async () => {
    testMock.mockResolvedValue({
      reachable: false,
      message: '凭据无效或无权访问（HTTP 401）',
      latencyMs: 18,
    });
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /测试/ }));

    expect(await screen.findByText('不通')).toBeInTheDocument();
    expect(testMock).toHaveBeenCalledWith('kb-1', expect.objectContaining({ sourceId: 's-1' }));
  });

  it('新增语雀接入源时先加载团队与知识库再勾选', async () => {
    catalogMock.mockResolvedValue({
      spaces: [
        { slug: 'xr4hwk', name: '基础服务' },
        { slug: 'zdgc6r', name: '平台产研' },
      ],
      books: [{ namespace: 'xr4hwk/unn4rb', slug: 'unn4rb', name: '知识中台', docsCount: 24 }],
    });
    saveMock.mockResolvedValue([]);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /新增接入源/ }));
    fireEvent.change(screen.getByPlaceholderText('如 产品文档库'), {
      target: { value: '知识中台语雀' },
    });
    fireEvent.change(screen.getByPlaceholderText('填写后保存即生效'), {
      target: { value: 'tk' },
    });
    fireEvent.click(screen.getByRole('button', { name: /加载团队与知识库/ }));

    const teamSelect = await screen.findByDisplayValue('选择语雀团队');
    await waitFor(() => expect(catalogMock).toHaveBeenCalledTimes(1));
    fireEvent.change(teamSelect, { target: { value: 'xr4hwk' } });

    fireEvent.click(await screen.findByRole('checkbox', { name: '同步知识库 知识中台' }));
    fireEvent.click(screen.getByRole('button', { name: /加入列表/ }));
    fireEvent.click(screen.getByRole('button', { name: /保存变更/ }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    const [, sources] = saveMock.mock.calls[0];
    expect(sources[1]).toMatchObject({
      provider: 'YUQUE',
      name: '知识中台语雀',
      scope: {
        namespace: 'xr4hwk',
        apiBaseUrl: 'https://come-future.yuque.com/api/v2',
        selection: [{ book: 'xr4hwk/unn4rb', name: '知识中台', docs: [] }],
      },
    });
    expect(sources[1].scope).not.toHaveProperty('book');
    expect(catalogMock.mock.calls[1][1]).toMatchObject({
      scope: expect.objectContaining({ namespace: 'xr4hwk' }),
    });
  });

  it('知识库可再展开勾选文章，保存到 selection.docs', async () => {
    catalogMock.mockResolvedValue({
      spaces: [{ slug: 'xr4hwk', name: '基础服务' }],
      books: [{ namespace: 'xr4hwk/unn4rb', slug: 'unn4rb', name: '知识中台', docsCount: 2 }],
    });
    catalogDocsMock.mockResolvedValue({
      docs: [
        { slug: 'doc-a', title: '总览', updatedAt: '2026-10-28T00:00:00Z' },
        { slug: 'doc-b', title: '接入', updatedAt: '2026-10-27T00:00:00Z' },
      ],
    });
    saveMock.mockResolvedValue([]);
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: /新增接入源/ }));
    fireEvent.change(screen.getByPlaceholderText('如 产品文档库'), {
      target: { value: '知识中台语雀' },
    });
    fireEvent.change(screen.getByPlaceholderText('填写后保存即生效'), {
      target: { value: 'tk' },
    });
    fireEvent.click(screen.getByRole('button', { name: /加载团队与知识库/ }));
    await waitFor(() => expect(catalogMock).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('checkbox', { name: '同步知识库 知识中台' }));

    fireEvent.click(screen.getByRole('button', { name: /选文章/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: '总览' }));

    await waitFor(() => expect(catalogDocsMock).toHaveBeenCalledTimes(1));
    expect(catalogDocsMock.mock.calls[0][2]).toBe('xr4hwk/unn4rb');
    expect(await screen.findByText('已选 1 篇')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /加入列表/ }));
    fireEvent.click(screen.getByRole('button', { name: /保存变更/ }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    const [, sources] = saveMock.mock.calls[0];
    expect(sources[1].scope?.selection).toEqual([
      { book: 'xr4hwk/unn4rb', name: '知识中台', docs: [{ slug: 'doc-a', title: '总览' }] },
    ]);
  });

  it('只读身份看不到新增与保存入口', async () => {
    renderPanel(false);
    expect(await screen.findByText('产品文档库')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增接入源/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存变更/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /编辑/ })).not.toBeInTheDocument();
  });
});
