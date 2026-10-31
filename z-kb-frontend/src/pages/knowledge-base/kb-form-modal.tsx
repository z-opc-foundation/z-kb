import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import {
  createKnowledgeBase,
  KnowledgeBaseRecord,
  KnowledgeBaseType,
  updateKnowledgeBase,
} from '@/services/knowledgeBase';
import { getActorId, getTenantInfo } from '@/utils/tenant';
import { toast } from '@/utils/toast';
import { queryCurrentUser } from '@/services/sso';
import { useEffect, useState } from 'react';
import { TYPE_META } from './kb-meta';

/** 编码只做稳定标识，默认给三个自动生成的候选，创建后不可改 */
function buildCodeOptions(): string[] {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const suffix = () => Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, 'x');
  return [`kb_${stamp}_${suffix()}`, `kb_${stamp}_${suffix()}`, `kb_${stamp}_${suffix()}`];
}

interface KbFormModalProps {
  mode: 'create' | 'edit';
  kb?: KnowledgeBaseRecord;
  onClose: () => void;
  onSaved: () => void;
}

function KbFormModal({ mode, kb, onClose, onSaved }: KbFormModalProps) {
  const tenant = getTenantInfo();
  const [name, setName] = useState(kb ? kb.name : '');
  const [codeOptions] = useState<string[]>(() =>
    mode === 'create' ? buildCodeOptions() : [],
  );
  const [code, setCode] = useState(kb ? kb.code : codeOptions[0] || '');
  const [ownerName, setOwnerName] = useState('');
  const [type, setType] = useState<KnowledgeBaseType>(kb ? kb.type : 'FILE');
  const [embeddingModel, setEmbeddingModel] = useState(
    kb ? kb.embeddingModel || '' : '',
  );
  const [description, setDescription] = useState(
    kb ? kb.description || '' : '',
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== 'create') {
      return;
    }
    let alive = true;
    void queryCurrentUser()
      .then((user) => {
        if (alive && user?.name) {
          setOwnerName(user.name);
        }
      })
      .catch(() => {
        // 取不到登录用户时退回本地账号展示，不阻断创建
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (trimmedName.length < 2) {
      setError('知识库名称至少 2 个字符');
      return;
    }
    if (mode === 'create' && !/^[a-zA-Z0-9_-]{1,64}$/.test(trimmedCode)) {
      setError('编码只能使用字母、数字、下划线或中划线，最多 64 位');
      return;
    }
    setError('');
    setSubmitting(true);
    const result =
      mode === 'create'
        ? await createKnowledgeBase({
            name: trimmedName,
            code: trimmedCode,
            type,
            description: description.trim(),
            embeddingModel: embeddingModel.trim() || undefined,
          })
        : await updateKnowledgeBase({
            kbId: kb!.kbId,
            name: trimmedName,
            description: description.trim(),
          });
    setSubmitting(false);
    if (result === undefined) {
      return;
    }
    toast(
      mode === 'create' ? '知识库已创建' : '基本信息已保存',
      trimmedName,
      'success',
    );
    onSaved();
  };

  return (
    <AppModal
      icon={mode === 'create' ? 'plus' : 'edit'}
      title={
        mode === 'create' ? '新建知识库' : `编辑知识库 · ${kb?.name || ''}`
      }
      width={720}
      onClose={onClose}
      footRight={
        <>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={submitting}
            onClick={submit}
          >
            <Icon name="check" size={13} />
            {mode === 'create' ? '创建知识库' : '保存修改'}
          </button>
        </>
      }
      body={
        <div>
          <div className="form-grid">
            <div className="field">
              <label>
                知识库名称 <span className="req">*</span>
              </label>
              <input
                className="input"
                value={name}
                placeholder="例如：心内科诊疗知识库"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label>
                编码 {mode === 'create' ? <span className="req">*</span> : null}
              </label>
              {mode === 'create' ? (
                <select
                  className="select mono"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                >
                  {codeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="readonly-value">{kb?.code}</div>
              )}
              <span className="help">
                自动生成，创建后不可修改；MD 导入使用 kbCode。
              </span>
            </div>
            <div className="field">
              <label>
                知识库类型 <span className="req">*</span>
              </label>
              {mode === 'create' ? (
                <select
                  className="select"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as KnowledgeBaseType)
                  }
                >
                  {(Object.keys(TYPE_META) as KnowledgeBaseType[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {TYPE_META[key].label}
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <div className="readonly-value">
                  {TYPE_META[kb?.type || 'FILE'].label}
                </div>
              )}
              <span className="help">
                类型决定资料的组织方式：文件库按文件平铺、混合库用条目树组织任意类型资料。任何库都能在本库设置里绑定多条接入源（文档平台 / 代码仓库 / 数据库），文件库与混合库默认也走本地上传。
              </span>
            </div>
            <div className="field">
              <label>嵌入模型</label>
              {mode === 'create' ? (
                <input
                  className="input mono"
                  value={embeddingModel}
                  placeholder="留空使用服务端默认"
                  onChange={(event) => setEmbeddingModel(event.target.value)}
                />
              ) : (
                <div className="readonly-value">
                  {kb?.embeddingModel || '—'}
                </div>
              )}
              <span className="help">
                {mode === 'create'
                  ? '留空使用服务端默认；创建后不可修改。'
                  : '创建后不可修改。'}
              </span>
            </div>
            <div className="field">
              <label>所属租户</label>
              <div className="readonly-value">
                {tenant.name} · {tenant.code}
              </div>
              <span className="help">
                租户来自登录上下文；知识库不跨租户迁移。
              </span>
            </div>
            <div className="field">
              <label>负责人</label>
              <div className="readonly-value">
                {mode === 'create'
                  ? ownerName || `本地账号 actorId ${getActorId()}`
                  : `actorId ${kb?.ownerId}`}
              </div>
              <span className="help">
                {mode === 'create'
                  ? '取自当前登录人；创建后可在权限与版本里调整成员角色。'
                  : '负责人为创建时的登录人，只读展示。'}
              </span>
            </div>
            <div className="field span-2">
              <label>描述</label>
              <textarea
                className="textarea"
                value={description}
                placeholder="说明这个库服务什么场景"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          {error ? (
            <div
              className="note"
              style={{ color: 'var(--red)', marginTop: 10 }}
            >
              {error}
            </div>
          ) : null}
        </div>
      }
    />
  );
}

export default KbFormModal;
