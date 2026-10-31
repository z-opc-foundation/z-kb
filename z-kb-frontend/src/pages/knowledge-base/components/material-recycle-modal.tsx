import { useState } from 'react';
import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import { formatFileSize, formatShortDateTime } from '@/utils/format';
import { MATERIAL_TYPE_META } from '../material-workspace-model';
import type { MaterialRecycleState } from '../hooks/use-material-recycle';

interface MaterialRecycleModalProps {
  recycle: MaterialRecycleState;
}

export default function MaterialRecycleModal({ recycle }: MaterialRecycleModalProps) {
  const {
    open,
    keyword,
    setKeyword,
    page,
    goPage,
    records,
    total,
    totalPages,
    loading,
    selected,
    busy,
    closeRecycle,
    applySearch,
    clearSearch,
    toggleSelected,
    toggleAll,
    restore,
    purge,
  } = recycle;
  const [pendingPurge, setPendingPurge] = useState<string[] | null>(null);

  if (!open) {
    return null;
  }

  const selectedSet = new Set(selected);

  return (
    <>
      <AppModal
        icon="trash"
        title="回收站"
        sub="已删除的资料可在此取回；彻底删除会清除原件与已生成的解析、检索数据，不可恢复"
        width={880}
        className="recycle-modal"
        onClose={() => {
          // 确认弹窗打开时 Esc 只关确认弹窗，回收站弹窗保持不动
          if (pendingPurge) {
            return;
          }
          closeRecycle();
        }}
        body={
          <div>
            <div className="table-toolbar">
              <div className="left">
                <div className="input-icon">
                  <span className="ic">
                    <Icon name="search" size={13} />
                  </span>
                  <input
                    className="input"
                    placeholder="搜索已删除资料标题"
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
                {keyword ? (
                  <button className="btn sm" type="button" onClick={clearSearch}>
                    清空
                  </button>
                ) : null}
              </div>
              <div className="right">
                <button
                  className="btn sm"
                  type="button"
                  disabled={busy || !selected.length}
                  onClick={() => void restore(selected)}
                >
                  <Icon name="refresh" size={12} />
                  取回
                </button>
                <button
                  className="btn sm danger"
                  type="button"
                  disabled={busy || !selected.length}
                  onClick={() => setPendingPurge(selected)}
                >
                  <Icon name="trash" size={12} />
                  彻底删除
                </button>
              </div>
            </div>
            {loading ? (
              <div className="empty">
                <b>正在加载回收站…</b>
              </div>
            ) : records.length ? (
              <>
                <div className="table-wrap">
                  <table className="list-table material-table recycle-table" style={{ width: '100%' }}>
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
                        <th>删除时间</th>
                        <th style={{ textAlign: 'right' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
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
                              <span className="file-tile text">
                                {(record.fileExt || 'doc').slice(0, 3)}
                              </span>
                              <div className="nc">
                                <span className="nc-title" title={record.title}>
                                  {record.title}
                                </span>
                                <small className="mono-sm">
                                  {record.materialId.slice(0, 8)}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {MATERIAL_TYPE_META[record.materialType]?.label ||
                              record.materialType}
                          </td>
                          <td>{formatFileSize(record.sizeBytes)}</td>
                          <td>{formatShortDateTime(record.updateTime)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-btn"
                                type="button"
                                title="取回"
                                disabled={busy}
                                onClick={() => void restore([record.materialId])}
                              >
                                <Icon name="refresh" size={13} />
                              </button>
                              <button
                                className="icon-btn"
                                type="button"
                                title="彻底删除"
                                disabled={busy}
                                onClick={() => setPendingPurge([record.materialId])}
                              >
                                <Icon name="trash" size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
                      onClick={() => goPage(page - 1)}
                    >
                      上一页
                    </button>
                    <button
                      className="btn sm"
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => goPage(page + 1)}
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty">
                <div className="empty-icon">
                  <Icon name="trash" size={22} />
                </div>
                <b>回收站为空</b>
                <p>
                  {keyword
                    ? '换个关键词再试。'
                    : '资料删除后会暂存在这里，可以取回或彻底删除。'}
                </p>
              </div>
            )}
          </div>
        }
        footLeft={selected.length ? `已选 ${selected.length} 份` : '勾选后可批量取回或彻底删除'}
        footRight={
          <button className="btn" type="button" disabled={busy} onClick={closeRecycle}>
            关闭
          </button>
        }
      />

      {pendingPurge ? (
        <AppModal
          icon="alert-triangle"
          title="彻底删除资料"
          sub="此操作不可恢复"
          width={480}
          onClose={() => {
            if (!busy) {
              setPendingPurge(null);
            }
          }}
          body={
            <div>
              <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                将彻底删除 {pendingPurge.length} 份资料的原件、版本、解析稿、检索块与概念提及；
                已生成的 Wiki 页面会下线，任务与评测历史保留。
              </p>
            </div>
          }
          footRight={
            <>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() => setPendingPurge(null)}
              >
                取消
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={busy}
                onClick={() => {
                  void purge(pendingPurge).then(() => setPendingPurge(null));
                }}
              >
                {busy ? '删除中…' : '确认彻底删除'}
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
