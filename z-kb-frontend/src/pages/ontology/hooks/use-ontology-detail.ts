import {
  createOntology,
  getOntologyDetail,
  updateOntology,
  type OntologyDetail,
  type OntologySavePayload,
} from '@/services/ontology';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useState } from 'react';

export type OntologyLoadState = 'loading' | 'open' | 'notOpen' | 'failed';

export function useOntologyDetail() {
  const [detail, setDetail] = useState<OntologyDetail | null>(null);
  const [state, setState] = useState<OntologyLoadState>('loading');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    const result = await getOntologyDetail();
    if (result === undefined) {
      setDetail(null);
      setState('failed');
      return;
    }
    setDetail(result);
    setState(result === null ? 'notOpen' : 'open');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (payload: OntologySavePayload, mode: 'create' | 'update') => {
      setSaving(true);
      try {
        const saved =
          mode === 'create'
            ? await createOntology(payload)
            : await updateOntology(payload);
        if (saved) {
          setDetail(saved);
          setState('open');
          toast(
            mode === 'create' ? '已开通本体' : '已保存本体信息',
            saved.name,
            'success',
          );
        }
        return saved;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { detail, state, saving, reload: load, save };
}
