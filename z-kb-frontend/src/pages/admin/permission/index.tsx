import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/icon';
import { Can } from '@/components/auth';
import { changeRoleStatus, type AuthRole } from '@/services/identity';
import { toast } from '@/utils/toast';
import MemberAuthorization from './member-authorization';
import PermissionCatalogPanel from './permission-catalog';
import RoleFormModal from './role-form';
import RolePermissions from './role-permissions';
import { usePermissionAdmin } from './use-permission-admin';
import './permission.less';

type PageTab = 'roles' | 'members' | 'catalog';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'roles', label: '角色授权' },
  { key: 'members', label: '成员授权' },
  { key: 'catalog', label: '权限目录' },
];

function RoleDetail({
  role,
  catalog,
  catalogLoading,
  catalogError,
  onReloadCatalog,
  onToggle,
  busy,
  onEdit,
}: {
  role: AuthRole;
  catalog: ReturnType<typeof usePermissionAdmin>['catalog'];
  catalogLoading: boolean;
  catalogError: string;
  onReloadCatalog: () => void;
  onToggle: (role: AuthRole, enabled: boolean) => void;
  busy: boolean;
  onEdit: () => void;
}) {
  if (catalogLoading) {
    return (
      <div className="perm-loading" role="status">
        <span className="spinner" />
        <span>正在读取权限目录…</span>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="callout danger">
        <Icon name="alert-triangle" size={15} />
        <div className="ct">
          <b>权限目录加载失败</b>
          <p>{catalogError}</p>
          <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={onReloadCatalog}>
            <Icon name="refresh" size={12} />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="perm-detail">
      <div className="perm-detail-head">
        <div className="perm-detail-copy">
          <div className="row" style={{ gap: 8 }}>
            <b className="perm-detail-name">{role.roleName}</b>
            <span className={`tag ${role.enabled ? 'green' : 'amber'}`}>
              <span className="dot"></span>
              {role.enabled ? '启用' : '停用'}
            </span>
          </div>
          <div className="mono muted">{role.roleCode}</div>
          {role.description ? <div className="perm-detail-desc">{role.description}</div> : null}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button
            className={`switch ${role.enabled ? 'on' : ''}`}
            type="button"
            aria-pressed={role.enabled}
            aria-label={role.enabled ? '停用角色' : '启用角色'}
            disabled={busy || role.id == null}
            onClick={() => onToggle(role, !role.enabled)}
          />
          <button className="btn sm" type="button" onClick={onEdit}>
            编辑
          </button>
        </div>
      </div>

      <div className="perm-detail-body">
        <RolePermissions role={role} catalog={catalog} />
      </div>
    </div>
  );
}

export default function PermissionAdminPage() {
  const admin = usePermissionAdmin();

  const [tab, setTab] = useState<PageTab>('roles');
  const [selected, setSelected] = useState<AuthRole | null>(null);
  const [form, setForm] = useState<{ role?: AuthRole } | null>(null);
  const [busyCode, setBusyCode] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // 列表刷新后同步选中角色；首次加载默认选第一个，方便直接勾权限
  useEffect(() => {
    setSelected((prev) => {
      if (prev) {
        return (
          admin.roles.find((item) => item.roleCode === prev.roleCode) ?? prev
        );
      }
      return admin.roles[0] ?? null;
    });
  }, [admin.roles]);

  const enabledCount = useMemo(
    () => admin.roles.filter((role) => role.enabled).length,
    [admin.roles],
  );
  const refreshAll = () => {
    admin.reloadRoles();
    admin.reloadCatalog();
    setRefreshTick((value) => value + 1);
  };

  const toggleRole = async (role: AuthRole, enabled: boolean) => {
    if (role.id == null) {
      toast('无法切换状态', '该角色缺少 Apex 角色 ID', 'warn');
      return;
    }
    setBusyCode(role.roleCode);
    try {
      await changeRoleStatus([role.id], enabled);
      admin.applyRole({ ...role, enabled });
      setSelected((prev) =>
        prev && prev.roleCode === role.roleCode ? { ...prev, enabled } : prev,
      );
      toast(enabled ? '角色已启用' : '角色已停用', role.roleName, 'success');
    } catch (error) {
      toast(
        '状态切换失败',
        error instanceof Error ? error.message : '请稍后重试',
        'error',
      );
    } finally {
      setBusyCode('');
    }
  };

  return (
    <div className="perm-admin">
      <div className="perm-page-tabs">
        <div className="segmented">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? 'active' : ''}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {item.key === 'roles' ? (
                <span className="perm-tab-count">{admin.roles.length}</span>
              ) : item.key === 'members' ? (
                memberCount == null ? null : (
                  <span className="perm-tab-count">{memberCount}</span>
                )
              ) : (
                <span className="perm-tab-count">{admin.catalog.length}</span>
              )}
            </button>
          ))}
        </div>
        <button className="btn sm ghost" type="button" onClick={refreshAll}>
          {admin.rolesLoading || admin.catalogLoading ? (
            <span className="spinner" />
          ) : (
            <Icon name="refresh" size={12} />
          )}
          刷新
        </button>
      </div>

      {tab === 'roles' ? (
        <div className="perm-grid">
          <section className="panel perm-roles">
            <div className="panel-head">
              <div>
                <h3>角色</h3>
                <div className="hint">当前机构 · 共 {admin.roles.length} 个，启用 {enabledCount}</div>
              </div>
              <Can code="identity.role.manage">
                <button className="btn sm primary" type="button" onClick={() => setForm({})}>
                  <Icon name="plus" size={12} />
                  新建角色
                </button>
              </Can>
            </div>
            <div className="perm-search">
              <div className="input-icon">
                <span className="ic">
                  <Icon name="search" size={13} />
                </span>
                <input
                  className="input"
                  placeholder="按角色名称筛选"
                  value={admin.keyword}
                  onChange={(event) => admin.setKeyword(event.target.value)}
                />
              </div>
            </div>

            {admin.rolesError ? (
              <div className="callout danger" style={{ margin: '0 14px 12px' }}>
                <Icon name="alert-triangle" size={15} />
                <div className="ct">
                  <b>角色加载失败</b>
                  <p>{admin.rolesError}</p>
                  <button
                    className="btn sm"
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={admin.reloadRoles}
                  >
                    重试
                  </button>
                </div>
              </div>
            ) : null}

            {admin.rolesLoading && !admin.roles.length ? (
              <div className="perm-loading" role="status">
                <span className="spinner" />
                <span>正在读取角色…</span>
              </div>
            ) : admin.roles.length ? (
              <div className="table-wrap">
                <table className="list-table perm-role-table">
                  <thead>
                    <tr>
                      <th>角色</th>
                      <th style={{ width: 64 }}>状态</th>
                      <th style={{ width: 64 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin.roles.map((role) => (
                      <tr
                        key={role.roleCode}
                        className={role.roleCode === selected?.roleCode ? 'selected' : ''}
                        onClick={() => setSelected(role)}
                      >
                        <td>
                          <div className="name-cell">
                            <span className="role-mark">{role.roleName.slice(0, 1)}</span>
                            <div className="role-copy">
                              <b>{role.roleName}</b>
                              <span className="mono muted">{role.roleCode}</span>
                            </div>
                          </div>
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <button
                            className={`switch ${role.enabled ? 'on' : ''}`}
                            type="button"
                            aria-pressed={role.enabled}
                            aria-label={role.enabled ? '停用角色' : '启用角色'}
                            disabled={busyCode === role.roleCode || role.id == null}
                            onClick={() => toggleRole(role, !role.enabled)}
                          />
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <button className="btn xs" type="button" onClick={() => setForm({ role })}>
                            编辑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : admin.rolesError ? null : (
              <div className="empty">
                <span className="empty-icon">
                  <Icon name="shield" size={20} />
                </span>
                <b>{admin.keyword ? '没有匹配的角色' : '还没有角色'}</b>
                <p>
                  {admin.keyword
                    ? '换个关键字试试，或清空筛选。'
                    : '先建一个角色，再勾选它能访问的菜单与按钮。'}
                </p>
                {!admin.keyword ? (
                  <Can code="identity.role.manage">
                    <button className="btn primary sm" type="button" onClick={() => setForm({})}>
                      <Icon name="plus" size={12} />
                      新建角色
                    </button>
                  </Can>
                ) : null}
              </div>
            )}
          </section>

          <section className="panel perm-workbench">
            {selected ? (
              <RoleDetail
                role={selected}
                catalog={admin.catalog}
                catalogLoading={admin.catalogLoading}
                catalogError={admin.catalogError}
                onReloadCatalog={admin.reloadCatalog}
                onToggle={toggleRole}
                busy={busyCode === selected.roleCode}
                onEdit={() => setForm({ role: selected })}
              />
            ) : (
              <div className="empty" style={{ padding: '72px 22px' }}>
                <span className="empty-icon">
                  <Icon name="key" size={20} />
                </span>
                <b>选择左侧角色</b>
                <p>选中角色后可查看它已获得的菜单与按钮授权。</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'members' ? (
        <MemberAuthorization
          roles={admin.roles}
          catalog={admin.catalog}
          catalogLoading={admin.catalogLoading}
          catalogError={admin.catalogError}
          onReloadCatalog={admin.reloadCatalog}
          refreshTick={refreshTick}
          onCountChange={setMemberCount}
        />
      ) : null}

      {tab === 'catalog' ? (
        <PermissionCatalogPanel
          catalog={admin.catalog}
          loading={admin.catalogLoading}
          error={admin.catalogError}
          publishing={admin.publishing}
          onReload={admin.reloadCatalog}
          onPublish={admin.publishCatalog}
        />
      ) : null}

      {form ? (
        <RoleFormModal
          role={form.role}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setForm(null);
            const existed = admin.roles.some((item) => item.roleCode === saved.roleCode);
            if (existed) {
              admin.applyRole(saved);
            } else {
              admin.reloadRoles();
            }
            setSelected(saved);
          }}
        />
      ) : null}
    </div>
  );
}
