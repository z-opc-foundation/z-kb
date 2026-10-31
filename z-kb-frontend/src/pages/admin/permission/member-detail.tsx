import { useEffect, useMemo, useState } from 'react';
import { Tree, type TreeDataNode } from 'antd';
import Icon from '@/components/icon';
import {
  updateMemberPermissions,
  updateMemberRoles,
  type AuthRole,
  type PermissionCatalogItem,
} from '@/services/identity';
import { toast } from '@/utils/toast';
import { buildCatalogTree, type CatalogTreeNode } from './catalog-tree';
import { useMemberAuthorization } from './hooks/use-member-authorization';
import {
  buildMemberPermissionIndex,
  diffMemberPermissions,
  effectiveCodes,
  toggleMemberPermission,
  type MemberPermissionSource,
  type MemberPermissionState,
} from './member-permissions';

const SOURCE_LABEL: Record<MemberPermissionSource, string> = {
  ROLE: '角色',
  UNIT: '组织',
  POSITION: '岗位',
};

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

function toTreeData(
  nodes: CatalogTreeNode[],
  index: Map<string, MemberPermissionState>,
): TreeDataNode[] {
  return nodes.map((node) => {
    const state = index.get(node.key);
    const tags = (state?.sources ?? []).map((source) => (
      <span key={source} className="tag gray">
        {SOURCE_LABEL[source]}
      </span>
    ));
    if (state?.direct) {
      tags.push(
        <span key="direct" className="tag green">
          直接
        </span>,
      );
    }
    return {
      key: node.key,
      disableCheckbox: state?.locked ?? false,
      title: (
        <span className="perm-tree-title">
          <span>{node.label}</span>
          {node.type === 'BUTTON' ? <span className="tag blue">按钮</span> : null}
          {tags}
        </span>
      ),
      children: toTreeData(node.children, index),
    };
  });
}

