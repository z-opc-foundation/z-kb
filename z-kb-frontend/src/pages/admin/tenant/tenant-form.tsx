import { useState } from 'react';
import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import { saveTenant, type TenantRecord } from '@/services/tenant';
import { toast } from '@/utils/toast';

const CODE_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** 新建 / 编辑租户：编码是请求头 X-Tenant-Code 的取值，创建后不可修改。 */
export default function TenantFormModal({
  tenant,
  onClose,
  onSaved,
}: {
  tenant?: TenantRecord;
  onClose: () => void;
  onSaved: (tenant: TenantRecord) => void;
}) {
  const editing = !!tenant;
  const [code, setCode] = useState(tenant?.code || '');
  const [name, setName] = useState(tenant?.name || '');
  const [description, setDescription] = useState(tenant?.description || '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async () => {
    const nextCode = code.trim();
    const nextName = name.trim();
    if (!editing && !nextCode) {
      setFormError('租户编码必填');
      return;
    }
    if (!editing && !CODE_PATTERN.test(nextCode)) {
      setFormError('编码仅支持字母、数字、下划线与中划线，最长 64 位');
      return;
    }
    if (!nextName) {
      setFormError('租户名称必填');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const id = await saveTenant({
        id: tenant?.id,
        code: editing ? undefined : nextCode,
        name: nextName,
        description: description.trim(),
      });
      const savedCode = editing ? tenant?.code || nextCode : nextCode;
      toast(editing ? '租户已更新' : '租户已创建', `${nextName} · ${savedCode}`, 'success');
      onSaved({
        id: id ?? tenant?.id ?? '',
        code: savedCode,
        name: nextName,
        status: tenant?.status || 'ACTIVE',
        description: description.trim(),
        createTime: tenant?.createTime,
        updateTime: tenant?.updateTime,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      icon="globe"
      title={editing ? `编辑租户 · ${tenant?.name || ''}` : '新建租户'}
      sub="租户编码作为请求标识，创建后不可修改。"
      width={620}
      onClose={onClose}
      body={
        <div className="form-grid">
          <div className="field">
            <label>
              租户编码<span className="req">*</span>
            </label>
            <input
              className="input mono"
              value={code}
              disabled={editing}
              placeholder="如 future_hospital"
              onChange={(event) => setCode(event.target.value)}
            />
            <span className="help">编码是请求头 X-Tenant-Code 的取值，创建后不可修改</span>
          </div>
          <div className="field">
            <label>
              租户名称<span className="req">*</span>
            </label>
            <input
              className="input"
              value={name}
              placeholder="如 未来医院"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>说明</label>
            <textarea
              className="textarea"
              value={description}
              maxLength={500}
              placeholder="租户用途或对接说明，最长 500 字"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {formError ? <div className="error" style={{ color: 'var(--red)' }}>{formError}</div> : null}
        </div>
      }
      footLeft={editing ? '编码与主键不可修改，状态在列表里切换' : '新建租户默认为启用状态'}
      footRight={
        <>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" type="button" disabled={saving} onClick={submit}>
            <Icon name="check" size={13} />
            {saving ? '保存中…' : '保存'}
          </button>
        </>
      }
    />
  );
}
