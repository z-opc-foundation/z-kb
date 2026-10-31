import { useState } from 'react';
import { toast } from '@/utils/toast';
import { InstanceQueryDrawer } from './components/instance-query-drawer';
import { OntologyEmpty } from './components/ontology-empty';
import { OntologyFormModal } from './components/ontology-form-modal';
import { OntologyInfoBar } from './components/ontology-info-bar';
import { OverviewTypesPanel } from './components/overview-types-panel';
import { SchemaGraphCanvas } from './components/schema-graph-canvas';
import { useGraphLayers } from './hooks/use-graph-layers';
import { useGraphView } from './hooks/use-graph-view';
import { useInstanceQuery } from './hooks/use-instance-query';
import { useOntologyDetail } from './hooks/use-ontology-detail';
import { useTagCategories } from './hooks/use-tag-categories';
import './ontology.less';

export default function OntologyPage() {
  const { detail, state, saving, reload, save } = useOntologyDetail();
  const open = state === 'open';
  const graph = useGraphView(open);
  const layers = useGraphLayers();
  const instanceQuery = useInstanceQuery();
  const categories = useTagCategories(open);
  const [formOpen, setFormOpen] = useState(false);

  const instanceTotal = (graph.view?.nodes || []).reduce(
    (sum, node) => sum + (Number(node.instanceCount) || 0),
    0,
  );

  const highlightCode =
    instanceQuery.target?.mode === 'tag'
      ? instanceQuery.target.tagName
      : instanceQuery.target?.mode === 'link'
        ? instanceQuery.target.edgeName
        : undefined;

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>本体图谱</h1>
          <p className="sub">
            一租户一本体：结构图谱与实例查询为核心，支持分组管理、对象/关系类型查看与图库实例下钻。
          </p>
        </div>
      </div>

      {state === 'loading' ? (
        <section className="panel ont-page-state">正在加载本体信息…</section>
      ) : state === 'failed' ? (
        <section className="panel ont-page-state">
          本体信息加载失败
          <button className="btn xs ghost" type="button" onClick={() => void reload()}>
            重试
          </button>
        </section>
      ) : state === 'notOpen' ? (
        <OntologyEmpty onOpen={() => setFormOpen(true)} />
      ) : detail ? (
        <>
          <OntologyInfoBar
            detail={detail}
            instanceTotal={String(instanceTotal)}
            onOpenSettings={() => setFormOpen(true)}
          />
          <div className="ov-split">
            <OverviewTypesPanel
              enabled={open}
              categories={categories}
              selectedTags={layers.selectedTags}
              activeTagName={
                instanceQuery.target?.mode === 'tag'
                  ? instanceQuery.target.tagName
                  : undefined
              }
              activeEdgeName={
                instanceQuery.target?.mode === 'link'
                  ? instanceQuery.target.edgeName
                  : undefined
              }
              onToggleTag={layers.toggleTag}
              selectedEdges={layers.selectedEdges}
              onToggleEdge={(record) => {
                const endpoints = Array.from(
                  new Set(
                    record.endpoints
                      .flatMap((e) => [e.srcTag, e.dstTag])
                      .filter((t): t is string => Boolean(t)),
                  ),
                );
                const result = layers.toggleEdge(record.edgeName, endpoints);
                if (!result) {
                  toast(
                    '无法勾选该关系类型',
                    '勾选需补选端点对象类型，将超出 5 个上限',
                    'warn',
                  );
                }
              }}
              onTagRowClick={(record) => instanceQuery.open(record.tagName)}
              onEdgeRowClick={(record) => {
                const endpoint = record.endpoints[0];
                instanceQuery.openLink(
                  record.edgeName,
                  endpoint?.srcTag,
                  endpoint?.dstTag,
                );
              }}
              onTagsMutated={() => void graph.reload()}
            />
            <SchemaGraphCanvas
              view={graph.view}
              loading={graph.loading}
              failed={graph.failed}
              onRetry={() => void graph.reload()}
              onRefresh={() => void graph.reload()}
              categories={categories.categories}
              layer={layers.layer}
              selectedTags={layers.selectedTags}
              subgraph={layers.subgraph}
              highlightCode={highlightCode}
              onEnterInstanceLayer={layers.enterInstanceLayer}
              onEnterInstanceWith={layers.enterInstanceWith}
              onBackToStructure={layers.backToStructureLayer}
              onReloadSubgraph={layers.reloadSubgraph}
              onNodeClick={(tagName) => instanceQuery.open(tagName)}
              onEdgeClick={(target) =>
                instanceQuery.openLink(target.edgeName, target.srcTag, target.dstTag)
              }
            />
          </div>
        </>
      ) : null}

      <InstanceQueryDrawer api={instanceQuery} />

      {formOpen ? (
        <OntologyFormModal
          mode={state === 'notOpen' ? 'create' : 'update'}
          ontology={detail}
          saving={saving}
          onClose={() => setFormOpen(false)}
          onSubmit={(payload) => {
            void save(payload, state === 'notOpen' ? 'create' : 'update').then((saved) => {
              if (saved) {
                setFormOpen(false);
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}
