import { useEffect, useMemo, useState } from 'react';
import { Tree, type TreeDataNode } from 'antd';
import Icon from '@/components/icon';
import { Can } from '@/components/auth';
import type { PermissionCatalogItem } from '@/services/identity';
import { buildCatalogTree, type CatalogTreeNode } from './catalog-tree';

function toTreeData(nodes: CatalogTreeNode[]): TreeDataNode[] {
  return nodes.map((node) => ({
    key: node.key,
    title: (
      <span className="perm-tree-title">
        <span>{node.label}</span>
        {node.type === 'BUTTON' ? (
          <span className="tag blue">按钮</span>
        ) : node.path ? (
          <span className="perm-tree-path mono">{node.path}</span>
        ) : null}
        <span className="mono muted">{node.key}</span>
      </span>
    ),
    children: toTreeData(node.children),
  }));
}

function collectMenuKeys(nodes: CatalogTreeNode[]): string[] {
  const keys: string[] = [];
  const walk = (list: CatalogTreeNode[]) => {
    for (const node of list) {
      if (node.type === 'MENU') {
        keys.push(node.key);
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return keys;
}

/** 权限目录：本地 SystemMenu 声明的全部菜单与按钮，发布后同步到 Apex 权限中心。 */
export default function PermissionCatalogPanel({
  catalog,
  loading,
  error,
  publishing,
  onReload,
  onPublish,
}: {
  catalog: PermissionCatalogItem[];
  loading: boolean;
  error: string;
  publishing: boolean;
  onReload: () => void;
  onPublish: () => void;
}) {
  const treeData = useMemo(() => buildCatalogTree(catalog), [catalog]);
  const antdTree = useMemo(() => toTreeData(treeData), [treeData]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    setExpandedKeys(collectMenuKeys(treeData));
  }, [treeData]);

  const menuCount = catalog.filter((item) => item.type === 'MENU').length;
  const buttonCount = catalog.length - menuCount;

  if (loading) {
    return (
      <div className="perm-loading" role="status">
        <span className="spinner" />
        <span>正在读取权限目录…</span>
      </div>
    );
  }

  return (
    <section className="panel perm-catalog">
      <div className="perm-toolbar">
        <div className="muted">
          菜单 <b>{menuCount}</b> · 按钮 <b>{buttonCount}</b> · 共 {catalog.length} 项
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn" type="button" onClick={onReload}>
            <Icon name="refresh" size={13} />
            刷新
          </button>
          <Can code="identity.permission.publish">
            <button className="btn primary" type="button" disabled={publishing} onClick={onPublish}>
              {publishing ? <span className="spinner" /> : <Icon name="upload" size={13} />}
              {publishing ? '发布中…' : '发布权限目录'}
            </button>
          </Can>
        </div>
      </div>

      {error ? (
        <div className="callout danger">
          <Icon name="alert-triangle" size={15} />
          <div className="ct">
            <b>权限目录加载失败</b>
            <p>{error}</p>
            <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={onReload}>
              <Icon name="refresh" size={12} />
              重试
            </button>
          </div>
        </div>
      ) : null}

      {catalog.length ? (
        <div className="perm-tree">
          <Tree
            selectable={false}
            treeData={antdTree}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys.map(String))}
          />
        </div>
      ) : null}
    </section>
  );
}
