import type { AuthContext } from '@/services/identity';

/**
 * 是否处于强制鉴权期。读取失败（context 为空）或 enforce=false 都按放行处理：
 * 前端隐藏只是体验，真正的边界在后端 PermissionInterceptor。
 */
export function isEnforced(context: AuthContext | null | undefined): boolean {
  return !!context && context.enforced === true;
}

/** 按钮/接口级权限判断；未接 apex 或观察期一律放行。 */
export function canAccess(
  context: AuthContext | null | undefined,
  code?: string,
): boolean {
  if (!code) {
    return true;
  }
  if (!isEnforced(context)) {
    return true;
  }
  return !!context && context.permissions.includes(code);
}

/** 菜单可见性只看后端裁剪后的 menuCodes，按钮授权不会让菜单出现。 */
export function canSeeMenu(
  context: AuthContext | null | undefined,
  code?: string,
): boolean {
  if (!code) {
    return true;
  }
  if (!isEnforced(context)) {
    return true;
  }
  return !!context && context.menuCodes.includes(code);
}
