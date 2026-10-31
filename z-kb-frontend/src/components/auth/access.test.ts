import { describe, expect, it } from 'vitest';
import type { AuthContext } from '@/services/identity';
import { canAccess, canSeeMenu, isEnforced } from './access';

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    authenticated: true,
    enforced: true,
    roles: [],
    permissions: [],
    menuCodes: [],
    menus: [],
    ...overrides,
  };
}

describe('access', () => {
  it('未取到权限视图时一律放行', () => {
    expect(isEnforced(null)).toBe(false);
    expect(canAccess(null, '***REMOVED***.create')).toBe(true);
    expect(canSeeMenu(null, 'menu.***REMOVED***')).toBe(true);
    expect(canAccess(undefined, '***REMOVED***.create')).toBe(true);
  });

  it('观察期 enforce=false 时菜单与按钮全开', () => {
    const ctx = context({ enforced: false });
    expect(isEnforced(ctx)).toBe(false);
    expect(canAccess(ctx, '***REMOVED***.create')).toBe(true);
    expect(canSeeMenu(ctx, 'menu.admin.permission')).toBe(true);
  });

  it('强制期只看已授予编码', () => {
    const ctx = context({ permissions: ['***REMOVED***.create'], menuCodes: ['menu.***REMOVED***'] });
    expect(isEnforced(ctx)).toBe(true);
    expect(canAccess(ctx, '***REMOVED***.create')).toBe(true);
    expect(canAccess(ctx, '***REMOVED***.delete')).toBe(false);
    expect(canSeeMenu(ctx, 'menu.***REMOVED***')).toBe(true);
    expect(canSeeMenu(ctx, 'menu.evaluation')).toBe(false);
  });

  it('按钮授权不会让菜单可见', () => {
    const ctx = context({ permissions: ['identity.role.manage'], menuCodes: [] });
    expect(canAccess(ctx, 'identity.role.manage')).toBe(true);
    expect(canSeeMenu(ctx, 'menu.admin.permission')).toBe(false);
  });

  it('不传编码视为无需校验', () => {
    const ctx = context();
    expect(canAccess(ctx, undefined)).toBe(true);
    expect(canSeeMenu(ctx, undefined)).toBe(true);
  });
});
