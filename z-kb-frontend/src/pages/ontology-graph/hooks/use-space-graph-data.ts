/**
 * 图空间数据加载 Hook：空间元数据 / Tag 关系 / 实例统计。
 * 自 galaxy-meta OntologyBrowse 的数据加载 effect 平移，
 * 数据源经 src/services/ontology-graph.ts 走 galaxy-meta-admin 代理。
 */
import {
  getSpaceMetadata,
  getSpaceStats,
  getStatsJobStatus,
  queryTagRelations,
  refreshSpaceStats,
  type SpaceMetadata,
  type TagRelationInfo,
} from '@/services/ontology-graph';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphLinkItem, GraphNodeItem, OntologyObjectInfo } from '../types';
import {
  UNCATEGORIZED_CAT_CODE,
  buildCategoryColorMap,
  type CategoryColor,
} from '@/components/ontology-graph';

export type GraphLoadState = 'loading' | 'ready' | 'failed';

export interface SpaceGraphData {
  loading: boolean;
  failed: boolean;
  metadata: SpaceMetadata | null;
  objects: OntologyObjectInfo[];
  /** 关系原始清单（displayName 已补齐中文） */
  relations: TagRelationInfo[];
  graphData: { data: GraphNodeItem[]; links: GraphLinkItem[] };
  /** 对象 code → 中文名（关系两端显示中文用） */
  tagDisplayMap: Record<string, string>;
  categoryColorMap: Map<string, CategoryColor>;
  tagInstanceCountRef: React.MutableRefObject<Record<string, number>>;
  edgeInstanceCountRef: React.MutableRefObject<Record<string, number>>;
  statsTime: string;
  statsRefreshing: boolean;
  refreshStats: () => void;
  reload: () => void;
}

/** 元数据 comment JSON 中的展示说明 */
function parseComment(comment: unknown): string {
  const raw = String(comment ?? '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { displayName?: string; description?: string };
    return String(parsed?.displayName || parsed?.description || raw);
  } catch {
    return raw;
  }
}

