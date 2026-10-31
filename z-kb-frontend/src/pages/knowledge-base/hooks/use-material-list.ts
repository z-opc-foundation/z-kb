import { useCallback, useEffect, useRef, useState } from 'react';
import { pageMaterial, type MaterialRecord } from '@/services/material';
import { PAGE_SIZE, type MaterialTypeKey } from '../material-workspace-model';

interface UseMaterialListParams {
  kbId: string;
  materialType: MaterialTypeKey;
  categoryId: string;
  onCategoryChange: (next: string) => void;
}

export function useMaterialList({
  kbId,
  materialType,
  categoryId,
  onCategoryChange,
}: UseMaterialListParams) {
  const [keyword, setKeyword] = useState('');
  const [queryKeyword, setQueryKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);
  const requestSeq = useRef(0);
  const [records, setRecords] = useState<MaterialRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const loadMaterials = useCallback(async (silent = false) => {
    const seq = ++requestSeq.current;
    if (!silent) {
      setLoading(true);
    }
    const result = await pageMaterial({
      current: page,
      size: PAGE_SIZE,
      kbId,
      keyword: queryKeyword || undefined,
      categoryId: categoryId || undefined,
      materialType,
    });
    // 条件变化时可能有多个请求在途，只认最后一次发起的响应，避免旧结果覆盖新筛选。
    if (seq !== requestSeq.current) {
      return;
    }
    if (!silent) {
      setLoading(false);
    }
    if (!result) {
      return;
    }
    setRecords(result.records);
    setTotal(result.total);
    setSelected((prev) => prev.filter((id) => result.records.some((r) => r.materialId === id)));
  }, [kbId, page, queryKeyword, categoryId, materialType, reloadTick]);

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [materialType]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const hasParsingMaterial = records.some((item) => item.parseStatus === 'PARSING');

  useEffect(() => {
    if (!hasParsingMaterial) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadMaterials(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasParsingMaterial, loadMaterials]);

  const resetToFirstPage = () => {
    // 已在本页时直接重取会命中本帧旧闭包（旧筛选条件），改由 reloadTick 触发新条件下的请求。
    if (page === 1) {
      setReloadTick((value) => value + 1);
    } else {
      setPage(1);
    }
  };

  const applySearch = (next = keyword) => {
    setQueryKeyword(next.trim());
    resetToFirstPage();
  };

  const clearSearch = () => {
    setKeyword('');
    setQueryKeyword('');
    resetToFirstPage();
  };

  const selectCategory = (targetId: string) => {
    onCategoryChange(targetId);
    setSelected([]);
    resetToFirstPage();
  };

  const toggleSelected = (materialId: string) => {
    setSelected((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId],
    );
  };

  const toggleAll = () => {
    if (selected.length === records.length) {
      setSelected([]);
    } else {
      setSelected(records.map((item) => item.materialId));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    keyword,
    setKeyword,
    queryKeyword,
    page,
    setPage,
    records,
    total,
    totalPages,
    loading,
    selected,
    setSelected,
    loadMaterials,
    resetToFirstPage,
    applySearch,
    clearSearch,
    selectCategory,
    toggleSelected,
    toggleAll,
  };
}

export type MaterialListState = ReturnType<typeof useMaterialList>;
