import { useState } from 'react';
import Icon from '@/components/icon';
import type { MaterialRecord, ParsedDraftRecord } from '@/services/material';
import MaterialDraftSection from './material-draft-section';
import MaterialOriginalPreview from './material-original-preview';
import MaterialRepoBrowser from './material-repo-browser';

interface MaterialSourceTabProps {
  material: MaterialRecord;
  draft: ParsedDraftRecord | null;
  canEdit: boolean;
  saving: boolean;
  onSave: (textContent: string) => Promise<boolean>;
  onOpenCompare: () => void;
}

type SourceMode = 'original' | 'draft';

/** 原文页签：原件高保真预览与解析稿二选一，默认看原件。 */
export default function MaterialSourceTab({
  material,
  draft,
  canEdit,
  saving,
  onSave,
  onOpenCompare,
}: MaterialSourceTabProps) {
  const [mode, setMode] = useState<SourceMode>('original');

  return (
    <section className="source-tab">
      <div className="source-tab-bar">
        <div className="segmented sm">
          <button
            className={mode === 'original' ? 'active' : ''}
            type="button"
            onClick={() => setMode('original')}
          >
            <Icon name="file" size={12} />
            原件
          </button>
          <button
            className={mode === 'draft' ? 'active' : ''}
            type="button"
            onClick={() => setMode('draft')}
          >
            <Icon name="file-text" size={12} />
            解析稿
          </button>
        </div>
      </div>
      <div className="source-tab-body">
        {mode === 'original' ? (
          material.sourceType === 'CODE_GIT' ? (
            <MaterialRepoBrowser material={material} />
          ) : (
            <MaterialOriginalPreview material={material} draft={draft} />
          )
        ) : draft ? (
          <MaterialDraftSection
            draft={draft}
            canEdit={canEdit}
            saving={saving}
            onSave={onSave}
            onOpenCompare={onOpenCompare}
          />
        ) : (
          <div className="empty">
            <b>没有解析稿</b>
            <p>当前版本还没有生成解析稿。</p>
          </div>
        )}
      </div>
    </section>
  );
}
