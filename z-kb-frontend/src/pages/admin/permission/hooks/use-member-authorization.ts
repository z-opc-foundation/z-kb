import { useCallback, useEffect, useState } from 'react';
import { getMemberAuthorization, type MemberAuthorization } from '@/services/identity';

/** 选中成员的授权加载：切换成员时清空旧数据，避免串号展示。 */
export function useMemberAuthorization(staffId: number | null) {
  const [data, setData] = useState<MemberAuthorization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (staffId == null) {
      setData(null);
      setError('');
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError('');
    setData(null);
    getMemberAuthorization(staffId)
      .then((next) => {
        if (alive) {
          setData(next);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : '成员授权加载失败');
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [staffId, tick]);

  return { data, loading, error, reload };
}
