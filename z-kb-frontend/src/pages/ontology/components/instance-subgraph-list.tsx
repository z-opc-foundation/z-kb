import type { OntologySubgraphView } from '@/services/ontology';
import { useMemo, useState } from 'react';

function matches(value: string, keyword: string): boolean {
  return !keyword || value.toLowerCase().includes(keyword.toLowerCase());
}

/** 实例子图列表视图：顶点表 + 实例边表，关键词本地过滤（≤500 条全量渲染）。 */
export function InstanceSubgraphList({ view }: { view: OntologySubgraphView }) {
  const [keyword, setKeyword] = useState('');

  const nameOfVid = useMemo(() => {
    const map = new Map<string, string>();
    view.nodes.forEach((n) => map.set(n.vid, n.name || n.vid));
    return map;
  }, [view]);

  const nodes = useMemo(
    () =>
      view.nodes.filter(
        (n) =>
          matches(n.name || n.vid, keyword) ||
          matches(n.vid, keyword) ||
          matches(n.tag, keyword),
      ),
    [view, keyword],
  );

  const edges = useMemo(() => {
    if (!keyword) return view.edges;
    return view.edges.filter((e) => {
      const srcName = nameOfVid.get(e.srcVid) ?? e.srcVid;
      const dstName = nameOfVid.get(e.dstVid) ?? e.dstVid;
      return (
        matches(e.edgeName, keyword) ||
        matches(srcName, keyword) ||
        matches(dstName, keyword)
      );
    });
  }, [view, keyword, nameOfVid]);

  return (
    <div className="ont-subgraph-list">
      <div className="ont-instance-filter">
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="按实例名 / 对象类型 / 关系类型过滤"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <span className="note">
          顶点 {nodes.length}/{view.nodes.length} · 实例边 {edges.length}/{view.edges.length}
          {view.truncated ? ' · 结果超限已截断' : ''}
        </span>
      </div>

      <div className="ont-subgraph-section">
        <h4>实例顶点</h4>
        {nodes.length > 0 ? (
          <div className="table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>实例名</th>
                  <th>对象类型</th>
                  <th>vid</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.vid}>
                    <td>{n.name || n.vid}</td>
                    <td>{n.tag}</td>
                    <td title={n.vid}>{n.vid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ont-instance-empty">
            <b>没有匹配的实例顶点</b>
            <span>试试清空关键词。</span>
          </div>
        )}
      </div>

      <div className="ont-subgraph-section">
        <h4>实例关系</h4>
        {edges.length > 0 ? (
          <div className="table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>关系类型</th>
                  <th>起点实例</th>
                  <th>终点实例</th>
                </tr>
              </thead>
              <tbody>
                {edges.map((e, i) => (
                  <tr key={`${e.edgeName}-${e.srcVid}-${e.dstVid}-${i}`}>
                    <td>{e.edgeName}</td>
                    <td title={e.srcVid}>{nameOfVid.get(e.srcVid) ?? e.srcVid}</td>
                    <td title={e.dstVid}>{nameOfVid.get(e.dstVid) ?? e.dstVid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ont-instance-empty">
            <b>{keyword ? '没有匹配的实例关系' : '所选对象类型集合内暂无实例关系'}</b>
            <span>
              {keyword
                ? '试试清空关键词。'
                : '勾选对象类型后无边场景属正常空结果，顶点仍会列出。'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
