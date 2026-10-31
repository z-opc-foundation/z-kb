import Icon from '@/components/icon';
import type { ReactNode } from 'react';
import {
  collectMixEntries,
  deriveMixEntryState,
  findMixTreeNode,
  MIX_ENTRY_STATE_META,
  MIX_ENTRY_TYPES,
  MIX_ENTRY_TYPE_META,
  type MixEntry,
  type MixEntryType,
  type MixTreeNode,
  type MixTreeModel,
} from '../mix-entry-model';

interface MixEntryTreePanelProps {
  model: MixTreeModel;
  allCount: number;
  loadedCount: number;
  total: number;
  truncated: boolean;
  typeCounts: Record<MixEntryType, number>;
  query: string;
  onQueryChange: (value: string) => void;
  typeFilter: MixEntryType | 'all';
  onTypeFilterChange: (value: MixEntryType | 'all') => void;
  activeFolderId: string;
  selectedEntryId: string;
  collapsed: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectEntry: (materialId: string) => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onRemoveFolder: () => void;
  canWrite: boolean;
  filterActive: boolean;
}

function indent(depth: number) {
  return { paddingLeft: 9 + depth * 14 };
}

export default function MixEntryTreePanel({
  model,
  allCount,
  loadedCount,
  total,
  truncated,
  typeCounts,
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  activeFolderId,
  selectedEntryId,
  collapsed,
  onToggleFolder,
  onSelectFolder,
  onSelectEntry,
  onUpload,
  onNewFolder,
  onRemoveFolder,
  canWrite,
  filterActive,
}: MixEntryTreePanelProps) {
  const chipTypes = MIX_ENTRY_TYPES.filter(
    (type) => typeCounts[type] > 0 || typeFilter === type,
  );
  const activeFolder = activeFolderId
    ? findMixTreeNode(model.roots, activeFolderId)
    : undefined;
  const empty =
    model.roots.length === 0 && model.unclassified.length === 0 && !filterActive;

  const entryRow = (entry: MixEntry, depth: number) => {
    const meta = MIX_ENTRY_TYPE_META[entry.type];
    const state = deriveMixEntryState(entry.material.parseStatus);
    const stateMeta = MIX_ENTRY_STATE_META[state];
    const active = selectedEntryId === entry.material.materialId;
    return (
      <div
        key={entry.material.materialId}
        className={`tree-item mix-tree-entry ${active ? 'active' : ''}`}
        style={indent(depth)}
        title={`${entry.material.title} · ${meta.label} · ${stateMeta.label}`}
        onClick={() => onSelectEntry(entry.material.materialId)}
      >
        <Icon name={meta.icon} size={13} className={`mix-tone-${entry.type}`} />
        <span className="mix-entry-name">{entry.material.title}</span>
        <span className={`mix-state-dot ${state}`} />
      </div>
    );
  };

  const folderRows = (nodes: MixTreeNode[]): ReactNode[] =>
    nodes.flatMap((node) => {
      const isCollapsed = collapsed.has(node.category.categoryId);
      const active =
        activeFolderId === node.category.categoryId && !selectedEntryId;
      const rows: ReactNode[] = [
        <div
          key={node.category.categoryId}
          className={`tree-item mix-tree-folder ${active ? 'active' : ''}`}
          style={indent(node.depth)}
          onClick={() => onSelectFolder(node.category.categoryId)}
        >
          <Icon name={isCollapsed ? 'folder' : 'folder-open'} size={13} />
          <span className="mix-entry-name">{node.category.name}</span>
          <span className="count">{node.count}</span>
          <button
            className="mix-tree-chevron"
            type="button"
            aria-label={isCollapsed ? '展开目录' : '收起目录'}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFolder(node.category.categoryId);
            }}
          >
            <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={11} />
          </button>
        </div>,
      ];
      if (!isCollapsed) {
        rows.push(...folderRows(node.children));
        node.entries.forEach((entry) => {
          rows.push(entryRow(entry, node.depth + 1));
        });
      }
      return rows;
    });

  return (
    <section className="panel mix-tree-panel">
      <div className="panel-head">
        <h3>
          <Icon name="layers" size={15} />
          条目树
        </h3>
        {canWrite ? (
          <div className="row gap-8">
            <button
              className="icon-btn"
              type="button"
              title="新建目录"
              onClick={onNewFolder}
            >
              <Icon name="folder" size={14} />
            </button>
            <button
              className="icon-btn"
              type="button"
              title="上传条目"
              onClick={onUpload}
            >
              <Icon name="upload" size={14} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="mix-tree-filters">
        <div className="input-icon">
          <span className="ic">
            <Icon name="search" size={13} />
          </span>
          <input
            className="input"
            placeholder="搜索条目名称"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <div className="mix-type-chips">
          <button
            type="button"
            className={`filter-chip ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => onTypeFilterChange('all')}
          >
            全部
            <span className="mix-chip-count">{allCount}</span>
          </button>
          {chipTypes.map((type) => {
            const meta = MIX_ENTRY_TYPE_META[type];
            return (
              <button
                key={type}
                type="button"
                className={`filter-chip ${typeFilter === type ? 'active' : ''}`}
                onClick={() =>
                  onTypeFilterChange(typeFilter === type ? 'all' : type)
                }
              >
                <Icon name={meta.icon} size={11} className={`mix-tone-${type}`} />
                {meta.label}
                <span className="mix-chip-count">{typeCounts[type]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="tree mix-tree">
        {empty ? (
          <div className="mix-tree-empty">
            <Icon name="layers" size={18} />
            <b>还没有目录或条目</b>
            <span>上传第一条后，树会按目录与类型成型。</span>
            {canWrite ? (
              <button className="btn sm primary" type="button" onClick={onUpload}>
                <Icon name="upload" size={12} />
                上传条目
              </button>
            ) : null}
          </div>
        ) : allCount === 0 && (filterActive || model.roots.length === 0) ? (
          <div className="mix-tree-empty">
            <Icon name="search" size={18} />
            <b>{filterActive ? '没有匹配的条目' : '这个库还没有条目'}</b>
            <span>
              {filterActive
                ? '清空关键词或类型筛选再试。'
                : '上传第一条后，这里会按条目类型展示。'}
            </span>
          </div>
        ) : (
          <>
            <div
              className={`tree-item ${activeFolderId || selectedEntryId ? '' : 'active'}`}
              onClick={() => onSelectFolder('')}
            >
              <Icon name="layers" size={13} />
              全部条目
              <span className="count">{allCount}</span>
            </div>
            {folderRows(model.roots)}
            {model.unclassified.length ? (
              <>
                <div
                  className="mix-tree-label"
                  style={indent(activeFolderId ? 0 : 1)}
                >
                  未分类条目
                </div>
                {model.unclassified.map((entry) =>
                  entryRow(entry, activeFolderId ? 0 : 1),
                )}
              </>
            ) : null}
          </>
        )}
        {truncated ? (
          <div className="mix-tree-note">
            仅加载前 {loadedCount} 条，共 {total} 条
          </div>
        ) : null}
      </div>

      {activeFolder ? (
        <div className="panel-foot mix-tree-foot">
          <span className="mono-sm">
            {activeFolder.category.name} · {collectMixEntries(activeFolder).length} 条
          </span>
          {canWrite ? (
            <button className="btn xs danger" type="button" onClick={onRemoveFolder}>
              删除目录
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
