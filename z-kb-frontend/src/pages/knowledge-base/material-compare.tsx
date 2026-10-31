import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import {
  listDrafts,
  MaterialVersionRecord,
  ParsedDraftRecord,
} from '@/services/material';
import { formatDateTime } from '@/utils/format';
import { useEffect, useMemo, useState } from 'react';

interface CompareOption {
  id: string;
  label: string;
}

interface DiffRow {
  kind: 'same' | 'add' | 'del';
  leftNo?: number;
  rightNo?: number;
  text: string;
}

const MAX_DIFF_LINES = 1500;

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function diffLines(left: string, right: string): DiffRow[] | null {
  const a = splitLines(left);
  const b = splitLines(right);
  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    return null;
  }
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'same', leftNo: i + 1, rightNo: j + 1, text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'del', leftNo: i + 1, text: a[i] });
      i += 1;
    } else {
      rows.push({ kind: 'add', rightNo: j + 1, text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    rows.push({ kind: 'del', leftNo: i + 1, text: a[i] });
    i += 1;
  }
  while (j < n) {
    rows.push({ kind: 'add', rightNo: j + 1, text: b[j] });
    j += 1;
  }
  return rows;
}

interface MaterialCompareProps {
  materialId: string;
  mode: 'version' | 'draft';
  versions: MaterialVersionRecord[];
  currentVersionId?: string | null;
  versionId?: string;
  onClose: () => void;
}

export default function MaterialCompare({
  materialId,
  mode,
  versions,
  currentVersionId,
  versionId,
  onClose,
}: MaterialCompareProps) {
  const [options, setOptions] = useState<CompareOption[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftText, setLeftText] = useState<string | null>(null);
  const [rightText, setRightText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      if (mode === 'version') {
        const versionOptions = versions.map((version) => ({
          id: version.versionId,
          label: `v${version.versionNo} · ${version.versionStatus} · ${formatDateTime(version.registeredAt, 'MM-DD HH:mm:ss')} · ${version.fileName}`,
        }));
        if (cancelled) {
          return;
        }
        setOptions(versionOptions);
        const currentIndex = versions.findIndex(
          (version) => version.versionId === currentVersionId,
        );
        const right =
          currentIndex >= 0 ? versions[currentIndex] : versions[0];
        const left =
          versions.find((version) => version.versionId !== right?.versionId) || undefined;
        setLeftId(left?.versionId || '');
        setRightId(right?.versionId || '');
        setLoading(false);
        return;
      }
      const drafts = (await listDrafts(materialId, versionId)) || [];
      if (cancelled) {
        return;
      }
      setOptions(
        drafts.map((draft: ParsedDraftRecord) => ({
          id: draft.draftId,
          label: `${formatDateTime(draft.parsedAt, 'MM-DD HH:mm:ss')} · ${draft.status} · ${draft.textLength} 字符 · ${draft.parserName}@${draft.parserVersion}`,
        })),
      );
      setLeftId(drafts[1]?.draftId || '');
      setRightId(drafts[0]?.draftId || '');
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [materialId, mode, versions, currentVersionId, versionId]);

  useEffect(() => {
    if (!leftId || !rightId) {
      return;
    }
    let cancelled = false;
    const loadText = async () => {
      setLeftText(null);
      setRightText(null);
      if (mode === 'version') {
        const [left, right] = await Promise.all([
          listDrafts(materialId, leftId),
          listDrafts(materialId, rightId),
        ]);
        if (cancelled) {
          return;
        }
        setLeftText(left?.[0]?.textContent ?? '');
        setRightText(right?.[0]?.textContent ?? '');
        return;
      }
      const drafts = (await listDrafts(materialId, versionId)) || [];
      if (cancelled) {
        return;
      }
      setLeftText(drafts.find((draft) => draft.draftId === leftId)?.textContent ?? '');
      setRightText(drafts.find((draft) => draft.draftId === rightId)?.textContent ?? '');
    };
    void loadText();
    return () => {
      cancelled = true;
    };
  }, [materialId, mode, versionId, leftId, rightId]);

  const rows = useMemo(() => {
    if (leftText == null || rightText == null) {
      return null;
    }
    return diffLines(leftText, rightText);
  }, [leftText, rightText]);

  const stats = useMemo(() => {
    if (!rows) {
      return { added: 0, removed: 0, same: 0, huge: true };
    }
    return {
      added: rows.filter((row) => row.kind === 'add').length,
      removed: rows.filter((row) => row.kind === 'del').length,
      same: rows.filter((row) => row.kind === 'same').length,
      huge: false,
    };
  }, [rows]);

  const leftLabel = options.find((option) => option.id === leftId)?.label;
  const rightLabel = options.find((option) => option.id === rightId)?.label;

  return (
    <AppModal
      icon="layers"
      title={mode === 'version' ? '对比物料版本' : '对比解析稿'}
      sub={
        mode === 'version'
          ? '按解析文本逐行比对两个版本，左为旧、右为新'
          : '同一版本多次解析的稿件比对，左为旧、右为新'
      }
      width={1020}
      onClose={onClose}
      body={
        <div>
          {options.length < 2 ? (
            <div className="empty">
              <b>暂无可对比对象</b>
              <p>
                {mode === 'version'
                  ? '至少需要两个版本才能对比，请先上传新版本。'
                  : '当前版本只有一份解析稿，重新解析后可对比新旧稿。'}
              </p>
            </div>
          ) : (
            <>
              <div className="row gap-8 mb-12" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <select
                    className="input"
                    value={leftId}
                    onChange={(event) => setLeftId(event.target.value)}
                  >
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Icon name="arrow-right" size={14} />
                <div style={{ flex: 1 }}>
                  <select
                    className="input"
                    value={rightId}
                    onChange={(event) => setRightId(event.target.value)}
                  >
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="meta mb-12" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="tag green">+{stats.added} 行</span>
                <span className="tag red">-{stats.removed} 行</span>
                <span className="tag gray">{stats.same} 行相同</span>
                {leftId === rightId ? <span className="tag amber">左右选择相同</span> : null}
              </div>
              {loading ? (
                <div className="empty">
                  <b>正在加载…</b>
                </div>
              ) : leftText == null || rightText == null ? (
                <div className="empty">
                  <b>正在加载文本…</b>
                </div>
              ) : rows ? (
                <div
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    overflow: 'auto',
                    maxHeight: '52vh',
                    fontSize: 11,
                    lineHeight: 1.6,
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <th style={{ width: 42, padding: '4px 6px', textAlign: 'right' }}>#</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>左：{leftLabel}</th>
                        <th style={{ width: 42, padding: '4px 6px', textAlign: 'right' }}>#</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left' }}>右：{rightLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={index}>
                          <td
                            className="mono-sm"
                            style={{ padding: '2px 6px', textAlign: 'right', color: 'var(--ink-3)' }}
                          >
                            {row.leftNo ?? ''}
                          </td>
                          <td
                            className="mono-sm"
                            style={{
                              padding: '2px 8px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              background:
                                row.kind === 'del' ? 'rgba(220, 38, 38, 0.10)' : undefined,
                            }}
                          >
                            {row.kind === 'add' ? '' : row.text}
                          </td>
                          <td
                            className="mono-sm"
                            style={{ padding: '2px 6px', textAlign: 'right', color: 'var(--ink-3)' }}
                          >
                            {row.rightNo ?? ''}
                          </td>
                          <td
                            className="mono-sm"
                            style={{
                              padding: '2px 8px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              background:
                                row.kind === 'add' ? 'rgba(22, 163, 74, 0.12)' : undefined,
                            }}
                          >
                            {row.kind === 'del' ? '' : row.text}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <div className="callout warn mb-12">
                    <Icon name="alert-triangle" size={14} />
                    <div className="ct">
                      <b>文本过长</b>
                      <p>超过 {MAX_DIFF_LINES} 行，未做逐行比对，下方并排展示全文。</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <pre
                      style={{
                        margin: 0,
                        padding: 10,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        fontSize: 11,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '48vh',
                        overflow: 'auto',
                      }}
                    >
                      {leftText}
                    </pre>
                    <pre
                      style={{
                        margin: 0,
                        padding: 10,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        fontSize: 11,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '48vh',
                        overflow: 'auto',
                      }}
                    >
                      {rightText}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      }
      footLeft={
        <span className="mono-sm">
          {materialId} · {mode === 'version' ? `${versions.length} 个版本` : `${options.length} 份解析稿`}
        </span>
      }
      footRight={
        <button className="btn" type="button" onClick={onClose}>
          关闭
        </button>
      }
    />
  );
}