export function useSpaceGraphData(spaceName: string): SpaceGraphData {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [metadata, setMetadata] = useState<SpaceMetadata | null>(null);
  const [relations, setRelations] = useState<TagRelationInfo[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [edgeCounts, setEdgeCounts] = useState<Record<string, number>>({});
  const [statsTime, setStatsTime] = useState('');
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [reloadSeq, setReloadSeq] = useState(0);

  const tagInstanceCountRef = useRef<Record<string, number>>({});
  const edgeInstanceCountRef = useRef<Record<string, number>>({});
  const statsAbortRef = useRef<AbortController | null>(null);

  // 统计数小写化：兼容 NebulaGraph enable_lowercase_identifiers，并镜像到 ref 供 tooltip 闭包读取
  tagInstanceCountRef.current = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(tagCounts).map(([k, v]) => [k.toLowerCase(), v]),
      ),
    [tagCounts],
  );
  edgeInstanceCountRef.current = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(edgeCounts).map(([k, v]) => [k.toLowerCase(), v]),
      ),
    [edgeCounts],
  );

  const load = useCallback(
    (signal: { cancelled: boolean }) => {
      if (!spaceName) return;
      setLoading(true);
      setFailed(false);
      Promise.all([
        getSpaceMetadata(spaceName),
        queryTagRelations(spaceName),
        getSpaceStats(spaceName).catch(() => null),
      ])
        .then(([meta, rels, stats]) => {
          if (signal.cancelled) return;
          setMetadata(meta);
          setRelations(
            (rels || []).map((r) => ({ ...r, edgeType: r.edgeType || '' })),
          );
          if (stats) {
            setTagCounts(stats.tagCounts || {});
            setEdgeCounts(stats.edgeCounts || {});
            setStatsTime(stats.statsTime || '');
          }
        })
        .catch(() => {
          if (signal.cancelled) return;
          setFailed(true);
        })
        .finally(() => {
          if (!signal.cancelled) setLoading(false);
        });
    },
    [spaceName],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load, reloadSeq]);

  // 卸载时取消统计轮询
  useEffect(
    () => () => {
      statsAbortRef.current?.abort();
    },
    [],
  );

  /** 对象清单：元数据 objectTypes 归一为统一结构 */
  const objects = useMemo<OntologyObjectInfo[]>(() => {
    const meta = metadata;
    if (!meta) return [];
    return (meta.objectTypes || []).map((t) => ({
      objectCode: t.typeName,
      objectName: t.displayName || t.typeName,
      categoryCode: t.categoryCode || '',
      categoryName: t.categoryName || '未分类',
      description: parseComment(t.comment),
      properties: (meta.objectPropertiesMap?.[t.typeName] || []).map((p) => ({
        name: p.propertyName || '',
        type: p.propertyType || '',
        description: p.description || '',
      })),
    }));
  }, [metadata]);

  const tagDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    objects.forEach((t) => {
      map[t.objectCode] = t.objectName || t.objectCode;
    });
    return map;
  }, [objects]);

  /** 关系 displayName 映射：edgeType -> 中文名（来自 metadata.relations） */
  const relDisplayMap = useMemo(() => {
    const map: Record<string, string> = {};
    (metadata?.relations || []).forEach((rel) => {
      if (rel.relationType) {
        map[rel.relationType] = rel.displayName || '';
      }
    });
    return map;
  }, [metadata]);

  /** 图谱数据：节点 id=objectCode（唯一英文标识），关系补齐中文显示名 */
  const graphData = useMemo<{
    data: GraphNodeItem[];
    links: GraphLinkItem[];
  }>(() => {
    const validTagCodes = new Set(objects.map((t) => t.objectCode));
    const data = objects.map((t) => ({
      id: t.objectCode,
      name: t.objectName,
      code: t.objectCode,
      categoryCode: t.categoryCode || '',
    }));
    const links = relations
      .map((r) => {
        const et = r.edgeType;
        const srcCode = r.sourceTag;
        const tgtCode = r.targetTag;
        if (!validTagCodes.has(srcCode) || !validTagCodes.has(tgtCode)) {
          return null;
        }
        return {
          source: srcCode,
          target: tgtCode,
          value: et,
          code: et,
          displayName: relDisplayMap[et] || et,
          sourceName: tagDisplayMap[srcCode] || srcCode,
          targetName: tagDisplayMap[tgtCode] || tgtCode,
        } satisfies GraphLinkItem;
      })
      .filter((l): l is GraphLinkItem => l != null);
    return { data, links };
  }, [objects, relations, relDisplayMap, tagDisplayMap]);

  /** 分类配色：按对象清单中分类首次出现顺序分配（无分类管理接口，取 objectTypes 注入值） */
  const categoryColorMap = useMemo(() => {
    const seen: string[] = [];
    objects.forEach((t) => {
      const code = t.categoryCode || UNCATEGORIZED_CAT_CODE;
      if (!seen.includes(code)) seen.push(code);
    });
    return buildCategoryColorMap(seen.map((categoryCode) => ({ categoryCode })));
  }, [objects]);

  /** 刷新统计：提交 STATS 任务后轮询任务状态（指数退避，最大 60s） */
  const refreshStats = useCallback(() => {
    if (statsRefreshing || !spaceName) return;
    statsAbortRef.current?.abort();
    const controller = new AbortController();
    statsAbortRef.current = controller;
    setStatsRefreshing(true);
    const run = async () => {
      try {
        await refreshSpaceStats(spaceName);
        if (controller.signal.aborted) return;
        toast('统计任务已提交', undefined, 'info');

        const maxWait = 60000;
        const intervals = [2000, 3000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000];
        let elapsed = 0;
        let jobFinished = false;
        for (const interval of intervals) {
          await new Promise<void>((resolve) => {
            if (controller.signal.aborted) {
              resolve();
              return;
            }
            const timer = setTimeout(resolve, interval);
            controller.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
          if (controller.signal.aborted) return;
          elapsed += interval;
          if (elapsed >= maxWait) break;
          const jobStatus = await getStatsJobStatus(spaceName);
          if (controller.signal.aborted) return;
          const status = (jobStatus.status || '').toLowerCase();
          if (status === 'finished' || status === 'failed' || status === 'stopped') {
            jobFinished = true;
            break;
          }
        }

        if (controller.signal.aborted) return;
        const stats = await getSpaceStats(spaceName);
        if (controller.signal.aborted) return;
        setTagCounts(stats.tagCounts || {});
        setEdgeCounts(stats.edgeCounts || {});
        setStatsTime(stats.statsTime || '');
        toast(
          jobFinished ? '统计已刷新' : '统计任务进行中，数据可能稍后更新',
          undefined,
          jobFinished ? 'success' : 'info',
        );
      } catch {
        if (!controller.signal.aborted) {
          toast('刷新统计失败', undefined, 'error');
        }
      } finally {
        if (statsAbortRef.current === controller) {
          statsAbortRef.current = null;
        }
        if (!controller.signal.aborted) {
          setStatsRefreshing(false);
        }
      }
    };
    void run();
  }, [statsRefreshing, spaceName]);

  const reload = useCallback(() => setReloadSeq((s) => s + 1), []);

  return {
    loading,
    failed,
    metadata,
    objects,
    relations,
    graphData,
    tagDisplayMap,
    categoryColorMap,
    tagInstanceCountRef,
    edgeInstanceCountRef,
    statsTime,
    statsRefreshing,
    refreshStats,
    reload,
  };
}
