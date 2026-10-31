import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import { confirmAction } from '@/components/confirm';
import {
  createCategory,
  removeCategory,
} from '@/services/category';
import {
  downloadMaterial,
  getMaterial,
  reparseMaterial,
  type MaterialDetailRecord,
} from '@/services/material';
import {
  getCompilationByJob,
  isCompilationActive,
  runCompilation,
} from '@/services/compilation';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MixEntryOverview from './components/mix-entry-overview';
import MixEntryTreePanel from './components/mix-entry-tree-panel';
import MixEntryUploadModal from './components/mix-entry-upload-modal';
import { useMixEntryTree } from './hooks/use-mix-entry-tree';
import {
  buildMixTree,
  collectMixEntries,
  findMixTreeNode,
  flattenMixTree,
  MIX_ENTRY_TYPES,
  mixFolderPath,
  type MixEntry,
  type MixEntryType,
} from './mix-entry-model';
import './mix-entry-workspace.css';

interface MixEntryWorkspaceProps {
  kbId: string;
  canWrite?: boolean;
  canCompile?: boolean;
  initialMaterialId?: string;
  onOpenDetail?: (
    materialId: string,
    tab: 'wiki' | 'graph' | 'knowledge',
  ) => void;
}

export default function MixEntryWorkspace({
  kbId,
  canWrite = false,
  canCompile = false,
  initialMaterialId,
  onOpenDetail,
}: MixEntryWorkspaceProps) {
  const { categories, entries, total, truncated, loading, error, reload } =
    useMixEntryTree(kbId);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MixEntryType | 'all'>('all');
  const [activeFolderId, setActiveFolderId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<MaterialDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNonce, setDetailNonce] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);
  const [reparseBusy, setReparseBusy] = useState(false);
  const [compileBusy, setCompileBusy] = useState(false);
  const compilePollRef = useRef<number | null>(null);
  const appliedInitial = useRef(false);

  const model = useMemo(
    () => buildMixTree(categories, entries),
    [categories, entries],
  );
  const filterActive = !!query.trim() || typeFilter !== 'all';
  const typeCounts = useMemo(() => {
    const counts = {} as Record<MixEntryType, number>;
    MIX_ENTRY_TYPES.forEach((type) => {
      counts[type] = 0;
    });
    entries.forEach((entry) => {
      counts[entry.type] += 1;
    });
    return counts;
  }, [entries]);
  const filteredEntries = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== 'all' && entry.type !== typeFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const haystack = `${entry.material.title} ${
        entry.material.fileName || ''
      }`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [entries, query, typeFilter]);
  const viewModel = useMemo(
    () =>
      filterActive ? buildMixTree(categories, filteredEntries) : model,
    [categories, filterActive, filteredEntries, model],
  );
  const activeNode = useMemo(
    () =>
      activeFolderId ? findMixTreeNode(model.roots, activeFolderId) : undefined,
    [activeFolderId, model],
  );
  const scopeEntries = useMemo(() => {
    if (!activeNode) {
      return filteredEntries;
    }
    const ids = new Set(
      collectMixEntries(activeNode).map((entry) => entry.material.materialId),
    );
    return filteredEntries.filter((entry) =>
      ids.has(entry.material.materialId),
    );
  }, [activeNode, filteredEntries]);
  const selectedEntry = useMemo(
    () =>
      entries.find((entry) => entry.material.materialId === selectedId) || null,
    [entries, selectedId],
  );
  const selectedPath = selectedEntry
    ? mixFolderPath(model, selectedEntry.material.categoryId).join(' / ') ||
      '未分类'
    : '';
  const activePath = activeFolderId
    ? mixFolderPath(model, activeFolderId).join(' / ')
    : '';
  const folderOptions = useMemo(
    () =>
      model.roots.flatMap(flattenMixTree).map(({ node }) => ({
        id: node.category.categoryId,
        label: `${'—'.repeat(node.depth)}${node.category.name}`,
      })),
    [model],
  );

  useEffect(() => {
    if (!initialMaterialId || appliedInitial.current) {
      return;
    }
    if (entries.some((entry) => entry.material.materialId === initialMaterialId)) {
      appliedInitial.current = true;
      setSelectedId(initialMaterialId);
    }
  }, [entries, initialMaterialId]);

  useEffect(() => {
    if (
      selectedId &&
      !entries.some((entry) => entry.material.materialId === selectedId)
    ) {
      setSelectedId('');
    }
  }, [entries, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setDetail(null);
    void getMaterial(selectedId)
      .then((result) => {
        if (alive) {
          setDetail(result || null);
        }
      })
      .finally(() => {
        if (alive) {
          setDetailLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [detailNonce, selectedId]);

  const toggleFolder = (folderId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const selectFolder = (folderId: string) => {
    setActiveFolderId(folderId);
    setSelectedId('');
  };

  const clearFilters = () => {
    setQuery('');
    setTypeFilter('all');
  };

  const submitFolder = async () => {
    const name = folderName.trim();
    if (!name) {
      toast('请输入目录名称', undefined, 'warn');
      return;
    }
    setFolderBusy(true);
    const result = await createCategory(
      kbId,
      name,
      activeFolderId || undefined,
    );
    setFolderBusy(false);
    if (!result) {
      return;
    }
    toast('已创建目录', name, 'success');
    setFolderOpen(false);
    setFolderName('');
    void reload();
  };

  const removeFolder = async () => {
    if (!activeNode) {
      return;
    }
    const ok = await confirmAction({
      title: `删除目录「${activeNode.category.name}」？`,
      sub: '目录下仍有子目录或条目时后端会拒绝。',
      confirmText: '删除',
    });
    if (!ok) {
      return;
    }
    setFolderBusy(true);
    const result = await removeCategory(activeNode.category.categoryId);
    setFolderBusy(false);
    if (!result) {
      return;
    }
    toast('已删除目录', activeNode.category.name, 'success');
    setActiveFolderId('');
    setSelectedId('');
    void reload();
  };

  const download = async (entry: MixEntry) => {
    try {
      const blob = await downloadMaterial(entry.material.materialId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = entry.material.fileName || entry.material.title;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      toast('下载失败', (downloadError as Error).message, 'error');
    }
  };

  const reparse = async (entry: MixEntry) => {
    setReparseBusy(true);
    const result = await reparseMaterial(
      entry.material.materialId,
      entry.material.currentVersionId || undefined,
    );
    setReparseBusy(false);
    if (!result) {
      return;
    }
    toast('解析已提交', entry.material.title, 'success');
    setDetailNonce((prev) => prev + 1);
    void reload();
  };

  const finishCompile = () => {
    setDetailNonce((prev) => prev + 1);
    void reload();
  };

  const pollCompile = (jobId: string) => {
    const tick = async () => {
      const job = await getCompilationByJob(jobId);
      if (!job) {
        compilePollRef.current = null;
        return;
      }
      if (isCompilationActive(job.runStatus)) {
        compilePollRef.current = window.setTimeout(tick, 2000);
        return;
      }
      compilePollRef.current = null;
      if (job.runStatus === 'COMPLETED') {
        toast('编译完成', '图谱与概念已更新', 'success');
        finishCompile();
        return;
      }
      toast('编译未完成', job.failureSummary || job.runStatus, 'warn');
    };
    compilePollRef.current = window.setTimeout(tick, 1500);
  };

  useEffect(
    () => () => {
      if (compilePollRef.current) {
        window.clearTimeout(compilePollRef.current);
        compilePollRef.current = null;
      }
    },
    [],
  );

  const compile = async (entry: MixEntry) => {
    setCompileBusy(true);
    const job = await runCompilation(
      entry.material.materialId,
      entry.material.currentVersionId || undefined,
    );
    setCompileBusy(false);
    if (!job) {
      return;
    }
    if (job.runStatus === 'COMPLETED') {
      toast(job.reused ? '该版本已编译' : '编译完成', '图谱与概念已更新', 'success');
      finishCompile();
      return;
    }
    if (!isCompilationActive(job.runStatus)) {
      toast('编译未完成', job.failureSummary || job.runStatus, 'warn');
      return;
    }
    toast('编译已提交', '任务已进入队列，完成后图谱与概念更新', 'success');
    pollCompile(job.jobId);
  };

  const closeUpload = useCallback(() => setUploadOpen(false), []);

  if (loading && !entries.length && !categories.length) {
    return (
      <section className="panel">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="layers" size={22} />
          </div>
          <b>正在加载条目树…</b>
          <p>目录来自物料分类树，叶子来自物料登记。</p>
        </div>
      </section>
    );
  }

  return (
    <div>
      {error ? (
        <div className="callout warn mb-12">
          <Icon name="alert-triangle" size={15} />
          <div className="ct">
            <b>条目树加载失败</b>
            <p>分类或物料列表没有返回，当前展示的是上一次成功的数据。</p>
          </div>
          <button
            className="btn sm"
            type="button"
            onClick={() => void reload()}
          >
            <Icon name="refresh" size={12} />
            重新加载
          </button>
        </div>
      ) : null}
      <div className="side-layout mix-workspace">
        <MixEntryTreePanel
          model={viewModel}
          allCount={filteredEntries.length}
          loadedCount={entries.length}
          total={total}
          truncated={truncated}
          typeCounts={typeCounts}
          query={query}
          onQueryChange={setQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          activeFolderId={activeFolderId}
          selectedEntryId={selectedId}
          collapsed={collapsed}
          onToggleFolder={toggleFolder}
          onSelectFolder={selectFolder}
          onSelectEntry={setSelectedId}
          onUpload={() => setUploadOpen(true)}
          onNewFolder={() => {
            setFolderName('');
            setFolderOpen(true);
          }}
          onRemoveFolder={() => void removeFolder()}
          canWrite={canWrite}
          filterActive={filterActive}
        />
        <MixEntryOverview
          kbId={kbId}
          entry={selectedEntry}
          detail={detail}
          detailLoading={detailLoading}
          entryPath={selectedPath}
          scopeEntries={scopeEntries}
          scopeLabel={activeFolderId ? activePath || '当前目录' : '全部条目'}
          folderCount={model.folderCount}
          total={total}
          filterActive={filterActive}
          activeFolderId={activeFolderId}
          canWrite={canWrite}
          canCompile={canCompile}
          compileBusy={compileBusy}
          reparseBusy={reparseBusy}
          onUpload={() => setUploadOpen(true)}
          onNewFolder={() => {
            setFolderName('');
            setFolderOpen(true);
          }}
          onClearFilters={clearFilters}
          onDownload={(entry) => void download(entry)}
          onReparse={(entry) => void reparse(entry)}
          onCompile={(entry) => void compile(entry)}
          onOpenDetail={(entry, tab) =>
            onOpenDetail?.(entry.material.materialId, tab)
          }
        />
      </div>

      {uploadOpen ? (
        <MixEntryUploadModal
          kbId={kbId}
          folders={folderOptions}
          defaultFolderId={activeFolderId}
          onClose={closeUpload}
          onUploaded={() => void reload()}
        />
      ) : null}

      {folderOpen ? (
        <AppModal
          icon="folder"
          title="新建目录"
          sub={
            activeFolderId
              ? `将创建在「${activePath || activeNode?.category.name || '当前目录'}」下`
              : '创建为根目录'
          }
          width={460}
          onClose={() => {
            if (!folderBusy) {
              setFolderOpen(false);
            }
          }}
          body={
            <div className="field">
              <label>
                目录名称 <span className="req">*</span>
              </label>
              <input
                className="input"
                value={folderName}
                maxLength={50}
                placeholder="例如：院级管理制度"
                onChange={(event) => setFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void submitFolder();
                  }
                }}
              />
              <span className="help">
                目录就是条目树的分支；同层名称不可重复，最多三层。
              </span>
            </div>
          }
          footRight={
            <>
              <button
                className="btn"
                type="button"
                disabled={folderBusy}
                onClick={() => setFolderOpen(false)}
              >
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={folderBusy}
                onClick={() => void submitFolder()}
              >
                {folderBusy ? '创建中…' : '创建'}
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
