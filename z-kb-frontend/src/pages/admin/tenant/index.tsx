import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Icon from '@/components/icon';
import { Can } from '@/components/auth';
import { confirmAction } from '@/components/confirm';
import {
  changeTenantStatus,
  deleteTenant,
  listTenants,
  type TenantRecord,
  type TenantStatus,
} from '@/services/tenant';
import { formatDateTime } from '@/utils/format';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';
import TenantFormModal from './tenant-form';
import './tenant.less';

const PAGE_SIZE = 10;

type StatusFilter = 'ALL' | TenantStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部状态' },
  { value: 'ACTIVE', label: '启用' },
  { value: 'DISABLED', label: '停用' },
];

function pageItems(current: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  const items: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(pages - 1, current + 1);
  if (start > 2) {
    items.push('gap');
  }
  for (let value = start; value <= end; value += 1) {
    items.push(value);
  }
  if (end < pages - 1) {
    items.push('gap');
  }
  items.push(pages);
  return items;
}

/** 全局管理 · 租户管理：租户主数据读写 sys_tenant，与请求入口的租户校验同源。 */
export default function TenantAdminPage() {
  const [records, setRecords] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ tenant?: TenantRecord } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentCode = getTenantCode();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRecords(await listTenants());
    } catch (err) {
      setError(err instanceof Error ? err.message : '租户列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter]);

  const activeCount = useMemo(
    () => records.filter((item) => item.status === 'ACTIVE').length,
    [records],
  );

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return records.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query)
      );
    });
  }, [records, keyword, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filteredActive = keyword.trim() !== '' || statusFilter !== 'ALL';

  const toggleStatus = async (tenant: TenantRecord) => {
    const next: TenantStatus = tenant.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (next === 'DISABLED') {
      const ok = await confirmAction({
        title: `停用租户「${tenant.name}」？`,
        sub: '停用后该租户的请求会被入口租户校验拒绝，直到重新启用。',
        confirmText: '停用',
      });
      if (!ok) {
        return;
      }
    }
    setBusyId(tenant.id);
    try {
      await changeTenantStatus(tenant.id, next);
      toast(next === 'ACTIVE' ? '租户已启用' : '租户已停用', tenant.name, 'success');
      await load();
    } catch (err) {
      toast(
        '状态切换失败',
        err instanceof Error ? err.message : '请稍后重试',
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  const removeTenant = async (tenant: TenantRecord) => {
    const ok = await confirmAction({
      title: `删除租户「${tenant.name}」？`,
      sub: '删除后该租户的请求会立即被拒绝；编码可以重新创建。',
      confirmText: '删除',
    });
    if (!ok) {
      return;
    }
    setBusyId(tenant.id);
    try {
      await deleteTenant(tenant.id);
      toast('租户已删除', tenant.name, 'success');
      await load();
    } catch (err) {
      toast('删除失败', err instanceof Error ? err.message : '请稍后重试', 'error');
    } finally {
      setBusyId(null);
    }
  };

  let body: ReactNode;
  if (loading && !records.length) {
    body = (
      <div className="empty">
        <span className="empty-icon">
          <span className="spinner" />
        </span>
        <b>正在读取租户列表…</b>
        <p>停用或删除后，该租户的请求会被入口校验拒绝。</p>
      </div>
    );
  } else if (error) {
    body = (
      <div className="callout danger" style={{ margin: 16 }}>
        <Icon name="alert-triangle" size={15} />
        <div className="ct">
          <b>租户列表加载失败</b>
          <p>{error}</p>
          <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={() => void load()}>
            <Icon name="refresh" size={12} />
            重试
          </button>
        </div>
      </div>
    );
  } else if (!rows.length) {
    body = (
      <div className="empty">
        <span className="empty-icon">
          <Icon name={filteredActive ? 'search-x' : 'globe'} size={20} />
        </span>
        <b>{filteredActive ? '没有匹配的租户' : '还没有租户'}</b>
        <p>
          {filteredActive
            ? '换个关键字或状态再试。'
            : '先建一个租户，业务请求会按它的编码识别租户。'}
        </p>
        {filteredActive ? (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setKeyword('');
              setStatusFilter('ALL');
            }}
          >
            清空筛选
          </button>
        ) : (
          <Can code="tenant.manage">
            <button className="btn primary sm" type="button" onClick={() => setForm({})}>
              <Icon name="plus" size={12} />
              新建租户
            </button>
          </Can>
        )}
      </div>
    );
  } else {
    body = (
      <div className="table-wrap">
        <table className="list-table tenant-table">
          <thead>
            <tr>
              <th>租户</th>
              <th style={{ width: 150 }}>状态</th>
              <th>说明</th>
              <th style={{ width: 150 }}>创建时间</th>
              <th style={{ width: 116 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tenant) => {
              const isCurrent = tenant.code === currentCode;
              const busy = busyId === tenant.id;
              const active = tenant.status === 'ACTIVE';
              return (
                <tr key={tenant.id}>
                  <td>
                    <div className="name-cell">
                      <span className="tenant-mark">{tenant.name.slice(0, 1)}</span>
                      <div className="nc">
                        <b>
                          {tenant.name}
                          {isCurrent ? <span className="tag sm blue tenant-current">当前</span> : null}
                        </b>
                        <small className="mono">{tenant.code}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="tenant-status-cell">
                      <Can
                        code="tenant.manage"
                        fallback={
                          <span className={`tag sm ${active ? 'green' : 'gray'}`}>
                            {active ? '启用' : '停用'}
                          </span>
                        }
                      >
                        <button
                          className={`switch ${active ? 'on' : ''}`}
                          type="button"
                          role="switch"
                          aria-checked={active}
                          aria-label={active ? '停用租户' : '启用租户'}
                          disabled={isCurrent || busy}
                          title={isCurrent ? '当前租户不能停用' : undefined}
                          onClick={() => void toggleStatus(tenant)}
                        />
                      </Can>
                      <span className={active ? 'tenant-state on' : 'tenant-state'}>
                        {busy ? '处理中…' : active ? '启用' : '停用'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="tenant-desc" title={tenant.description || undefined}>
                      {tenant.description || '—'}
                    </span>
                  </td>
                  <td className="mono-sm">{formatDateTime(tenant.createTime)}</td>
                  <td>
                    <div className="row-actions">
                      <Can code="tenant.manage">
                        <button
                          className="btn xs"
                          type="button"
                          onClick={() => setForm({ tenant })}
                        >
                          编辑
                        </button>
                        <button
                          className="btn xs danger"
                          type="button"
                          disabled={isCurrent || busy}
                          title={isCurrent ? '当前租户不能删除' : undefined}
                          onClick={() => void removeTenant(tenant)}
                        >
                          删除
                        </button>
                      </Can>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="view tenant-admin">
      <section className="panel tenant-panel">
        <div className="panel-head">
          <div>
            <h3>
              <Icon name="globe" size={14} />
              租户
            </h3>
            <div className="hint">
              共 {records.length} 个 · 启用 {activeCount}
              {loading ? ' · 刷新中…' : ''}
            </div>
          </div>
          <div className="actions">
            <button className="btn sm ghost" type="button" onClick={() => void load()} disabled={loading}>
              {loading ? <span className="spinner" /> : <Icon name="refresh" size={12} />}
              刷新
            </button>
            <Can code="tenant.manage">
              <button className="btn sm primary" type="button" onClick={() => setForm({})}>
                <Icon name="plus" size={12} />
                新建租户
              </button>
            </Can>
          </div>
        </div>

        <div className="tenant-toolbar">
          <div className="input-icon">
            <Icon name="search" size={13} />
            <input
              className="input"
              placeholder="搜索租户名称或编码"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div className="segmented sm">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={statusFilter === option.value ? 'active' : ''}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="spacer" />
          {filteredActive ? (
            <button
              className="btn sm ghost"
              type="button"
              onClick={() => {
                setKeyword('');
                setStatusFilter('ALL');
              }}
            >
              清空筛选
            </button>
          ) : null}
        </div>

        <div className="tenant-body">{body}</div>

        <div className="tenant-pager">
          <span className="note">
            共 {filtered.length} 个租户 · 第 {currentPage} / {pages} 页 · 每页 {PAGE_SIZE} 个
          </span>
          <div className="pagination">
            <button
              type="button"
              title="上一页"
              aria-label="上一页"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <Icon name="chevron-left" size={12} />
            </button>
            {pageItems(currentPage, pages).map((item, index) =>
              item === 'gap' ? (
                <span key={`gap-${index}`} className="tenant-page-gap">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={item === currentPage ? 'active' : ''}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              title="下一页"
              aria-label="下一页"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <Icon name="chevron-right" size={12} />
            </button>
          </div>
        </div>
      </section>

      {form ? (
        <TenantFormModal
          tenant={form.tenant}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
