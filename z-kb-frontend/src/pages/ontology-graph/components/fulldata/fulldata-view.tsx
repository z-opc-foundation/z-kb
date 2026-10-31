/**
 * 实例数据查询视图（FullDataView）：自 galaxy-meta ontology-fulldata.tsx 平移。
 *
 * 交互总览：
 *   1. 顶部链路图：按链路顺序展示对象节点 + 关系箭头，点击对象 / 关系展开
 *      属性勾选面板，并可由工具栏最左侧的按钮整体收起 / 展开；
 *   2. 属性勾选面板：为每个出现位置勾选要进入表格的属性（默认取前 3 个）；
 *      链路上的对象还可「暂时失效」——关系查询下从两端把端点对象及其相邻关系
 *      成对收起（收缩子链路），独立查询下任意对象都能单独收起；
 *   3. 数据加载层：分「独立查询」与「关系查询」两种模式，走 executeNGQLQuery，
 *      用 useRef 做结果缓存，请求批次号规避竞态；
 *   4. 表格渲染层：AG Grid 列分组 + 共享行索引 / 关系路径行，排序 / 列过滤 /
 *      列宽拖拽 / 行虚拟化全走 AG Grid 内建能力；
 *   5. 查询语句面板：只读展示本次查询的 nGQL 与中文说明
 *      （monaco 编辑器与手工执行按搬运决策暂不引入，图库接入时再评估）。
 *
 * UI 体系映射（antd → fe 自研）：Segmented→.segmented、Popover 面板→链路图下
 * 内联展开、message→toast、Modal→AppModal、Tooltip→原生 title。
 */
import type {
  CellClassParams,
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  ValueGetterParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { AgGridReact } from 'ag-grid-react';
import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import type { SpaceMetadata } from '@/services/ontology-graph';
import { executeNGQLQuery } from '@/services/ontology-graph';
import { toast } from '@/utils/toast';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChainEdge,
  ChainObjectMeta,
  GraphLinkItem,
  GraphNodeItem,
  OntologyObjectInfo,
  PathStep,
  QueryMode,
  TableRow,
} from '../../types';
import {
  buildInstanceNGQL,
  buildRelationNGQL,
  describeQueryFailure,
  serializeFilters,
} from '../../utils/query';
import {
  buildAttrHeaderTemplate,
  dedupeInstanceRows,
  dedupePathRows,
  describeFilters,
  downloadCsv,
  estimateTextWidth,
  formatCellValue,
  getPropCnName,
  isBlankCellValue,
  VERTEX_ID_SUFFIX,
} from '../../utils/format';
import {
  getPathEdgeLabel,
  getPathNodeKey,
  getPathNodeLabel,
} from '../../utils/path-search';
import {
  AG_LOCALE_TEXT,
  EDGE_COL_HEADER_FONT_SIZE,
  EDGE_COL_ID_PREFIX,
  EDGE_COL_MAX_WIDTH,
  EDGE_COL_MIN_WIDTH,
  EDGE_COL_TEXT_PADDING,
  EdgeGroupHeader,
  GroupHeaderWithFilter,
  MAX_FILTER_CONDITIONS,
  type GroupLeafCol,
} from './fulldata-headers';
import {
  FulldataPropPanel,
  toObjectPropDefs,
  type PropPanelPropDef,
} from './fulldata-prop-panel';
import '../../fulldata.less';

// ==================== Props ====================

export interface FulldataViewProps {
  /** 路径数据：node / edge 交替出现的步骤序列 */
  pathData: PathStep[];
  /** 图空间名 */
  spaceName: string;
  /** 对象定义列表（属性已归一为 name/type/description） */
  objects: OntologyObjectInfo[];
  /** 元数据（含 relationPropertiesMap） */
  metadata: SpaceMetadata | null;
  /** 打开实例数据图谱标签页：把当前表格数据与链路传出 */
  onOpenGraph: (data: {
    rowData: TableRow[];
    chainNodes: string[];
    chainEdges: ChainEdge[];
  }) => void;
}

// ==================== 常量 ====================

/** 默认展示的属性数量：首屏为每个对象自动勾选前 N 个属性 */
const DEFAULT_PROP_COUNT = 3;
/** 查询行数上限的默认值，清空即不加 LIMIT（查全量） */
const DEFAULT_QUERY_LIMIT = 1000;
/** 「限制」输入框允许的行数区间：上限之外的值容易把查询打崩 */
const MIN_QUERY_LIMIT = 1;
const MAX_QUERY_LIMIT = 100000;
/** 属性过滤输入框 / 行数限制输入框的防抖时长（ms） */
const FILTER_DEBOUNCE_MS = 500;
/** 配色循环数（对应 less 中 .lc-fd-c0 ~ .lc-fd-c7） */
const PALETTE_SIZE = 8;
/** 聚合视角下，单元格内最多展开的去重值个数，超出部分折叠为计数 */
const AGG_VALUE_LIMIT = 5;

type RawRow = Record<string, unknown>;

// ==================== 组件 ====================

