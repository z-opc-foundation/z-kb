import { useEffect, useMemo, useState } from 'react';
import { Tree, type TreeDataNode } from 'antd';
import Icon from '@/components/icon';
import {
  getRolePermissions,
  updateRolePermissions,
  type AuthRole,
  type PermissionCatalogItem,
} from '@/services/identity';
import { toast } from '@/utils/toast';
import {
  applyCatalogCheck,
  buildCatalogTree,
  diffPermissions,
  type CatalogTreeNode,
} from './catalog-tree';

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

/** 角色授权：目录来自本地 SystemMenu，勾选结果按增量写回 Apex。 */
export default function RolePermissions({
  role,
  catalog,
}: {
  role: AuthRole;
  catalog: PermissionCatalogItem[];
}) {
  const [granted, setGranted] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const treeData = useMemo(() => buildCatalogTree(catalog), [catalog]);
  const antdTree = useMemo(() => toTreeData(treeData), [treeData]);
  const catalogCodes = useMemo(() => catalog.map((item) => item.code), [catalog]);

  useEffect(() => {
    setExpandedKeys(collectMenuKeys(treeData));
  }, [treeData]);

  useEffect(() => {
    let alive = true;
    const roleId = role.id;
    setLoading(true);
    setError('');
    setGranted([]);
    setChecked([]);
    if (roleId == null) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    getRolePermissions(roleId)
      .then((codes) => {
        if (alive) {
          setGranted(codes || []);
          setChecked(codes || []);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : '角色权限加载失败');
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [role.id]);

  const diff = useMemo(
    () => diffPermissions(catalogCodes, granted, checked),
    [catalogCodes, granted, checked],
  );
  const changed = diff.addCodes.length > 0 || diff.removeCodes.length > 0;
  const known = useMemo(() => new Set(catalogCodes), [catalogCodes]);
  const grantedInCatalog = granted.filter((code) => known.has(code)).length;

  const save = async () => {
    const roleId = role.id;
    if (roleId == null || !changed) {
      return;
    }
    setSaving(true);
    try {
      await updateRolePermissions(roleId, diff);
      setGranted(checked);
      toast(
        '授权已保存',
        `新增 ${diff.addCodes.length} · 回收 ${diff.removeCodes.length}`,
        'success',
      );
    } catch (err) {
      toast('授权保存失败', err instanceof Error ? err.message : '请稍后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (role.id == null) {
    return (
      <div className="callout danger">
        <Icon name="alert-triangle" size={15} />
        <div className="ct">
          <b>该角色没有 Apex 角色 ID</b>
          <p>只有 Apex 返回的角色才能授权；请先在 Apex 权限中心确认角色数据。</p>
        </div>
      </div>
    );
  }

  if (loading || !catalog.length) {
    return (
      <div className="perm-loading" role="status">
        <span className="spinner" />
        <span>{loading ? '正在读取角色授权…' : '权限目录为空，请先发布目录'}</span>
      </div>
    );
  }

  return (
    <div className="perm-panel">
      {error ? (
        <div className="callout danger" style={{ marginBottom: 12 }}>
          <Icon name="alert-triangle" size={15} />
          <div className="ct">
            <b>授权读取失败</b>
            <p>{error}</p>
          </div>
        </div>
      ) : null}
      <div className="perm-toolbar">
        <div className="muted">
          已授予 <b>{grantedInCatalog}</b> / 目录 {catalog.length} 项
          {changed ? (
            <span className="perm-diff">
              待提交：新增 {diff.addCodes.length} · 回收 {diff.removeCodes.length}
            </span>
          ) : null}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="btn"
            type="button"
            disabled={!changed || saving}
            onClick={() => setChecked(granted)}
          >
            还原
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!changed || saving || !!error}
            onClick={save}
          >
            <Icon name="check" size={13} />
            {saving ? '保存中…' : '保存授权'}
          </button>
        </div>
      </div>
      <div className="perm-tree">
        <Tree
          checkable
          checkStrictly
          selectable={false}
          treeData={antdTree}
          checkedKeys={checked}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys.map(String))}
          onCheck={(keys) => {
            const next = (Array.isArray(keys) ? keys : keys.checked).map(String);
            const nextSet = new Set(next);
            const currentSet = new Set(checked);
            let result = checked;
            for (const code of currentSet) {
              if (!nextSet.has(code)) {
                result = applyCatalogCheck(catalog, result, code, false);
              }
            }
            for (const code of next) {
              if (!currentSet.has(code)) {
                result = applyCatalogCheck(catalog, result, code, true);
              }
            }
            setChecked(result);
          }}
        />
      </div>
    </div>
  );
}
