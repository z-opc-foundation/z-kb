import { useCallback, useEffect, useState } from 'react';
import {
  pageOntologyInstanceLinks,
  pageOntologyInstances,
  type OntologyInstanceLinkRecord,
  type OntologyInstanceRecord,
} from '@/services/ontology';

/** 抽屉查询目标：tag 模式查某对象类型实例分页；link 模式查某关系类型实例对分页。 */
export type InstanceQueryTarget =
  | { mode: 'tag'; tagName: string }
  | { mode: 'link'; edgeName: string; srcTag?: string; dstTag?: string };

export interface InstanceQueryState {
  loading: boolean;
  failed: boolean;
  graphBound: boolean;
  records: OntologyInstanceRecord[];
  linkRecords: OntologyInstanceLinkRecord[];
  total: number;
  current: number;
  size: number;
}

const INITIAL: InstanceQueryState = {
  loading: true,
  failed: false,
  graphBound: true,
  records: [],
  linkRecords: [],
  total: 0,
  current: 1,
  size: 10,
};

/**
 * 抽屉统一实例查询状态机。
 *
 * - open/openLink 切换查询目标（tag / link 两种模式）
 * - search 关键词查询（tag 模式专用），turnPage 翻页，retry 重试
 * - graphBound=false 是图库未接入的正常降级态，非错误
 */
export function useInstanceQuery() {
  const [target, setTarget] = useState<InstanceQueryTarget | null>(null);
  const [query, setQuery] = useState({ keyword: '', current: 1, size: 10 });
  const [state, setState] = useState<InstanceQueryState>(INITIAL);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!target) return;
    let stale = false;
    const load =
      target.mode === 'tag'
        ? pageOntologyInstances({
            tagName: target.tagName,
            keyword: query.keyword,
            current: query.current,
            size: query.size,
          }).then((page) =>
            page
              ? {
                  meta: page,
                  records: page.records ?? [],
                  linkRecords: [] as OntologyInstanceLinkRecord[],
                }
              : undefined,
          )
        : pageOntologyInstanceLinks({
            edgeName: target.edgeName,
            srcTag: target.srcTag,
            dstTag: target.dstTag,
            current: query.current,
            size: query.size,
          }).then((page) =>
            page
              ? {
                  meta: page,
                  records: [] as OntologyInstanceRecord[],
                  linkRecords: page.records ?? [],
                }
              : undefined,
          );
    load.then((result) => {
      if (stale) return;
      if (!result) {
        setState((prev) => ({ ...prev, loading: false, failed: true }));
        return;
      }
      setState({
        loading: false,
        failed: false,
        graphBound: result.meta.graphBound,
        records: result.records,
        linkRecords: result.linkRecords,
        total: result.meta.total,
        current: result.meta.current,
        size: result.meta.size,
      });
    });
    return () => {
      stale = true;
    };
  }, [target, query, reloadTick]);

  const open = useCallback((tagName: string) => {
    setTarget({ mode: 'tag', tagName });
    setQuery({ keyword: '', current: 1, size: 10 });
    setState(INITIAL);
  }, []);

  const openLink = useCallback(
    (edgeName: string, srcTag?: string, dstTag?: string) => {
      setTarget({ mode: 'link', edgeName, srcTag, dstTag });
      setQuery({ keyword: '', current: 1, size: 10 });
      setState(INITIAL);
    },
    [],
  );

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  const search = useCallback((keyword: string) => {
    setState((prev) => ({ ...prev, loading: true, failed: false }));
    setQuery((prev) => ({ ...prev, keyword, current: 1 }));
  }, []);

  const turnPage = useCallback((current: number) => {
    setState((prev) => ({ ...prev, loading: true, failed: false }));
    setQuery((prev) => ({ ...prev, current }));
  }, []);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, failed: false }));
    setReloadTick((tick) => tick + 1);
  }, []);

  return {
    target,
    state,
    query,
    open,
    openLink,
    close,
    search,
    turnPage,
    retry,
  };
}
