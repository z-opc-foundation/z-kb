import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/icon';
import type { CategoryNode } from '@/services/category';
import type { MaterialRecord } from '@/services/material';
import { MATERIAL_TYPE_META, materialFileIcon } from '../material-workspace-model';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';

interface MaterialTreePanelProps {
  ctrl: MaterialWorkspaceController;
  /** 接入源节点上的「同步」入口：打开该源的语雀全量并勾选同步范围。 */
  onSyncSource?: (node: CategoryNode) => void;
}

interface TreeNodeMenu {
  node: CategoryNode;
  locked: boolean;
  x: number;
  y: number;
}

interface TreeNodeMenuItem {
  label: string;
  icon: string;
  danger?: boolean;
  run: () => void;
}

const MENU_WIDTH = 148;
const MENU_ITEM_HEIGHT = 30;

export default function MaterialTreePanel({ ctrl, onSyncSource }: MaterialTreePanelProps) {
  const {
    tree,
    categoryId,
    detailId,
    canWrite,
    canCompile,
    materialsByCategory,
    categoryCounts,
    collapsed,
    dragMaterialId,
    dragCategoryId,
    dropTargetId,
    editingCategoryId,
    editingCategoryName,
    treeMaterials,
    libraryTotal,
    recycle,
    setEditingCategoryName,
    setDragMaterialId,
    setDragCategoryId,
    setDropTargetId,
    selectCategory,
    toggleCollapsed,
    openDetail,
    openCreateCategory,
    deleteCategory,
    beginRename,
    cancelRename,
    commitRename,
    dropProps,
    rootDropProps,
    openNodeBatch,
    syncSource,
  } = ctrl;

  const [menu, setMenu] = useState<TreeNodeMenu | null>(null);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = () => setMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    // 点空白、滚动、窗口尺寸变化都会让固定定位的菜单漂移，一律关掉
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const menuItems = (target: TreeNodeMenu): TreeNodeMenuItem[] => {
    const { node, locked } = target;
    const bound = !!node.nodeKind && node.nodeKind !== 'FOLDER';
    const provider = typeof node.ext?.provider === 'string' ? node.ext.provider : '';
    const sourceId = typeof node.ext?.sourceId === 'string' ? node.ext.sourceId : '';
    const syncable = node.nodeKind === 'SOURCE' && provider === 'YUQUE' && canWrite && !!onSyncSource;
    const repoSource = node.nodeKind === 'SOURCE' && provider === 'GIT' && canWrite;
    const items: TreeNodeMenuItem[] = [];
    if (!locked && canWrite) {
      items.push({ label: '重命名', icon: 'edit', run: () => beginRename(node) });
    }
    if (syncable) {
      items.push({
        label: '同步范围',
        icon: 'refresh',
        run: () => onSyncSource?.(node),
      });
    }
    if (repoSource) {
      items.push({
        label: '同步仓库',
        icon: 'refresh',
        run: () => {
          if (sourceId) {
            void syncSource(sourceId);
          }
        },
      });
    }
    if (canCompile && !syncable) {
      items.push({ label: '发起批任务', icon: 'layers', run: () => openNodeBatch(node) });
    }
    if (!locked && canWrite && !bound) {
      items.push({
        label: '删除分类',
        icon: 'trash',
        danger: true,
        run: () => void deleteCategory(node.categoryId),
      });
    }
    return items;
  };

  const openMenu = (node: CategoryNode, locked: boolean, x: number, y: number) => {
    const target: TreeNodeMenu = { node, locked, x, y };
    if (menuItems(target).length === 0) {
      return false;
    }
    setMenu(target);
    return true;
  };

  const materialRow = (item: MaterialRecord, depth: number, locked: boolean): ReactNode => {
    const meta = MATERIAL_TYPE_META[item.materialType];
    const fileIcon = materialFileIcon(item);
    const typeLabel = item.fileExt
      ? item.fileExt.replace(/^\./, '').toUpperCase()
      : meta.label;
    const draggable = canWrite && !locked;
    return (
      <div
        key={item.materialId}
        className={`tree-item tree-leaf ${locked ? 'tree-locked' : ''} ${
          dragMaterialId === item.materialId ? 'dragging' : ''
        } ${detailId === item.materialId ? 'active' : ''}`}
        style={{ paddingLeft: 9 + depth * 13 }}
        title={`${item.title} · ${typeLabel}${
          draggable
            ? ' · 拖到分类上可调整归属'
            : locked
              ? ' · 由接入源同步维护，不能移动'
              : ''
        }`}
        draggable={draggable}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', item.materialId);
          setDragMaterialId(item.materialId);
          setDragCategoryId('');
        }}
        onDragEnd={() => {
          setDragMaterialId('');
          setDropTargetId(null);
        }}
        onClick={() => void openDetail(item.materialId)}
      >
        <Icon name={fileIcon.icon} size={13} className={`file-ic ${fileIcon.tone}`} />
        <span className="tree-name">{item.title}</span>
        <span className="tree-type">{typeLabel}</span>
      </div>
    );
  };

  const folderRows = (
    nodes: CategoryNode[],
    depth: number,
    ancestorLocked: boolean,
  ): ReactNode[] =>
    nodes.flatMap((node) => {
      const own = materialsByCategory.get(node.categoryId) || [];
      const children = node.children || [];
      const expandable = children.length > 0 || own.length > 0;
      const isCollapsed = collapsed.has(node.categoryId);
      const bound = !!node.nodeKind && node.nodeKind !== 'FOLDER';
      // 接入源下的层级与语雀原结构一致，源节点及其子孙都不允许在本树里挪动
      const locked = ancestorLocked || bound;
      const provider = typeof node.ext?.provider === 'string' ? node.ext.provider : '';
      const sourceId = typeof node.ext?.sourceId === 'string' ? node.ext.sourceId : '';
      // 「同步」按整个接入源取全量，只挂在接入源节点上，子书节点不再重复
      const syncable =
        node.nodeKind === 'SOURCE' && provider === 'YUQUE' && canWrite && !!onSyncSource;
      // Git 接入源一次同步整个仓库，不需要勾选范围，点了直接发起
      const repoSource = node.nodeKind === 'SOURCE' && provider === 'GIT' && canWrite;
      const lockedHint = '由接入源同步维护，不能在资料树里改名、移动或删除';
      const rows: ReactNode[] = [
        <div
          key={node.categoryId}
          className={`tree-item tree-folder ${bound ? 'tree-bound' : ''} ${
            categoryId === node.categoryId ? 'active' : ''
          } ${dropTargetId === `cat:${node.categoryId}` ? 'drop-on' : ''} ${
            dragCategoryId === node.categoryId ? 'dragging' : ''
          }`}
          style={depth ? { paddingLeft: 9 + depth * 13 } : undefined}
          title={
            locked
              ? `${node.name} · ${lockedHint}`
              : canWrite
                ? '双击名称可重命名，右键更多操作，拖到其他分类上可移动'
                : node.name
          }
          draggable={!locked && canWrite && editingCategoryId !== node.categoryId}
          onContextMenu={(event) => {
            if (openMenu(node, locked, event.clientX, event.clientY)) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-kb-category', node.categoryId);
            setDragCategoryId(node.categoryId);
            setDragMaterialId('');
          }}
          onDragEnd={() => {
            setDragCategoryId('');
            setDropTargetId(null);
          }}
          onClick={() =>
            selectCategory(categoryId === node.categoryId ? '' : node.categoryId)
          }
          {...(locked ? {} : dropProps(node.categoryId))}
        >
          <Icon
            name={
              bound
                ? node.nodeKind === 'SOURCE'
                  ? 'plug'
                  : node.nodeKind === 'SOURCE_REPO'
                    ? 'git-branch'
                    : 'book'
                : isCollapsed
                  ? 'folder'
                  : 'folder-open'
            }
            size={13}
          />
          {editingCategoryId === node.categoryId ? (
            <input
              className="tree-rename"
              autoFocus
              aria-label="分类名称"
              value={editingCategoryName}
              onFocus={(event) => event.target.select()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setEditingCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void commitRename(node);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              onBlur={() => void commitRename(node)}
            />
          ) : (
            <span
              className="tree-name"
              onDoubleClick={(event) => {
                if (!canWrite || locked) {
                  return;
                }
                event.stopPropagation();
                beginRename(node);
              }}
            >
              {node.name}
            </span>
          )}
          <span className="count">{categoryCounts.get(node.categoryId) || 0}</span>
          <button
            className="tree-chevron"
            type="button"
            aria-label={isCollapsed ? '展开分类' : '收起分类'}
            title={expandable ? (isCollapsed ? '展开' : '收起') : '空分类'}
            onClick={(event) => {
              event.stopPropagation();
              toggleCollapsed(node.categoryId);
            }}
          >
            <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={11} />
          </button>
          {!locked && canWrite && editingCategoryId !== node.categoryId && depth < 2 ? (
            <button
              className="tree-task tree-new"
              type="button"
              title={`在「${node.name}」下新建子分类`}
              onClick={(event) => {
                event.stopPropagation();
                openCreateCategory(node.categoryId);
              }}
            >
              <Icon name="plus" size={12} />
            </button>
          ) : null}
          {syncable || repoSource ? (
            <span className="tree-node-actions flush">
              {syncable ? (
                <button
                  className="tree-task tree-sync"
                  type="button"
                  title={`同步「${node.name}」：勾选要同步的语雀知识库与文章`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSyncSource(node);
                  }}
                >
                  <Icon name="refresh" size={12} />
                </button>
              ) : null}
              {repoSource ? (
                <button
                  className="tree-task tree-sync"
                  type="button"
                  title={`同步「${node.name}」：拉取仓库最新的项目结构与文档`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (sourceId) {
                      void syncSource(sourceId);
                    }
                  }}
                >
                  <Icon name="refresh" size={12} />
                </button>
              ) : null}
            </span>
          ) : null}
        </div>,
      ];
      if (!isCollapsed) {
        rows.push(...folderRows(children, depth + 1, locked));
        own.forEach((item) => {
          rows.push(materialRow(item, depth + 1, locked));
        });
      }
      return rows;
    });

  return (
    <section className="panel tree-panel">
      <div className="panel-head">
        <h3>
          <Icon name="folder" size={15} />
          资料树
        </h3>
        {canWrite ? (
          <button
            className="icon-btn"
            type="button"
            title="新建分类（根目录）"
            onClick={() => openCreateCategory()}
          >
            <Icon name="plus" size={14} />
          </button>
        ) : null}
      </div>
      <div className="tree material-tree" {...rootDropProps}>
        {folderRows(tree, 0, false)}
        {(materialsByCategory.get('') || []).map((item) => materialRow(item, 0, false))}
        {libraryTotal > treeMaterials.length ? (
          <div className="tree-add" style={{ cursor: 'default' }}>
            树内先展示 {treeMaterials.length} 条，共 {libraryTotal} 条资料
          </div>
        ) : null}
        {dragMaterialId || dragCategoryId ? (
          <div
            className={`tree-add ${dropTargetId === 'root' ? 'drop-on' : ''}`}
            style={{ cursor: 'default', pointerEvents: 'none' }}
          >
            放到空白处 = 根目录
          </div>
        ) : null}
      </div>
      {canWrite ? (
        <div className="panel-foot tree-recycle-foot">
          <button
            className="tree-recycle"
            type="button"
            title="查看已删除的资料，可取回或彻底删除"
            onClick={recycle.openRecycle}
          >
            <Icon name="trash" size={12} />
            <span>回收站</span>
            {recycle.count ? <span className="count">{recycle.count}</span> : null}
          </button>
        </div>
      ) : null}
      {menu
        ? (() => {
            const items = menuItems(menu);
            // 固定定位的菜单贴边时会被视口裁掉，先按条目数估高再往里收
            const left = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8);
            const top = Math.min(
              menu.y,
              window.innerHeight - items.length * MENU_ITEM_HEIGHT - 16,
            );
            return createPortal(
              <div
                className="tree-ctx"
                role="menu"
                aria-label={`「${menu.node.name}」操作`}
                style={{ left, top }}
                onMouseDown={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                {items.map((item) => (
                  <button
                    key={item.label}
                    className={`tree-ctx-item${item.danger ? ' is-danger' : ''}`}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(null);
                      item.run();
                    }}
                  >
                    <Icon name={item.icon} size={12} />
                    {item.label}
                  </button>
                ))}
              </div>,
              document.body,
            );
          })()
        : null}
    </section>
  );
}
