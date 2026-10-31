import { useCallback, useEffect, useState } from 'react';
import { listMembers, type OrgMember } from '@/services/identity';

/**
 * 成员列表编排：成员来自 Apex 人员主数据，关键字过滤由后端完成。
 */
export function useMembers(refreshTick = 0) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      listMembers(keyword.trim() || undefined)
        .then((next) => {
          if (alive) {
            setMembers(next || []);
          }
        })
        .catch((err: unknown) => {
          if (alive) {
            setError(err instanceof Error ? err.message : '成员加载失败');
          }
        })
        .finally(() => {
          if (alive) {
            setLoading(false);
          }
        });
    }, keyword ? 300 : 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [keyword, tick, refreshTick]);

  return { members, loading, error, keyword, setKeyword, reload };
}
