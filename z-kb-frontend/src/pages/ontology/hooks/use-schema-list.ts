import {
  pageOntologyEdges,
  pageOntologyTags,
  type OntologyEdgeRecord,
  type OntologyTagRecord,
} from '@/services/ontology';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_SIZE = 10;

interface PagedState<T> {
  records: T[];
  total: number;
  current: number;
  size: number;
  loading: boolean;
  failed: boolean;
}

interface FilterState {
  status: string;
  keyword: string;
}

interface PageQueryParams {
  current: number;
  size: number;
  status?: string;
  keyword?: string;
}

function usePagedList<T>(
  fetchPage: (query: PageQueryParams) => Promise<{
    records: T[];
    total: number;
    current: number;
    size: number;
  } | undefined>,
  enabled: boolean,
  initialSize: number,
) {
  const [state, setState] = useState<PagedState<T>>({
    records: [],
    total: 0,
    current: 1,
    size: initialSize,
    loading: true,
    failed: false,
  });
  const [filters, setFilters] = useState<FilterState>({ status: '', keyword: '' });
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(initialSize);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const reload = useCallback(
    async (page: number, pageSize: number, nextFilters: FilterState) => {
      if (!enabled) {
        return;
      }
      setState((prev) => ({ ...prev, loading: true, failed: false }));
      const result = await fetchPage({
        current: page,
        size: pageSize,
        status: nextFilters.status || undefined,
        keyword: nextFilters.keyword.trim() || undefined,
      });
      if (!aliveRef.current) {
        return;
      }
      if (!result) {
        setState((prev) => ({
          ...prev,
          records: [],
          total: 0,
          loading: false,
          failed: true,
        }));
        return;
      }
      setState({
        records: result.records,
        total: result.total,
        current: result.current,
        size: result.size,
        loading: false,
        failed: false,
      });
    },
    [enabled, fetchPage],
  );

  useEffect(() => {
    void reload(current, size, filters);
  }, [reload, current, size, filters]);

  const onPageChange = useCallback((page: number) => {
    setCurrent(page);
  }, []);

  const onSizeChange = useCallback((pageSize: number) => {
    setSize(pageSize);
    setCurrent(1);
  }, []);

  const setFiltersAndReset = useCallback((next: FilterState) => {
    setFilters(next);
    setCurrent(1);
  }, []);

  return { ...state, filters, onPageChange, onSizeChange, setFilters: setFiltersAndReset };
}

export function useTagList(enabled: boolean, initialSize: number = DEFAULT_SIZE) {
  return usePagedList<OntologyTagRecord>(
    useCallback((query) => pageOntologyTags(query), []),
    enabled,
    initialSize,
  );
}

export function useEdgeList(enabled: boolean, initialSize: number = DEFAULT_SIZE) {
  return usePagedList<OntologyEdgeRecord>(
    useCallback((query) => pageOntologyEdges(query), []),
    enabled,
    initialSize,
  );
}
