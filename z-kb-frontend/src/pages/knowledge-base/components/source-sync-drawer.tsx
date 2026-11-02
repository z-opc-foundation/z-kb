import { createPortal } from 'react-dom';
import Icon from '@/components/icon';
import type { SourceSyncDrawerController } from '../hooks/use-source-sync-drawer';

interface SourceSyncDrawerProps {
  sync: SourceSyncDrawerController;
}

export default function SourceSyncDrawer({ sync }: SourceSyncDrawerProps) {
  const {
    target,
    loading,
    saving,
    catalog,
    selection,
    expandedBook,
    docCache,
    close,
    toggleBook,
    toggleDoc,
    loadDocs,
    saveAndSync,
  } = sync;
  if (!target) {
    return null;
  }
  const books = catalog?.books ?? [];
  // 抽屉挂在 body 上：工作台在带 z-index 的容器里，留在原地会被顶栏等兄弟节点盖住
  return createPortal(
    <div className="overlay drawer-overlay" onMouseDown={close}>
      <aside
        className="drawer task-config-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="d-top">
            <div className="d-icon">
              <Icon name="book" size={18} />
            </div>
            <div className="d-copy">
              <h2>同步 · {target.name}</h2>
              <div className="d-sub">
                <span>语雀</span>
                <span>·</span>
                <span>勾选知识库，展开可挑文章；不挑文章按整库同步</span>
              </div>
            </div>
            <div className="d-actions">
              <button className="icon-btn" type="button" onClick={close}>
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
        </div>
        <div className="drawer-body">
          <div className="row between mb-8">
            <b>同步范围</b>
            <span className="note">
              {selection.length
                ? `已选 ${selection.length} 个知识库，可展开挑文章`
                : '勾选知识库；不展开文章则整库同步'}
            </span>
          </div>
          {loading ? <span className="note">正在读取语雀目录…</span> : null}
          {!loading && !catalog ? (
            <span className="note">目录没有加载出来，关掉后重试，或到设置里的接入源检查凭据</span>
          ) : null}
          {!loading && catalog && books.length === 0 ? (
            <span className="note">
              {selection.length
                ? '当前团队没有读到知识库，已选范围保留'
                : '当前团队没有读到知识库，请到设置里的接入源检查团队空间'}
            </span>
          ) : null}
          {books.map((book) => {
            const picked = selection.find((item) => item.book === book.namespace);
            const cache = docCache[book.namespace];
            return (
              <div className="scope-book" key={book.namespace}>
                <div className="scope-book-row">
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={!!picked}
                    aria-label={`同步知识库 ${book.name}`}
                    onChange={() => toggleBook(book.namespace, book.name)}
                  />
                  <b>{book.name}</b>
                  <span className="note mono-sm">{book.namespace}</span>
                  <span className="tag gray sm">{book.docsCount ?? 0} 篇</span>
                  {picked ? (
                    <>
                      <span className={`tag ${picked.docs.length ? 'green' : 'gray'} sm`}>
                        {picked.docs.length ? `已选 ${picked.docs.length} 篇` : '整库'}
                      </span>
                      <button
                        className="btn sm"
                        type="button"
                        onClick={() => loadDocs(book.namespace)}
                      >
                        <Icon
                          name={expandedBook === book.namespace ? 'chevron-up' : 'chevron-down'}
                          size={11}
                        />
                        {expandedBook === book.namespace ? '收起文章' : '选文章'}
                      </button>
                    </>
                  ) : null}
                </div>
                {picked && expandedBook === book.namespace ? (
                  <div className="scope-book-docs">
                    {cache?.loading ? <span className="note">正在读取文章…</span> : null}
                    {cache && !cache.loading && cache.docs.length === 0 ? (
                      <span className="note">{cache.message || '没有读到文章'}</span>
                    ) : null}
                    {(cache?.docs ?? []).map((doc) => (
                      <label className="scope-doc" key={doc.slug}>
                        <input
                          className="checkbox"
                          type="checkbox"
                          checked={picked.docs.some((entry) => entry.slug === doc.slug)}
                          onChange={() => toggleDoc(book.namespace, doc)}
                        />
                        <span>{doc.title}</span>
                      </label>
                    ))}
                    {picked.docs.length ? (
                      <span className="note">取消全部文章勾选即回到整库同步</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="drawer-foot">
          <button className="btn" type="button" onClick={close}>
            取消
          </button>
          <div className="row gap-6">
            <button
              className="btn primary"
              type="button"
              disabled={saving || loading}
              onClick={saveAndSync}
            >
              <Icon name="refresh" size={12} />
              {saving ? '同步中…' : '保存并同步'}
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
