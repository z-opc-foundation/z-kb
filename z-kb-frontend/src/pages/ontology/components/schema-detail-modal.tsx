import AppModal from '@/components/app-modal';
import {
  getOntologyEdgeDetail,
  getOntologyTagDetail,
  type OntologyEdgeDetail,
  type OntologyPropertyRecord,
  type OntologyTagDetail,
} from '@/services/ontology';
import { useEffect, useState } from 'react';
import { formatCount, LevelTag, SourceTag, StructureStatusTag } from './shared';

export interface SchemaDetailTarget {
  kind: 'tag' | 'edge';
  code: string;
  title: string;
  /** 分类展示名（由字典解析，兜底显示原始值）。 */
  categoryName?: string;
}

const DATA_TYPE_LABEL: Record<string, string> = {
  STRING: '字符串',
  INT: '整数',
  DOUBLE: '小数',
  BOOL: '布尔',
  DATE: '日期',
  DATETIME: '日期时间',
  TEXT: '长文本',
};

export function SchemaDetailModal({
  target,
  onClose,
}: {
  target: SchemaDetailTarget;
  onClose: () => void;
}) {
  const [tag, setTag] = useState<OntologyTagDetail | null>(null);
  const [edge, setEdge] = useState<OntologyEdgeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    setTag(null);
    setEdge(null);
    const load =
      target.kind === 'tag'
        ? getOntologyTagDetail(target.code)
        : getOntologyEdgeDetail(target.code);
    load.then((result) => {
      if (!alive) {
        return;
      }
      setLoading(false);
      if (!result) {
        setFailed(true);
        return;
      }
      if (target.kind === 'tag') {
        setTag(result as OntologyTagDetail);
      } else {
        setEdge(result as OntologyEdgeDetail);
      }
    });
    return () => {
      alive = false;
    };
  }, [target]);

  return (
    <AppModal
      icon={target.kind === 'tag' ? 'tag' : 'link'}
      title={`${target.kind === 'tag' ? '对象类型详情' : '关系类型详情'} · ${target.title}`}
      sub={target.code}
      width={720}
      onClose={onClose}
      body={
        loading ? (
          <div className="ont-detail-state">正在加载详情…</div>
        ) : failed ? (
          <div className="ont-detail-state">
            详情加载失败，可关闭后重试；退役结构仍可查询。
          </div>
        ) : (
          <div className="ont-detail">
            {tag ? (
              <>
                <div className="ont-detail-meta">
                  <span className="note">结构名</span>
                  <b className="mono-sm">{tag.tagName}</b>
                  <span className="note">分类</span>
                  <b>{target.categoryName || tag.category || '-'}</b>
                  <span className="note">业务域</span>
                  <b>{tag.bizDomain || '-'}</b>
                  <span className="note">层级</span>
                  <LevelTag levelCode={tag.levelCode} />
                  <span className="note">来源</span>
                  <SourceTag source={tag.sourceType} />
                  <span className="note">状态</span>
                  <StructureStatusTag status={tag.status} />
                  <span className="note">允许抽取</span>
                  <b>{tag.extractable === 1 ? '是' : '否'}</b>
                  <span className="note">实例数</span>
                  <b>{formatCount(tag.instanceCount)}</b>
                </div>
                {tag.description ? <p className="ont-detail-desc">{tag.description}</p> : null}
                <PropertyList properties={tag.properties} />
              </>
            ) : null}
            {edge ? (
              <>
                <div className="ont-detail-meta">
                  <span className="note">结构名</span>
                  <b className="mono-sm">{edge.edgeName}</b>
                  <span className="note">约束模式</span>
                  <b>{edge.constraintMode === 'STRICT' ? '严格（STRICT）' : '宽松（LOOSE）'}</b>
                  <span className="note">业务域</span>
                  <b>{edge.bizDomain || '-'}</b>
                  <span className="note">来源</span>
                  <SourceTag source={edge.sourceType} />
                  <span className="note">状态</span>
                  <StructureStatusTag status={edge.status} />
                  <span className="note">边规模</span>
                  <b>{formatCount(edge.edgeCount)}</b>
                </div>
                {edge.description ? <p className="ont-detail-desc">{edge.description}</p> : null}
                <h4 className="ont-detail-sub">端点约束对</h4>
                <div className="table-wrap">
                  <table className="list-table">
                    <thead>
                      <tr>
                        <th>源对象类型</th>
                        <th>目标对象类型</th>
                        <th>展示名</th>
                        <th>参与抽取</th>
                        <th>自环</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {edge.endpoints.map((endpoint) => (
                        <tr key={endpoint.code}>
                          <td className="mono-sm">{endpoint.srcTag || '-'}</td>
                          <td className="mono-sm">{endpoint.dstTag || '-'}</td>
                          <td>{endpoint.displayName || '-'}</td>
                          <td>{endpoint.extractable === 1 ? '是' : '否'}</td>
                          <td>{endpoint.selfLoop ? '是' : '否'}</td>
                          <td>
                            <StructureStatusTag status={endpoint.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PropertyList properties={edge.properties} />
              </>
            ) : null}
          </div>
        )
      }
      footLeft="tasks01 阶段为只读详情，属性建模在后续任务开放"
      footRight={
        <button className="btn" type="button" onClick={onClose}>
          关闭
        </button>
      }
    />
  );
}

function PropertyList({ properties }: { properties: OntologyPropertyRecord[] }) {
  return (
    <>
      <h4 className="ont-detail-sub">属性清单</h4>
      {!properties.length ? (
        <div className="ont-detail-state">暂无属性声明</div>
      ) : (
        <div className="table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>属性名</th>
                <th>展示名</th>
                <th>数据类型</th>
                <th>可空</th>
                <th>默认值</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.code}>
                  <td className="mono-sm">{property.propertyName}</td>
                  <td>{property.displayName || '-'}</td>
                  <td>{DATA_TYPE_LABEL[property.dataType] || property.dataType}</td>
                  <td>{property.nullable === 1 ? '是' : '否'}</td>
                  <td>{property.defaultValue || '-'}</td>
                  <td>{property.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
