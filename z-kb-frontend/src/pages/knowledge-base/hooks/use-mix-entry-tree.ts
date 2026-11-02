import { getCategoryTree, type CategoryNode } from '@/services/category';
import { pageMaterial, type MaterialRecord } from '@/services/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deriveMixEntryType, type MixEntry } from '../mix-entry-model';

const PAGE_SIZE = 100;
const MAX_ENTRIES = 2000;

interface MaterialBatch {
  records: MaterialRecord[];
  total: number;
}

async function loadAllMaterials(kbId: string): Promise<MaterialBatch | null> {
  const records: MaterialRecord[] = [];
  let total = 0;
  let current = 1;
  while (records.length < MAX_ENTRIES) {
    const result = await pageMaterial({ current, size: PAGE_SIZE, kbId });
    if (!result) {
      return null;
    }
    total = result.total;
    records.push(...result.records);
    if (!result.records.length || records.length >= total) {
      break;
    }
    current += 1;
  }
  return { records: records.slice(0, MAX_ENTRIES), total };
}

export interface MixEntryTreeResult {
  categories: CategoryNode[];
  entries: MixEntry[];
  total: number;
  truncated: boolean;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
}

export function useMixEntryTree(kbId: string): MixEntryTreeResult {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [entries, setEntries] = useState<MixEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const seqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setLoading(true);
    setError(false);
    try {
      const [tree, batch] = await Promise.all([
        getCategoryTree(kbId),
        loadAllMaterials(kbId),
      ]);
      if (seq !== seqRef.current) {
        return;
      }
      if (!tree || !batch) {
        setError(true);
        return;
      }
      setCategories(tree);
      setEntries(
        batch.records.map((material) => ({
          material,
          type: deriveMixEntryType(material),
        })),
      );
      setTotal(batch.total);
      setTruncated(batch.records.length < batch.total);
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
      }
    }
  }, [kbId]);

  useEffect(() => {
    void reload();
    return () => {
      seqRef.current += 1;
    };
  }, [reload]);

  return {
    categories,
    entries,
    total,
    truncated,
    loading,
    error,
    reload,
  };
}
