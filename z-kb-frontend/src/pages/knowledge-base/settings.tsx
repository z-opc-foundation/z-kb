import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import {
  archiveKnowledgeBase,
  getKnowledgeBase,
  KnowledgeBaseRecord,
  removeKnowledgeBase,
  restoreKnowledgeBase,
  updateKnowledgeBase,
} from '@/services/knowledgeBase';
import {
  getEffectiveAccess,
  KnowledgeBaseEffectiveRecord,
  roleLabel,
} from '@/services/member';
import { getTenantInfo } from '@/utils/tenant';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TaskConfigPanel from './task-config-panel';
import SourceConfigPanel from './source-config-panel';
import KbMemberPanel from './components/member-panel';
import { formatDateTime } from '@/utils/format';
import { TYPE_META } from './kb-meta';

type SettingsSection = 'basic' | 'access' | 'source' | 'task' | 'danger';

const SECTIONS: { key: SettingsSection; label: string; icon: string; hint: string }[] = [
  { key: 'basic', label: '基本信息', icon: 'settings', hint: '名称、描述与只读身份' },
  { key: 'access', label: '权限与版本', icon: 'shield-check', hint: '成员授权与内容版本' },
  { key: 'source', label: '接入源', icon: 'plug', hint: '文档平台、代码仓库与数据库' },
  { key: 'task', label: '任务配置', icon: 'workflow', hint: '库内覆盖租户默认与版本发布' },
  { key: 'danger', label: '危险区', icon: 'alert-triangle', hint: '归档、恢复与删除' },
];

