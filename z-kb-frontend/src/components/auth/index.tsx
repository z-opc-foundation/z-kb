import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchAuthContext, type AuthContext } from '@/services/identity';
import { canAccess, canSeeMenu, isEnforced } from './access';

interface PermissionState {
  loading: boolean;
  context: AuthContext | null;
  /** 是否强制鉴权；false 时菜单全开、后端不拦截 */
  enforced: boolean;
  can: (code?: string) => boolean;
  canSeeMenu: (code?: string) => boolean;
  reload: () => void;
}

const PermissionContext = createContext<PermissionState | null>(null);

/** 独立整页路由（如系统导览）：不套外壳，也不拉权限视图，避免未登录时被 401 踢去登录页。 */
const PUBLIC_PATHS = ['/welcome'];

function isPublicRoute(): boolean {
  const path = window.location.hash.replace(/^#/, '').split('?')[0];
  return PUBLIC_PATHS.includes(path);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AuthContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isPublicRoute()) {
      setContext(null);
      setLoading(false);
      // 从独立页进控制台时再补拉权限视图
      const onHashChange = () => {
        if (!isPublicRoute()) {
          window.removeEventListener('hashchange', onHashChange);
          setTick((value) => value + 1);
        }
      };
      window.addEventListener('hashchange', onHashChange);
      return () => window.removeEventListener('hashchange', onHashChange);
    }
    let alive = true;
    setLoading(true);
    // 失败返回 null，前端按放行处理，避免本地未接 apex 时整站不可用
    fetchAuthContext()
      .then((next) => {
        if (alive) {
          setContext(next);
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
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  const value = useMemo<PermissionState>(
    () => ({
      loading,
      context,
      enforced: isEnforced(context),
      can: (code) => canAccess(context, code),
      canSeeMenu: (code) => canSeeMenu(context, code),
      reload,
    }),
    [context, loading, reload],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission(): PermissionState {
  const state = useContext(PermissionContext);
  if (!state) {
    throw new Error('usePermission 必须在 AuthProvider 内使用');
  }
  return state;
}

/** 按钮级权限包装：无权限时不渲染，可给 fallback。 */
export function Can({
  code,
  children,
  fallback = null,
}: {
  code: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermission();
  return <>{can(code) ? children : fallback}</>;
}
