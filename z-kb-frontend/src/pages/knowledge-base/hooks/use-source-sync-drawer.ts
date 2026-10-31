import { useCallback, useState } from 'react';
import type { CategoryNode } from '@/services/category';
import {
  KnowledgeBaseSourceCatalog,
  KnowledgeBaseSourceDoc,
  KnowledgeBaseSourcePayload,
  KnowledgeBaseSourceRecord,
  listKnowledgeBaseSources,
  loadYuqueCatalog,
  loadYuqueCatalogDocs,
  saveKnowledgeBaseSources,
  syncKnowledgeBaseSource,
} from '@/services/knowledgeBaseSource';
import { toast } from '@/utils/toast';
import { readSelection, type SelectedBook, type SelectedDoc } from '../source-selection';

interface DocCacheEntry {
  loading: boolean;
  docs: KnowledgeBaseSourceDoc[];
  message?: string;
}

export interface SourceSyncTarget {
  sourceId: string;
  name: string;
}

export interface SourceSyncDrawerController {
  target: SourceSyncTarget | null;
  loading: boolean;
  saving: boolean;
  catalog: KnowledgeBaseSourceCatalog | null;
  selection: SelectedBook[];
  expandedBook: string;
  docCache: Record<string, DocCacheEntry>;
  open: (node: CategoryNode) => void;
  close: () => void;
  toggleBook: (namespace: string, name: string) => void;
  toggleDoc: (bookScope: string, doc: KnowledgeBaseSourceDoc) => void;
  loadDocs: (bookScope: string) => void;
  saveAndSync: () => void;
}

function toPayload(
  record: KnowledgeBaseSourceRecord,
  scope: Record<string, unknown>,
): KnowledgeBaseSourcePayload {
  return {
    sourceId: record.sourceId,
    category: record.category,
    provider: record.provider,
    name: record.name,
    enabled: record.enabled,
    scope,
    credentialType: record.credentialType,
    credentialUsername: record.credentialUsername,
    secretRef: record.secretRef,
  };
}

/** 资料树上按接入源节点打开「同步范围」抽屉：勾知识库、展开挑文章，确认后保存并触发一次同步。 */
export function useSourceSyncDrawer(kbId: string): SourceSyncDrawerController {
  const [target, setTarget] = useState<SourceSyncTarget | null>(null);
  const [source, setSource] = useState<KnowledgeBaseSourceRecord | null>(null);
  const [sources, setSources] = useState<KnowledgeBaseSourceRecord[]>([]);
  const [catalog, setCatalog] = useState<KnowledgeBaseSourceCatalog | null>(null);
  const [selection, setSelection] = useState<SelectedBook[]>([]);
  const [expandedBook, setExpandedBook] = useState('');
  const [docCache, setDocCache] = useState<Record<string, DocCacheEntry>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    setTarget(null);
    setSource(null);
    setSources([]);
    setCatalog(null);
    setSelection([]);
    setExpandedBook('');
    setDocCache({});
    setLoading(false);
    setSaving(false);
  }, []);

  const open = useCallback(
    (node: CategoryNode) => {
      const sourceId = typeof node.ext?.sourceId === 'string' ? node.ext.sourceId : '';
      if (!sourceId) {
        toast('不能同步', '该节点没有绑定接入源', 'warn');
        return;
      }
      const provider = typeof node.ext?.provider === 'string' ? node.ext.provider : '';
      if (provider && provider !== 'YUQUE') {
        toast('暂不支持', '目前只有语雀接入源可以从资料树打开同步范围', 'warn');
        return;
      }
      setTarget({ sourceId, name: node.name });
      setSelection([]);
      setCatalog(null);
      setExpandedBook('');
      setDocCache({});
      setLoading(true);
      setSource(null);
      setSources([]);

      void (async () => {
        const records = await listKnowledgeBaseSources(kbId);
        const found = records?.find((item) => item.sourceId === sourceId);
        if (!records || !found) {
          setLoading(false);
          if (records) {
            toast('不能同步', '这条接入源已不存在，请刷新资料树重试', 'warn');
          }
          return;
        }
        setSources(records);
        setSource(found);
        setSelection(readSelection(found.scope));
        const result = await loadYuqueCatalog(kbId, toPayload(found, found.scope || {}));
        setLoading(false);
        if (!result) {
          return;
        }
        setCatalog(result);
        if (result.message) {
          toast('目录未加载完整', result.message, 'warn');
        }
      })();
    },
    [kbId],
  );

  const toggleBook = useCallback((namespace: string, name: string) => {
    setSelection((current) => {
      const existing = current.findIndex((item) => item.book === namespace);
      if (existing >= 0) {
        return current.filter((_, index) => index !== existing);
      }
      return [...current, { book: namespace, name, docs: [] }];
    });
  }, []);

  const toggleDoc = useCallback((bookScope: string, doc: KnowledgeBaseSourceDoc) => {
    setSelection((current) =>
      current.map((item) => {
        if (item.book !== bookScope) {
          return item;
        }
        const picked = item.docs.some((entry) => entry.slug === doc.slug);
        const docs: SelectedDoc[] = picked
          ? item.docs.filter((entry) => entry.slug !== doc.slug)
          : [...item.docs, { slug: doc.slug, title: doc.title }];
        return { ...item, docs };
      }),
    );
  }, []);

  const loadDocs = useCallback(
    (bookScope: string) => {
      if (expandedBook === bookScope) {
        setExpandedBook('');
        return;
      }
      setExpandedBook(bookScope);
      if (docCache[bookScope] && !docCache[bookScope].loading) {
        return;
      }
      const current = source;
      if (!current) {
        return;
      }
      setDocCache((cache) => ({ ...cache, [bookScope]: { loading: true, docs: [] } }));
      void (async () => {
        const result = await loadYuqueCatalogDocs(
          kbId,
          toPayload(current, current.scope || {}),
          bookScope,
        );
        setDocCache((cache) => ({
          ...cache,
          [bookScope]: result
            ? { loading: false, docs: result.docs, message: result.message }
            : { loading: false, docs: [], message: '文章加载失败' },
        }));
        if (result?.message) {
          toast('文章未加载', result.message, 'warn');
        }
      })();
    },
    [docCache, expandedBook, kbId, source],
  );

  const saveAndSync = useCallback(() => {
    const current = source;
    if (!current || !target) {
      return;
    }
    if (selection.length === 0) {
      toast('不能保存', '至少勾选一个语雀知识库', 'warn');
      return;
    }
    const scope = { ...(current.scope || {}), selection };
    const payloads = sources.map((item) =>
      item.sourceId === current.sourceId
        ? toPayload(item, scope)
        : toPayload(item, item.scope || {}),
    );
    setSaving(true);
    void (async () => {
      const saved = await saveKnowledgeBaseSources(kbId, payloads);
      if (!saved) {
        setSaving(false);
        return;
      }
      const result = await syncKnowledgeBaseSource(kbId, current.sourceId);
      setSaving(false);
      if (!result) {
        return;
      }
      toast(
        result.reusing ? '已在同步中' : '已按新的范围同步',
        result.reusing
          ? '该接入源已有运行中的同步任务，本次未重复发起'
          : '已保存勾选范围并发起采集，进度可在任务管理查看',
        'success',
      );
      close();
    })();
  }, [close, kbId, selection, source, sources, target]);

  return {
    target,
    loading,
    saving,
    catalog,
    selection,
    expandedBook,
    docCache,
    open,
    close,
    toggleBook,
    toggleDoc,
    loadDocs,
    saveAndSync,
  };
}
