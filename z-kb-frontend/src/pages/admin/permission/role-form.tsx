import { useState } from 'react';
import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import { saveRole, type AuthRole } from '@/services/identity';
import { toast } from '@/utils/toast';

/** 新建/编辑角色：角色归属当前登录机构，由 Apex 落库。 */
export default function RoleFormModal({
  role,
  onClose,
  onSaved,
}: {
  role?: AuthRole;
  onClose: () => void;
  onSaved: (role: AuthRole) => void;
}) {
  const editing = !!role?.id;
  const [roleCode, setRoleCode] = useState(role?.roleCode || '');
  const [roleName, setRoleName] = useState(role?.roleName || '');
  const [description, setDescription] = useState(role?.description || '');
  const [enabled, setEnabled] = useState(role?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const submit = async () => {
    const nextCode = roleCode.trim();
    const nextName = roleName.trim();
    if (!nextCode || !nextName) {
      setFormError('角色编码与名称必填');
      return;
    }
    if (!editing && !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(nextCode)) {
      setFormError('角色编码以字母开头，仅支持字母、数字、下划线、点与中划线');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const id = await saveRole({
        id: role?.id,
        roleCode: nextCode,
        roleName: nextName,
        description: description.trim() || undefined,
        enabled,
        type: role?.type,
      });
      toast(
        editing ? '角色已更新' : '角色已创建',
        `${nextName} · ${nextCode}`,
        'success',
      );
      onSaved({
        id,
        roleCode: nextCode,
        roleName: nextName,
        description: description.trim() || undefined,
        type: role?.type,
        enabled,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      icon="shield"
      title={editing ? `编辑角色 · ${role?.roleName || ''}` : '新建角色'}
      sub="角色写入 Apex 权限中心，绑定到当前登录机构；权限与员工在列表里继续配置。"
      width={620}
      onClose={onClose}
      body={
        <div className="form-grid">
          <div className="field">
            <label>
              角色编码<span className="req">*</span>
            </label>
            <input
              className="input mono"
              value={roleCode}
              disabled={editing}
              placeholder="如 kb_operator"
              onChange={(event) => setRoleCode(event.target.value)}
            />
            <span className="help">编码是授权与绑定的业务键，创建后不可修改</span>
          </div>
          <div className="field">
            <label>
              角色名称<span className="req">*</span>
            </label>
            <input
              className="input"
              value={roleName}
              placeholder="如 知识库运营"
              onChange={(event) => setRoleName(event.target.value)}
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>说明</label>
            <input
              className="input"
              value={description}
              placeholder="角色职责说明，便于审计"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="field">
            <label>状态</label>
            <div className="row">
              <button
                type="button"
                className={`switch ${enabled ? 'on' : ''}`}
                aria-pressed={enabled}
                onClick={() => setEnabled((value) => !value)}
              />
              <span className="muted">{enabled ? '启用' : '停用（保留授权，不生效）'}</span>
            </div>
          </div>
          {formError ? <div className="error" style={{ color: 'var(--red)' }}>{formError}</div> : null}
        </div>
      }
      footLeft="角色与授权都可以在 Apex 侧核对"
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
