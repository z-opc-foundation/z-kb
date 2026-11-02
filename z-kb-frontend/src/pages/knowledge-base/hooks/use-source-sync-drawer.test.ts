import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNode } from '@/services/category';

vi.mock('@/services/knowledgeBaseSource', () => ({
  listKnowledgeBaseSources: vi.fn(),
  loadYuqueCatalog: vi.fn(),
  loadYuqueCatalogDocs: vi.fn(),
  saveKnowledgeBaseSources: vi.fn(),
  syncKnowledgeBaseSource: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

import {
  listKnowledgeBaseSources,
  loadYuqueCatalog,
  loadYuqueCatalogDocs,
  saveKnowledgeBaseSources,
  syncKnowledgeBaseSource,
} from '@/services/knowledgeBaseSource';
import { toast } from '@/utils/toast';
import { useSourceSyncDrawer } from './use-source-sync-drawer';

const KB_ID = 'kb-1';
const SOURCE_ID = 'src-1';

const SOURCE_RECORD = {
  sourceId: SOURCE_ID,
  category: 'DOC_PLATFORM',
  provider: 'YUQUE',
  name: '语雀·知识中台',
  enabled: true,
  scope: { namespace: 'xr4hwk', selection: [{ book: 'xr4hwk/unn4rb', name: '知识中台', docs: [] }] },
  credentialType: 'TOKEN',
  credentialUsername: '',
  secretRef: 'ref-1',
  hasSecret: true,
};

const NODE: CategoryNode = {
  categoryId: 'cat-src',
  name: '语雀·知识中台',
  sortNo: 1,
  nodeKind: 'SOURCE',
  ext: { sourceId: SOURCE_ID, provider: 'YUQUE' },
};

const CATALOG = {
  spaces: [{ slug: 'xr4hwk', name: 'xr4hwk 基础服务' }],
  books: [
    { namespace: 'xr4hwk/unn4rb', slug: 'unn4rb', name: '知识中台', docsCount: 24 },
    { namespace: 'xr4hwk/other', slug: 'other', name: '其他库', docsCount: 3 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listKnowledgeBaseSources).mockResolvedValue([SOURCE_RECORD]);
  vi.mocked(loadYuqueCatalog).mockResolvedValue(CATALOG);
  vi.mocked(loadYuqueCatalogDocs).mockResolvedValue({
    docs: [
      { slug: 'ai-flow', title: 'AI信息流' },
      { slug: 'demo', title: '知识中台-演示脚本' },
    ],
  });
  vi.mocked(saveKnowledgeBaseSources).mockResolvedValue([SOURCE_RECORD]);
  vi.mocked(syncKnowledgeBaseSource).mockResolvedValue({
    scopeId: 1,
    sourceId: SOURCE_ID,
    provider: 'YUQUE',
    reusing: false,
  });
});

describe('useSourceSyncDrawer', () => {
  it('打开时按节点 sourceId 读取接入源与语雀目录，并回填已保存的勾选', async () => {
    const { result } = renderHook(() => useSourceSyncDrawer(KB_ID));

    await act(async () => {
      result.current.open(NODE);
    });

    expect(listKnowledgeBaseSources).toHaveBeenCalledWith(KB_ID);
    expect(loadYuqueCatalog).toHaveBeenCalledWith(
      KB_ID,
      expect.objectContaining({ sourceId: SOURCE_ID, provider: 'YUQUE' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalog?.books).toHaveLength(2);
    expect(result.current.selection).toEqual([{ book: 'xr4hwk/unn4rb', name: '知识中台', docs: [] }]);
  });

  it('节点没有绑定接入源时只提示，不打开抽屉', () => {
    const { result } = renderHook(() => useSourceSyncDrawer(KB_ID));

    act(() => {
      result.current.open({ categoryId: 'c', name: '普通分类', sortNo: 1 });
    });

    expect(result.current.target).toBeNull();
    expect(toast).toHaveBeenCalledWith('不能同步', '该节点没有绑定接入源', 'warn');
  });

  it('勾选知识库后展开文章仍按整库，勾文章则改按文章白名单', async () => {
    const { result } = renderHook(() => useSourceSyncDrawer(KB_ID));
    await act(async () => {
      result.current.open(NODE);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleBook('xr4hwk/other', '其他库'));
    expect(result.current.selection.map((item) => item.book)).toEqual([
      'xr4hwk/unn4rb',
      'xr4hwk/other',
    ]);

    await act(async () => {
      result.current.loadDocs('xr4hwk/unn4rb');
    });
    await waitFor(() =>
      expect(result.current.docCache['xr4hwk/unn4rb']?.docs).toHaveLength(2),
    );
    act(() => result.current.toggleDoc('xr4hwk/unn4rb', { slug: 'ai-flow', title: 'AI信息流' }));

    expect(result.current.selection[0].docs).toEqual([{ slug: 'ai-flow', title: 'AI信息流' }]);

    act(() => result.current.toggleDoc('xr4hwk/unn4rb', { slug: 'ai-flow', title: 'AI信息流' }));
    expect(result.current.selection[0].docs).toEqual([]);
  });

  it('保存勾选后先写入 scope 再触发同步，并关闭抽屉', async () => {
    const { result } = renderHook(() => useSourceSyncDrawer(KB_ID));
    await act(async () => {
      result.current.open(NODE);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.toggleBook('xr4hwk/other', '其他库'));
    await act(async () => {
      result.current.saveAndSync();
    });

    expect(saveKnowledgeBaseSources).toHaveBeenCalledWith(KB_ID, [
      expect.objectContaining({
        sourceId: SOURCE_ID,
        scope: expect.objectContaining({
          selection: [
            { book: 'xr4hwk/unn4rb', name: '知识中台', docs: [] },
            { book: 'xr4hwk/other', name: '其他库', docs: [] },
          ],
        }),
      }),
    ]);
    expect(syncKnowledgeBaseSource).toHaveBeenCalledWith(KB_ID, SOURCE_ID);
    await waitFor(() => expect(result.current.target).toBeNull());
    expect(toast).toHaveBeenCalledWith(
      '已按新的范围同步',
      '已保存勾选范围并发起采集，进度可在任务管理查看',
      'success',
    );
  });

  it('一个知识库都没勾时不保存也不同步', async () => {
    const { result } = renderHook(() => useSourceSyncDrawer(KB_ID));
    vi.mocked(listKnowledgeBaseSources).mockResolvedValue([{ ...SOURCE_RECORD, scope: {} }]);
    await act(async () => {
      result.current.open(NODE);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.saveAndSync());

    expect(saveKnowledgeBaseSources).not.toHaveBeenCalled();
    expect(syncKnowledgeBaseSource).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('不能保存', '至少勾选一个语雀知识库', 'warn');
  });
});
