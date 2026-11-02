import Icon from '@/components/icon';
import { AgentAskButton } from '@/pages/ai/agent-ask';
import { isCompilationActive } from '@/services/compilation';
import { formatFileSize, formatShortDateTime } from '@/utils/format';
import { MATERIAL_TYPE_META, findCategory, materialFileIcon } from '../material-workspace-model';
import {
  JOB_STATUS,
  SOURCE_TYPE_LABEL,
  VERSION_STATUS,
} from '../material-status';
import { MATERIAL_DETAIL_TABS } from '../material-detail-tabs';
import MaterialCompilationSection from './material-compilation-section';
import MaterialSourceTab from './material-source-tab';
import MaterialEvidenceCompare from './material-evidence-compare';
import MaterialGraphTab from './material-graph-tab';
import MaterialKnowledgeTab from './material-knowledge-tab';
import MaterialWikiTab from './material-wiki-tab';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';

interface MaterialDetailPanelProps {
  ctrl: MaterialWorkspaceController;
}

export default function MaterialDetailPanel({ ctrl }: MaterialDetailPanelProps) {
  const {
    kbId,
    tree,
    canWrite,
    canCompile,
    onOpenConcept,
    detailId,
    detail,
    detailTab,
    setDetailTab,
    compilation,
    compilationLoading,
    chunks,
    compileBusy,
    cancelBusy,
    versionUploading,
    reparseBusy,
    draftSaving,
    setConfirmRerun,
    setCompareMode,
    versionInputRef,
    materialAskQuestion,
    closeDetail,
    download,
    submitCompile,
    cancelCompile,
    submitRevise,
    submitReparse,
    submitDraftText,
  } = ctrl;

  return (
    <section className="panel material-detail-panel">
      <div className="drawer-head">
        <div className="d-top">
          <button
            className="icon-btn"
            type="button"
            title="返回资料列表"
            aria-label="返回资料列表"
            onClick={closeDetail}
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <div className="d-icon">
            <Icon
              name={detail ? materialFileIcon(detail.material).icon : 'file-text'}
              size={18}
            />
          </div>
          <div className="d-copy">
            <h2>{detail?.material.title || '资料详情'}</h2>
            <div className="d-sub">
              <span className="mono-sm">{detailId}</span>
            </div>
          </div>
          <div className="d-actions">
            <AgentAskButton
              kbId={kbId}
              className="btn xs"
              label="问 AI"
              question={materialAskQuestion}
            />
          </div>
        </div>
        <div className="tabs" style={{ marginTop: 10 }}>
          {MATERIAL_DETAIL_TABS.map((item) => (
            <button
              key={item.key}
              className={`tab ${detailTab === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => setDetailTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="drawer-body">
        {!detail ? (
          <div className="empty">
            <b>正在加载…</b>
          </div>
        ) : detailTab === 'basic' ? (
          <>
            <dl className="kv material-basic-kv">
              <dt>资料 ID</dt>
              <dd className="mono wide">{detail.material.materialId}</dd>
              <dt>文件名</dt>
              <dd className="wide">{detail.material.fileName || '—'}</dd>
              <dt>类型</dt>
              <dd>
                {MATERIAL_TYPE_META[detail.material.materialType]?.label ||
                  detail.material.materialType}
              </dd>
              <dt>大小</dt>
              <dd>{formatFileSize(detail.material.sizeBytes)}</dd>
              <dt>来源</dt>
              <dd>{SOURCE_TYPE_LABEL[detail.material.sourceType] || detail.material.sourceType}</dd>
              <dt>分类</dt>
              <dd>
                {detail.material.categoryId
                  ? findCategory(tree, detail.material.categoryId)?.name || '—'
                  : '根目录'}
              </dd>
              <dt>登记时间</dt>
              <dd>{formatShortDateTime(detail.material.registeredAt)}</dd>
              <dt>编译状态</dt>
              <dd>
                {compilation ? (
                  <span className={`tag ${JOB_STATUS[compilation.runStatus]?.tag || 'gray'}`}>
                    {JOB_STATUS[compilation.runStatus]?.label || compilation.runStatus}
                    {compilation.milestone !== 'NONE' ? ` · ${compilation.milestone}` : ''}
                  </span>
                ) : (
                  <span className="tag gray">
                    {compilationLoading ? '加载中…' : '未编译'}
                  </span>
                )}
              </dd>
              <dt>指纹</dt>
              <dd className="mono wide">{detail.material.fingerprint}</dd>
            </dl>
          </>
        ) : detailTab === 'versions' ? (
          <div className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="layers" size={14} />
                文件版本
              </h3>
              <div className="row gap-8">
                {detail.versions.length > 1 ? (
                  <button
                    className="btn xs"
                    type="button"
                    onClick={() => setCompareMode('version')}
                  >
                    对比版本
                  </button>
                ) : null}
                <span className="hint">不可变</span>
              </div>
            </div>
            <div className="panel-body flush">
              <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>状态</th>
                    <th>大小</th>
                    <th>登记时间</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.versions.map((version) => (
                    <tr key={version.versionId}>
                      <td className="mono">
                        v{version.versionNo}
                        {version.versionId === detail.material.currentVersionId ? (
                          <span className="tag green" style={{ marginLeft: 6 }}>当前</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`tag ${VERSION_STATUS[version.versionStatus]?.tag || 'gray'}`}>
                          {VERSION_STATUS[version.versionStatus]?.label || version.versionStatus}
                        </span>
                      </td>
                      <td>{formatFileSize(version.sizeBytes)}</td>
                      <td>{formatShortDateTime(version.registeredAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="icon-btn"
                          type="button"
                          title="下载该版本"
                          onClick={() =>
                            void download(detail.material.materialId,
                              version.fileName || detail.material.title,
                              version.versionId)
                          }
                        >
                          <Icon name="download" size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : detailTab === 'compile' ? (
          <MaterialCompilationSection
            detail={detail}
            compilation={compilation}
            compilationLoading={compilationLoading}
            chunks={chunks}
            canManage={canCompile}
            compileBusy={compileBusy}
            onCompile={() => void submitCompile()}
          />
        ) : detailTab === 'wiki' ? (
          <MaterialWikiTab kbId={kbId} materialId={detail.material.materialId} />
        ) : detailTab === 'graph' ? (
          <MaterialGraphTab materialId={detail.material.materialId} />
        ) : detailTab === 'knowledge' ? (
          <MaterialKnowledgeTab
            materialId={detail.material.materialId}
            failureSummary={compilation?.failureSummary}
            onOpenConcept={onOpenConcept}
          />
        ) : detailTab === 'compare' ? (
          <MaterialEvidenceCompare
            materialId={detail.material.materialId}
            detail={detail}
            chunks={chunks}
            compilationLoading={compilationLoading}
            onOpenTab={setDetailTab}
          />
        ) : detailTab === 'draft' ? (
          <MaterialSourceTab
            key={detail.material.materialId}
            material={detail.material}
            draft={detail.currentDraft || null}
            canEdit={canWrite}
            saving={draftSaving}
            onSave={submitDraftText}
            onOpenCompare={() => setCompareMode('draft')}
          />
        ) : null}
      </div>
      <div className="material-detail-foot">
        <span className="mono-sm">
          {detail
            ? `当前 v${detail.material.versionNo ?? 1} · ${
                detail.material.versionStatus
                  ? VERSION_STATUS[detail.material.versionStatus]?.label ||
                    detail.material.versionStatus
                  : '—'
              }`
            : '物料详情'}
        </span>
        <div className="btn-group">
          {canCompile && detail && detail.currentDraft?.status === 'READY' ? (
            compilation ? (
              isCompilationActive(compilation.runStatus) ? (
                <button
                  className="btn sm"
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => void cancelCompile()}
                >
                  <Icon name="x" size={12} />
                  {cancelBusy ? '取消中…' : '取消编译'}
                </button>
              ) : (
                <button
                  className="btn sm"
                  type="button"
                  disabled={compileBusy}
                  onClick={() => setConfirmRerun(true)}
                >
                  <Icon name="refresh" size={12} />
                  重试编译
                </button>
              )
            ) : (
              <button
                className="btn sm"
                type="button"
                disabled={compileBusy}
                onClick={() => void submitCompile()}
              >
                <Icon name="play" size={12} />
                {compileBusy ? '提交中…' : '编译'}
              </button>
            )
          ) : null}
          <button
            className="btn sm"
            type="button"
            onClick={() => {
              if (detail) {
                void download(detail.material.materialId,
                  detail.material.fileName || detail.material.title);
              }
            }}
          >
            <Icon name="download" size={12} />
            下载原件
          </button>
          {canWrite && detail ? (
            <>
              <button
                className="btn sm"
                type="button"
                disabled={reparseBusy}
                onClick={() => void submitReparse()}
              >
                <Icon name="refresh" size={12} />
                {reparseBusy ? '解析中…' : '重新解析'}
              </button>
              <button
                className="btn primary sm"
                type="button"
                disabled={versionUploading}
                onClick={() => versionInputRef.current?.click()}
              >
                <Icon name="upload" size={12} />
                {versionUploading ? '上传中…' : '上传新版本'}
              </button>
              <input
                ref={versionInputRef}
                type="file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void submitRevise(file);
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
