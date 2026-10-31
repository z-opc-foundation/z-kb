import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import type {
  OntologyTagCategory,
  OntologyTagCategorySavePayload,
  OntologyTagCategoryUpdatePayload,
} from '@/services/ontology';
import { useState } from 'react';
import { formatCount } from './shared';

interface CategoryManageModalProps {
  categories: OntologyTagCategory[];
  mutating: boolean;
  onCreate: (data: OntologyTagCategorySavePayload) => Promise<boolean>;
  onUpdate: (data: OntologyTagCategoryUpdatePayload) => Promise<boolean>;
  onRemove: (code: string) => Promise<boolean>;
  onReorder: (orderedCodes: string[]) => Promise<boolean>;
  onClose: () => void;
}

/**
 * 对象类型分组管理弹窗：新建 / 改名 / 上移下移 / 删除（级联解绑归「未分类」）。
 * 分组只影响浏览分组，不触碰结构声明。
 */
export function CategoryManageModal({
  categories,
  mutating,
  onCreate,
  onUpdate,
  onRemove,
  onReorder,
  onClose,
}: CategoryManageModalProps) {
  const [newName, setNewName] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmingCode, setConfirmingCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError('分组名称必填');
      return;
    }
    const saved = await onCreate({ categoryName: name });
    if (saved) {
      setNewName('');
      setError('');
    }
  };

  const submitRename = async () => {
    if (!editingCode) {
      return;
    }
    const name = editName.trim();
    if (!name) {
      setError('分组名称必填');
      return;
    }
    const saved = await onUpdate({ code: editingCode, categoryName: name });
    if (saved) {
      setEditingCode(null);
      setError('');
    }
  };

  const move = async (code: string, offset: -1 | 1) => {
    const codes = categories.map((c) => c.code);
    const index = codes.indexOf(code);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= codes.length) {
      return;
    }
    [codes[index], codes[target]] = [codes[target], codes[index]];
    await onReorder(codes);
  };

  return (
    <AppModal
      icon="tag"
      title="分组管理"
      sub="对象类型的浏览分组；删除分组后其下类型自动归入「未分类」"
      width={520}
      onClose={onClose}
      body={
        <div className="ont-cat-manage">
          <div className="ont-cat-create">
            <input
              className="input"
              value={newName}
              maxLength={64}
              placeholder="新分组名称"
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void submitCreate();
                }
              }}
            />
            <button
              className="btn primary xs"
              type="button"
              disabled={mutating}
              onClick={() => void submitCreate()}
            >
              <Icon name="plus" size={12} />
              添加
            </button>
          </div>
          {error ? <div className="ont-cat-error">{error}</div> : null}
          {!categories.length ? (
            <div className="ont-detail-state">暂无分组；对象类型未分组时归入「未分类」。</div>
          ) : (
            <div className="ont-cat-list">
              {categories.map((category, index) => (
                <div key={category.code} className="ont-cat-row">
                  {editingCode === category.code ? (
                    <>
                      <input
                        className="input xs"
                        value={editName}
                        maxLength={64}
                        autoFocus
                        onChange={(event) => setEditName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            void submitRename();
                          }
                          if (event.key === 'Escape') {
                            setEditingCode(null);
                          }
                        }}
                      />
                      <button
                        className="btn xs primary"
                        type="button"
                        disabled={mutating}
                        onClick={() => void submitRename()}
                      >
                        保存
                      </button>
                      <button
                        className="btn xs ghost"
                        type="button"
                        onClick={() => setEditingCode(null)}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="ont-cat-name">{category.categoryName}</span>
                      <span className="ont-cat-count">{formatCount(category.tagCount)} 个类型</span>
                      <span className="ont-cat-actions">
                        {confirmingCode === category.code ? (
                          <>
                            <button
                              className="btn xs danger"
                              type="button"
                              disabled={mutating}
                              onClick={async () => {
                                const removed = await onRemove(category.code);
                                if (removed) {
                                  setConfirmingCode(null);
                                }
                              }}
                            >
                              确认删除
                            </button>
                            <button
                              className="btn xs ghost"
                              type="button"
                              onClick={() => setConfirmingCode(null)}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn xs ghost"
                              type="button"
                              title="上移"
                              disabled={index === 0 || mutating}
                              onClick={() => void move(category.code, -1)}
                            >
                              ↑
                            </button>
                            <button
                              className="btn xs ghost"
                              type="button"
                              title="下移"
                              disabled={index === categories.length - 1 || mutating}
                              onClick={() => void move(category.code, 1)}
                            >
                              ↓
                            </button>
                            <button
                              className="btn xs ghost"
                              type="button"
                              disabled={mutating}
                              onClick={() => {
                                setEditingCode(category.code);
                                setEditName(category.categoryName);
                                setError('');
                              }}
                            >
                              改名
                            </button>
                            <button
                              className="btn xs ghost"
                              type="button"
                              disabled={mutating}
                              onClick={() => setConfirmingCode(category.code)}
                            >
                              删除
                            </button>
                          </>
                        )}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      }
      footLeft="分组只影响浏览，不参与类型编码与校验"
      footRight={
        <button className="btn" type="button" onClick={onClose}>
          关闭
        </button>
      }
    />
  );
}
