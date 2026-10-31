import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/icon';
import type { AuthRole, OrgMember, PermissionCatalogItem } from '@/services/identity';
import { useMembers } from './hooks/use-members';
import MemberDetail from './member-detail';

const PAGE_SIZE = 12;

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

/**
 * 成员授权：左侧是 Apex 全量成员（按机构），分页展示、内部滚动，
 * 右侧配置角色与直接授予的权限点。
 */
export default function MemberAuthorization({
  roles,
  catalog,
  catalogLoading,
  catalogError,
  onReloadCatalog,
  refreshTick,
  onCountChange,
}: {
  roles: AuthRole[];
  catalog: PermissionCatalogItem[];
  catalogLoading: boolean;
  catalogError: string;
  onReloadCatalog: () => void;
  refreshTick: number;
  onCountChange?: (count: number) => void;
}) {
  const { members, loading, error, keyword, setKeyword, reload } = useMembers(refreshTick);
  const [selected, setSelected] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PAGE_SIZE);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const pages = Math.max(1, Math.ceil(members.length / perPage));
  const current = Math.min(page, pages);
  const pageMembers = useMemo(
    () => members.slice((current - 1) * perPage, current * perPage),
    [members, current, perPage],
  );

  // 候选来自后端按姓名/工号模糊匹配的结果，展示前 8 条避免下拉过长
  const suggestions = useMemo(
    () => (keyword.trim() ? members.slice(0, 8) : []),
    [members, keyword],
  );

  const pickMember = (member: OrgMember) => {
    // 用工号（唯一）回填关键字，选中项稳定落在筛选结果里
    setKeyword(member.jobNumber || member.name || String(member.staffId));
    setSelected(member.staffId);
    setPage(1);
    setSuggestOpen(false);
  };

  useEffect(() => {
    if (!suggestOpen) {
      return;
    }
    const onDocMouseDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [suggestOpen]);

  // 每页行数按列表可视高度算，翻页即可看全，不用在页内再滚
  useEffect(() => {
    const body = listRef.current;
    if (!body) {
      return;
    }
    const measure = () => {
      const row = body.querySelector('tbody tr');
      const head = body.querySelector('thead');
      if (!row || body.clientHeight < 100) {
        return;
      }
      const rowHeight = row.getBoundingClientRect().height;
      const headHeight = head?.getBoundingClientRect().height ?? 0;
      if (rowHeight <= 0) {
        return;
      }
      const fit = Math.floor((body.clientHeight - headHeight) / rowHeight);
      setPerPage(Math.min(50, Math.max(5, fit)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [members.length, perPage]);

  useEffect(() => {
    onCountChange?.(members.length);
  }, [members.length, onCountChange]);

  // 搜索或翻页后右侧详情跟随当前页，避免选中一项却不在可见列表里
  const activeId =
    selected != null && pageMembers.some((member) => member.staffId === selected)
      ? selected
      : pageMembers[0]?.staffId ?? null;

  const roleNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of roles) {
      map.set(role.roleCode, role.roleName);
    }
    return map;
  }, [roles]);

  return (
    <div className="perm-grid">
      <section className="panel perm-roles">
        <div className="panel-head">
          <div>
            <h3>成员</h3>
            <div className="hint">Apex 人员主数据 · 共 {members.length} 人</div>
          </div>
          <button className="btn sm" type="button" onClick={reload}>
            {loading ? <span className="spinner" /> : <Icon name="refresh" size={12} />}
            刷新
          </button>
        </div>
        <div className="perm-search" ref={searchRef}>
          <div className="input-icon">
            <span className="ic">
              <Icon name="search" size={13} />
            </span>
            <input
              className="input"
              placeholder="按姓名或工号搜索"
              role="combobox"
              aria-expanded={suggestOpen && (loading || suggestions.length > 0)}
              aria-controls="perm-member-suggest"
              autoComplete="off"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
                setSuggestIndex(0);
                setSuggestOpen(!!event.target.value.trim());
              }}
              onFocus={() => {
                if (keyword.trim()) {
                  setSuggestOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (!suggestions.length) {
                  return;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setSuggestOpen(true);
                  setSuggestIndex((index) => Math.min(index + 1, suggestions.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setSuggestIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === 'Enter' && suggestOpen) {
                  event.preventDefault();
                  pickMember(suggestions[Math.min(suggestIndex, suggestions.length - 1)]);
                } else if (event.key === 'Escape') {
                  setSuggestOpen(false);
                }
              }}
            />
          </div>
          {suggestOpen && (loading || suggestions.length) ? (
            <div className="perm-suggest" role="listbox" id="perm-member-suggest">
              {loading ? (
                <div className="perm-suggest-loading" role="status">
                  <span className="spinner" />
                  正在匹配成员…
                </div>
              ) : (
                suggestions.map((member, index) => (
                  <button
                    key={member.staffId}
                    type="button"
                    role="option"
                    aria-selected={index === suggestIndex}
                    className={`perm-suggest-item ${index === suggestIndex ? 'active' : ''}`}
                    onMouseEnter={() => setSuggestIndex(index)}
                    onClick={() => pickMember(member)}
                  >
                    <span className="role-mark">{(member.name || '?').slice(0, 1)}</span>
                    <span className="perm-suggest-copy">
                      <b>{member.name || '未命名成员'}</b>
                      <span className="mono muted">
                        {member.jobNumber ? `工号 ${member.jobNumber}` : `#${member.staffId}`}
                      </span>
                    </span>
                    {member.roleCodes.length ? (
                      <span className="tag gray sm">已绑定</span>
                    ) : (
                      <span className="perm-suggest-note muted">未绑定</span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="callout danger" style={{ margin: '0 14px 12px' }}>
            <Icon name="alert-triangle" size={15} />
            <div className="ct">
              <b>成员加载失败</b>
              <p>{error}</p>
              <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={reload}>
                重试
              </button>
            </div>
          </div>
        ) : null}

        {loading && !members.length ? (
          <div className="perm-loading" role="status">
            <span className="spinner" />
            <span>正在读取成员…</span>
          </div>
        ) : members.length ? (
          <>
            <div className="table-wrap" ref={listRef}>
              <table className="list-table perm-role-table">
                <thead>
                  <tr>
                    <th>成员</th>
                    <th style={{ width: 140 }}>角色</th>
                  </tr>
                </thead>
                <tbody>
                  {pageMembers.map((member) => (
                    <tr
                      key={member.staffId}
                      className={member.staffId === activeId ? 'selected' : ''}
                      onClick={() => setSelected(member.staffId)}
                    >
                      <td>
                        <div className="name-cell">
                          <span className="role-mark">{(member.name || '?').slice(0, 1)}</span>
                          <div className="role-copy">
                            <b>{member.name || '未命名成员'}</b>
                            <span className="mono muted">
                              {member.jobNumber ? `工号 ${member.jobNumber}` : `#${member.staffId}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {member.roleCodes.length ? (
                          <span
                            className="perm-role-names"
                            title={member.roleCodes
                              .map((code) => roleNames.get(code) ?? code)
                              .join('、')}
                          >
                            {member.roleCodes
                              .map((code) => roleNames.get(code) ?? code)
                              .join('、')}
                          </span>
                        ) : (
                          <span className="muted">未绑定</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="perm-list-pager">
              <span className="note muted">
                共 {members.length} 人 · 第 {current} / {pages} 页
              </span>
              <div className="pagination">
                <button
                  type="button"
                  title="上一页"
                  aria-label="上一页"
                  disabled={current <= 1}
                  onClick={() => setPage(current - 1)}
                >
                  <Icon name="chevron-left" size={12} />
                </button>
                {pageItems(current, pages).map((item, index) =>
                  item === 'gap' ? (
                    <span key={`gap-${index}`} className="perm-page-gap">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={item === current ? 'active' : ''}
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
                  disabled={current >= pages}
                  onClick={() => setPage(current + 1)}
                >
                  <Icon name="chevron-right" size={12} />
                </button>
              </div>
            </div>
          </>
        ) : error ? null : (
          <div className="empty">
            <span className="empty-icon">
              <Icon name="users" size={20} />
            </span>
            <b>{keyword ? '没有匹配的成员' : '机构下还没有成员'}</b>
            <p>
              {keyword
                ? '换个姓名或工号试试。'
                : '成员来自 Apex 人员主数据，需先在 Apex 组织中心维护员工。'}
            </p>
          </div>
        )}
      </section>

      <section className="panel perm-workbench">
        {catalogLoading ? (
          <div className="perm-loading" role="status">
            <span className="spinner" />
            <span>正在读取权限目录…</span>
          </div>
        ) : catalogError ? (
          <div className="callout danger" style={{ margin: 16 }}>
            <Icon name="alert-triangle" size={15} />
            <div className="ct">
              <b>权限目录加载失败</b>
              <p>{catalogError}</p>
              <button
                className="btn sm"
                type="button"
                style={{ marginTop: 8 }}
                onClick={onReloadCatalog}
              >
                <Icon name="refresh" size={12} />
                重试
              </button>
            </div>
          </div>
        ) : activeId != null ? (
          <MemberDetail
            key={activeId}
            staffId={activeId}
            roles={roles}
            catalog={catalog}
            onSaved={reload}
          />
        ) : (
          <div className="empty" style={{ padding: '72px 22px' }}>
            <span className="empty-icon">
              <Icon name="users" size={20} />
            </span>
            <b>选择左侧成员</b>
            <p>选中成员后可绑定角色，也可单独授予游离的权限点。</p>
          </div>
        )}
      </section>
    </div>
  );
}
