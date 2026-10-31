import Icon from '@/components/icon';
import { useState } from 'react';
import type {
  OntologyEdgeRecord,
  OntologyTagCategory,
  OntologyTagRecord,
} from '@/services/ontology';
import type { useTagCategories } from '../hooks/use-tag-categories';
import { useEdgeList, useTagList } from '../hooks/use-schema-list';
import { CategoryManageModal } from './category-manage-modal';
import { formatCount } from './shared';
import { SchemaDetailModal, type SchemaDetailTarget } from './schema-detail-modal';

const PANEL_PAGE_SIZE = 50;
const SUBGRAPH_TAG_MAX = 5;

const DOMAIN_PALETTE = ['#1f8bff', '#7c5cff', '#13a874', '#e8890c', '#e5487e', '#0f9bb2'];

const UNCATEGORIZED = '未分类';

export interface TypesPanelCategories {
  categories: OntologyTagCategory[];
  mutating: boolean;
  create: ReturnType<typeof useTagCategories>['create'];
  update: ReturnType<typeof useTagCategories>['update'];
  remove: ReturnType<typeof useTagCategories>['remove'];
  reorder: ReturnType<typeof useTagCategories>['reorder'];
  bindTag: ReturnType<typeof useTagCategories>['bindTag'];
}

interface OverviewTypesPanelProps {
  enabled: boolean;
  categories: TypesPanelCategories;
  selectedTags: string[];
  selectedEdges: string[];
  activeTagName?: string;
  activeEdgeName?: string;
  onToggleTag: (tagName: string) => void;
  onToggleEdge: (record: OntologyEdgeRecord) => void;
  onTagRowClick: (record: OntologyTagRecord) => void;
  onEdgeRowClick: (record: OntologyEdgeRecord) => void;
  onTagsMutated: () => void;
}

function domainColor(index: number): string {
  return DOMAIN_PALETTE[index % DOMAIN_PALETTE.length];
}

/** 按分类字典分组：组序 = 字典 sortOrder；tag.category 存分类编码，未匹配归「未分类」兜底。 */
function groupTags(records: OntologyTagRecord[], categories: OntologyTagCategory[]) {
  const groups: { name: string; items: OntologyTagRecord[] }[] = categories.map((category) => ({
    name: category.categoryName,
    items: [],
  }));
  const fallback = { name: UNCATEGORIZED, items: [] as OntologyTagRecord[] };
  for (const record of records) {
    const index = categories.findIndex((c) => c.code === record.category);
    if (index >= 0) {
      groups[index].items.push(record);
    } else {
      fallback.items.push(record);
    }
  }
  return fallback.items.length ? [...groups, fallback] : groups;
}

function groupEdges(records: OntologyEdgeRecord[]) {
  const strict = records.filter((r) => r.status === 'ACTIVE' && r.constraintMode === 'STRICT');
  const loose = records.filter((r) => r.status === 'ACTIVE' && r.constraintMode !== 'STRICT');
  const retired = records.filter((r) => r.status !== 'ACTIVE');
  return [
    { name: '强约束（严格）', color: '#7c5cff', items: strict },
    { name: '弱约束（宽松）', color: '#a9b8cb', items: loose },
    { name: '已退役', color: '#c2ccdb', items: retired },
  ].filter((g) => g.items.length);
}

/** 勾边需补选的端点对象类型超出 5 上限时置灰。 */
function isEdgeBlocked(record: OntologyEdgeRecord, selectedTags: string[]): boolean {
  const endpoints = Array.from(
    new Set(
      record.endpoints.flatMap((e) => [e.srcTag, e.dstTag]).filter((t): t is string => Boolean(t)),
    ),
  );
  const missing = endpoints.filter((t) => !selectedTags.includes(t));
  return missing.length > 0 && selectedTags.length + missing.length > SUBGRAPH_TAG_MAX;
}

