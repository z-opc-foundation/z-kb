import { useEffect, useRef, useState } from 'react';
import {
  pageDeletedMaterials,
  purgeMaterials,
  restoreMaterials,
  type MaterialRecord,
} from '@/services/material';
import { toast } from '@/utils/toast';
import { PAGE_SIZE, type MaterialTypeKey } from '../material-workspace-model';

interface UseMaterialRecycleParams {
  kbId: string;
  canWrite: boolean;
  materialType: MaterialTypeKey;
  onChanged: () => void;
}

export function useMaterialRecycle({
  kbId,
  canWrite,
  materialType,
  onChanged,
}: UseMaterialRecycleParams) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [queryKeyword, setQueryKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);
  const [records, setRecords] = useState<MaterialRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const requestSeq = useRef(0);

  const refreshCount = () => {
    if (!canWrite) {
      return;
    }
    void pageDeletedMaterials({ current: 1, size: 1, kbId, materialType }).then((result) => {
      if (result) {
        setCount(result.total);
      }
    });
  };

  useEffect(() => {
    if (!canWrite) {
      return;
    }
    let active = true;
    void pageDeletedMaterials({ current: 1, size: 1, kbId, materialType }).then((result) => {
      if (active && result) {
        setCount(result.total);
      }
    });
    return () => {
      active = false;
    };
  }, [canWrite, kbId, materialType]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const seq = ++requestSeq.current;
    void pageDeletedMaterials({
      current: page,
      size: PAGE_SIZE,
      kbId,
      keyword: queryKeyword || undefined,
      materialType,
    })
      .then((result) => {
        // 翻页/搜索可能有多个请求在途，只认最后一次发起的响应
        if (seq !== requestSeq.current || !result) {
          return;
        }
        setRecords(result.records);
        setTotal(result.total);
        setCount(result.total);
        setSelected((prev) =>
          prev.filter((id) => result.records.some((r) => r.materialId === id)),
        );
        // 取回/彻底删除可能清空当前页，回退一页直到有数据
        if (!result.records.length && result.total > 0 && page > 1) {
          setPage((prev) => Math.max(1, prev - 1));
        }
      })
      .finally(() => {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      });
  }, [open, page, queryKeyword, kbId, materialType, reloadTick]);

  const reload = () => setReloadTick((value) => value + 1);

  const openRecycle = () => {
    setKeyword('');
    setQueryKeyword('');
    setPage(1);
    setSelected([]);
    setLoading(true);
    setOpen(true);
  };

  const closeRecycle = () => {
    if (!busy) {
      setOpen(false);
    }
  };

  const applySearch = (next = keyword) => {
    setLoading(true);
    setQueryKeyword(next.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setLoading(true);
    setKeyword('');
    setQueryKeyword('');
    setPage(1);
  };

  const goPage = (next: number) => {
    setLoading(true);
    setPage(Math.min(Math.max(1, next), Math.max(1, Math.ceil(total / PAGE_SIZE))));
  };

  const toggleSelected = (materialId: string) => {
    setSelected((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId],
    );
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.length === records.length ? [] : records.map((item) => item.materialId),
    );
  };

  const restore = async (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setBusy(true);
    const result = await restoreMaterials(kbId, ids);
    setBusy(false);
    if (!result) {
      return;
    }
    const ok = result.filter((item) => item.success).length;
    toast('取回完成', `${ok}/${result.length} 份资料已恢复`, ok === result.length ? 'success' : 'warn');
    setSelected([]);
    setLoading(true);
    reload();
    refreshCount();
    onChanged();
  };

  const purge = async (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setBusy(true);
    const result = await purgeMaterials(kbId, ids);
    setBusy(false);
    if (!result) {
      return;
    }
    const ok = result.filter((item) => item.success).length;
    toast('彻底删除完成', `${ok}/${result.length} 份资料已清除`, ok === result.length ? 'success' : 'warn');
    setSelected([]);
    setLoading(true);
    reload();
    refreshCount();
    onChanged();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    open,
    keyword,
    setKeyword,
    queryKeyword,
    page,
    goPage,
    records,
    total,
    totalPages,
    count,
    loading,
    selected,
    busy,
    openRecycle,
    closeRecycle,
    applySearch,
    clearSearch,
    toggleSelected,
    toggleAll,
    restore,
    purge,
    loadCount: refreshCount,
  };
}

export type MaterialRecycleState = ReturnType<typeof useMaterialRecycle>;