/** 成员授权：角色按机构角色勾选，权限树只改直接授予部分，角色与组织岗位来源只读。 */
export default function MemberDetail({
  staffId,
  roles,
  catalog,
  onSaved,
}: {
  staffId: number;
  roles: AuthRole[];
  catalog: PermissionCatalogItem[];
  onSaved: () => void;
}) {
  const { data, loading, error, reload } = useMemberAuthorization(staffId);
  const [roleSelection, setRoleSelection] = useState<string[]>([]);
  const [roleSaved, setRoleSaved] = useState<string[]>([]);
  const [directSelection, setDirectSelection] = useState<string[]>([]);
  const [directSaved, setDirectSaved] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!data) {
      setRoleSelection([]);
      setRoleSaved([]);
      setDirectSelection([]);
      setDirectSaved([]);
      return;
    }
    const codes = data.roles.map((role) => role.roleCode);
    setRoleSelection(codes);
    setRoleSaved(codes);
    setDirectSelection(data.directCodes || []);
    setDirectSaved(data.directCodes || []);
  }, [data]);

  const treeData = useMemo(() => buildCatalogTree(catalog), [catalog]);

  useEffect(() => {
    setExpandedKeys(collectMenuKeys(treeData));
  }, [treeData]);

  const permissionIndex = useMemo(
    () =>
      buildMemberPermissionIndex({
        directCodes: directSelection,
        rolePermittedCodes: data?.rolePermittedCodes ?? [],
        inheritedCodes: data?.inheritedCodes ?? [],
      }),
    [data, directSelection],
  );

  const checkedKeys = useMemo(
    () =>
      data
        ? effectiveCodes(catalog, {
            directCodes: directSelection,
            rolePermittedCodes: data.rolePermittedCodes,
            inheritedCodes: data.inheritedCodes,
          })
        : [],
    [catalog, data, directSelection],
  );

  const antdTree = useMemo(
    () => toTreeData(treeData, permissionIndex),
    [treeData, permissionIndex],
  );

  const lockedCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const [code, state] of permissionIndex) {
      if (state.locked) {
        codes.add(code);
      }
    }
    return codes;
  }, [permissionIndex]);

  const roleDiff = useMemo(() => {
    const savedSet = new Set(roleSaved);
    const nextSet = new Set(roleSelection);
    return {
      add: roleSelection.filter((code) => !savedSet.has(code)),
      remove: roleSaved.filter((code) => !nextSet.has(code)),
    };
  }, [roleSaved, roleSelection]);
  const rolesChanged = roleDiff.add.length > 0 || roleDiff.remove.length > 0;

  const permissionDiff = useMemo(
    () => diffMemberPermissions(catalog, directSaved, directSelection),
    [catalog, directSaved, directSelection],
  );
  const permissionsChanged =
    permissionDiff.addCodes.length > 0 || permissionDiff.removeCodes.length > 0;

  const roleOptions = useMemo(() => {
    const options = [...roles];
    const known = new Set(options.map((role) => role.roleCode));
    for (const role of data?.roles ?? []) {
      if (!known.has(role.roleCode)) {
        options.push(role);
      }
    }
    return options;
  }, [data, roles]);

  const saveRoles = async () => {
    setSavingRoles(true);
    try {
      await updateMemberRoles(staffId, roleSelection);
      setRoleSaved(roleSelection);
      toast('角色已保存', `${roleSelection.length} 个角色绑定到该成员`, 'success');
      onSaved();
      reload();
    } catch (err) {
      toast('角色保存失败', err instanceof Error ? err.message : '请稍后重试', 'error');
    } finally {
      setSavingRoles(false);
    }
  };

  const savePermissions = async () => {
    setSavingPermissions(true);
    try {
      await updateMemberPermissions(staffId, permissionDiff);
      setDirectSaved(directSelection);
      toast(
        '权限已保存',
        `新增 ${permissionDiff.addCodes.length} · 回收 ${permissionDiff.removeCodes.length}`,
        'success',
      );
      onSaved();
      reload();
    } catch (err) {
      toast('权限保存失败', err instanceof Error ? err.message : '请稍后重试', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  if (loading) {
    return (
      <div className="perm-loading" role="status">
        <span className="spinner" />
        <span>正在读取成员授权…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="callout danger">
        <Icon name="alert-triangle" size={15} />
        <div className="ct">
          <b>成员授权读取失败</b>
          <p>{error}</p>
          <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={reload}>
            <Icon name="refresh" size={12} />
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const rolePermittedCount = data.rolePermittedCodes.length;
  const inheritedCount = data.inheritedCodes.length;

  return (
    <div className="perm-detail">
      <div className="perm-detail-head">
        <div className="perm-detail-copy">
          <div className="row" style={{ gap: 8 }}>
            <b className="perm-detail-name">{data.name || '未命名成员'}</b>
            {data.jobNumber ? <span className="mono muted">工号 {data.jobNumber}</span> : null}
          </div>
          <div className="mono muted">staffId {data.staffId}</div>
        </div>
      </div>

      <div className="perm-section">
        <div className="perm-section-head">
          <b>角色</b>
          <span className="muted">
            已绑定 {roleSelection.length} 个
            {rolesChanged
              ? ` · 待提交：绑定 ${roleDiff.add.length} · 解绑 ${roleDiff.remove.length}`
              : ''}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn xs"
              type="button"
              disabled={!rolesChanged || savingRoles}
              onClick={() => setRoleSelection(roleSaved)}
            >
              还原
            </button>
            <button
              className="btn xs primary"
              type="button"
              disabled={!rolesChanged || savingRoles}
              onClick={saveRoles}
            >
              {savingRoles ? '保存中…' : '保存角色'}
            </button>
          </div>
        </div>
        {roleOptions.length ? (
          <div className="perm-chips">
            {roleOptions.map((role) => {
              const active = roleSelection.includes(role.roleCode);
              return (
                <button
                  key={role.roleCode}
                  type="button"
                  className={`perm-chip ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() =>
                    setRoleSelection((prev) =>
                      active
                        ? prev.filter((code) => code !== role.roleCode)
                        : [...prev, role.roleCode],
                    )
                  }
                >
                  {role.roleName}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="muted">当前机构还没有角色，可先去「角色授权」新建。</div>
        )}
      </div>

      <div className="perm-section">
        <div className="perm-section-head">
          <b>权限点</b>
          <span className="muted">
            直接 {directSelection.length} · 角色带入 {rolePermittedCount} · 组织岗位 {inheritedCount}
            {permissionsChanged
              ? ` · 待提交：新增 ${permissionDiff.addCodes.length} · 回收 ${permissionDiff.removeCodes.length}`
              : ''}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn xs"
              type="button"
              disabled={!permissionsChanged || savingPermissions}
              onClick={() => setDirectSelection(directSaved)}
            >
              还原
            </button>
            <button
              className="btn xs primary"
              type="button"
              disabled={!permissionsChanged || savingPermissions}
              onClick={savePermissions}
            >
              {savingPermissions ? '保存中…' : '保存权限'}
            </button>
          </div>
        </div>
        <div className="perm-legend">
          <span className="tag green">直接</span> 可勾选，保存写回成员本人
          <span className="tag gray">角色 / 组织 / 岗位</span> 带入，置灰只读，请在角色或组织侧调整
        </div>
        {catalog.length ? (
          <div className="perm-tree">
            <Tree
              checkable
              checkStrictly
              selectable={false}
              treeData={antdTree}
              checkedKeys={checkedKeys}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys.map(String))}
              onCheck={(keys) => {
                const next = (Array.isArray(keys) ? keys : keys.checked).map(String);
                const nextSet = new Set(next);
                const currentSet = new Set(checkedKeys);
                let result = directSelection;
                for (const code of currentSet) {
                  if (!nextSet.has(code) && !lockedCodes.has(code)) {
                    result = toggleMemberPermission(catalog, result, lockedCodes, code, false);
                  }
                }
                for (const code of next) {
                  if (!currentSet.has(code)) {
                    result = toggleMemberPermission(catalog, result, lockedCodes, code, true);
                  }
                }
                setDirectSelection(result);
              }}
            />
          </div>
        ) : (
          <div className="muted">权限目录为空，请先在「权限目录」发布。</div>
        )}
      </div>
    </div>
  );
}
