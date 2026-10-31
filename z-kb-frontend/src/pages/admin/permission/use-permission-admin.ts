import { useCallback, useEffect, useState } from 'react';
import {
  listPermissionCatalog,
  listRoles,
  publishPermissionCatalog,
  type AuthRole,
  type PermissionCatalogItem,
} from '@/services/identity';
import { toast } from '@/utils/toast';

/**
 * 权限管理页的数据编排：角色列表（Apex 机构内角色）与本地权限目录。
 * 成员列表与成员授权由成员面板自行加载，避免一次拉全量。
 */
export function usePermissionAdmin() {
  const [roles, setRoles] = useState<AuthRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [rolesTick, setRolesTick] = useState(0);

  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogTick, setCatalogTick] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const reloadRoles = useCallback(() => setRolesTick((value) => value + 1), []);
  const reloadCatalog = useCallback(() => setCatalogTick((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    setRolesLoading(true);
    setRolesError('');
    const timer = window.setTimeout(() => {
      listRoles(keyword.trim() || undefined)
        .then((next) => {
          if (alive) {
            setRoles(next || []);
          }
        })
        .catch((error: unknown) => {
          if (alive) {
            setRolesError(error instanceof Error ? error.message : '角色加载失败');
          }
        })
        .finally(() => {
          if (alive) {
            setRolesLoading(false);
          }
        });
    }, keyword ? 300 : 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [keyword, rolesTick]);

  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);
    setCatalogError('');
    listPermissionCatalog()
      .then((next) => {
        if (alive) {
          setCatalog(next || []);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setCatalogError(error instanceof Error ? error.message : '权限目录加载失败');
        }
      })
      .finally(() => {
        if (alive) {
          setCatalogLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [catalogTick]);

  const applyRole = useCallback((next: AuthRole) => {
    setRoles((prev) =>
      prev.map((item) => (item.roleCode === next.roleCode ? next : item)),
    );
  }, []);

  const publishCatalog = useCallback(async () => {
    setPublishing(true);
    try {
      const published = await publishPermissionCatalog();
      toast('权限目录已发布', `共 ${published} 个菜单与按钮同步到 Apex`, 'success');
      reloadCatalog();
    } catch (error) {
      toast(
        '发布失败',
        error instanceof Error ? error.message : '请检查 Apex 权限中心连接',
        'error',
      );
    } finally {
      setPublishing(false);
    }
  }, [reloadCatalog]);

  return {
    roles,
    rolesLoading,
    rolesError,
    keyword,
    setKeyword,
    reloadRoles,
    applyRole,
    catalog,
    catalogLoading,
    catalogError,
    reloadCatalog,
    publishing,
    publishCatalog,
  };
}
