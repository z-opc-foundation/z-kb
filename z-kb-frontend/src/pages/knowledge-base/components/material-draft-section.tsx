import { useEffect, useState } from 'react';
import Icon from '@/components/icon';
import type { ParsedDraftRecord } from '@/services/material';
import { formatShortDateTime } from '@/utils/format';
import { PARSE_STATUS } from '../material-status';
import MaterialDraftMarkdown from './material-draft-markdown';

interface MaterialDraftSectionProps {
  draft: ParsedDraftRecord;
  canEdit: boolean;
  saving: boolean;
  onSave: (textContent: string) => Promise<boolean>;
  onOpenCompare: () => void;
}

export default function MaterialDraftSection({
  draft,
  canEdit,
  saving,
  onSave,
  onOpenCompare,
}: MaterialDraftSectionProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [blankError, setBlankError] = useState('');

  useEffect(() => {
    setEditing(false);
  }, [draft.draftId]);

  const content = draft.textContent || '';
  const truncated = draft.textLength > content.length;
  const editable = canEdit && draft.status === 'READY' && !truncated && content.length > 0;
  const dirty = editing && text !== content;

  const startEdit = () => {
    setText(content);
    setBlankError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setBlankError('');
  };

  const save = async () => {
    if (!text.trim()) {
      setBlankError('解析稿正文不能为空');
      return;
    }
    setBlankError('');
    await onSave(text);
  };

  const statusMeta = PARSE_STATUS[draft.status] || { label: draft.status, tag: 'gray' };

  return (
    <section className="draft-section">
      <div className="draft-toolbar">
        <span className={`tag ${statusMeta.tag}`}>{statusMeta.label}</span>
        <span className="tag gray mono">
          {draft.parserName}@{draft.parserVersion}
        </span>
        <span className="tag gray">{(editing ? text.length : draft.textLength).toLocaleString()} 字符</span>
        {draft.parsedAt ? (
          <span className="hint">解析于 {formatShortDateTime(draft.parsedAt)}</span>
        ) : null}
        <div className="draft-toolbar-actions">
          {editing ? (
            <span className="tag blue">编辑中</span>
          ) : editable ? (
            <button className="btn xs" type="button" onClick={startEdit}>
              <Icon name="edit" size={12} />
              编辑
            </button>
          ) : null}
          {!editing && truncated ? (
            <span className="hint">超过 20 万字符，仅展示前 20 万字符，暂不支持在线编辑</span>
          ) : null}
          <button className="btn xs" type="button" onClick={onOpenCompare}>
            对比解析稿
          </button>
        </div>
      </div>
      {draft.failureReason ? (
        <div className="callout warn">
          <Icon name="alert-triangle" size={14} />
          <div className="ct">
            <b>解析未完成</b>
            <p>{draft.failureReason}</p>
          </div>
        </div>
      ) : editing ? (
        <>
          <textarea
            className="textarea draft-editor"
            value={text}
            spellCheck={false}
            autoFocus
            onChange={(event) => {
              setText(event.target.value);
              if (blankError) {
                setBlankError('');
              }
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                void save();
              }
            }}
          />
          <div className="draft-edit-bar">
            {blankError ? (
              <span className="draft-edit-error">{blankError}</span>
            ) : (
              <span className="hint">
                保存后生成新解析稿（旧稿保留），重新编译后应用到 Wiki
              </span>
            )}
            <span className="mono-sm">{text.length.toLocaleString()} 字符</span>
            <button className="btn xs" type="button" disabled={saving} onClick={cancelEdit}>
              取消
            </button>
            <button
              className="btn primary xs"
              type="button"
              disabled={saving || !dirty}
              onClick={() => void save()}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </>
      ) : content ? (
        <div className="draft-render">
          <MaterialDraftMarkdown content={content} />
          {truncated ? (
            <div className="draft-truncated">
              已到 20 万字符预览上限，完整正文请下载原件查看
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty">
          <b>解析稿没有正文</b>
          <p>当前解析稿未产出可读文本，可尝试重新解析。</p>
        </div>
      )}
    </section>
  );
}
