import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import { formatFileSize } from '@/utils/format';
import { findCategory } from '../material-workspace-model';
import MoveCategoryModal from './move-category-modal';
import MaterialCompare from '../material-compare';
import MaterialRecycleModal from './material-recycle-modal';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';

interface MaterialWorkspaceDialogsProps {
  ctrl: MaterialWorkspaceController;
}

export default function MaterialWorkspaceDialogs({ ctrl }: MaterialWorkspaceDialogsProps) {
  const {
    tree,
    selected,
    busy,
    currentCategory,
    detail,
    recycle,
    uploadOpen,
    setUploadOpen,
    uploadFiles,
    setUploadFiles,
    uploadResults,
    setUploadResults,
    uploading,
    fileInputRef,
    categoryModal,
    setCategoryModal,
    categoryName,
    setCategoryName,
    moveOpen,
    setMoveOpen,
    confirmRemove,
    setConfirmRemove,
    confirmRerun,
    setConfirmRerun,
    compilation,
    compileBusy,
    nodeBatch,
    setNodeBatch,
    nodeBatchName,
    setNodeBatchName,
    nodeBatchBusy,
    batchOpen,
    setBatchOpen,
    batchName,
    setBatchName,
    batchBusy,
    compareMode,
    setCompareMode,
    submitUpload,
    submitCategory,
    moveSelected,
    removeSelected,
    submitRerun,
    submitNodeBatch,
    submitBatch,
  } = ctrl;

  return (
    <>
      {uploadOpen ? (
        <AppModal
          icon="upload"
          title="上传资料"
          sub={`登记到 ${currentCategory?.name || '根目录'}；单文件上限 10MB`}
          width={640}
          onClose={() => {
            if (uploading) {
              return;
            }
            setUploadOpen(false);
          }}
          body={
            <div>
              <div
                className="dropzone"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="dz-icon">
                  <Icon name="upload" size={20} />
                </div>
                <b>点击选择文件</b>
                <p>文本类格式即时解析；PDF / Word / PPT / Excel / 图片经 MinerU 生成解析稿</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setUploadFiles(files);
                    setUploadResults([]);
                    event.target.value = '';
                  }}
                />
              </div>
              {uploadFiles.length ? (
                <div className="upload-list">
                  {uploadFiles.map((file) => (
                    <div className="file-row" key={`${file.name}-${file.size}`}>
                      <Icon name="file-text" size={13} />
                      <span className="nm">{file.name}</span>
                      <span className="sz">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {uploadResults.length ? (
                <div className="upload-list" style={{ marginTop: 14 }}>
                  {uploadResults.map((item, index) => (
                    <div
                      className="file-row"
                      key={`${item.fileName}-${index}`}
                      style={{ borderColor: item.success ? 'var(--line)' : '#f6d3d0' }}
                    >
                      <Icon
                        name={item.success ? 'check-circle' : 'alert-circle'}
                        size={13}
                      />
                      <span className="nm">{item.fileName}</span>
                      <span className="sz">{item.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          }
          footLeft={<span>已选 {uploadFiles.length} 个文件</span>}
          footRight={
            <>
              <button
                className="btn"
                type="button"
                disabled={uploading}
                onClick={() => setUploadOpen(false)}
              >
                关闭
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={uploading || !uploadFiles.length}
                onClick={() => void submitUpload()}
              >
                {uploading ? '上传中…' : '开始上传'}
              </button>
            </>
          }
        />
      ) : null}

      {categoryModal.open ? (
        <AppModal
          icon="folder"
          title={categoryModal.parentId ? '新建子分类' : '新建分类'}
          sub={
            categoryModal.parentId
              ? `将创建在「${findCategory(tree, categoryModal.parentId)?.name || '上级分类'}」下`
              : '创建为根分类'
          }
          width={460}
          onClose={() => setCategoryModal({ open: false })}
          body={
            <div className="field">
              <label>
                分类名称 <span className="req">*</span>
              </label>
              <input
                className="input"
                value={categoryName}
                maxLength={50}
                placeholder="例如：临床指南"
                onChange={(event) => setCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void submitCategory();
                  }
                }}
              />
              <span className="help">同层分类名称不可重复，最多三层。</span>
            </div>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setCategoryModal({ open: false })}>
                取消
              </button>
              <button className="btn primary" type="button" onClick={() => void submitCategory()}>
                创建
              </button>
            </>
          }
        />
      ) : null}

      {moveOpen ? (
        <MoveCategoryModal
          tree={tree}
          count={selected.length}
          busy={busy}
          onClose={() => {
            if (!busy) {
              setMoveOpen(false);
            }
          }}
          onConfirm={(targetId) => void moveSelected(targetId)}
        />
      ) : null}

      {confirmRemove ? (
        <AppModal
          icon="alert-triangle"
          title="删除资料"
          sub="删除为逻辑删除，资料会从列表与统计中消失"
          width={440}
          onClose={() => setConfirmRemove(false)}
          body={
            <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              将删除已勾选的 {selected.length} 个资料，是否继续？
            </p>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setConfirmRemove(false)}>
                取消
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={busy}
                onClick={() => void removeSelected()}
              >
                确认删除
              </button>
            </>
          }
        />
      ) : null}

      {confirmRerun && compilation ? (
        <AppModal
          icon="refresh"
          title="重试编译任务"
          sub={detail ? detail.material.title : undefined}
          width={560}
          onClose={() => setConfirmRerun(false)}
          body={
            <div>
              <div className="callout">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>从 P0 全量重跑</b>
                  <p>
                    将清空阶段记录与检索块，新建产物版本后按 P0–P4 重新执行。
                    需要只重跑部分阶段时，请到任务管理页选择起始阶段。
                  </p>
                </div>
              </div>
            </div>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setConfirmRerun(false)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={compileBusy}
                onClick={() => void submitRerun()}
              >
                {compileBusy ? '执行中…' : '确认重跑'}
              </button>
            </>
          }
        />
      ) : null}

      {nodeBatch ? (
        <AppModal
          icon="layers"
          title="按分类发起批任务"
          sub={nodeBatch.name}
          width={580}
          onClose={() => setNodeBatch(null)}
          body={
            <div>
              <label className="note" htmlFor="node-batch-name">
                组别名称
              </label>
              <input
                id="node-batch-name"
                className="input mt-8"
                style={{ width: '100%' }}
                value={nodeBatchName}
                onChange={(event) => setNodeBatchName(event.target.value)}
                placeholder="如：护理交接批量编译"
              />
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>范围锁定当前分类（含子分类）</b>
                  <p>
                    提交后由服务端按该分类下的全部资料扇出文档编译单任务，归入同一任务组别；
                    同库存在运行中组别时会被拒绝，范围超过 200 份也会被拒绝。
                  </p>
                </div>
              </div>
            </div>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setNodeBatch(null)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={nodeBatchBusy}
                onClick={() => void submitNodeBatch()}
              >
                {nodeBatchBusy ? '执行中…' : '开始编译'}
              </button>
            </>
          }
        />
      ) : null}

      {batchOpen ? (
        <AppModal
          icon="layers"
          title="知识编译"
          sub={`已选 ${selected.length} 份资料，按每份资料扇出编译单任务`}
          width={580}
          onClose={() => setBatchOpen(false)}
          body={
            <div>
              <label className="note" htmlFor="batch-name">
                组别名称
              </label>
              <input
                id="batch-name"
                className="input mt-8"
                style={{ width: '100%' }}
                value={batchName}
                onChange={(event) => setBatchName(event.target.value)}
                placeholder="如：护理交接批量编译"
              />
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>组别只聚合结果</b>
                  <p>
                    每份资料生成一个文档编译单任务并归入同一组别，范围记为「工作台多选」；
                    同库存在运行中组别时会被拒绝。任务配置按租户在「运营管理 → 任务配置」维护，本入口不覆盖配置。
                  </p>
                </div>
              </div>
            </div>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setBatchOpen(false)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={batchBusy || !selected.length}
                onClick={() => void submitBatch()}
              >
                {batchBusy ? '执行中…' : `开始编译（${selected.length}）`}
              </button>
            </>
          }
        />
      ) : null}

      <MaterialRecycleModal recycle={recycle} />

      {compareMode && detail ? (
        <MaterialCompare
          materialId={detail.material.materialId}
          mode={compareMode}
          versions={detail.versions}
          currentVersionId={detail.material.currentVersionId}
          versionId={detail.material.currentVersionId || undefined}
          onClose={() => setCompareMode(null)}
        />
      ) : null}
    </>
  );
}
