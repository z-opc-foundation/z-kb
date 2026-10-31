import Icon from '@/components/icon';
import type { AuditLogRecord, AuditLogType } from '@/services/audit';
import { formatDateTime } from '@/utils/format';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ActorFilter from './actor-filter';
import AuditDetailDrawer from './audit-detail-drawer';
import AuditStatsPanel from './audit-stats';
import { useFitPageSize } from './use-fit-page-size';
import {
  DEFAULT_AUDIT_PAGE_SIZE,
  useAuditLog,
  type AuditRangeFilter,
  type AuditResultFilter,
} from './use-audit-log';
import { useAuditStats } from './use-audit-stats';
import { useActorDirectory } from './use-actor-names';
import './audit-log.less';

type AuditTab = 'stats' | 'detail';

const TABS: { key: AuditTab; label: string; icon: string }[] = [
  { key: 'stats', label: '统计', icon: 'bar-chart' },
  { key: 'detail', label: '明细', icon: 'list' },
];

const RESULT_OPTIONS: { value: AuditResultFilter; label: string }[] = [
  { value: 'all', label: '全部结果' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
];

const RANGE_OPTIONS: { value: AuditRangeFilter; label: string }[] = [
  { value: 'all', label: '全部时间' },
  { value: '1h', label: '近 1 小时' },
  { value: '24h', label: '近 24 小时' },
  { value: '7d', label: '近 7 天' },
];

function pageItems(current: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  const items: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(pages - 1, current + 1);
  if (start > 2) {
    items.push('gap');
  }
  for (let value = start; value <= end; value += 1) {
    items.push(value);
  }
  if (end < pages - 1) {
    items.push('gap');
  }
  items.push(pages);
  return items;
}

export interface AuditLogPanelProps {
  /** 固定日志类型：系统审计页不限，知识库操作日志传 KB */
  type?: AuditLogType;
  /** 配合 type=KB 限定知识库，传 kbId */
  bizRef?: string;
  /** 系统审计页展示「归属」列，区分系统级与知识库级日志 */
  showType?: boolean;
}

/** 审计日志面板：统计与明细两个页签共用筛选条件、详情抽屉与操作人名册。 */
export default function AuditLogPanel({
  type,
  bizRef,
  showType = false,
}: AuditLogPanelProps) {
  const [tab, setTab] = useState<AuditTab>('detail');
  const [fitSize, setFitSize] = useState(DEFAULT_AUDIT_PAGE_SIZE);
  const wrapRef = useRef<HTMLDivElement>(null);
  const audit = useAuditLog({ type, bizRef, pageSize: fitSize });
  const measured = useFitPageSize(
    wrapRef,
    `${audit.records.length}-${tab === 'detail' ? 'detail' : 'stats'}`,
    DEFAULT_AUDIT_PAGE_SIZE,
  );
  const { names: actorNames } = useActorDirectory();
  const [detail, setDetail] = useState<AuditLogRecord | null>(null);
  const kbScope = type === 'KB';

  const stats = useAuditStats({ type, bizRef }, audit.applied, tab === 'stats');

  useEffect(() => {
    setFitSize((prev) => (prev === measured ? prev : measured));
  }, [measured]);

  const renderRows = () =>
    audit.records.map((row) => {
      const failed = row.success === 0;
      return (
        <tr key={row.id} className="c-pointer" onClick={() => setDetail(row)}>
          <td className="mono-sm audit-time-cell">
            {formatDateTime(row.createTime, 'YYYY-MM-DD HH:mm:ss')}
          </td>
          {showType ? (
            <td>
              <div className="audit-inline">
                <span className={`tag ${row.type === 'KB' ? 'violet' : 'gray'} sm`}>
                  {row.type === 'KB' ? '知识库' : '系统'}
                </span>
                {row.type === 'KB' ? (
                  <span className="mono truncate" title={row.bizRef || ''}>
                    {row.bizRef || '—'}
                  </span>
                ) : null}
              </div>
            </td>
          ) : null}
          <td>
            <div className="audit-inline">
              <b title={row.actionDesc || row.action}>{row.actionDesc || row.action}</b>
              <span className="mono truncate">{row.action}</span>
            </div>
          </td>
          <td className="audit-actor-cell">
            {row.actorId == null ? (
              '—'
            ) : actorNames[row.actorId] ? (
              <span title={`actorId ${row.actorId}`}>{actorNames[row.actorId]}</span>
            ) : (
              <span className="mono-sm">{row.actorId}</span>
            )}
          </td>
          <td>
            <div className="audit-inline">
              <span className={`tag ${failed ? 'red' : 'green'} sm`}>
                {failed ? '失败' : '成功'}
              </span>
              {failed && row.errorMessage ? (
                <span className="audit-error-inline truncate" title={row.errorMessage}>
                  {row.errorMessage}
                </span>
              ) : null}
            </div>
          </td>
          <td className="mono-sm tnum">
            {row.durationMs == null ? '—' : `${row.durationMs} ms`}
          </td>
          <td className="audit-col-request">
            <div className="audit-inline">
              <span className="tag gray sm">{row.httpMethod || '—'}</span>
              <span className="mono truncate" title={row.requestUri || ''}>
                {row.requestUri || '—'}
              </span>
            </div>
          </td>
          <td>
            <button
              className="btn xs"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDetail(row);
              }}
            >
              查看
            </button>
          </td>
        </tr>
      );
    });

  let body: ReactNode;
  if (audit.loading && !audit.records.length) {
    body = (
      <div className="empty">
        <span className="empty-icon">
          <span className="spinner" />
        </span>
        <b>正在读取操作日志…</b>
        <p>列表按 X-Tenant-Code 只返回当前租户的留痕。</p>
      </div>
    );
  } else if (audit.error) {
    body = (
      <div className="callout danger" style={{ margin: 16 }}>
        <Icon name="alert-triangle" size={15} />
        <div className="ct">
          <b>操作日志加载失败</b>
          <p>{audit.error}</p>
          <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={audit.reload}>
            重试
          </button>
        </div>
      </div>
    );
  } else if (!audit.records.length) {
    body = (
      <div className="empty">
        <span className="empty-icon">
          <Icon name="inbox" size={20} />
        </span>
        <b>
          {audit.filtered
            ? '没有匹配的操作记录'
            : kbScope
              ? '这个知识库还没有操作记录'
              : '当前租户还没有审计记录'}
        </b>
        <p>
          {audit.filtered
            ? '换个关键词、操作人或时间范围再试。'
            : kbScope
              ? '在这个知识库里上传资料、改配置或跑编译后，会在这里留下记录。'
              : '关键写操作执行后会自动留痕，下一次写操作后即可在这里看到。'}
        </p>
        {audit.filtered ? (
          <button className="btn" type="button" onClick={audit.reset}>
            清空筛选
          </button>
        ) : null}
      </div>
    );
  } else {
    body = (
      <div className={`table-wrap ${audit.loading ? 'is-fitting' : ''}`} ref={wrapRef}>
        <table className="list-table audit-detail-table">
          <thead>
            <tr>
              <th style={{ width: 150 }}>时间</th>
              {showType ? <th style={{ width: 120 }}>归属</th> : null}
              <th>动作</th>
              <th style={{ width: 76 }}>操作人</th>
              <th style={{ width: 124 }}>结果</th>
              <th style={{ width: 66 }}>耗时</th>
              <th className="audit-col-request" style={{ width: 170 }}>请求</th>
              <th style={{ width: 58 }}></th>
            </tr>
          </thead>
          <tbody>{renderRows()}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="audit-log-panel">
      <div className="audit-page-tabs">
        <div className="segmented">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? 'active' : ''}
              onClick={() => setTab(item.key)}
            >
              <Icon name={item.icon} size={12} />
              {item.label}
            </button>
          ))}
        </div>
        {/* 状态紧跟页签：放进筛选行会换行、表格高度跟着变，按高度换算的每页条数会来回抖 */}
        <span className="audit-tabs-status">
          {tab === 'detail' && audit.loading && audit.records.length ? (
            <span className="audit-loading" role="status">
              <span className="spinner" />
              加载中…
            </span>
          ) : tab === 'stats' && stats.loading && stats.stats ? (
            <span className="audit-loading" role="status">
              <span className="spinner" />
              正在汇总…
            </span>
          ) : null}
        </span>
      </div>

      <section className="panel audit-filter">
        <div className="panel-body">
          <div className="filter-bar">
            <div className="input-icon">
              <Icon name="search" size={13} />
              <input
                className="input"
                placeholder="搜索动作、说明、方法或路径"
                value={audit.draft.keyword}
                onChange={(event) =>
                  audit.setDraft((prev) => ({ ...prev, keyword: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    audit.submit();
                  }
                }}
              />
            </div>
            <ActorFilter value={audit.draft.actorId} onChange={audit.changeActor} />
            <div className="segmented sm">
              {RESULT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={audit.result === option.value ? 'active' : ''}
                  onClick={() => audit.changeResult(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="segmented sm">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={audit.range === option.value ? 'active' : ''}
                  onClick={() => audit.changeRange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="spacer"></span>
            {audit.filtered ? (
              <button className="btn sm ghost" type="button" onClick={audit.reset}>
                清空筛选
              </button>
            ) : null}
            <button
              className="btn sm ghost"
              type="button"
              onClick={() => {
                audit.reload();
                if (tab === 'stats') {
                  stats.reload();
                }
              }}
            >
              <Icon name="refresh" size={12} />
              刷新
            </button>
            <button className="btn sm" type="button" onClick={audit.submit}>
              <Icon name="search" size={12} />
              查询
            </button>
          </div>
        </div>
      </section>

      {tab === 'stats' ? (
        <AuditStatsPanel
          stats={stats.stats}
          error={stats.error}
          onRetry={stats.reload}
          showType={showType}
          actorNames={actorNames}
        />
      ) : (
        <>
          <section className="panel audit-table-panel">{body}</section>

          <div className="audit-pager">
            <span className="note">
              共 {audit.total} 条 · 第 {audit.page} / {audit.pages} 页 · 每页 {audit.size} 条 · 按时间倒序
            </span>
            <div className="pagination">
              <button
                type="button"
                title="上一页"
                aria-label="上一页"
                disabled={audit.page <= 1}
                onClick={() => audit.setPage(audit.page - 1)}
              >
                <Icon name="chevron-left" size={12} />
              </button>
              {pageItems(audit.page, audit.pages).map((item, index) =>
                item === 'gap' ? (
                  <span key={`gap-${index}`} className="audit-page-gap">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={item === audit.page ? 'active' : ''}
                    onClick={() => audit.setPage(item)}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                type="button"
                title="下一页"
                aria-label="下一页"
                disabled={audit.page >= audit.pages}
                onClick={() => audit.setPage(audit.page + 1)}
              >
                <Icon name="chevron-right" size={12} />
              </button>
            </div>
          </div>
        </>
      )}

      {detail ? (
        <AuditDetailDrawer
          record={detail}
          actorName={detail.actorId == null ? undefined : actorNames[detail.actorId]}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
