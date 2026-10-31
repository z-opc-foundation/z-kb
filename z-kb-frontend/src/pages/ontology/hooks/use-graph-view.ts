import {
  getOntologyGraphView,
  type OntologyGraphView,
} from '@/services/ontology';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useGraphView(enabled: boolean) {
  const [view, setView] = useState<OntologyGraphView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setFailed(false);
    const result = await getOntologyGraphView();
    if (!aliveRef.current) {
      return;
    }
    setView(result || null);
    setFailed(result === undefined);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { view, loading, failed, reload: load };
}
