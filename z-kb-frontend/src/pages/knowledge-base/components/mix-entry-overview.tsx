import Icon from '@/components/icon';
import { AgentAskButton } from '@/pages/ai/agent-ask';
import type { MaterialDetailRecord } from '@/services/material';
import {
  deriveMixEntryState,
  MIX_ENTRY_STATE_META,
  MIX_ENTRY_TYPES,
  MIX_ENTRY_TYPE_META,
  normalizeExt,
  type MixEntry,
  type MixEntryType,
} from '../mix-entry-model';
import { formatDateTime, formatFileSize } from '@/utils/format';

interface MixEntryOverviewProps {
  kbId: string;
  entry: MixEntry | null;
  detail: MaterialDetailRecord | null;
  detailLoading: boolean;
  entryPath: string;
  scopeEntries: MixEntry[];
  scopeLabel: string;
  folderCount: number;
  total: number;
  filterActive: boolean;
  activeFolderId: string;
  canWrite: boolean;
  canCompile: boolean;
  compileBusy: boolean;
  reparseBusy: boolean;
  onUpload: () => void;
  onNewFolder: () => void;
  onClearFilters: () => void;
  onDownload: (entry: MixEntry) => void;
  onReparse: (entry: MixEntry) => void;
  onCompile: (entry: MixEntry) => void;
  onOpenDetail: (entry: MixEntry, tab: 'wiki' | 'graph' | 'knowledge') => void;
}

function rawCell(label: string, value: string, mono?: boolean) {
  return (
    <div className="mix-raw-cell" key={label}>
      <span>{label}</span>
      <b className={mono ? 'mono' : undefined}>{value || '—'}</b>
    </div>
  );
}

function typeCountsOf(entries: MixEntry[]): { type: MixEntryType; count: number }[] {
  return MIX_ENTRY_TYPES.map((type) => ({
    type,
    count: entries.filter((entry) => entry.type === type).length,
  })).filter((item) => item.count > 0);
}