export function OverviewTypesPanel({
  enabled,
  categories,
  selectedTags,
  selectedEdges,
  activeTagName,
  activeEdgeName,
  onToggleTag,
  onToggleEdge,
  onTagRowClick,
  onEdgeRowClick,
  onTagsMutated,
}: OverviewTypesPanelProps) {
  const [tab, setTab] = useState<'tags' | 'edges'>('tags');
  const [detail, setDetail] = useState<SchemaDetailTarget | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [assigningTag, setAssigningTag] = useState<string | null>(null);
  const tags = useTagList(enabled, PANEL_PAGE_SIZE);
  const edges = useEdgeList(enabled, PANEL_PAGE_SIZE);

  const list = tab === 'tags' ? tags : edges;
  const failed = list.failed;
  const loading = list.loading;

  const reloadTags = () => {
    tags.setFilters({ ...tags.filters });
  };

  const assignCategory = async (tagCode: string, categoryCode?: string) => {
    const bound = await categories.bindTag({ tagCode, categoryCode });
    if (bound) {
      setAssigningTag(null);
      reloadTags();
      onTagsMutated();
    }
  };

  return (
    <section className="panel ont-types">
      <div className="panel-head">
        <h3>
          <Icon name="list" size={14} />
          类型
        </h3>
        {tab === 'tags' ? (
          <span className="hint ont-head-actions">
            按分组
            <button className="btn xs ghost" type="button" onClick={() => setManageOpen(true)}>
              <Icon name="settings" size={11} />
              分组管理
            </button>
          </span>
        ) : (
          <span className="hint">按约束模式分组</span>
        )}
      </div>
      <div className="ont-tabs">
        <button
          type="button"
          className={`ont-tab${tab === 'tags' ? ' active' : ''}`}
          onClick={() => setTab('tags')}
        >
          <Icon name="tag" size={12} />
          对象类型
          <b>{tags.total}</b>
        </button>
        <button
          type="button"
          className={`ont-tab${tab === 'edges' ? ' active' : ''}`}
          onClick={() => setTab('edges')}
        >
          <Icon name="link" size={12} />
          关系类型
          <b>{edges.total}</b>
        </button>
      </div>

      {failed ? (
        <div className="ont-table-state">列表加载失败，请稍后重试</div>
      ) : loading ? (
        <div className="ont-table-state">正在加载{tab === 'tags' ? '对象类型' : '关系类型'}…</div>
      ) : tab === 'tags' ? (
        <div className="ont-types-body">
          {groupTags(tags.records, categories.categories).map((group, gi) => (
            <div key={group.name} className="ont-group">
              <div className="ont-group-head">
                <i style={{ background: domainColor(gi) }} />
                {group.name}
                <span>{group.items.length}</span>
              </div>
              {group.items.map((record) => (
                <div key={record.code}>
                  <TagRow
                    record={record}
                    color={domainColor(gi)}
                    active={activeTagName === record.tagName}
                    selected={selectedTags.includes(record.tagName)}
                    selectedCount={selectedTags.length}
                    assignOpen={assigningTag === record.code}
                    onToggleSelect={() => onToggleTag(record.tagName)}
                    onQuery={() => onTagRowClick(record)}
                    onDetail={() =>
                      setDetail({
                        kind: 'tag',
                        code: record.code,
                        title: record.displayName || record.tagName,
                        categoryName:
                          categories.categories.find((c) => c.code === record.category)
                            ?.categoryName,
                      })
                    }
                    onToggleAssign={() =>
                      setAssigningTag((prev) => (prev === record.code ? null : record.code))
                    }
                  />
                  {assigningTag === record.code ? (
                    <div className="ont-cat-assign">
                      {categories.categories.map((category) => (
                        <button
                          key={category.code}
                          type="button"
                          className={`ont-cat-chip${
                            record.category === category.code ? ' active' : ''
                          }`}
                          disabled={categories.mutating}
                          onClick={() => void assignCategory(record.code, category.code)}
                        >
                          {category.categoryName}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`ont-cat-chip${record.category ? '' : ' active'}`}
                        disabled={categories.mutating}
                        onClick={() => void assignCategory(record.code)}
                      >
                        {UNCATEGORIZED}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          <div className="ont-tab-note">
            <Icon name="info" size={11} />
            勾选 1~{SUBGRAPH_TAG_MAX} 个对象类型后可在图谱切到实例层；点击行在抽屉中查看图库真实实例。
          </div>
        </div>
      ) : (
        <div className="ont-types-body">
          {groupEdges(edges.records).map((group) => (
            <div key={group.name} className="ont-group">
              <div className="ont-group-head">
                <i style={{ background: group.color }} />
                {group.name}
                <span>{group.items.length}</span>
              </div>
              {group.items.map((record) => (
                <EdgeRow
                  key={record.code}
                  record={record}
                  color={group.color}
                  active={activeEdgeName === record.edgeName}
                  selected={selectedEdges.includes(record.edgeName)}
                  blocked={isEdgeBlocked(record, selectedTags)}
                  onToggleSelect={() => onToggleEdge(record)}
                  onQuery={() => onEdgeRowClick(record)}
                  onDetail={() =>
                    setDetail({
                      kind: 'edge',
                      code: record.code,
                      title: record.displayName || record.edgeName,
                    })
                  }
                />
              ))}
            </div>
          ))}
          <div className="ont-tab-note">
            <Icon name="info" size={11} />
            勾选关系类型会自动补选端点对象类型，且子图只看该类实例边；严格模式参与结构校验；宽松模式仅作关联提示。点击行在抽屉中查看真实关系实例。
          </div>
        </div>
      )}

      {detail ? <SchemaDetailModal target={detail} onClose={() => setDetail(null)} /> : null}
      {manageOpen ? (
        <CategoryManageModal
          categories={categories.categories}
          mutating={categories.mutating}
          onCreate={categories.create}
          onUpdate={categories.update}
          onRemove={categories.remove}
          onReorder={categories.reorder}
          onClose={() => {
            setManageOpen(false);
            reloadTags();
            onTagsMutated();
          }}
        />
      ) : null}
    </section>
  );
}

function TagRow({
  record,
  color,
  active,
  selected,
  selectedCount,
  assignOpen,
  onToggleSelect,
  onQuery,
  onDetail,
  onToggleAssign,
}: {
  record: OntologyTagRecord;
  color: string;
  active: boolean;
  selected: boolean;
  selectedCount: number;
  assignOpen: boolean;
  onToggleSelect: () => void;
  onQuery: () => void;
  onDetail: () => void;
  onToggleAssign: () => void;
}) {
  const off: boolean = record.status !== 'ACTIVE';
  const zero = !off && Number(record.instanceCount || 0) === 0;
  return (
    <div
      className={`ont-type-row${active ? ' active' : ''}${off ? ' off' : ''}`}
      onClick={onQuery}
      title={`在抽屉中查看 ${record.tagName} 的图库实例`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        className={`ont-row-check${selected ? ' checked' : ''}`}
        disabled={!selected && selectedCount >= SUBGRAPH_TAG_MAX}
        title={
          !selected && selectedCount >= SUBGRAPH_TAG_MAX
            ? `最多选择 ${SUBGRAPH_TAG_MAX} 个对象类型`
            : '加入实例子图选择'
        }
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
      />
      <i className="ont-dot" style={{ background: color }} />
      <span className="ont-type-main">
        <b>{record.tagName}</b>
        <small>
          {record.displayName || '-'}
          {zero ? ' · 零实例' : ''}
          {off ? ' · 已退役' : ''}
        </small>
      </span>
      <span className="ont-type-count">{formatCount(record.instanceCount)}</span>
      <button
        className={`ont-type-detail${assignOpen ? ' assign-open' : ''}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleAssign();
        }}
        title="选择分组"
      >
        <Icon name="tag" size={12} />
      </button>
      <button
        className="ont-type-detail"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDetail();
        }}
        title="类型详情"
      >
        <Icon name="chevron-right" size={12} />
      </button>
    </div>
  );
}

function EdgeRow({
  record,
  color,
  active,
  selected,
  blocked,
  onToggleSelect,
  onQuery,
  onDetail,
}: {
  record: OntologyEdgeRecord;
  color: string;
  active: boolean;
  selected: boolean;
  blocked: boolean;
  onToggleSelect: () => void;
  onQuery: () => void;
  onDetail: () => void;
}) {
  const off: boolean = record.status !== 'ACTIVE';
  const endpoint = record.endpoints[0];
  const selfLoop = endpoint?.srcTag && endpoint.srcTag === endpoint.dstTag;
  return (
    <div
      className={`ont-type-row${active ? ' active' : ''}${off ? ' off' : ''}`}
      onClick={onQuery}
      title={`在抽屉中查看 ${record.edgeName} 的图库关系实例`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        className={`ont-row-check${selected ? ' checked' : ''}`}
        disabled={blocked}
        title={
          blocked
            ? `勾选该边需补选端点类型，超出 ${SUBGRAPH_TAG_MAX} 个上限`
            : '勾选后子图只看该关系类型的实例边'
        }
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
      />
      <i className="ont-dot" style={{ background: color }} />
      <span className="ont-type-main">
        <b>{record.edgeName}</b>
        <small>
          {endpoint
            ? `${endpoint.srcTag ?? '?'} → ${endpoint.dstTag ?? '?'}${selfLoop ? ' · 自环' : ''}`
            : '未声明端点'}
          {off ? ' · 已退役' : ''}
        </small>
      </span>
      <span className="ont-type-count">{formatCount(record.edgeCount)}</span>
      <button
        className="ont-type-detail"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDetail();
        }}
        title="关系类型详情"
      >
        <Icon name="chevron-right" size={12} />
      </button>
    </div>
  );
}
