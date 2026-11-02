import Icon from '@/components/icon';
import { formatFileSize, formatShortDateTime } from '@/utils/format';
import { MATERIAL_TYPE_META, materialFileIcon } from '../material-workspace-model';
import { MATERIAL_STATUS, PARSE_STATUS, VERSION_STATUS } from '../material-status';
import type { MaterialWorkspaceController } from '../hooks/use-material-workspace';

interface MaterialListPanelProps {
  ctrl: MaterialWorkspaceController;
}

export default function MaterialListPanel({ ctrl }: MaterialListPanelProps) {
  const {
    keyword,
    setKeyword,
    queryKeyword,
    page,
    setPage,
    records,
    total,
    totalPages,
    loading,
    selected,
    busy,
    currentCategory,
    categoryId,
    canWrite,
    canCompile,
    materialType,
    refreshAll,
    applySearch,
    clearSearch,
    selectCategory,
    openUpload,
    openBatch,
    askRemove,
    setMoveOpen,
    toggleAll,
    toggleSelected,
    openDetail,
    download,
  } = ctrl;

  const selectedSet = new Set(selected);

  return (
    <section className="panel">
      <div className="table-toolbar">
        <div className="left">
          <div className="input-icon">
            <span className="ic">
              <Icon name="search" size={13} />
            </span>
            <input
              className="input"
              placeholder="搜索标题"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applySearch();
                }
              }}
            />
          </div>
          <button className="btn sm" type="button" onClick={() => applySearch()}>
            搜索
          </button>
          {categoryId ? (
            <button
              className="btn sm"
              type="button"
              title="清除分类筛选，回到全部资料"
              onClick={() => selectCategory('')}
            >
              <Icon name="folder" size={12} />
              {currentCategory?.name || '文件夹'}
              <Icon name="x" size={11} />
            </button>
          ) : null}
          <button
            className="btn sm"
            type="button"
            disabled={!canWrite || !selected.length || busy}
            title="选择目标分类后批量移动"
            onClick={() => setMoveOpen(true)}
          >
            <Icon name="folder" size={12} />
            移动分类
          </button>
          <button
            className="btn sm"
            type="button"
            disabled={!canCompile || !selected.length || busy}
            title="按所选资料创建编译组别"
            onClick={openBatch}
          >
            <Icon name="layers" size={12} />
            知识编译
          </button>
          <button
            className="btn sm danger"
            type="button"
            disabled={!canWrite || !selected.length || busy}
            onClick={() => askRemove(selected)}
          >
            <Icon name="trash" size={12} />
            删除
          </button>
        </div>
        <div className="right">
          <button className="icon-btn" type="button" title="刷新" onClick={refreshAll}>
            <Icon name="refresh" size={14} />
          </button>
          {canWrite && materialType === 'DOCUMENT' ? (
            <button className="btn primary sm" type="button" onClick={openUpload}>
              <Icon name="upload" size={13} />
              上传资料
            </button>
          ) : null}
        </div>
      </div>
      {loading ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="file-text" size={20} />
          </div>
          <b>正在加载资料…</b>
        </div>
      ) : records.length ? (
        <>
          <div className="table-wrap">
            <table
              className="list-table material-table"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selected.length > 0 && selected.length === records.length}
                      onChange={toggleAll}
                      aria-label="全选"
                    />
                  </th>
                  <th>资料</th>
                  <th>类型</th>
                  <th>大小</th>
                  <th>物料状态</th>
                  <th>解析</th>
                  <th>登记时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const status = MATERIAL_STATUS[record.materialStatus] || {
                    label: record.materialStatus,
                    tag: 'gray',
                  };
                  const parse = record.parseStatus
                    ? PARSE_STATUS[record.parseStatus]
                    : undefined;
                  const fileIcon = materialFileIcon(record);
                  return (
                    <tr key={record.materialId}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(record.materialId)}
                          onChange={() => toggleSelected(record.materialId)}
                          aria-label={`选择 ${record.title}`}
                        />
                      </td>
                      <td>
                        <div className="name-cell">
                          <span className={`file-tile ${fileIcon.tone}`}>
                            {(record.fileExt || 'doc').slice(0, 3)}
                          </span>
                          <div className="nc">
                            <button
                              className="nc-title"
                              type="button"
                              title={record.title}
                              onClick={() => void openDetail(record.materialId)}
                            >
                              {record.title}
                            </button>
                            <small className="mono-sm">{record.materialId.slice(0, 8)}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {MATERIAL_TYPE_META[record.materialType]?.label || record.materialType}
                      </td>
                      <td>{formatFileSize(record.sizeBytes)}</td>
                      <td>
                        <span className={`tag ${status.tag}`}>{status.label}</span>
                      </td>
                      <td>
                        {parse ? (
                          <span
                            className={`tag ${parse.tag}`}
                            title={
                              record.versionStatus
                                ? VERSION_STATUS[record.versionStatus]?.label || record.versionStatus
                                : undefined
                            }
                          >
                            {parse.label}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{formatShortDateTime(record.registeredAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            type="button"
                            title="详情"
                            onClick={() => void openDetail(record.materialId)}
                          >
                            <Icon name="eye" size={13} />
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            title="下载原件"
                            onClick={() =>
                              void download(record.materialId, record.fileName || record.title)
                            }
                          >
                            <Icon name="download" size={13} />
                          </button>
                          {canWrite ? (
                            <button
                              className="icon-btn"
                              type="button"
                              title="删除"
                              onClick={() => askRemove([record.materialId])}
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span>
              共 {total} 条 · 第 {page}/{totalPages} 页
            </span>
            <div className="btn-group">
              <button
                className="btn sm"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                上一页
              </button>
              <button
                className="btn sm"
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="file-text" size={22} />
          </div>
          <b>
            {queryKeyword
              ? '没有匹配的资料'
              : materialType === 'DOCUMENT'
                ? categoryId
                  ? '这个分类还没有资料'
                  : '这个库还没有资料'
                : `暂无${MATERIAL_TYPE_META[materialType].label}类型资料`}
          </b>
          <p>
            {queryKeyword
              ? '换个关键词或切换分类再试。'
              : materialType === 'DOCUMENT'
                ? '上传 txt / md / csv / json 等文本文件后，会在此登记并生成解析稿。'
                : MATERIAL_TYPE_META[materialType].hint}
          </p>
          {queryKeyword ? (
            <button className="btn" type="button" onClick={clearSearch}>
              清空搜索
            </button>
          ) : null}
          {canWrite && !queryKeyword && materialType === 'DOCUMENT' ? (
            <button className="btn primary" type="button" onClick={openUpload}>
              <Icon name="upload" size={14} />
              {categoryId ? '上传到该分类' : '上传第一份资料'}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
