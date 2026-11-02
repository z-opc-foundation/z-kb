import Icon from '@/components/icon';
import {
  pageEvaluationKnowledgeBases,
  type EvalKbListRecord,
} from '@/services/evaluation';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  availabilityMeta,
  datasetStatusMeta,
  EmptyState,
  ErrorState,
  fmtNumber,
  fmtTime,
  LoadingState,
  normalizeNotConnected,
  StatusTag,
  Tag,
} from './components/shared';
import './index.less';

const PAGE_SIZE = 10;

export default function EvaluationListPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<EvalKbListRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    pageEvaluationKnowledgeBases({
      current: page,
      size: PAGE_SIZE,
      ...(appliedKeyword ? { keyword: appliedKeyword } : {}),
    }).then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      if (result === undefined) {
        setFailed(true);
        setRecords([]);
        setTotal(0);
        return;
      }
      setRecords(result.records || []);
      setTotal(result.total ?? (result.records || []).length);
    });
    return () => {
      alive = false;
    };
  }, [appliedKeyword, page, tick]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pages);

  const submitSearch = () => {
    setPage(1);
    setAppliedKeyword(keyword.trim());
  };

  const clearSearch = () => {
    setKeyword('');
    setAppliedKeyword('');
    setPage(1);
  };

  const openWorkbench = (record: EvalKbListRecord) => {
    navigate(`/knowledge-bases/${encodeURIComponent(record.kbId)}/evaluation`);
  };

  let body: ReactNode;
  if (loading) {
    body = (
      <section className="panel">
        <LoadingState title="正在加载评测库…" />
      </section>
    );
  } else if (failed) {
    body = (
      <section className="panel">
        <ErrorState
          title="评测库加载失败"
          description="pageKnowledgeBase 返回异常或接口暂未就绪；页面不使用本地样本补齐列表。"
          onRetry={() => setTick((value) => value + 1)}
        />
      </section>
    );
  } else if (!records.length) {
    body = (
      <section className="panel">
        <EmptyState
          icon={appliedKeyword ? 'search' : 'list'}
          title={appliedKeyword ? '没有匹配的评测库' : '尚无 QA 集合'}
          description={
            appliedKeyword
              ? `没有知识库匹配“${appliedKeyword}”。清空关键词后可查看全部真实记录。`
              : '列表只返回后端已有 QA 集合的知识库。进入任意知识库的「知识评测」创建 QA 草稿并发布后再发起跑批。'
          }
          action={
            appliedKeyword ? (
              <button className="btn" type="button" onClick={clearSearch}>
                清空搜索
              </button>
            ) : (
              <button
                className="btn"
                type="button"
                onClick={() => navigate('/knowledge-bases')}
              >
                <Icon name="database" size={13} />
                去知识库列表
              </button>
            )
          }
        />
      </section>
    );
  } else {
    body = (
      <section className="panel">
        <div className="panel-head">
          <h3>
            <Icon name="shield-check" size={14} />
            评测库
            <span className="hint">
              {loading ? '加载中' : `${records.length} / ${total} 个知识库`}
            </span>
          </h3>
          <div className="actions">
            <span className="note">按 pageKnowledgeBase 返回顺序展示</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>知识库</th>
                <th>QA 版本</th>
                <th>题数</th>
                <th>最近跑批</th>
                <th>可用性</th>
                <th>核心指标</th>
                <th>待修坏例</th>
                <th>前置状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const datasetMeta = datasetStatusMeta(record.datasetStatus);
                const availability = availabilityMeta({
                  runId: record.lastRunId,
                  resultUsable: record.resultUsable,
                });
                const notConnected = normalizeNotConnected(record.notConnected);
                return (
                  <tr
                    key={record.kbId}
                    className="c-pointer"
                    onClick={() => openWorkbench(record)}
                  >
                    <td>
                      <b>{record.kbName || record.kbId}</b>
                      <small className="mono-sm" style={{ display: 'block' }}>
                        {record.kbId}
                      </small>
                    </td>
                    <td>
                      <div className="eval-status-inline">
                        <span className="mono-sm">
                          {record.datasetVersion || '未配置'}
                        </span>
                        {record.datasetStatus ? (
                          <StatusTag meta={datasetMeta} />
                        ) : null}
                      </div>
                    </td>
                    <td className="mono-sm">{fmtNumber(record.caseCount)}</td>
                    <td>
                      {record.lastRunId ? (
                        <>
                          <span className="mono-sm">{record.lastRunId}</span>
                          <small className="note" style={{ display: 'block' }}>
                            {fmtTime(record.lastRunAt)}
                          </small>
                        </>
                      ) : (
                        <span className="note">未跑批</span>
                      )}
                    </td>
                    <td>
                      <StatusTag meta={availability} />
                    </td>
                    <td>
                      {record.lastRunId && record.coreTotal != null ? (
                        <b className="tnum">
                          {record.corePassCount ?? '—'} / {record.coreTotal}
                        </b>
                      ) : (
                        <span className="note">—</span>
                      )}
                    </td>
                    <td>
                      {record.openBadcaseCount == null ? (
                        <span className="note">—</span>
                      ) : (
                        <b className="tnum c-amber">{record.openBadcaseCount}</b>
                      )}
                    </td>
                    <td>
                      <div className="eval-status-inline">
                        {record.datasetStatus ? (
                          <StatusTag meta={datasetMeta} />
                        ) : (
                          <span className="note">QA 状态未返回</span>
                        )}
                      </div>
                      {notConnected.length ? (
                        <div className="tag-list eval-list-notconnected">
                          {notConnected.map((item) => (
                            <Tag
                              key={item.code}
                              tone="gray"
                              className="sm"
                            >
                              {item.label} · 未接入
                            </Tag>
                          ))}
                        </div>
                      ) : (
                        <span className="note">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        className="btn xs ghost"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openWorkbench(record);
                        }}
                      >
                        进入评测
                        <Icon name="chevron-right" size={10} />                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="panel-foot">
          <span>共 {total} 个知识库</span>
          <span className="mono">
            {currentPage} / {pages} 页
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className="view eval-list-page">
      <div className="panel mb-16" style={{ padding: 0 }}>
        <div className="panel-body" style={{ padding: '12px 14px' }}>
          <div className="eval-list-toolbar">
            <div className="input-icon">
              <Icon name="search" size={14} />
              <input
                className="input"
                value={keyword}
                placeholder="搜索知识库名称或 kbId"
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitSearch();
                  }
                }}
              />
            </div>
            <button className="btn primary" type="button" onClick={submitSearch}>
              <Icon name="search" size={13} />
              搜索
            </button>
            {appliedKeyword ? (
              <button className="btn" type="button" onClick={clearSearch}>
                清空
              </button>
            ) : null}
            <span className="spacer" />
            <span className="note">共 {total} 个知识库</span>
            <button
              className="btn sm ghost"
              type="button"
              onClick={() => setTick((value) => value + 1)}
              disabled={loading}
            >
              <Icon name="refresh" size={12} />
              刷新
            </button>
          </div>
        </div>
      </div>

      {body}

      {total > PAGE_SIZE ? (
        <div className="row between mt-16">
          <span className="note">
            第 {currentPage} / {pages} 页 · 共 {total} 个知识库
          </span>
          <div className="pagination">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <Icon name="chevron-left" size={12} />
            </button>
            {Array.from({ length: pages }, (_, index) => index + 1).map(
              (value) => (
                <button
                  key={value}
                  type="button"
                  className={value === currentPage ? 'active' : ''}
                  onClick={() => setPage(value)}
                >
                  {value}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <Icon name="chevron-right" size={12} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
