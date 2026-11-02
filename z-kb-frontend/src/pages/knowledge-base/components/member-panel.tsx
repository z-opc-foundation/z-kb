import Icon from '@/components/icon';
import {
  getEffectiveAccess,
  grantMember,
  KnowledgeBaseEffectiveRecord,
  KnowledgeBaseMemberCandidateRecord,
  KnowledgeBaseMemberRecord,
  listMembers,
  revokeMember,
  ROLE_META,
  ROLE_ORDER,
  roleLabel,
  searchMemberCandidates,
} from '@/services/member';
import { formatDateTime } from '@/utils/format';
import { toast } from '@/utils/toast';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

interface KbMemberPanelProps {
  kbId: string;
  canManage: boolean;
}

function avatarClass(role: string): string {
  if (role === 'KB_ADMIN') {
    return 'violet';
  }
  if (role === 'EDITOR') {
    return 'green';
  }
  if (role === 'REVIEWER') {
    return 'amber';
  }
  return 'gray';
}

function displayName(member: { name?: string; principalId: number }): string {
  return member.name || `主体 #${member.principalId}`;
}

export default function KbMemberPanel({ kbId, canManage }: KbMemberPanelProps) {
  const [members, setMembers] = useState<KnowledgeBaseMemberRecord[]>([]);
  const [effective, setEffective] = useState<KnowledgeBaseEffectiveRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<KnowledgeBaseMemberCandidateRecord[]>([]);
  const [candidateKeyword, setCandidateKeyword] = useState('');
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [candidateRole, setCandidateRole] = useState('READER');
  const [candidateBusy, setCandidateBusy] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<KnowledgeBaseMemberRecord | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const access = await getEffectiveAccess(kbId);
      if (!alive) {
        return;
      }
      setEffective(access || null);
      if (canManage) {
        const list = await listMembers(kbId);
        if (!alive) {
          return;
        }
        setMembers(list || []);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [kbId, canManage]);

  const reload = useCallback(async () => {
    const list = await listMembers(kbId);
    setMembers(list || []);
  }, [kbId]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return members.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const text = `${displayName(member)} ${member.employeeId || ''} ${member.dept || ''} ${
        member.principalId
      }`.toLowerCase();
      return text.includes(keyword);
    });
  }, [members, search, roleFilter]);

  const openAdd = async () => {
    setCandidateId(null);
    setCandidateKeyword('');
    setCandidateRole('READER');
    setAddOpen(true);
    setCandidateBusy(true);
    const list = await searchMemberCandidates(kbId, '');
    setCandidates(list || []);
    setCandidateBusy(false);
  };

  const runCandidateSearch = async () => {
    setCandidateBusy(true);
    const list = await searchMemberCandidates(kbId, candidateKeyword.trim());
    setCandidates(list || []);
    setCandidateId(null);
    setCandidateBusy(false);
  };

  const submitAdd = async () => {
    if (!candidateId) {
      toast('请选择成员', '先从候选中选一名主体，再确认添加', 'warn');
      return;
    }
    setBusy(true);
    const result = await grantMember(kbId, candidateId, candidateRole);
    setBusy(false);
    if (result === undefined) {
      return;
    }
    toast('成员已加入', `${displayName(result)} · ${roleLabel(result.role)}`, 'success');
    setAddOpen(false);
    await reload();
  };

  const changeRole = async (member: KnowledgeBaseMemberRecord, role: string) => {
    if (member.role === role) {
      return;
    }
    setBusy(true);
    const result = await grantMember(kbId, member.principalId, role);
    setBusy(false);
    if (result === undefined) {
      await reload();
      return;
    }
    toast('角色已更新', `${displayName(member)} · ${roleLabel(role)}`, 'success');
    await reload();
  };

  const confirmRemove = async () => {
    if (!removeTarget) {
      return;
    }
    setBusy(true);
    const result = await revokeMember(kbId, removeTarget.principalId);
    setBusy(false);
    if (result === undefined) {
      return;
    }
    toast('已移除成员', `${displayName(removeTarget)} 的授权立即失效`, 'success');
    setRemoveTarget(null);
    setDetailId(null);
    await reload();
  };

  if (!canManage) {
    return (
      <div className="callout warn">
        <Icon name="lock" size={15} />
        <div className="ct">
          <b>当前角色无权查看成员</b>
          <p>
            你当前的角色为 {roleLabel(effective?.role)}；成员列表、授权与撤销只对创建者与知识库管理员开放。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-member-panel">
      <div className="table-toolbar">
        <div className="left">
          <div className="input-icon">
            <Icon name="search" size={13} />
            <input
              className="input"
              placeholder="搜索姓名、工号或部门"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="select"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="all">全部角色</option>
            {ROLE_ORDER.map((role) => (
              <option key={role} value={role}>
                {ROLE_META[role].label}
              </option>
            ))}
          </select>
        </div>
        <div className="right">
          <span className="note">
            {filtered.length} / {members.length} 名成员
          </span>
          <button
            className="btn xs ghost"
            type="button"
            onClick={() => void reload()}
          >
            <Icon name="refresh" size={11} />
            刷新
          </button>
          <button className="btn sm primary" type="button" onClick={() => void openAdd()}>
            <Icon name="plus" size={12} />
            添加成员
          </button>
        </div>
      </div>

      {addOpen ? (
        <div className="member-add">
          <div className="row gap-6 member-add-bar">
            <div className="input-icon">
              <Icon name="search" size={13} />
              <input
                className="input"
                placeholder="搜索姓名、工号或部门"
                value={candidateKeyword}
                onChange={(event) => setCandidateKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void runCandidateSearch();
                  }
                }}
              />
            </div>
            <button
              className="btn sm"
              type="button"
              disabled={candidateBusy}
              onClick={() => void runCandidateSearch()}
            >
              <Icon name="search" size={12} />
              搜索
            </button>
            <select
              className="select member-role-select"
              value={candidateRole}
              aria-label="新成员角色"
              onChange={(event) => setCandidateRole(event.target.value)}
            >
              {ROLE_ORDER.map((role) => (
                <option key={role} value={role}>
                  {ROLE_META[role].label}
                </option>
              ))}
            </select>
            <button
              className="btn sm primary"
              type="button"
              disabled={!candidateId || busy}
              onClick={() => void submitAdd()}
            >
              <Icon name="check" size={12} />
              确认添加
            </button>
            <button className="btn sm ghost" type="button" onClick={() => setAddOpen(false)}>
              取消
            </button>
          </div>
          <div className="candidate-list mt-8">
            {candidateBusy ? (
              <span className="note">正在检索候选主体…</span>
            ) : candidates.length ? (
              candidates.map((candidate) => (
                <button
                  key={candidate.principalId}
                  type="button"
                  className={`candidate-row ${candidateId === candidate.principalId ? 'active' : ''}`}
                  onClick={() => setCandidateId(candidate.principalId)}
                >
                  <span className="avatar sm gray">{(candidate.name || '?').slice(0, 1)}</span>
                  <span className="cc">
                    <b>{candidate.name || `主体 #${candidate.principalId}`}</b>
                    <small>
                      {candidate.employeeId || '—'} · {candidate.dept || '—'}
                    </small>
                  </span>
                  {candidateId === candidate.principalId ? (
                    <span className="tag blue sm">已选择</span>
                  ) : null}
                </button>
              ))
            ) : (
              <span className="note">没有可添加的候选；候选池已全部加入本库。</span>
            )}
          </div>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="callout danger member-remove">
          <Icon name="alert-triangle" size={15} />
          <div className="ct">
            <b>移除成员 · {displayName(removeTarget)}？</b>
            <p>
              当前角色 {roleLabel(removeTarget.role)}；移除后其入口、检索与写入权限立即失效，历史产物与任务不回溯。
            </p>
          </div>
          <div className="row gap-6">
            <button className="btn xs" type="button" onClick={() => setRemoveTarget(null)}>
              取消
            </button>
            <button
              className="btn xs danger"
              type="button"
              disabled={busy}
              onClick={() => void confirmRemove()}
            >
              确认移除
            </button>
          </div>
        </div>
      ) : null}

      <div className="table-wrap member-table-wrap">
        <table className="list-table member-table">
          <thead>
            <tr>
              <th>成员</th>
              <th>工号</th>
              <th>部门</th>
              <th>角色</th>
              <th>状态</th>
              <th>加入时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <span className="note">正在加载成员…</span>
                </td>
              </tr>
            ) : filtered.length ? (
              filtered.map((member) => (
                <Fragment key={member.principalId}>
                  <tr>
                    <td>
                      <div className="name-cell">
                        <span className={`avatar sm ${avatarClass(member.role)}`}>
                          {(displayName(member) || '?').slice(0, 1)}
                        </span>
                        <div className="nc">
                          <b>
                            {displayName(member)}
                            {member.owner ? <span className="tag blue sm"> 创建者</span> : null}
                          </b>
                          <small>{roleLabel(member.role)}</small>
                        </div>
                      </div>
                    </td>
                    <td className="mono-sm">{member.employeeId || '—'}</td>
                    <td>{member.dept || '—'}</td>
                    <td>
                      <select
                        className="select role-select"
                        value={String(member.role)}
                        disabled={member.owner || busy}
                        aria-label={`${displayName(member)} 的角色`}
                        onChange={(event) => void changeRole(member, event.target.value)}
                      >
                        {ROLE_ORDER.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_META[role].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="tag green sm">正常</span>
                    </td>
                    <td className="mono-sm">{formatDateTime(member.grantedAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          type="button"
                          title="成员详情"
                          onClick={() =>
                            setDetailId(detailId === member.principalId ? null : member.principalId)
                          }
                        >
                          <Icon name="eye" size={13} />
                        </button>
                        <button
                          className="icon-btn"
                          type="button"
                          disabled={member.owner || busy}
                          title={member.owner ? '创建者受保护' : '移除成员'}
                          onClick={() => setRemoveTarget(member)}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {detailId === member.principalId ? (
                    <tr className="member-detail-row">
                      <td colSpan={7}>
                        <dl className="kv">
                          <dt>主体 ID</dt>
                          <dd className="mono-sm">
                            {member.principalId} · {member.principalType}
                          </dd>
                          <dt>授权时间</dt>
                          <dd>{formatDateTime(member.grantedAt)}</dd>
                          <dt>授权人</dt>
                          <dd className="mono-sm">actorId {member.grantedBy ?? '—'}</dd>
                          <dt>过期时间</dt>
                          <dd>{member.expiresAt ? formatDateTime(member.expiresAt) : '长期有效'}</dd>
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <b>没有匹配的成员</b>
                    <p className="note">清空关键词或角色筛选。</p>
                    <button
                      className="btn sm mt-12"
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setRoleFilter('all');
                      }}
                    >
                      清空筛选
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="member-panel-foot">
        <span>创建者不能移除或降级；变更立即影响其入口与检索范围。</span>
        <span className="note">成员 {members.length} 名</span>
      </div>
    </div>
  );
}
