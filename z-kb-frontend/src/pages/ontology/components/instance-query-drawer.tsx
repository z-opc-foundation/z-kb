import Icon from '@/components/icon';
import { useEscapeKey } from '@/hooks/use-escape-key';
import type { OntologyInstanceLinkRecord } from '@/services/ontology';
import { useState } from 'react';
import type { useInstanceQuery } from '../hooks/use-instance-query';

type QueryApi = ReturnType<typeof useInstanceQuery>;

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return String(value);
}

function propKeys(
  records: Array<{ properties?: Record<string, unknown> }>,
): string[] {
  const keys: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record.properties ?? {})) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  return keys;
}

function Pager({
  current,
  size,
  total,
  loading,
  onTurn,
}: {
  current: number;
  size: number;
  total: number;
  loading: boolean;
  onTurn: (page: number) => void;
}) {
  const pages = Math.max(Math.ceil(total / Math.max(size, 1)), 1);
  return (
    <div className="ont-instance-filter">
      <span className="note">
        共 {total} 条 · 第 {current}/{pages} 页
        {loading ? ' · 加载中…' : ''}
      </span>
      {total > size ? (
        <span className="ont-instance-foot">
          <button
            className="btn xs ghost"
            type="button"
            disabled={current <= 1}
            onClick={() => onTurn(current - 1)}
          >
            上一页
          </button>
          <button
            className="btn xs ghost"
            type="button"
            disabled={current >= pages}
            onClick={() => onTurn(current + 1)}
          >
            下一页
          </button>
        </span>
      ) : null}
    </div>
  );
}

function LinkRows({ records }: { records: OntologyInstanceLinkRecord[] }) {
  const keys = propKeys(records.map((r) => ({ properties: r.edgeProperties })));
  return (
    <div className="table-wrap">
      <table className="list-table">
        <thead>
          <tr>
            <th>源实例</th>
            <th>目标实例</th>
            {keys.map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.srcVid}-${record.dstVid}-${keys.join()}`}>
              <td title={record.srcVid}>{record.srcName || record.srcVid}</td>
              <td title={record.dstVid}>{record.dstName || record.dstVid}</td>
              {keys.map((key) => (
                <td key={key}>{cellText(record.edgeProperties?.[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 实例查询抽屉：tag 模式分页查对象类型实例；link 模式分页查关系实例对。 */
export function InstanceQueryDrawer({ api }: { api: QueryApi }) {
  const { target, state, query, close, search, turnPage, retry } = api;
  const [keywordInput, setKeywordInput] = useState('');

  useEscapeKey(() => {
    if (target) close();
  });

  if (!target) {
    return null;
  }

  const tagMode = target.mode === 'tag';
  const title = tagMode
    ? `${target.tagName} 实例`
    : `${target.edgeName} 关系实例`;
  const subtitle = tagMode
    ? '按对象类型分页查询 · 图库真实数据'
    : `源 ${target.srcTag ?? '不限'} → 目标 ${target.dstTag ?? '不限'} · 图库真实数据`;

  return (
    <div className="overlay drawer-overlay" onMouseDown={close}>
      <div
        className="drawer ont-instance-drawer"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="d-top">
            <div className="d-icon">
              <Icon name={tagMode ? 'tag' : 'link'} size={18} />
            </div>
            <div className="d-copy">
              <h2>
                {title}
                <span className={`tag sm ${state.graphBound ? 'green' : 'amber'}`}>
                  {state.graphBound ? '图库数据' : '图库未接入'}
                </span>
              </h2>
              <div className="d-sub">{subtitle}</div>
            </div>
            <div className="d-actions">
              <button
                className="close-btn"
                type="button"
                aria-label="关闭"
                onClick={close}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="drawer-body">
          {state.failed ? (
            <div className="ont-instance-empty">
              <b>实例查询失败</b>
              <button className="btn xs ghost" type="button" onClick={retry}>
                重试
              </button>
            </div>
          ) : state.loading && state.records.length === 0 && state.linkRecords.length === 0 ? (
            <div className="ont-instance-empty">
              <b>正在加载实例…</b>
            </div>
          ) : !state.graphBound ? (
            <div className="ont-instance-empty">
              <b>图库未接入</b>
              <span>实例查询链路已就绪，图库配置下发后此处自动展示真实实例。</span>
            </div>
          ) : (
            <>
              {tagMode ? (
                <div className="ont-instance-filter">
                  <input
                    className="input"
                    style={{ width: 220 }}
                    placeholder="按实例名/属性值模糊搜索"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        search(keywordInput);
                      }
                    }}
                  />
                  <button
                    className="btn xs ghost"
                    type="button"
                    onClick={() => search(keywordInput)}
                  >
                    查询
                  </button>
                </div>
              ) : null}

              {tagMode ? (
                state.records.length ? (
                  <div className="table-wrap">
                    <table className="list-table">
                      <thead>
                        <tr>
                          <th>实例名</th>
                          <th>vid</th>
                          {propKeys(state.records).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {state.records.map((record) => (
                          <tr key={record.vid}>
                            <td>{record.name || record.vid}</td>
                            <td title={record.vid}>{record.vid}</td>
                            {propKeys(state.records).map((key) => (
                              <td key={key}>
                                {cellText(record.properties?.[key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="ont-instance-empty">
                    <b>空结果是有效信号</b>
                    <span>
                      {query.keyword
                        ? '当前搜索条件下没有实例，试试清空关键词。'
                        : '该对象类型在图库中暂无实例。'}
                    </span>
                  </div>
                )
              ) : state.linkRecords.length ? (
                <LinkRows records={state.linkRecords} />
              ) : (
                <div className="ont-instance-empty">
                  <b>空结果是有效信号</b>
                  <span>该关系类型（含当前端点约束）在图库中暂无实例对。</span>
                </div>
              )}

              <Pager
                current={state.current}
                size={state.size}
                total={state.total}
                loading={state.loading}
                onTurn={turnPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
