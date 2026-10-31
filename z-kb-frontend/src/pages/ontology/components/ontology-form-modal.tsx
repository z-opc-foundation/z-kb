import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import type { OntologyDetail } from '@/services/ontology';
import { useState } from 'react';

interface OntologyFormModalProps {
  mode: 'create' | 'update';
  ontology?: OntologyDetail | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; description?: string }) => void;
}

export function OntologyFormModal({
  mode,
  ontology,
  saving,
  onClose,
  onSubmit,
}: OntologyFormModalProps) {
  const [name, setName] = useState(ontology?.name || '');
  const [description, setDescription] = useState(ontology?.description || '');
  const [formError, setFormError] = useState('');

  const submit = () => {
    const nextName = name.trim();
    if (!nextName) {
      setFormError('本体名称必填');
      return;
    }
    onSubmit({
      name: nextName,
      description: description.trim() || undefined,
    });
  };

  return (
    <AppModal
      icon="git-branch"
      title={mode === 'create' ? '开通本体' : '本体设置'}
      sub={
        mode === 'create'
          ? '一租户一本体；开通后即可查看 Schema 图谱与类型清单'
          : '可修改名称与说明；编码与图空间不可修改'
      }
      width={560}
      onClose={onClose}
      body={
        <div className="form-grid">
          <div className="field">
            <label>
              名称<span className="req">*</span>
            </label>
            <input
              className="input"
              value={name}
              maxLength={255}
              placeholder="如 临床医学本体"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <label>说明</label>
            <textarea
              className="textarea"
              rows={3}
              maxLength={500}
              value={description}
              placeholder="一句话说明本体的适用领域与场景"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {formError ? <div className="field span-2 error">{formError}</div> : null}
        </div>
      }
      footLeft="tasks01 阶段不提供声明表写入，类型建模在后续任务开放"
      footRight={
        <>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={saving}
            onClick={submit}
          >
            {saving ? <span className="spinner" /> : <Icon name="check" size={13} />}
            {mode === 'create' ? '开通' : '保存'}
          </button>
        </>
      }
    />
  );
}