export default function MixEntryOverview({
  kbId,
  entry,
  detail,
  detailLoading,
  entryPath,
  scopeEntries,
  scopeLabel,
  folderCount,
  total,
  filterActive,
  activeFolderId,
  canWrite,
  canCompile,
  compileBusy,
  reparseBusy,
  onUpload,
  onNewFolder,
  onClearFilters,
  onDownload,
  onReparse,
  onCompile,
  onOpenDetail,
}: MixEntryOverviewProps) {
  if (entry) {
    const meta = MIX_ENTRY_TYPE_META[entry.type];
    const material = detail?.material || entry.material;
    const state = deriveMixEntryState(material.parseStatus);
    const stateMeta = MIX_ENTRY_STATE_META[state];
    const draft = detail?.currentDraft;
    const previewText = (draft?.textContent || '').trim();
    const previewExcerpt = previewText.slice(0, 1200);
    const askQuestion = `请介绍条目「${material.title}」的主要内容、可引用要点与适用场景，并标注引用来源。${
      previewText ? `资料开头片段：${previewText.replace(/\s+/g, ' ').slice(0, 120)}` : ''
    }`;

    return (
      <section className="panel mix-overview">
        <div className="panel-head mix-entry-head">
          <h3>
            <Icon name={meta.icon} size={15} className={`mix-tone-${entry.type}`} />
            <span className="mix-entry-title">{material.title}</span>
            <span className="tag gray sm">{meta.label}</span>
            <span className={`tag ${stateMeta.tag} sm`}>{stateMeta.label}</span>
          </h3>
          <div className="row gap-8">
            <button
              className="btn xs ghost"
              type="button"
              onClick={() => onDownload(entry)}
            >
              <Icon name="download" size={11} />
              下载原件
            </button>
            <button
              className="btn xs ghost"
              type="button"
              onClick={() => onOpenDetail(entry, 'wiki')}
            >
              <Icon name="book" size={11} />
              Wiki
            </button>
            <button
              className="btn xs ghost"
              type="button"
              onClick={() => onOpenDetail(entry, 'graph')}
            >
              <Icon name="share" size={11} />
              图谱
            </button>
            {canCompile && state === 'parsed' ? (
              <button
                className="btn xs"
                type="button"
                disabled={compileBusy}
                onClick={() => onCompile(entry)}
              >
                <Icon name="play" size={11} />
                {compileBusy ? '提交中…' : '编译'}
              </button>
            ) : null}
            {canWrite ? (
              <button
                className="btn xs primary-soft"
                type="button"
                disabled={reparseBusy}
                onClick={() => onReparse(entry)}
              >
                <Icon name="zap" size={11} />
                {reparseBusy
                  ? '提交中…'
                  : material.parseStatus === 'FAILED'
                    ? '重试解析'
                    : '重新解析'}
              </button>
            ) : null}
            <AgentAskButton
              kbId={kbId}
              className="btn xs"
              label="问 AI"
              question={askQuestion}
            />
          </div>
        </div>
        <div className="panel-body">
          <div className="note mix-entry-path">
            <Icon name="folder" size={11} />
            <span>{entryPath}</span>
          </div>

          <div className="row between mix-section-title">
            <b>原始数据概览</b>
            <span className="note">通用字段 · 解析前</span>
          </div>
          <div className="mix-raw-grid">
            {rawCell('条目 ID', material.materialId, true)}
            {rawCell('条目类型', `${meta.label}（${entry.type}）`)}
            {rawCell('所属路径', entryPath)}
            {rawCell('来源', material.sourceType)}
            {rawCell('文件名', material.fileName || '—')}
            {rawCell('文件大小', formatFileSize(material.sizeBytes))}
            {rawCell('扩展名', normalizeExt(material.fileExt) || '—', true)}
            {rawCell(
              '版本',
              `v${material.versionNo ?? 1} · ${material.versionStatus || '—'}`,
            )}
            {rawCell('解析状态', stateMeta.label)}
            {rawCell('登记人', `actorId ${material.registeredBy}`)}
            {rawCell('登记时间', formatDateTime(material.registeredAt))}
            {rawCell('最近更新', formatDateTime(material.updateTime))}
            {rawCell('内容指纹', material.fingerprint, true)}
          </div>

          <div className="row between mix-section-title">
            <b>{meta.label}类型属性</b>
            <span className="note">由版本与解析稿推导</span>
          </div>
          {detailLoading ? (
            <div className="mix-attr-loading">
              <Icon name="refresh" size={12} />
              正在加载版本与解析稿…
            </div>
          ) : detail ? (
            <div className="table-wrap">
              <table className="list-table mix-attr-table">
                <thead>
                  <tr>
                    <th>属性</th>
                    <th>原始值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>版本数</td>
                    <td>{detail.versions.length}</td>
                  </tr>
                  <tr>
                    <td>当前解析稿</td>
                    <td>
                      {draft
                        ? `${draft.parserName}@${draft.parserVersion}`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>解析文本长度</td>
                    <td>{draft ? `${draft.textLength} 字` : '—'}</td>
                  </tr>
                  <tr>
                    <td>解析时间</td>
                    <td>{formatDateTime(draft?.parsedAt)}</td>
                  </tr>
                  {draft?.failureReason ? (
                    <tr>
                      <td>失败原因</td>
                      <td>{draft.failureReason}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mix-attr-loading">
              <Icon name="alert-circle" size={12} />
              详情未加载成功，当前仅展示列表字段。
            </div>
          )}

          <div className="row between mix-section-title">
            <b>原始数据预览</b>
            <span className="note">{normalizeExt(material.fileExt) || '—'}</span>
          </div>
          {previewExcerpt ? (
            <>
              <pre className="mix-preview">{previewExcerpt}</pre>
              {previewText.length > previewExcerpt.length ? (
                <div className="note mix-preview-foot">
                  仅展示前 {previewExcerpt.length} 字，共 {previewText.length} 字。
                </div>
              ) : null}
            </>
          ) : detailLoading ? (
            <div className="mix-preview-empty">正在加载解析文本…</div>
          ) : (
            <div className="mix-preview-empty">
              当前没有可展示的解析文本。
            </div>
          )}

        </div>
      </section>
    );
  }

  if (scopeEntries.length === 0) {
    if (filterActive) {
      return (
        <section className="panel mix-overview">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="search" size={20} />
            </div>
            <b>当前筛选下没有条目</b>
            <p>清空关键词或类型筛选，查看这个库里已有的条目。</p>
            <button className="btn sm" type="button" onClick={onClearFilters}>
              <Icon name="x" size={12} />
              清空筛选
            </button>
          </div>
        </section>
      );
    }
    if (activeFolderId) {
      return (
        <section className="panel mix-overview">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="folder" size={20} />
            </div>
            <b>这个目录还没有条目</b>
            <p>上传条目时选择当前目录，或先把已有条目移动到该目录。</p>
            {canWrite ? (
              <button className="btn sm primary" type="button" onClick={onUpload}>
                <Icon name="upload" size={12} />
                上传到此目录
              </button>
            ) : null}
          </div>
        </section>
      );
    }
    return (
      <section className="panel mix-overview">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="layers" size={20} />
          </div>
          <b>{folderCount ? '目录已就绪，还没有条目' : '这个混合库还没有条目'}</b>
          <p>
            混合库用一棵条目树承载任意类型资料；上传第一条后，类型图标与原始数据概览会随条目出现。
          </p>
          {canWrite ? (
            <div className="row gap-8">
              <button className="btn sm primary" type="button" onClick={onUpload}>
                <Icon name="upload" size={12} />
                上传条目
              </button>
              <button className="btn sm" type="button" onClick={onNewFolder}>
                <Icon name="folder" size={12} />
                新建目录
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const distribution = typeCountsOf(scopeEntries);
  const maxCount = distribution.reduce(
    (max, item) => Math.max(max, item.count),
    1,
  );
  const parsedCount = scopeEntries.filter(
    (item) => deriveMixEntryState(item.material.parseStatus) === 'parsed',
  ).length;
  const distinctTypes = distribution.length;

  return (
    <section className="panel mix-overview">
      <div className="panel-head">
        <h3>
          <Icon name="layers" size={15} />
          {scopeLabel}
        </h3>
        <span className="hint">
          {scopeEntries.length} 条 · 全库 {total} 条
        </span>
      </div>
      <div className="panel-body">
        <div className="grid grid-4 mb-16">
          <div className="stat">
            <div className="label">条目</div>
            <div className="value tnum">{scopeEntries.length}</div>
            <div className="foot">
              <span>按目录与筛选统计</span>
            </div>
            <div className="s-icon">
              <Icon name="layers" size={15} />
            </div>
          </div>
          <div className="stat violet">
            <div className="label">目录</div>
            <div className="value tnum">{folderCount}</div>
            <div className="foot">
              <span>物料分类树</span>
            </div>
            <div className="s-icon">
              <Icon name="folder" size={15} />
            </div>
          </div>
          <div className="stat">
            <div className="label">类型</div>
            <div className="value tnum">{distinctTypes}</div>
            <div className="foot">
              <span>按 entry_type 区分</span>
            </div>
            <div className="s-icon">
              <Icon name="tag" size={15} />
            </div>
          </div>
          <div className="stat green">
            <div className="label">已解析</div>
            <div className="value tnum">{parsedCount}</div>
            <div className="foot">
              <span>解析状态 READY</span>
            </div>
            <div className="s-icon">
              <Icon name="check-circle" size={15} />
            </div>
          </div>
        </div>

        <div className="row between mix-section-title">
          <b>类型分布</b>
          <span className="note">按扩展名与物料类型推导</span>
        </div>
        <div className="mix-type-distribution">
          {distribution.map((item) => {
            const meta = MIX_ENTRY_TYPE_META[item.type];
            return (
              <div className="mix-type-row" key={item.type}>
                <span className="mix-type-label">
                  <Icon
                    name={meta.icon}
                    size={12}
                    className={`mix-tone-${item.type}`}
                  />
                  {meta.label}
                </span>
                <span className="mix-type-bar">
                  <i
                    className={`mix-tone-bg-${item.type}`}
                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="mix-type-count">{item.count}</span>
              </div>
            );
          })}
        </div>

        <div className="callout mt-16">
          <Icon name="info" size={15} />
          <div className="ct">
            <b>同树不同解析器</b>
            <p>
              目录只负责组织，不决定处理方式；每片叶子按条目类型选择解析器。解析状态与原始数据分离，失败条目仍留在树里可重试。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