export default function KnowledgeBaseSettingsPage() {
  const params = useParams<{ kbId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const kbId = params.kbId || '';
  const tenant = getTenantInfo();
  const [kb, setKb] = useState<KnowledgeBaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [section, setSection] = useState<SettingsSection>(() => {
    const raw = searchParams.get('section');
    return SECTIONS.some((item) => item.key === raw) ? (raw as SettingsSection) : 'basic';
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [effective, setEffective] = useState<KnowledgeBaseEffectiveRecord | null>(null);

  const load = useCallback(async () => {
    if (!kbId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    const result = await getKnowledgeBase(kbId);
    setLoading(false);
    if (!result) {
      setNotFound(true);
      setKb(null);
      return;
    }
    setNotFound(false);
    setKb(result);
    setName(result.name);
    setDescription(result.description || '');
    const access = await getEffectiveAccess(kbId);
    setEffective(access || null);
  }, [kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBasic = async () => {
    if (!kb) {
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast('保存失败', '知识库名称至少 2 个字符', 'warn');
      return;
    }
    setSaving(true);
    const result = await updateKnowledgeBase({
      kbId: kb.kbId,
      name: trimmedName,
      description: description.trim(),
    });
    setSaving(false);
    if (result === undefined) {
      return;
    }
    toast('已保存', '名称与描述已更新', 'success');
    void load();
  };

  const changeStatus = async (action: 'archive' | 'restore') => {
    if (!kb) {
      return;
    }
    setStatusBusy(true);
    const result =
      action === 'archive' ? await archiveKnowledgeBase(kb.kbId) : await restoreKnowledgeBase(kb.kbId);
    setStatusBusy(false);
    if (result === undefined) {
      return;
    }
    toast(action === 'archive' ? '已归档' : '已恢复', kb.name, 'success');
    void load();
  };

  const confirmDelete = async () => {
    if (!kb || deleteCode.trim() !== kb.code) {
      return;
    }
    setDeleting(true);
    const result = await removeKnowledgeBase(kb.kbId);
    setDeleting(false);
    if (result === undefined) {
      return;
    }
    toast('知识库已删除', kb.name, 'success');
    navigate('/knowledge-bases');
  };

  if (loading) {
    return (
      <div className="view">
        <div className="panel">
          <div className="panel-body">
            <span className="note">正在加载设置…</span>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !kb) {
    return (
      <div className="view">
        <div className="panel">
          <div className="panel-body">
            <b>无法打开设置</b>
            <p className="note">知识库不存在，或当前身份无权访问。</p>
            <button className="btn mt-16" type="button" onClick={() => navigate('/knowledge-bases')}>
              返回知识库列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  const typeMeta = TYPE_META[kb.type] || TYPE_META.FILE;

  return (
    <div className="view settings-view">
      <div className="settings-page">
        <nav className="settings-page-nav" aria-label="设置分区">
          <div className="settings-nav-kb">
            <button
              className="settings-nav-back"
              type="button"
              onClick={() => navigate(`/knowledge-bases/${kb.kbId}`)}
            >
              <Icon name="arrow-left" size={13} />
              返回知识库
            </button>
            <b className="settings-nav-title" title={kb.name}>
              {kb.name}
            </b>
          </div>
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`settings-nav-item ${section === item.key ? 'active' : ''}`}
              onClick={() => setSection(item.key)}
            >
              <span className="ic">
                <Icon name={item.icon} size={14} />
              </span>
              <span>
                <b>{item.label}</b>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-page-body">
          {section === 'basic' ? (
            <>
              <div className="panel mb-16">
                <div className="panel-head">
                  <h3>
                    <Icon name="settings" size={14} />
                    基本信息
                  </h3>
                  <span className="hint">保存后列表与库详情读取同一份数据</span>
                </div>
                <div className="panel-body">
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="kb-basic-name">
                        知识库名称 <span className="req">*</span>
                      </label>
                      <input
                        id="kb-basic-name"
                        className="input"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>编码</label>
                      <div className="readonly-value">{kb.code}</div>
                    </div>
                    <div className="field">
                      <label>类型</label>
                      <div className="readonly-value">
                        <Icon name={typeMeta.icon} size={12} /> {typeMeta.label}
                      </div>
                    </div>
                    <div className="field">
                      <label>嵌入模型</label>
                      <div className="readonly-value">{kb.embeddingModel || '—'}</div>
                    </div>
                    <div className="field span-2">
                      <label htmlFor="kb-basic-description">描述</label>
                      <textarea
                        id="kb-basic-description"
                        className="textarea"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="row between mt-16">
                    <span className="note">当前更新接口只接收名称与描述</span>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={saving || !kb.canManage}
                      onClick={() => void saveBasic()}
                    >
                      <Icon name="check" size={13} />
                      {saving ? '保存中…' : '保存基本信息'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>
                    <Icon name="globe" size={14} />
                    租户归属
                  </h3>
                  <span className="tag gray mono">{kb.tenantCode}</span>
                </div>
                <div className="panel-body">
                  <dl className="kv">
                    <dt>所属租户</dt>
                    <dd>
                      {tenant.name} · {tenant.code}
                    </dd>
                    <dt>负责人</dt>
                    <dd className="mono-sm">actorId {kb.ownerId}</dd>
                    <dt>创建时间</dt>
                    <dd>{formatDateTime(kb.createTime)}</dd>
                    <dt>最近更新</dt>
                    <dd>{formatDateTime(kb.updateTime)}</dd>
                  </dl>
                  <div className="callout mt-16">
                    <Icon name="lock" size={15} />
                    <div className="ct">
                      <b>知识库不跨租户迁移</b>
                      <p>租户来自登录上下文；这里的归属只读展示。</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {section === 'access' ? (
            <>
              <div className="panel mb-16">
                <div className="panel-head">
                  <h3>
                    <Icon name="users" size={14} />
                    成员与角色
                  </h3>
                  <div className="actions">
                    <span className="hint">我的角色：{roleLabel(effective?.role)}</span>
                    <span className={`tag ${kb.canManage ? 'green' : 'gray'}`}>
                      {kb.canManage ? '可管理' : '只读'}
                    </span>
                  </div>
                </div>
                <KbMemberPanel kbId={kb.kbId} canManage={!!kb.canManage} />
              </div>
              <div className="panel mb-16">
                <div className="panel-head">
                  <h3>
                    <Icon name="git-branch" size={14} />
                    版本管理
                  </h3>
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => navigate(`/knowledge-bases/${kb.kbId}/versions`)}
                  >
                    <Icon name="arrow-right" size={12} />
                    进入版本管理
                  </button>
                </div>
                <div className="panel-body">
                  <p className="note">内容配置版本时间线、草稿差异、影响分析与全量重建。</p>
                  <div className="callout mt-12">
                    <Icon name="info" size={15} />
                    <div className="ct">
                      <b>内容版本与任务配置分开维护</b>
                      <p>
                        内容配置版本在「版本管理」维护；任务配置默认取「运营管理 → 任务配置」的租户级版本，在本库「任务配置」分区发布后按库级版本生效。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3>
                    <Icon name="log-in" size={14} />
                    当前判定
                  </h3>
                  <span className="hint">前端显隐不是安全边界</span>
                </div>
                <div className="panel-body">
                  <dl className="kv">
                    <dt>canManage</dt>
                    <dd>{String(kb.canManage)}</dd>
                    <dt>当前角色</dt>
                    <dd>{roleLabel(effective?.role)}</dd>
                    <dt>创建者</dt>
                    <dd>{effective?.owner ? '是' : '否'}</dd>
                    <dt>可见范围</dt>
                    <dd>当前租户 + owner/ACL</dd>
                    <dt>租户</dt>
                    <dd className="mono-sm">{kb.tenantCode}</dd>
                  </dl>
                  <div className="mt-16">
                    <span className="note">服务端返回的有效动作</span>
                    <div className="row gap-6 mt-8" style={{ flexWrap: 'wrap' }}>
                      {(effective?.actions || []).map((action) => (
                        <span className="tag gray sm mono" key={action}>
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {section === 'source' ? (
            <div className="panel">
              <div className="panel-head">
                <h3>
                  <Icon name="plug" size={14} />
                  接入源
                </h3>
              </div>
              <div className="panel-body">
                <SourceConfigPanel kbId={kb.kbId} canManage={!!kb.canManage} />
              </div>
            </div>
          ) : null}

          {section === 'task' ? (
            <div className="panel">
              <div className="panel-head">
                <h3>
                  <Icon name="workflow" size={14} />
                  任务配置
                </h3>
                <span className="hint">库内未覆盖时继承租户默认 · 整版发布</span>
              </div>
              <div className="panel-body">
                <TaskConfigPanel kbId={kb.kbId} canManage={!!kb.canManage} />
              </div>
            </div>
          ) : null}

          {section === 'danger' ? (
            <div className="panel danger-zone">
              <div className="panel-head">
                <h3>
                  <Icon name="alert-triangle" size={14} />
                  危险区
                </h3>
                <span className="hint">归档是软状态；删除只在归档态可用</span>
              </div>
              <div className="panel-body">
                <div className="binding-row">
                  <span className="ic">
                    <Icon name={kb.status === 'ACTIVE' ? 'archive' : 'refresh'} size={15} />
                  </span>
                  <div className="copy">
                    <b>{kb.status === 'ACTIVE' ? '归档知识库' : '恢复知识库'}</b>
                    <small>
                      {kb.status === 'ACTIVE'
                        ? '停止写入与编译，保留读取，可随时恢复'
                        : '状态回到 ACTIVE，archivedAt 清空'}
                    </small>
                  </div>
                  <button
                    className="btn sm"
                    type="button"
                    disabled={statusBusy || !kb.canManage}
                    onClick={() => void changeStatus(kb.status === 'ACTIVE' ? 'archive' : 'restore')}
                  >
                    <Icon name={kb.status === 'ACTIVE' ? 'archive' : 'refresh'} size={12} />
                    {kb.status === 'ACTIVE' ? '归档' : '恢复'}
                  </button>
                </div>
                <div className="row between mt-20">
                  <div>
                    <b style={{ fontSize: 11.5 }}>删除知识库</b>
                    <p className="note" style={{ marginTop: 3 }}>
                      删除会清理库档案与成员权限，并改写编码；仅归档态可用。
                    </p>
                  </div>
                  <button
                    className="btn danger"
                    type="button"
                    disabled={!kb.canManage || kb.status !== 'ARCHIVED'}
                    onClick={() => {
                      setDeleteCode('');
                      setDeleteOpen(true);
                    }}
                  >
                    <Icon name="trash" size={13} />
                    删除知识库
                  </button>
                </div>
                {kb.status !== 'ARCHIVED' ? (
                  <div className="callout mt-16">
                    <Icon name="info" size={15} />
                    <div className="ct">
                      <b>运行中的库不能直接删除</b>
                      <p>先归档，再回到本区删除；这是后端的硬约束。</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {deleteOpen ? (
        <AppModal
          icon="trash"
          title={`删除知识库 · ${kb.name}`}
          sub="危险区 · 删除不可恢复"
          width={600}
          onClose={() => setDeleteOpen(false)}
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setDeleteOpen(false)}>
                取消
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={deleteCode.trim() !== kb.code || deleting}
                onClick={() => void confirmDelete()}
              >
                <Icon name="trash" size={12} />
                确认删除
              </button>
            </>
          }
          body={
            <div>
              <div className="callout danger">
                <Icon name="alert-triangle" size={15} />
                <div className="ct">
                  <b>删除后不可恢复</b>
                  <p>可以改名称，但编码不会回来；这是防误删的最后确认。</p>
                </div>
              </div>
              <div className="field mt-16">
                <label>输入编码 {kb.code} 以确认</label>
                <input
                  className="input mono"
                  value={deleteCode}
                  placeholder={kb.code}
                  autoComplete="off"
                  onChange={(event) => setDeleteCode(event.target.value)}
                />
              </div>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
