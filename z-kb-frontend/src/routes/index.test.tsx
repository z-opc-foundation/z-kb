import { describe, expect, it } from 'vitest';
import { canSeeMenu } from '@/components/auth/access';
import type { AuthContext } from '@/services/identity';
import { allRoutes, defaultRoutePath } from './index';

function context(menuCodes: string[]): AuthContext {
  return {
    authenticated: true,
    enforced: true,
    roles: [],
    permissions: [],
    menuCodes,
    menus: [],
  };
}

describe('路由与菜单元数据', () => {
  it('默认落地首页且每条路由 key/path 唯一', () => {
    expect(defaultRoutePath).toBe('/index');
    expect(allRoutes[0]).toMatchObject({ key: 'index', path: defaultRoutePath, menuCode: 'menu.home' });

    const keys = allRoutes.map((route) => route.key);
    const paths = allRoutes.map((route) => route.path);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('除系统导览外都带菜单编码并套知识中台外壳', () => {
    const welcome = allRoutes.find((route) => route.key === 'welcome');
    expect(welcome?.path).toBe('/welcome');
    expect(welcome?.menuCode).toBeUndefined();
    expect(welcome?.component.name).not.toBe('AppShellPage');

    const shellRoutes = allRoutes.filter((route) => route.key !== 'welcome');
    expect(shellRoutes.every((route) => route.menuCode)).toBe(true);
    expect(shellRoutes.every((route) => route.component.name === 'AppShellPage')).toBe(true);
  });

  it('按登录人菜单授权过滤后可导航路由', () => {
    const visible = allRoutes
      .filter((route) => canSeeMenu(context(['menu.kb']), route.menuCode))
      .map((route) => route.path);

    expect(visible).toEqual([
      '/welcome',
      '/knowledge-bases',
      '/knowledge-bases/:kbId',
      '/knowledge-bases/:kbId/settings',
      '/knowledge-bases/:kbId/versions',
      '/knowledge-bases/:kbId/:tab',
    ]);
  });

  it('放行观察期展示全部路由', () => {
    const visible = allRoutes.filter((route) => canSeeMenu(null, route.menuCode));
    expect(visible).toHaveLength(allRoutes.length);
  });

  it('知识库详情通配路由排在最后，避免吞掉设置与版本页', () => {
    expect(allRoutes.at(-1)).toMatchObject({
      key: 'knowledge-base-detail-tab',
      path: '/knowledge-bases/:kbId/:tab',
      menuCode: 'menu.kb',
    });
  });
});