export function FulldataView({
  pathData,
  spaceName,
  objects,
  metadata,
  onOpenGraph,
}: FulldataViewProps) {
  // ─── 0. 链路拆解：节点序列 + 节点间关系序列（自 meta LogicChainView 平移）───
  const chainNodes = useMemo<GraphNodeItem[]>(
    () => pathData.filter((s) => s.type === 'node').map((s) => s.data as GraphNodeItem),
    [pathData],
  );
  const chainEdges = useMemo<ChainEdge[]>(() => {
    const list: ChainEdge[] = [];
    pathData.forEach((step, idx) => {
      if (step.type !== 'edge') return;
      const prevKey = getPathNodeKey(pathData[idx - 1]?.data);
      const d = step.data as GraphLinkItem;
      list.push({
        edgeType: String(d?.value ?? d?.code ?? ''),
        label: getPathEdgeLabel(d),
        forward: String(d?.source ?? '') === prevKey,
        source: String(d?.source ?? ''),
        target: String(d?.target ?? ''),
      });
    });
    return list;
  }, [pathData]);

  // ─── 1. 链路对象元信息：去重 + 分配循环配色 ───
  const objectMetas = useMemo<ChainObjectMeta[]>(() => {
    const seen = new Set<string>();
    const list: ChainObjectMeta[] = [];
    chainNodes.forEach((node) => {
      const code = getPathNodeKey(node);
      if (!code || seen.has(code)) return;
      seen.add(code);
      list.push({
        code,
        name: getPathNodeLabel(node),
        colorIndex: list.length % PALETTE_SIZE,
      });
    });
    return list;
  }, [chainNodes]);

  const metaMap = useMemo<Record<string, ChainObjectMeta>>(() => {
    const map: Record<string, ChainObjectMeta> = {};
    objectMetas.forEach((m) => {
      map[m.code] = m;
    });
    return map;
  }, [objectMetas]);

  /** 路径文本描述：「对象 → [关系] → 对象」串 */
  const pathText = useMemo(
    () =>
      (pathData || [])
        .map((s) =>
          s.type === 'node'
            ? getPathNodeLabel(s.data)
            : `[${getPathEdgeLabel(s.data)}]`,
        )
        .join(' → '),
    [pathData],
  );

  /** 对象属性定义：code → 归一化属性（name + 中文名） */
  const objectPropsByCode = useMemo<Record<string, PropPanelPropDef[]>>(() => {
    const map: Record<string, PropPanelPropDef[]> = {};
    (objects || []).forEach((o) => {
      map[o.objectCode] = toObjectPropDefs(o.properties);
    });
    return map;
  }, [objects]);

  const getObjectProps = (code: string): PropPanelPropDef[] =>
    objectPropsByCode[code] || [];

  /** 关系属性定义：edgeType → 归一化属性（propertyName + 中文名） */
  const edgePropsByType = useMemo<Record<string, PropPanelPropDef[]>>(() => {
    const map: Record<string, PropPanelPropDef[]> = {};
    const propsMap = metadata?.relationPropertiesMap;
    if (!propsMap) return map;
    Object.keys(propsMap).forEach((edgeType) => {
      map[edgeType] = (propsMap[edgeType] || [])
        .map((p) => ({
          name: String(p?.propertyName ?? ''),
          cnName: getPropCnName({
            name: p?.propertyName,
            description: p?.description,
          }),
        }))
        .filter((p) => !!p.name);
    });
    return map;
  }, [metadata]);

  // ─── 2. 属性勾选状态 ───
  /** 每个出现位置（stepKey=`{code}__{pathData下标}`）对应「已勾选的属性列表」 */
  const [selectedProps, setSelectedProps] = useState<Record<string, string[]>>({});
  /** 属性值过滤条件（即时值，回显用）：stepKey → { 属性: 关键词 } */
  const [filterConditions, setFilterConditions] = useState<
    Record<string, Record<string, string>>
  >({});
  /** 防抖后的过滤条件：输入停稳 FILTER_DEBOUNCE_MS 后才生效 */
  const [debouncedFilters, setDebouncedFilters] = useState<
    Record<string, Record<string, string>>
  >({});
  /** 当前打开属性勾选面板的路径步骤下标（对象 / 关系互斥，各自记录） */
  const [openStepIdx, setOpenStepIdx] = useState<number | null>(null);
  const [openEdgeStepIdx, setOpenEdgeStepIdx] = useState<number | null>(null);

  // ─── 2.0 关系属性勾选状态（按 edgeType 归集，仅关系查询模式生效）───
  const [selectedEdgeProps, setSelectedEdgeProps] = useState<
    Record<string, string[]>
  >({});
  const [edgeFilterConditions, setEdgeFilterConditions] = useState<
    Record<string, Record<string, string>>
  >({});
  const [debouncedEdgeFilters, setDebouncedEdgeFilters] = useState<
    Record<string, Record<string, string>>
  >({});
  /**
   * 在列表中隐藏的对象 / 关系集合（仅控列显隐，不影响查询）。
   * 与「清空属性勾选」（改 RETURN）、「暂时失效」（改 MATCH）互不相干。
   */
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  /** 链路图是否收起：收起后仅剩工具栏及表格 */
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  // ─── 2.1 查询模式（独立查询 / 关系查询）───
  const [queryMode, setQueryMode] = useState<QueryMode>(() =>
    (chainEdges || []).length === 0 ? 'independent' : 'relation',
  );
  /** 聚合视角：关系模式下按该对象归并路径，null 为不聚合（一行一路径） */
  const [aggregateBy, setAggregateBy] = useState<string | null>(null);
  /** 查询行数上限：null 表示不加 LIMIT（查全量） */
  const [queryLimit, setQueryLimit] = useState<number | null>(
    DEFAULT_QUERY_LIMIT,
  );
  const [debouncedLimit, setDebouncedLimit] = useState<number | null>(
    DEFAULT_QUERY_LIMIT,
  );

  /** 链路上按位置排列的对象 code 序列（不去重，供路径查询拼 MATCH） */
  const nodeCodes = useMemo(
    () => chainNodes.map(getPathNodeKey).filter(Boolean),
    [chainNodes],
  );

  // ─── 2.2 链路对象 / 关系的「暂时失效」状态 ───
  /**
   * 被暂时失效的 pathData 步骤下标集合：
   * - 关系查询：失效恒为「一段前缀 + 一段后缀」，端点节点与相邻关系成对进出，
   *   剩下的有效步骤必然连续，才能直接当成一条完整链路来查询；
   * - 独立查询：任意对象都能单独失效（不涉及关系），无连续性要求。
   */
  const [disabledSteps, setDisabledSteps] = useState<Set<number>>(new Set());

  const activeStepIdxs = useMemo(
    () =>
      (pathData || []).map((_, i) => i).filter((i) => !disabledSteps.has(i)),
    [pathData, disabledSteps],
  );

  /**
   * 有效子链路：排除失效步骤后的节点 code 序列、关系序列与参与对象元信息。
   * - effectiveObjectMetas 两种模式都收缩：失效对象退出表格、不再发起查询；
   * - effectiveNodeCodes / effectiveChainEdges 只在关系查询下收缩。独立查询里
   *   收缩路径没有意义，且这两份值参与 hasEdge 判定——一并收缩会让模式
   *   切换器随失效对象消失，用户再也切不回关系查询。
   */
  const {
    effectiveNodeCodes,
    effectiveChainEdges,
    effectiveObjectMetas,
    effectiveNodeStepIdxs,
  } = useMemo(() => {
    const fullStepIdxs: number[] = [];
    (pathData || []).forEach((step, i) => {
      if (step.type === 'node' && getPathNodeKey(step.data)) fullStepIdxs.push(i);
    });
    const fullChain = {
      effectiveNodeCodes: nodeCodes,
      effectiveNodeStepIdxs: fullStepIdxs,
      effectiveChainEdges: chainEdges,
      effectiveObjectMetas: objectMetas,
    };
    if (disabledSteps.size === 0) return fullChain;

    const effNodes: string[] = [];
    const effNodeStepIdxs: number[] = [];
    const effEdges: ChainEdge[] = [];
    (pathData || []).forEach((step, i) => {
      if (disabledSteps.has(i)) return;
      // pathData 中 node / edge 交替出现，两者在 chainNodes / chainEdges 中的下标均为 i / 2 下取整
      const seqIdx = Math.floor(i / 2);
      if (step.type === 'node') {
        const code = getPathNodeKey(step.data);
        if (code) {
          effNodes.push(code);
          effNodeStepIdxs.push(i);
        }
      } else if (chainEdges[seqIdx]) {
        effEdges.push(chainEdges[seqIdx]);
      }
    });
    // 对象元信息只做过滤不重排：配色下标沿用全链路分配，收缩后同对象仍同色
    const effCodes = new Set(effNodes);
    const effMetas = objectMetas.filter((m) => effCodes.has(m.code));

    if (queryMode !== 'relation') {
      return { ...fullChain, effectiveObjectMetas: effMetas };
    }
    return {
      effectiveNodeCodes: effNodes,
      effectiveNodeStepIdxs: effNodeStepIdxs,
      effectiveChainEdges: effEdges,
      effectiveObjectMetas: effMetas,
    };
  }, [pathData, chainEdges, objectMetas, nodeCodes, disabledSteps, queryMode]);

  /** code → 首次出现位置的 stepKey：独立模式下每对象只查一次，取此位置的过滤条件 */
  const firstStepKeyForCode = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (pathData || []).forEach((step, i) => {
      if (step.type !== 'node') return;
      const code = getPathNodeKey(step.data);
      if (code && !(code in map)) map[code] = `${code}__${i}`;
    });
    return map;
  }, [pathData]);

  /**
   * 可被点击失效的步骤下标，按模式给出不同范围：
   * - 关系查询：仅当前有效子链路两端的节点及其外侧相邻关系（至少保留 1 个对象）；
   * - 独立查询：任意有效对象都可失效，但至少保留 1 个有效对象。
   */
  const disableableSteps = useMemo<Set<number>>(() => {
    const result = new Set<number>();
    const activeNodeIdxs = activeStepIdxs.filter(
      (i) => (pathData || [])[i]?.type === 'node',
    );

    if (queryMode !== 'relation') {
      if (activeNodeIdxs.length <= 1) return result;
      activeNodeIdxs.forEach((i) => result.add(i));
      return result;
    }

    if (activeNodeIdxs.length <= 1) return result;
    const lastPos = activeStepIdxs.length - 1;
    if ((pathData || [])[activeStepIdxs[0]]?.type === 'node') {
      result.add(activeStepIdxs[0]);
    }
    if ((pathData || [])[activeStepIdxs[1]]?.type === 'edge') {
      result.add(activeStepIdxs[1]);
    }
    if ((pathData || [])[activeStepIdxs[lastPos]]?.type === 'node') {
      result.add(activeStepIdxs[lastPos]);
    }
    if ((pathData || [])[activeStepIdxs[lastPos - 1]]?.type === 'edge') {
      result.add(activeStepIdxs[lastPos - 1]);
    }
    return result;
  }, [pathData, activeStepIdxs, queryMode]);

  /** 链路上原本就没有任何关系（用户仅选中单个对象进入）：只支持独立查询 */
  const isSingleObjectChain = useMemo(
    () => (chainEdges || []).length === 0,
    [chainEdges],
  );

  /** 链路是否具备路径查询条件：至少两个节点且各段关系都有 edgeType */
  const hasEdge = useMemo(
    () =>
      effectiveNodeCodes.length >= 1 &&
      (effectiveNodeCodes.length < 2 ||
        (effectiveChainEdges.length >= effectiveNodeCodes.length - 1 &&
          effectiveNodeCodes
            .slice(1)
            .every(
              (_, i) => !!String(effectiveChainEdges?.[i]?.edgeType ?? ''),
            ))),
    [effectiveNodeCodes, effectiveChainEdges],
  );

  /** 有效子链路的文本描述：收缩后按此如实交代实际查询范围 */
  const effectivePathText = useMemo(() => {
    if (queryMode !== 'relation' || disabledSteps.size === 0) return pathText;
    return (pathData || [])
      .filter((_, i) => !disabledSteps.has(i))
      .map((s) =>
        s.type === 'node'
          ? getPathNodeLabel(s.data)
          : `[${getPathEdgeLabel(s.data)}]`,
      )
      .join(' → ');
  }, [pathData, disabledSteps, pathText, queryMode]);

  // 链路变化时：为每个出现位置默认勾选前 DEFAULT_PROP_COUNT 个属性，并清空
  // 过滤 / 失效 / 隐藏等旧链路残留（依赖路径签名而非引用，避免父组件重渲染导致重复重置）
  useEffect(() => {
    const next: Record<string, string[]> = {};
    (pathData || []).forEach((step, i) => {
      if (step.type !== 'node') return;
      const code = getPathNodeKey(step.data);
      if (!code) return;
      next[`${code}__${i}`] = getObjectProps(code)
        .slice(0, DEFAULT_PROP_COUNT)
        .map((p) => p.name)
        .filter(Boolean);
    });
    setSelectedProps(next);
    setFilterConditions({});
    setDebouncedFilters({});
    setSelectedEdgeProps({});
    setEdgeFilterConditions({});
    setDebouncedEdgeFilters({});
    setDisabledSteps(new Set());
    setHiddenGroups(new Set());
    setOpenStepIdx(null);
    setOpenEdgeStepIdx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    (pathData || [])
      .map((s) => (s.type === 'node' ? getPathNodeKey(s.data) : ''))
      .join('|'),
  ]);

  /**
   * 关系属性的默认勾选：有属性定义的关系自动勾上第一个属性。
   * 与对象属性分开两个 effect：关系属性来自异步取回的 relationPropertiesMap，
   * 链路重置那一刻往往还是空的，必须等它到位后再补。
   * 只补「从未设置过」（undefined）的关系：用户主动清空后是 []，不能被再次自动勾上。
   */
  useEffect(() => {
    const propsMap = metadata?.relationPropertiesMap;
    if (!propsMap) return;
    setSelectedEdgeProps((prev) => {
      const next = { ...prev };
      let changed = false;
      (effectiveChainEdges || []).forEach((edge) => {
        const edgeType = String(edge?.edgeType ?? '');
        if (!edgeType || next[edgeType] !== undefined) return;
        const first = String((propsMap[edgeType] || [])[0]?.propertyName ?? '');
        if (!first) return;
        next[edgeType] = [first];
        changed = true;
      });
      // 无可补的关系时返回原引用，React 跳过这次更新，避免本 effect 自我循环
      return changed ? next : prev;
    });
  }, [effectiveChainEdges, metadata]);

  // 过滤关键词 / 行数上限防抖：输入停稳后才落到防抖态并触发查询
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedFilters(filterConditions),
      FILTER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [filterConditions]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedEdgeFilters(edgeFilterConditions),
      FILTER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [edgeFilterConditions]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedLimit(queryLimit),
      FILTER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [queryLimit]);

  // ─── 3. 实例数据加载层 ───
  const [instanceData, setInstanceData] = useState<Record<string, RawRow[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  /** 查询结果缓存：key = `${code}::${属性集}::${过滤}::${limit}` */
  const cacheRef = useRef<Record<string, RawRow[]>>({});
  const [relationRows, setRelationRows] = useState<RawRow[]>([]);
  const [relationLoading, setRelationLoading] = useState(false);
  /** 路径查询缓存：key = 完整 nGQL */
  const relCacheRef = useRef<Record<string, RawRow[]>>({});
  /** 最近一次自动生成的查询语句：关系模式一条 / 独立模式每对象一条 */
  const [lastNGQL, setLastNGQL] = useState('');
  const [lastIndependentNGQL, setLastIndependentNGQL] = useState<
    Record<string, string>
  >({});
  /** 查询语句面板是否展开（只读展示） */
  const [showNGQL, setShowNGQL] = useState(false);
  /** 请求批次号：仅采纳最新一批的异步结果，规避竞态（模式切换即作废在飞请求） */
  const reqSeqRef = useRef(0);

  /** 取某出现位置实际生效的过滤条件：仅保留「已勾选属性 + 关键词非空」的项 */
  const getEffectiveFilters = (
    filterKey: string,
    props: string[],
  ): Record<string, string> => {
    const raw = debouncedFilters[filterKey] || {};
    const out: Record<string, string> = {};
    props.forEach((p) => {
      const keyword = String(raw[p] ?? '').trim();
      if (keyword) out[p] = keyword;
    });
    return out;
  };

  const buildCacheKey = (
    code: string,
    props: string[],
    filters: Record<string, string>,
  ): string =>
    `${code}::${[...props].sort().join(',')}::${serializeFilters(filters)}::${
      debouncedLimit ?? 'all'
    }`;

  /**
   * 独立查询模式的数据加载：对「有勾选属性且未命中缓存」的对象并行查询，
   * 命中缓存的对象直接回填。
   */
  const loadInstances = async () => {
    if (!spaceName) return;
    const seq = ++reqSeqRef.current;

    const cacheHits: Record<string, RawRow[]> = {};
    const toFetch: Array<{ code: string; props: string[]; filters: Record<string, string>; nGql: string }> = [];
    const statements: Record<string, string> = {};

    // 只遍历有效对象：被暂时失效的对象既不发起查询，也不写入本轮语句
    effectiveObjectMetas.forEach((m) => {
      const stepKey = firstStepKeyForCode[m.code] || m.code;
      const props = selectedProps[stepKey] || [];
      if (props.length === 0) return;
      const filters = getEffectiveFilters(stepKey, props);
      const nGql = buildInstanceNGQL(spaceName, m.code, props, filters, debouncedLimit);
      statements[m.code] = nGql;
      const cached = cacheRef.current[buildCacheKey(m.code, props, filters)];
      if (cached) {
        cacheHits[m.code] = cached;
      } else {
        toFetch.push({ code: m.code, props, filters, nGql });
      }
    });

    // 记录本轮自动生成的语句（命中缓存时也更新，否则面板停留在上一轮属性集上）
    setLastIndependentNGQL(statements);

    if (Object.keys(cacheHits).length > 0) {
      setInstanceData((prev) => ({ ...prev, ...cacheHits }));
    }
    if (toFetch.length === 0) return;

    setLoadingMap((prev) => {
      const next = { ...prev };
      toFetch.forEach((t) => {
        next[t.code] = true;
      });
      return next;
    });

    // 并行查询：任一失败不影响其余对象
    const results = await Promise.allSettled(
      toFetch.map((t) => executeNGQLQuery(spaceName, t.nGql)),
    );

    // 已被更新的批次号覆盖时丢弃本次结果，避免旧请求回写脏数据
    if (seq !== reqSeqRef.current) return;

    const merged: Record<string, RawRow[]> = {};
    let failedReason: string | null = null;
    results.forEach((res, i) => {
      const { code, props, filters, nGql } = toFetch[i];
      let rows: RawRow[] = [];
      if (res.status === 'fulfilled' && res.value?.success) {
        rows = dedupeInstanceRows(res.value.tableData || []);
        // 仅成功结果入缓存：失败不落键，调整条件重试时才能重新发起
        cacheRef.current[buildCacheKey(code, props, filters)] = rows;
      } else {
        // 逐条抛到控制台：面向用户只弹首条且归并成类别文案，
        // 否则无法区分「真无数据」与「语句报错 → 空」
        const reason =
          res.status === 'fulfilled'
            ? String(res.value?.error ?? '')
            : String((res.reason as { message?: string })?.message ?? '');
        console.error('[fulldata] 实例查询失败', { code, nGql, reason });
        if (failedReason === null) failedReason = reason;
      }
      merged[code] = rows;
    });

    if (failedReason !== null) {
      toast(describeQueryFailure(failedReason), undefined, 'error');
    }

    setInstanceData((prev) => ({ ...prev, ...merged }));
    setLoadingMap((prev) => {
      const next = { ...prev };
      toFetch.forEach((t) => {
        next[t.code] = false;
      });
      return next;
    });
  };

  /**
   * 关系查询模式的数据加载：沿整条链路发一次 MATCH，
   * 结果按路径组合去重后落入 relationRows。
   */
  const loadRelationPaths = async () => {
    if (!spaceName) return;
    const seq = ++reqSeqRef.current;

    // 链路不成路径（不足两节点 / 缺关系）时无路径可查
    if (!hasEdge) {
      setRelationRows([]);
      setRelationLoading(false);
      return;
    }

    // 各出现位置生效的过滤条件按 stepKey 归集（自关联等重复出现的对象各占独立 key）
    const relFilters: Record<string, Record<string, string>> = {};
    effectiveNodeCodes.forEach((code, i) => {
      const stepKey = `${code}__${effectiveNodeStepIdxs[i]}`;
      const filters = getEffectiveFilters(
        stepKey,
        selectedProps[stepKey] || [],
      );
      if (Object.keys(filters).length > 0) relFilters[stepKey] = filters;
    });

    // 各关系生效的过滤条件按 edgeType 归集（同一关系多段出现时共用一份，只加在首段上）
    const relEdgeFilters: Record<string, Record<string, string>> = {};
    effectiveChainEdges.forEach((edge) => {
      const edgeType = String(edge?.edgeType ?? '');
      if (!edgeType || relEdgeFilters[edgeType]) return;
      const raw = debouncedEdgeFilters[edgeType] || {};
      const out: Record<string, string> = {};
      (selectedEdgeProps[edgeType] || []).forEach((prop) => {
        const keyword = String(raw[prop] ?? '').trim();
        if (keyword) out[prop] = keyword;
      });
      if (Object.keys(out).length > 0) relEdgeFilters[edgeType] = out;
    });

    const nGql = buildRelationNGQL(
      spaceName,
      effectiveNodeCodes,
      effectiveNodeStepIdxs,
      effectiveChainEdges,
      selectedProps,
      relFilters,
      debouncedLimit,
      selectedEdgeProps,
      relEdgeFilters,
    );
    setLastNGQL(nGql);
    const cached = relCacheRef.current[nGql];
    if (cached) {
      setRelationRows(cached);
      setRelationLoading(false);
      return;
    }

    setRelationLoading(true);
    let rows: RawRow[] = [];
    let failedReason: string | null = null;
    try {
      const res = await executeNGQLQuery(spaceName, nGql);
      if (res?.success) rows = dedupePathRows(res.tableData || []);
      else failedReason = String(res?.error ?? '');
    } catch (e) {
      failedReason = String((e as { message?: string })?.message ?? '');
    }

    if (seq !== reqSeqRef.current) return;

    if (failedReason !== null) {
      console.error('[fulldata] 路径查询失败', { nGql, reason: failedReason });
      toast(describeQueryFailure(failedReason), undefined, 'error');
    } else {
      relCacheRef.current[nGql] = rows;
    }
    setRelationRows(rows);
    setRelationLoading(false);
  };

  // 主加载 effect：关系模式走一次路径 MATCH，独立模式各对象并行。
  // 依赖取各状态的稳定签名：失效端点会改写有效子链路签名、失效对象会改写有效对象
  // 签名，两者都能让本 effect 重跑，从而只查有效范围的数据。
  useEffect(() => {
    if (queryMode === 'relation') void loadRelationPaths();
    else void loadInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queryMode,
    spaceName,
    debouncedLimit,
    effectiveNodeCodes.join('|'),
    effectiveNodeStepIdxs.join('|'),
    effectiveObjectMetas.map((m) => m.code).join('|'),
    JSON.stringify(selectedProps),
    JSON.stringify(selectedEdgeProps),
    JSON.stringify(debouncedFilters),
    JSON.stringify(debouncedEdgeFilters),
  ]);

  // ─── 4. 表格数据模型 ───
  /** 参与表格的对象：在有效子链路上且任一出现位置有勾选属性者 */
  const activeObjects = useMemo<ChainObjectMeta[]>(
    () =>
      effectiveObjectMetas.filter((m) =>
        Object.keys(selectedProps).some(
          (k) =>
            k.startsWith(`${m.code}__`) && (selectedProps[k] || []).length > 0,
        ),
      ),
    [effectiveObjectMetas, selectedProps],
  );

  /**
   * 实际生效的聚合视角：选定的对象可能因属性被清空而退出表格，
   * 此时退回不聚合，避免按不存在的分组列把全部路径归成一组。
   */
  const effectiveAggregateBy = useMemo<string | null>(
    () =>
      aggregateBy && activeObjects.some((m) => m.code === aggregateBy)
        ? aggregateBy
        : null,
    [aggregateBy, activeObjects],
  );

  // ─── 4.0 查询语句面板（只读）：语句生成与中文说明 ───
  const generatedNGQL = useMemo(() => {
    if (queryMode === 'relation') return lastNGQL;
    const first = activeObjects[0]?.code ?? '';
    return lastIndependentNGQL[first] || '';
  }, [queryMode, lastNGQL, lastIndependentNGQL, activeObjects]);

  /** 查询语句的中文说明：按当前模式、链路与过滤条件动态生成 */
  const ngqlDescription = useMemo(() => {
    const limitText = debouncedLimit ? `最多 ${debouncedLimit}` : '不限';
    if (queryMode === 'relation') {
      const objSeen = new Set<string>();
      const filterTexts: string[] = [];
      effectiveNodeCodes.forEach((code, i) => {
        if (!activeObjects.some((m) => m.code === code)) return;
        const stepKey = `${code}__${effectiveNodeStepIdxs[i]}`;
        const meta = metaMap[code];
        const isRecurring = objSeen.has(code);
        objSeen.add(code);
        const baseName = meta?.name || code;
        const label = isRecurring ? `${baseName}（${i + 1}）` : baseName;
        const desc = describeFilters(
          getEffectiveFilters(stepKey, selectedProps[stepKey] || []),
        );
        if (desc) filterTexts.push(`${label} 的 ${desc}`);
      });
      return (
        `沿逻辑链路查询 ${effectivePathText || '当前链路'} 的实例路径关系：` +
        '一行即一条真实存在的关系路径，返回各对象的顶点 ID 与已勾选属性' +
        (filterTexts.length > 0 ? `，并要求 ${filterTexts.join('；')}` : '') +
        `，${limitText}条。`
      );
    }
    const first = activeObjects[0];
    if (!first) return '';
    const stepKey = firstStepKeyForCode[first.code] || first.code;
    const props = selectedProps[stepKey] || [];
    const filterDesc = describeFilters(getEffectiveFilters(stepKey, props));
    return (
      `查询「${first.name || first.code}」（${first.code}）类型的所有实例数据，` +
      `返回 ${props.join('、')} 共 ${props.length} 个属性列` +
      (filterDesc ? `，并要求 ${filterDesc}` : '') +
      `，${limitText}行。`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queryMode,
    effectivePathText,
    activeObjects,
    metaMap,
    selectedProps,
    debouncedFilters,
    debouncedLimit,
    effectiveNodeCodes,
    effectiveNodeStepIdxs,
    firstStepKeyForCode,
  ]);

  // ─── 4.1 表格行数据 ───
  /**
   * 两种口径：
   *   - 关系模式：一行一条路径；选了聚合视角则按该对象归并，
   *     其余对象的值去重后合到一格（超过 AGG_VALUE_LIMIT 个折叠为计数）；
   *   - 独立模式：各对象实例按行号并排，总行数 = 各对象实例数的最大值。
   * 空值统一写空串，由列定义的 valueFormatter 统一渲成「-」。
   */
  const rowData = useMemo<TableRow[]>(() => {
    if (queryMode === 'relation') {
      if (relationRows.length === 0) return [];

      // 不聚合：路径行直接映射成表格行
      if (!effectiveAggregateBy) {
        return relationRows.map((row) => {
          const tableRow: TableRow = {};
          // 沿有效子链路遍历，自关联等重复出现的对象取带后缀的值
          const objSeen = new Set<string>();
          effectiveNodeCodes.forEach((code, i) => {
            if (!activeObjects.some((m) => m.code === code)) return;
            const stepKey = `${code}__${effectiveNodeStepIdxs[i]}`;
            const isRecurring = objSeen.has(code);
            objSeen.add(code);
            const dataSuffix = isRecurring ? `_${i}` : '';
            (selectedProps[stepKey] || []).forEach((prop) => {
              const key = `${code}_${prop}${dataSuffix}`;
              const val = row[key];
              tableRow[key] = val == null ? '' : String(val);
            });
          });
          // 追加关系属性值：同一关系多段出现时只成一组列，故只取首段的值
          effectiveChainEdges.forEach((edge, i) => {
            const edgeType = String(edge?.edgeType ?? '');
            if (!edgeType) return;
            (selectedEdgeProps[edgeType] || []).forEach((prop) => {
              const key = `${edgeType}_${prop}`;
              if (key in tableRow) return;
              const val = row[`${edgeType}_${prop}_${i}`];
              tableRow[key] = val == null ? '' : String(val);
            });
          });
          return tableRow;
        });
      }

      // 聚合视角：按该对象的顶点 ID 分组（Map 保留首次出现顺序）
      const groupKey = `${effectiveAggregateBy}${VERTEX_ID_SUFFIX}`;
      const groups = new Map<string, RawRow[]>();
      relationRows.forEach((row) => {
        const gk = String(row[groupKey] ?? '');
        if (!groups.has(gk)) groups.set(gk, []);
        groups.get(gk)?.push(row);
      });

      /** 组内值去重合并：过多时只展前 N 个并标注总数 */
      const mergeVals = (vals: unknown[]): string => {
        const list = Array.from(
          new Set(
            vals
              .filter((v) => v != null && v !== '')
              .map((v) => String(v)),
          ),
        );
        return list.length > AGG_VALUE_LIMIT
          ? `${list.slice(0, AGG_VALUE_LIMIT).join('、')} …共 ${list.length} 项`
          : list.join('、');
      };

      return Array.from(groups.values()).map((groupRows) => {
        const tableRow: TableRow = {};
        const objSeen = new Set<string>();
        effectiveNodeCodes.forEach((code, i) => {
          if (!activeObjects.some((m) => m.code === code)) return;
          const stepKey = `${code}__${effectiveNodeStepIdxs[i]}`;
          const isRecurring = objSeen.has(code);
          objSeen.add(code);
          const dataSuffix = isRecurring ? `_${i}` : '';
          (selectedProps[stepKey] || []).forEach((prop) => {
            const key = `${code}_${prop}${dataSuffix}`;
            // 聚合主对象：组内同一顶点，取首行值即可
            if (code === effectiveAggregateBy && !isRecurring) {
              const val = groupRows[0]?.[key];
              tableRow[key] = val == null ? '' : String(val);
              return;
            }
            tableRow[key] = mergeVals(groupRows.map((r) => r[key]));
          });
        });
        // 关系属性：不是聚合主对象，一律按「组内去重合并」口径处理
        effectiveChainEdges.forEach((edge, i) => {
          const edgeType = String(edge?.edgeType ?? '');
          if (!edgeType) return;
          (selectedEdgeProps[edgeType] || []).forEach((prop) => {
            const key = `${edgeType}_${prop}`;
            if (key in tableRow) return;
            // 只取首段的 alias（与列组按 edgeType 去重的口径一致）
            tableRow[key] = mergeVals(
              groupRows.map((r) => r[`${edgeType}_${prop}_${i}`]),
            );
          });
        });
        return tableRow;
      });
    }

    const totalRows = activeObjects.reduce(
      (max, m) => Math.max(max, (instanceData[m.code] || []).length),
      0,
    );
    const list: TableRow[] = [];
    for (let r = 0; r < totalRows; r += 1) {
      const row: TableRow = {};
      activeObjects.forEach((m) => {
        const inst = (instanceData[m.code] || [])[r];
        const stepKey = firstStepKeyForCode[m.code] || m.code;
        (selectedProps[stepKey] || []).forEach((prop) => {
          const key = `${m.code}_${prop}`;
          const val = inst ? inst[prop] : '';
          row[key] = val == null ? '' : String(val);
        });
      });
      list.push(row);
    }
    return list;
  }, [
    queryMode,
    effectiveAggregateBy,
    relationRows,
    activeObjects,
    instanceData,
    selectedProps,
    selectedEdgeProps,
    effectiveChainEdges,
    effectiveNodeCodes,
    effectiveNodeStepIdxs,
    firstStepKeyForCode,
  ]);

  // ─── 4.2 列分组定义 ───
  /**
   * 每个参与对象 → 一个 column group，组内为该对象的勾选属性列。
   * 关系查询模式下按链路顺序在相邻对象列组之间插入一个「关系」列组：
   * 每行的第 i 段关系在链路中是固定的，故列值为静态的方向箭头，不参与查询。
   */
  const columnDefs = useMemo<(ColDef<TableRow> | ColGroupDef<TableRow>)[]>(() => {
    const buildObjectGroup = (
      m: ChainObjectMeta,
      stepKey: string,
      chainIdx = 0,
      isRecurring = false,
    ): ColGroupDef<TableRow> => {
      const props = selectedProps[stepKey] || [];
      // 自关联等重复出现的对象：colId / 取值键加 _${chainIdx} 后缀，与 NGQL alias 对齐
      const dataSuffix = isRecurring ? `_${chainIdx}` : '';
      const leafCols: GroupLeafCol[] = props.map((prop) => ({
        colId: `${m.code}_${prop}${dataSuffix}`,
        label: prop,
      }));
      return {
        headerName: isRecurring
          ? `${m.name || m.code}（${chainIdx + 1}）`
          : m.name || m.code,
        headerClass: `lc-fd-group-header lc-fd-c${m.colorIndex}`,
        headerGroupComponent: GroupHeaderWithFilter,
        headerGroupComponentParams: { leafCols },
        children: props.map((prop) => {
          const key = `${m.code}_${prop}${dataSuffix}`;
          const cnName =
            getObjectProps(m.code).find((p) => p.name === prop)?.cnName || '';
          return {
            headerName: prop,
            // 属性名可能含 `.` 等字符，用 colId + valueGetter 规避 field 的深层路径解析
            colId: key,
            hide: hiddenGroups.has(m.code),
            valueGetter: (params: ValueGetterParams<TableRow>) =>
              params.data?.[key] ?? '',
            headerClass: `lc-fd-c${m.colorIndex}`,
            cellClass: `lc-fd-c${m.colorIndex}`,
            headerComponentParams: cnName
              ? { template: buildAttrHeaderTemplate(cnName) }
              : undefined,
            cellClassRules: {
              'lc-fd-cell-empty': (params: CellClassParams<TableRow>) =>
                isBlankCellValue(params.value),
            },
            headerTooltip: cnName
              ? `${m.name || m.code} · ${prop}（${cnName}）`
              : `${m.name || m.code} · ${prop}`,
            valueFormatter: formatCellValue,
          } as ColDef<TableRow>;
        }),
      };
    };

    /** 链路第 idx 段关系的列组：未勾选属性时组内只有一列占位列 */
    const buildEdgeGroup = (edge: ChainEdge, idx: number): ColGroupDef<TableRow> => {
      const edgeType = String(edge?.edgeType ?? '');
      const label = String(edge?.label ?? edgeType);
      const forward = !!edge?.forward;
      const sourceCode = String(edge?.source ?? '');
      const targetCode = String(edge?.target ?? '');
      const sourceName = metaMap[sourceCode]?.name || sourceCode;
      const targetName = metaMap[targetCode]?.name || targetCode;
      // 两端 code 都缺失时（异常数据）不显示空指向
      const pointText =
        sourceName && targetName ? `${sourceName}→${targetName}` : '';
      const pointTip =
        sourceName && targetName
          ? `${sourceName} →[${label}]→ ${targetName}（链路方向：${
              forward ? '正向' : '反向'
            }）`
          : `${label}（${forward ? '正向' : '反向'}）`;

      const edgeProps = selectedEdgeProps[edgeType] || [];

      // 未勾选任何关系属性：退化为单列占位（列头明写暂无属性，单元格给关系名）
      if (edgeProps.length === 0) {
        const width = Math.round(
          Math.min(
            EDGE_COL_MAX_WIDTH,
            Math.max(
              EDGE_COL_MIN_WIDTH,
              estimateTextWidth(label, EDGE_COL_HEADER_FONT_SIZE) +
                EDGE_COL_TEXT_PADDING,
            ),
          ),
        );
        return {
          headerName: label,
          headerClass: 'lc-fd-group-header lc-fd-edge-col',
          headerGroupComponent: EdgeGroupHeader,
          headerGroupComponentParams: { pointText, pointTip },
          children: [
            {
              headerName: '-（暂无属性）',
              colId: `${EDGE_COL_ID_PREFIX}${idx}`,
              hide: hiddenGroups.has(edgeType),
              width,
              minWidth: width,
              sortable: false,
              filter: false,
              headerClass: 'lc-fd-edge-col',
              cellClass: 'lc-fd-edge-cell',
              // 该关系未取任何属性，全部行给关系名作链路标记，不读行数据
              valueGetter: () => label,
              // 静态关系名不应参与全局搜索匹配
              getQuickFilterText: () => '',
            } as ColDef<TableRow>,
          ],
        };
      }

      const edgePropDefs = edgePropsByType[edgeType] || [];

      return {
        headerName: label,
        headerClass: 'lc-fd-group-header lc-fd-edge-col',
        headerGroupComponent: EdgeGroupHeader,
        headerGroupComponentParams: { pointText, pointTip },
        children: edgeProps.map((prop) => {
          // 行数据 key 按 edgeType 归集（不带链路段下标）：同一关系多段出现时只成一组列
          const key = `${edgeType}_${prop}`;
          const cnName =
            edgePropDefs.find((p) => p.name === prop)?.cnName || '';
          return {
            headerName: prop,
            colId: key,
            hide: hiddenGroups.has(edgeType),
            valueGetter: (params: ValueGetterParams<TableRow>) =>
              params.data?.[key] ?? '',
            headerClass: 'lc-fd-edge-col',
            cellClass: 'lc-fd-edge-col',
            headerComponentParams: cnName
              ? { template: buildAttrHeaderTemplate(cnName) }
              : undefined,
            cellClassRules: {
              'lc-fd-cell-empty': (params: CellClassParams<TableRow>) =>
                isBlankCellValue(params.value),
            },
            headerTooltip: cnName
              ? `${label} · ${prop}（${cnName}）`
              : `${label} · ${prop}`,
            valueFormatter: formatCellValue,
          } as ColDef<TableRow>;
        }),
      };
    };

    // 独立查询模式（或链路不成路径）：仅按对象顺序排列列组，
    // 各对象取首次出现位置的 stepKey，无勾选属性的对象不生成列组
    if (queryMode !== 'relation' || effectiveChainEdges.length === 0) {
      return activeObjects
        .filter((m) => {
          const sk = firstStepKeyForCode[m.code] || m.code;
          return (selectedProps[sk] || []).length > 0;
        })
        .map((m) =>
          buildObjectGroup(m, firstStepKeyForCode[m.code] || m.code, 0, false),
        );
    }

    // 关系查询模式：沿有效子链路顺序排列，第 i 段关系列组接在第 i 个节点之后。
    // 自关联等重复出现的对象：每次出现都生成列组（带后缀区分）
    const groups: (ColDef<TableRow> | ColGroupDef<TableRow>)[] = [];
    const seen = new Set<string>();
    effectiveNodeCodes.forEach((code, i) => {
      const meta = activeObjects.find((m) => m.code === code);
      if (meta) {
        const stepKey = `${code}__${effectiveNodeStepIdxs[i]}`;
        // 无勾选属性的出现位置不生成列组（自关联两端属性独立，可能一端有一端无）
        if ((selectedProps[stepKey] || []).length > 0) {
          const isRecurring = seen.has(code);
          seen.add(code);
          groups.push(buildObjectGroup(meta, stepKey, i, isRecurring));
        }
      }
      const edge = effectiveChainEdges[i];
      if (edge) groups.push(buildEdgeGroup(edge, i));
    });

    /**
     * 首尾的关系列组一侧没有对象列组（该端对象未勾选属性），去掉后表头才不悬空。
     * 只修剪退化成方向箭头的关系列组；已勾选属性的关系列组自带真实数据，
     * 即使落在首尾也必须保留，否则「只勾关系属性、两端对象未勾属性」时会出现空表。
     */
    const isArrowOnlyEdgeGroup = (g: ColDef<TableRow> | ColGroupDef<TableRow>) =>
      ((g as ColGroupDef<TableRow>).children || []).some((c) =>
        String((c as ColDef<TableRow>).colId ?? '').startsWith(
          EDGE_COL_ID_PREFIX,
        ),
      );
    while (groups.length > 0 && isArrowOnlyEdgeGroup(groups[0])) groups.shift();
    while (groups.length > 0 && isArrowOnlyEdgeGroup(groups[groups.length - 1]))
      groups.pop();
    return groups;
  }, [
    activeObjects,
    selectedProps,
    queryMode,
    effectiveChainEdges,
    effectiveNodeCodes,
    effectiveNodeStepIdxs,
    firstStepKeyForCode,
    metaMap,
    selectedEdgeProps,
    edgePropsByType,
    objectPropsByCode,
    hiddenGroups,
  ]);

  /** AG Grid 默认列配置：排序 / 过滤 / 拖拽改列宽全部开启 */
  const defaultColDef = useMemo<ColDef<TableRow>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 120,
      filterParams: {
        // 单列支持多级过滤条件（默认只有 2 级）
        maxNumConditions: MAX_FILTER_CONDITIONS,
        // 面板底部展示「清除」按钮：一键清空该列的全部过滤条件并立即生效
        buttons: ['reset'],
      },
    }),
    [],
  );

  // ─── 5. AG Grid 实例与全局搜索 ───
  const gridApiRef = useRef<GridApi | null>(null);
  const [quickFilterText, setQuickFilterText] = useState('');
  const [displayedRowCount, setDisplayedRowCount] = useState(0);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportFileName, setExportFileName] = useState('');

  const handleGridReady = (e: GridReadyEvent) => {
    gridApiRef.current = e.api;
    setDisplayedRowCount(e.api.getDisplayedRowCount());
  };

  const handleModelUpdated = () => {
    const api = gridApiRef.current;
    if (api) setDisplayedRowCount(api.getDisplayedRowCount());
  };

  /**
   * 表格卸载前丢弃 api 引用并归零行数。
   * 零行时本组件会撤掉整个 AgGridReact，若不清理，gridApiRef 会抱着一个已销毁的
   * api：导出、过滤判定等处以为 grid 还在场而去调它，得到的是空列定义与陈旧行数。
   */
  const handleGridPreDestroy = () => {
    gridApiRef.current = null;
    setDisplayedRowCount(0);
  };

  const handleOpenExport = () => {
    const today = new Date().toISOString().slice(0, 10);
    setExportFileName(`实例全数据_${today}.csv`);
    setExportModalVisible(true);
  };

  /**
   * 从列定义中收集导出用的列：字段取叶子列 colId（与行数据 key 一致），
   * 表头按「对象名.属性名」组织。grid 在场与不在场两条路径共用同一口径。
   */
  const collectExportColumns = (
    defs: (ColDef<TableRow> | ColGroupDef<TableRow>)[],
  ): Array<{ field: string; header: string }> => {
    const columns: Array<{ field: string; header: string }> = [];
    defs.forEach((group) => {
      if (group && 'children' in group) {
        const groupName = group.headerName || '';
        (group.children || []).forEach((child) => {
          const leaf = child as ColDef<TableRow>;
          const field = leaf.colId || leaf.field || '';
          if (!field) return;
          // 关系标识列只是表头上的链路指示，无对应数据，不进导出
          if (field.startsWith(EDGE_COL_ID_PREFIX)) return;
          // 被「在列表中隐藏」收起的列不导出：导出口径跟随表格所见
          if (leaf.hide) return;
          columns.push({
            field,
            header: `${groupName}.${leaf.headerName || field}`,
          });
        });
      }
    });
    return columns;
  };

  /**
   * 导出当前（过滤 / 排序后）数据为 CSV 并触发浏览器下载。
   * 零行也得能导（仅表头）：api 缺席（grid 未渲染）时回落到
   * React 侧的 columnDefs / rowData。
   */
  const handleExport = () => {
    const api = gridApiRef.current;
    const columns = collectExportColumns(
      (api ? api.getColumnDefs() : columnDefs) || [],
    );
    if (columns.length === 0) {
      toast('当前没有可导出的列', undefined, 'info');
      return;
    }

    const rows: string[][] = [];
    const pushRow = (data?: TableRow | null) => {
      if (!data) return;
      rows.push(
        columns.map((col) => {
          const val = data[col.field];
          return val == null ? '' : String(val);
        }),
      );
    };
    if (api) api.forEachNodeAfterFilterAndSort((node) => pushRow(node.data));
    else rowData.forEach(pushRow);

    downloadCsv(
      exportFileName,
      columns.map((c) => c.header),
      rows,
    );
    setExportModalVisible(false);
  };

  // ─── 6. 属性勾选面板操作 ───
  /** 勾选 / 取消单个属性，并丢弃已取消勾选属性上的过滤关键词 */
  const handleToggleProp = (stepKey: string, prop: string, checked: boolean) => {
    setSelectedProps((prev) => {
      const cur = prev[stepKey] || [];
      const next = checked
        ? [...cur, prop]
        : cur.filter((p) => p !== prop);
      return { ...prev, [stepKey]: next };
    });
    if (!checked) {
      setFilterConditions((prev) => {
        const kept = { ...(prev[stepKey] || {}) };
        delete kept[prop];
        return { ...prev, [stepKey]: kept };
      });
    }
  };

  const handleSelectAll = (stepKey: string, code: string) => {
    const all = getObjectProps(code).map((p) => p.name).filter(Boolean);
    setSelectedProps((prev) => ({ ...prev, [stepKey]: all }));
  };

  const handleClearAll = (stepKey: string) => {
    setSelectedProps((prev) => ({ ...prev, [stepKey]: [] }));
    setFilterConditions((prev) => ({ ...prev, [stepKey]: {} }));
  };

  const handleEdgeToggleProp = (edgeType: string, prop: string, checked: boolean) => {
    setSelectedEdgeProps((prev) => {
      const cur = prev[edgeType] || [];
      const next = checked
        ? [...cur, prop]
        : cur.filter((p) => p !== prop);
      return { ...prev, [edgeType]: next };
    });
    if (!checked) {
      setEdgeFilterConditions((prev) => {
        const kept = { ...(prev[edgeType] || {}) };
        delete kept[prop];
        return { ...prev, [edgeType]: kept };
      });
    }
  };

  const handleEdgeSelectAll = (edgeType: string) => {
    const all = (edgePropsByType[edgeType] || []).map((p) => p.name).filter(Boolean);
    setSelectedEdgeProps((prev) => ({ ...prev, [edgeType]: all }));
  };

  const handleEdgeClearAll = (edgeType: string) => {
    setSelectedEdgeProps((prev) => ({ ...prev, [edgeType]: [] }));
    setEdgeFilterConditions((prev) => ({ ...prev, [edgeType]: {} }));
  };

  const handleFilterChange = (filterKey: string, prop: string, keyword: string) => {
    setFilterConditions((prev) => ({
      ...prev,
      [filterKey]: { ...(prev[filterKey] || {}), [prop]: keyword },
    }));
  };

  const handleEdgeFilterChange = (
    edgeType: string,
    prop: string,
    keyword: string,
  ) => {
    setEdgeFilterConditions((prev) => ({
      ...prev,
      [edgeType]: { ...(prev[edgeType] || {}), [prop]: keyword },
    }));
  };

  const handleHiddenChange = (key: string, hidden: boolean) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  // ─── 6.1 链路端点的暂时失效 / 恢复 ───
  /** 取某步骤用于提示文案的名称：节点取对象展示名，关系取关系名 */
  const getStepLabel = (stepIdx: number): string => {
    const step = (pathData || [])[stepIdx];
    if (!step) return '';
    if (step.type === 'node') return getPathNodeLabel(step.data);
    const edge = (chainEdges || [])[Math.floor(stepIdx / 2)];
    return String(edge?.label ?? getPathEdgeLabel(step.data));
  };

  /** 收集在给定失效集合下仍然有效的节点 code */
  const collectActiveCodes = (disabled: Set<number>): Set<string> => {
    const codes = new Set<string>();
    (pathData || []).forEach((step, i) => {
      if (disabled.has(i) || step.type !== 'node') return;
      const code = getPathNodeKey(step.data);
      if (code) codes.add(code);
    });
    return codes;
  };

  /**
   * 暂时失效某个步骤：
   * - 关系查询：端点节点与其外侧相邻关系成对失效，失效后有效子链路向内收缩一格；
   * - 独立查询：只失效被点的那一个对象，链路上其余部分不受影响。
   */
  const handleDisableStep = (stepIdx: number) => {
    if (!disableableSteps.has(stepIdx)) return;
    // 属性面板可能正开在被收起的节点上，先关掉，避免面板悬空
    setOpenStepIdx(null);
    setOpenEdgeStepIdx(null);

    let toDisable: number[];
    if (queryMode !== 'relation') {
      toDisable = [stepIdx];
    } else {
      const lastPos = activeStepIdxs.length - 1;
      const isHead =
        stepIdx === activeStepIdxs[0] || stepIdx === activeStepIdxs[1];
      toDisable = isHead
        ? [activeStepIdxs[0], activeStepIdxs[1]]
        : [activeStepIdxs[lastPos - 1], activeStepIdxs[lastPos]];
    }

    const next = new Set(disabledSteps);
    toDisable.forEach((i) => {
      if (typeof i === 'number') next.add(i);
    });
    setDisabledSteps(next);

    // 失效对象若在链路别处仍然有效，其过滤条件不能丢（两处共用同一份 code 级条件）
    const stillActive = collectActiveCodes(next);
    const droppedCodes = toDisable
      .map((i) => (pathData || [])[i])
      .filter((s) => s?.type === 'node')
      .map((s) => getPathNodeKey(s?.data))
      .filter((code) => !!code && !stillActive.has(code));
    if (droppedCodes.length > 0) {
      const omitDropped = (
        prev: Record<string, Record<string, string>>,
      ): Record<string, Record<string, string>> => {
        const kept = { ...prev };
        droppedCodes.forEach((code) => delete kept[code]);
        return kept;
      };
      // 即时态与防抖态一并清掉，避免防抖计时器把旧条件再打一次查询
      setFilterConditions(omitDropped);
      setDebouncedFilters(omitDropped);
      // 聚合视角落在已失效对象上时退回不聚合
      if (aggregateBy && droppedCodes.includes(aggregateBy)) {
        setAggregateBy(null);
      }
    }

    const nodeIdx = toDisable.find((i) => (pathData || [])[i]?.type === 'node');
    const edgeIdx = toDisable.find((i) => (pathData || [])[i]?.type === 'edge');
    const nodeName = getStepLabel(nodeIdx ?? stepIdx);
    toast(
      edgeIdx === undefined
        ? `已暂时隐藏「${nodeName}」`
        : `已暂时隐藏「${nodeName}」及其「${getStepLabel(edgeIdx)}」关系`,
      undefined,
      'info',
    );
  };

  /**
   * 恢复某个已失效步骤：
   * - 关系查询：失效集恒为「前缀 + 后缀」，恢复时把该步骤与有效区之间的步骤一并
   *   恢复（只恢复被点的那一个会在链路中间留下断口）；点在关系上时还把其外侧的
   *   端点节点一起带回来；
   * - 独立查询：对象之间互不关联，只恢复被点的那一个。
   */
  const handleEnableStep = (stepIdx: number) => {
    if (!disabledSteps.has(stepIdx)) return;
    const next = new Set(disabledSteps);
    const restored: number[] = [];
    if (queryMode !== 'relation') {
      restored.push(stepIdx);
    } else {
      const firstActive = activeStepIdxs[0] ?? (pathData || []).length;
      const lastActive = activeStepIdxs[activeStepIdxs.length - 1] ?? -1;
      const isEdgeStep = (pathData || [])[stepIdx]?.type === 'edge';
      if (stepIdx < firstActive) {
        const from = isEdgeStep ? stepIdx - 1 : stepIdx;
        for (let i = Math.max(0, from); i < firstActive; i += 1)
          restored.push(i);
      } else {
        const to = isEdgeStep ? stepIdx + 1 : stepIdx;
        for (
          let i = lastActive + 1;
          i <= Math.min(to, (pathData || []).length - 1);
          i += 1
        ) {
          restored.push(i);
        }
      }
    }
    restored.forEach((i) => next.delete(i));
    setDisabledSteps(next);

    // 恢复的对象若属性曾被清空，补上默认前 N 个属性，避免恢复后不产生任何列
    const restoredStepKeys = restored
      .map((i) => {
        const step = (pathData || [])[i];
        if (step?.type !== 'node') return null;
        const code = getPathNodeKey(step?.data);
        if (!code) return null;
        return { stepKey: `${code}__${i}`, code };
      })
      .filter(
        (item): item is { stepKey: string; code: string } =>
          !!item && (selectedProps[item.stepKey] || []).length === 0,
      );
    if (restoredStepKeys.length > 0) {
      setSelectedProps((prev) => {
        const merged = { ...prev };
        restoredStepKeys.forEach(({ stepKey, code }) => {
          merged[stepKey] = getObjectProps(code)
            .slice(0, DEFAULT_PROP_COUNT)
            .map((p) => p.name)
            .filter(Boolean);
        });
        return merged;
      });
    }

    const restoredNodeIdx = restored.find(
      (i) => (pathData || [])[i]?.type === 'node',
    );
    const restoredEdgeIdx = restored.find(
      (i) => (pathData || [])[i]?.type === 'edge',
    );
    const nodeName = getStepLabel(restoredNodeIdx ?? stepIdx);
    toast(
      restoredEdgeIdx === undefined
        ? `已恢复「${nodeName}」`
        : `已恢复「${nodeName}」及其「${getStepLabel(restoredEdgeIdx)}」关系`,
      undefined,
      'info',
    );
  };

  // ─── 7. 渲染辅助 ───
  /** 关系查询下参与表格的关系属性列数（按 edgeType 去重，与列组生成口径一致） */
  const activeEdgePropCount = useMemo<number>(() => {
    if (queryMode !== 'relation') return 0;
    const seen = new Set<string>();
    let count = 0;
    (effectiveChainEdges || []).forEach((edge) => {
      const edgeType = String(edge?.edgeType ?? '');
      if (!edgeType || seen.has(edgeType)) return;
      seen.add(edgeType);
      count += (selectedEdgeProps[edgeType] || []).length;
    });
    return count;
  }, [queryMode, effectiveChainEdges, selectedEdgeProps]);

  const hasAnySelected = activeObjects.length > 0 || activeEdgePropCount > 0;
  const anyLoading =
    queryMode === 'relation'
      ? relationLoading
      : Object.values(loadingMap).some(Boolean);
  /** 可见叶子列数（用于统计信息，含关系属性列） */
  const visibleColCount =
    (queryMode === 'relation'
      ? effectiveNodeCodes.reduce((sum, code, i) => {
          if (!activeObjects.some((m) => m.code === code)) return sum;
          const stepKey = `${code}__${effectiveNodeStepIdxs[i]}`;
          return sum + (selectedProps[stepKey] || []).length;
        }, 0)
      : activeObjects.reduce((sum, m) => {
          const stepKey = firstStepKeyForCode[m.code] || m.code;
          return sum + (selectedProps[stepKey] || []).length;
        }, 0)) + activeEdgePropCount;
  const hasActiveFilter =
    !!quickFilterText || !!gridApiRef.current?.isAnyFilterPresent();

  /** 流程图是否展示：收起 / 展开由工具栏左端按钮驱动；无勾选时强制展开 */
  const chainFlowVisible = !headerCollapsed || !hasAnySelected;

  /** 节点 / 关系上的「暂时失效 · 恢复」小圆按钮（点击截断冒泡，不触发面板） */
  const renderStepToggle = (stepIdx: number, disabled: boolean) => {
    const scope = queryMode === 'relation' ? '该对象及其关系' : '该对象';
    return (
      <span
        className={`lc-fd-disable-btn ${
          disabled ? 'is-enable-action' : 'is-disable-action'
        }`}
        title={disabled ? `恢复${scope}` : `暂时隐藏${scope}`}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) handleEnableStep(stepIdx);
          else handleDisableStep(stepIdx);
        }}
      >
        <Icon name="eye" size={13} />
      </span>
    );
  };

  /** 点击节点 / 关系块：展开对应属性勾选面板（已打开则收起；对象 / 关系互斥） */
  const handleStepClick = (idx: number, isEdge: boolean) => {
    if (isEdge) {
      if (openEdgeStepIdx === idx) {
        setOpenEdgeStepIdx(null);
        return;
      }
      setOpenEdgeStepIdx(idx);
      setOpenStepIdx(null);
      return;
    }
    if (openStepIdx === idx) {
      setOpenStepIdx(null);
      return;
    }
    setOpenStepIdx(idx);
    setOpenEdgeStepIdx(null);
  };

  // Escape 关闭属性面板
  useEffect(() => {
    if (openStepIdx == null && openEdgeStepIdx == null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenStepIdx(null);
        setOpenEdgeStepIdx(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openStepIdx, openEdgeStepIdx]);

  /** 链路图下方内联展开的属性勾选面板（对象 / 关系共用一个位置） */
  const renderOpenPanel = () => {
    if (openStepIdx != null) {
      const step = (pathData || [])[openStepIdx];
      const code = getPathNodeKey(step?.data);
      const meta = metaMap[code] || { code, name: '', colorIndex: 0 };
      const stepKey = `${code}__${openStepIdx}`;
      return (
        <FulldataPropPanel
          title={meta.name || meta.code}
          props={getObjectProps(code)}
          selected={selectedProps[stepKey] || []}
          filters={filterConditions[stepKey] || {}}
          hidden={hiddenGroups.has(code)}
          emptyText="该对象暂无属性定义"
          onToggleProp={(prop, checked) => handleToggleProp(stepKey, prop, checked)}
          onSelectAll={() => handleSelectAll(stepKey, code)}
          onClearAll={() => handleClearAll(stepKey)}
          onFilterChange={(prop, keyword) => handleFilterChange(stepKey, prop, keyword)}
          onHiddenChange={(hidden) => handleHiddenChange(code, hidden)}
          onClose={() => setOpenStepIdx(null)}
        />
      );
    }
    if (openEdgeStepIdx != null) {
      const edgeIdx = Math.floor(openEdgeStepIdx / 2);
      const edge = (chainEdges || [])[edgeIdx];
      const edgeType = String(edge?.edgeType ?? '');
      const edgeLabel = String(edge?.label ?? edgeType);
      return (
        <FulldataPropPanel
          title={edgeLabel || edgeType}
          props={edgePropsByType[edgeType] || []}
          selected={selectedEdgeProps[edgeType] || []}
          filters={edgeFilterConditions[edgeType] || {}}
          hidden={hiddenGroups.has(edgeType)}
          emptyText="该关系暂无属性定义"
          onToggleProp={(prop, checked) => handleEdgeToggleProp(edgeType, prop, checked)}
          onSelectAll={() => handleEdgeSelectAll(edgeType)}
          onClearAll={() => handleEdgeClearAll(edgeType)}
          onFilterChange={(prop, keyword) => handleEdgeFilterChange(edgeType, prop, keyword)}
          onHiddenChange={(hidden) => handleHiddenChange(edgeType, hidden)}
          onClose={() => setOpenEdgeStepIdx(null)}
        />
      );
    }
    return null;
  };

  /** 顶部链路流程图：对象块（序号 + 名称 + code + 已选徽标）与关系块交替 */
  const renderChainFlow = () => (
    <>
      {chainFlowVisible && (
        <div className="lc-fd-chain-flow">
          {(pathData || []).map((step, idx) => {
            const stepDisabled = disabledSteps.has(idx);
            const showToggle = stepDisabled || disableableSteps.has(idx);
            if (step.type === 'node') {
              // pathData 中 node / edge 交替出现，节点序号 = idx / 2
              const nodeIdx = Math.floor(idx / 2);
              const code = getPathNodeKey(step.data);
              const meta = metaMap[code] || { code, name: '', colorIndex: 0 };
              const selectedCount =
                (selectedProps[`${code}__${idx}`] || []).length;
              const totalCount = getObjectProps(code).length;
              return (
                <div
                  key={`node_${idx}`}
                  className={`lc-fd-chain-node lc-fd-c${meta.colorIndex}${
                    stepDisabled ? ' is-disabled' : ''
                  }`}
                  title={stepDisabled ? '已暂时隐藏，点击眼睛按钮恢复' : '点击勾选要展示的属性'}
                  onClick={() => {
                    if (!stepDisabled) handleStepClick(idx, false);
                  }}
                >
                  <span className="lc-fd-chain-node-idx">{nodeIdx + 1}</span>
                  <span className="lc-fd-chain-node-name">
                    {getPathNodeLabel(step.data)}
                  </span>
                  <span className="lc-fd-chain-node-code">{code}</span>
                  {selectedCount > 0 && (
                    <span className="lc-fd-node-count">
                      {selectedCount}/{totalCount}
                    </span>
                  )}
                  {showToggle && renderStepToggle(idx, stepDisabled)}
                </div>
              );
            }
            const edgeIdx = Math.floor(idx / 2);
            const edge = (chainEdges || [])[edgeIdx];
            const edgeType = String(edge?.edgeType ?? '');
            const edgeLabel = String(
              edge?.label ?? getPathEdgeLabel(step.data),
            );
            const edgeTotalCount = (edgePropsByType[edgeType] || []).length;
            const edgeSelectedCount =
              (selectedEdgeProps[edgeType] || []).length;
            // 关系属性只在关系查询下才会成列，故仅关系模式下给开勾选面板
            const edgePanelEnabled = queryMode === 'relation' && !stepDisabled;
            return (
              <div
                key={`edge_${idx}`}
                className={`lc-fd-chain-edge${
                  edgePanelEnabled ? ' is-clickable' : ''
                }${stepDisabled ? ' is-disabled' : ''}`}
                title={
                  stepDisabled
                    ? '已暂时隐藏，点击眼睛按钮恢复'
                    : edgePanelEnabled
                      ? '点击勾选关系属性'
                      : undefined
                }
                onClick={() => {
                  if (edgePanelEnabled) handleStepClick(idx, true);
                }}
              >
                <span className="lc-fd-edge-name-row">
                  <span className="lc-fd-chain-edge-name">{edgeLabel}</span>
                  {edgeSelectedCount > 0 && (
                    <span className="lc-fd-node-count">
                      {edgeSelectedCount}/{edgeTotalCount}
                    </span>
                  )}
                  {showToggle && renderStepToggle(idx, stepDisabled)}
                </span>
                <span className="lc-fd-chain-edge-line">
                  {edge?.forward ? '───▶' : '◀───'}
                </span>
                <span className="lc-fd-chain-edge-dir">
                  {edge?.forward ? '正向' : '反向'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {(openStepIdx != null || openEdgeStepIdx != null) && chainFlowVisible && (
        <div className="lc-fd-panel-slot">{renderOpenPanel()}</div>
      )}
      {chainFlowVisible && <div className="lc-fd-divider" />}
    </>
  );

  /** 主体：空态 / 加载态 / 表格 */
  const renderBody = () => {
    if (!hasAnySelected) {
      return (
        <div className="lc-fd-empty">
          <div className="empty-icon">
            <Icon name="search" size={22} />
          </div>
          <b>点击上方对象，选择要展示的属性</b>
          <p>勾选属性后立即查询实例数据；关系查询可沿链路匹配路径结果。</p>
        </div>
      );
    }
    if (rowData.length === 0 && anyLoading) {
      return (
        <div className="lc-fd-loading">
          <span className="spinner" />
          {queryMode === 'relation'
            ? '正在查询关系路径…'
            : '正在加载实例数据…'}
        </div>
      );
    }
    if (rowData.length === 0) {
      return (
        <div className="lc-fd-empty">
          <div className="empty-icon">
            <Icon name="table" size={22} />
          </div>
          <b>{queryMode === 'relation' ? '沿当前链路未找到关系路径' : '暂无实例数据'}</b>
          <p>可调整属性勾选、过滤关键词或行数上限后重试。</p>
        </div>
      );
    }
    return (
      <div className="lc-fd-table-wrap ag-theme-quartz">
        <AgGridReact<TableRow>
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={defaultColDef}
          suppressDragLeaveHidesColumns
          enableCellTextSelection
          animateRows
          domLayout="normal"
          headerHeight={28}
          rowHeight={28}
          groupHeaderHeight={26}
          quickFilterText={quickFilterText}
          localeText={AG_LOCALE_TEXT}
          onGridReady={handleGridReady}
          onModelUpdated={handleModelUpdated}
          onGridPreDestroyed={handleGridPreDestroy}
        />
      </div>
    );
  };

  return (
    <div className="lc-fd-container">
      {renderChainFlow()}
      {hasAnySelected && (
        <div className="lc-fd-search-bar">
          <button
            type="button"
            className="btn xs ghost lc-fd-collapse-btn"
            title={pathText}
            onClick={() => setHeaderCollapsed((v) => !v)}
          >
            {headerCollapsed ? '链路图' : '收起'}
          </button>
          {isSingleObjectChain && (
            <span className="segmented sm" title="单个对象仅支持独立查询">
              <button type="button" className="active" disabled>
                独立查询
              </button>
              <button type="button" disabled>
                关系查询
              </button>
            </span>
          )}
          {!isSingleObjectChain && hasEdge && (
            <div className="segmented sm lc-fd-query-mode">
              <button
                type="button"
                className={queryMode === 'independent' ? 'active' : ''}
                title="各对象独立查询实例，不关联路径关系"
                onClick={() => {
                  setQueryMode('independent');
                  // 聚合视角仅关系模式有意义；两种模式的可失效范围口径不通用
                  setAggregateBy(null);
                  setDisabledSteps(new Set());
                }}
              >
                独立查询
              </button>
              <button
                type="button"
                className={queryMode === 'relation' ? 'active' : ''}
                title="沿链路匹配关联数据，展示对象间的关系路径"
                onClick={() => {
                  setQueryMode('relation');
                  setAggregateBy(null);
                  setDisabledSteps(new Set());
                }}
              >
                关系查询
              </button>
            </div>
          )}
          <select
            className="select lc-fd-aggregate-select"
            disabled={queryMode !== 'relation'}
            value={queryMode === 'relation' ? effectiveAggregateBy ?? '' : ''}
            onChange={(e) => setAggregateBy(e.target.value || null)}
            title="聚合视角：按选定对象归并路径，空则一行一路径"
          >
            <option value="">
              {queryMode === 'relation' ? '聚合视角' : '-'}
            </option>
            {queryMode === 'relation' &&
              activeObjects.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name || m.code}
                </option>
              ))}
          </select>
          <button
            type="button"
            className={`btn xs ghost lc-fd-ngql-btn${showNGQL ? ' is-active' : ''}`}
            title="查看查询语句"
            onClick={() => setShowNGQL((v) => !v)}
          >
            <Icon name="code" size={13} />
          </button>
          <span className="lc-fd-search-stat">
            {anyLoading && '加载中… '}
            {queryMode === 'relation'
              ? `路径 共${displayedRowCount}${
                  effectiveAggregateBy ? '组' : '条'
                } ${visibleColCount}列`
              : `数据 共${displayedRowCount}行 ${visibleColCount}列`}
            {queryMode === 'relation' &&
              !!effectiveAggregateBy &&
              ` · 源自${relationRows.length}条路径`}
          </span>
          <span className="lc-fd-limit-wrap">
            <span className="lc-fd-limit-label">限制</span>
            <input
              type="number"
              className="lc-fd-limit-input"
              min={MIN_QUERY_LIMIT}
              max={MAX_QUERY_LIMIT}
              placeholder="不限"
              value={queryLimit ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setQueryLimit(null);
                  return;
                }
                const num = Number(raw);
                if (Number.isNaN(num)) return;
                setQueryLimit(
                  Math.min(MAX_QUERY_LIMIT, Math.max(MIN_QUERY_LIMIT, Math.round(num))),
                );
              }}
            />
            <span className="lc-fd-limit-label">条</span>
          </span>
          <button
            type="button"
            className="btn xs"
            disabled={rowData.length === 0}
            onClick={() =>
              onOpenGraph({
                rowData,
                chainNodes: effectiveNodeCodes,
                chainEdges: effectiveChainEdges,
              })
            }
          >
            <Icon name="share" size={13} />
            查看图谱
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={handleOpenExport}
          >
            <Icon name="download" size={13} />
            导出
          </button>
          <span className="input-icon lc-fd-search-input-wrap">
            <span className="ic">
              <Icon name="search" size={13} />
            </span>
            <input
              type="text"
              className="input lc-fd-search-input"
              placeholder="全局搜索（跨列）"
              value={quickFilterText}
              onChange={(e) => setQuickFilterText(e.target.value)}
            />
          </span>
        </div>
      )}
      {/* 查询语句面板（只读）：中文说明 + 当前自动生成的 nGQL */}
      {hasAnySelected && showNGQL && (
        <div className="lc-fd-ngql-panel">
          <div className="lc-fd-ngql-desc">{ngqlDescription}</div>
          <pre className="lc-fd-ngql-code">{generatedNGQL || '（暂无语句）'}</pre>
        </div>
      )}
      {renderBody()}
      {exportModalVisible && (
        <AppModal
          icon="download"
          title="导出数据"
          sub="将当前数据导出为 CSV 格式文件"
          width={420}
          onClose={() => setExportModalVisible(false)}
          body={
            <div className="lc-fd-export-body">
              <p className="lc-fd-export-hint">
                {hasActiveFilter
                  ? '当前存在过滤条件，仅导出过滤后的数据。'
                  : '将导出全部数据。'}
              </p>
              <p className="lc-fd-export-stat">
                导出范围：共 {displayedRowCount} 行 × {visibleColCount} 列
              </p>
              <div className="lc-fd-export-filename">
                <span>文件名：</span>
                <input
                  type="text"
                  className="input"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                />
              </div>
            </div>
          }
          footRight={
            <>
              <button
                type="button"
                className="btn"
                onClick={() => setExportModalVisible(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleExport}
              >
                导出
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

export default FulldataView;
