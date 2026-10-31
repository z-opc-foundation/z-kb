import {
  bindOntologyTagCategory,
  createOntologyTagCategory,
  deleteOntologyTagCategory,
  listOntologyTagCategories,
  reorderOntologyTagCategories,
  updateOntologyTagCategory,
  type OntologyTagCategory,
  type OntologyTagCategoryBindPayload,
  type OntologyTagCategorySavePayload,
  type OntologyTagCategoryUpdatePayload,
} from '@/services/ontology';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTagCategories(enabled: boolean) {
  const [categories, setCategories] = useState<OntologyTagCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mutating, setMutating] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setFailed(false);
    const result = await listOntologyTagCategories();
    if (!aliveRef.current) {
      return;
    }
    setLoading(false);
    if (!result) {
      setFailed(true);
      return;
    }
    setCategories(result);
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setMutating(true);
      const result = await action();
      setMutating(false);
      if (result === undefined) {
        return false;
      }
      await reload();
      return true;
    },
    [reload],
  );

  const create = useCallback(
    (data: OntologyTagCategorySavePayload) => mutate(() => createOntologyTagCategory(data)),
    [mutate],
  );

  const update = useCallback(
    (data: OntologyTagCategoryUpdatePayload) => mutate(() => updateOntologyTagCategory(data)),
    [mutate],
  );

  const remove = useCallback(
    (code: string) => mutate(() => deleteOntologyTagCategory(code)),
    [mutate],
  );

  const reorder = useCallback(
    (orderedCodes: string[]) => mutate(() => reorderOntologyTagCategories(orderedCodes)),
    [mutate],
  );

  const bindTag = useCallback(
    (data: OntologyTagCategoryBindPayload) => mutate(() => bindOntologyTagCategory(data)),
    [mutate],
  );

  return { categories, loading, failed, mutating, reload, create, update, remove, reorder, bindTag };
}
