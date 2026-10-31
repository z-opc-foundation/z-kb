import type { MemberInheritedPermission, PermissionCatalogItem } from '@/services/identity';
import { applyCatalogCheck, diffPermissions } from './catalog-tree';

export type MemberPermissionSource = 'ROLE' | 'UNIT' | 'POSITION';

export interface MemberPermissionState {
  /** 该权限点的非直接来源，用于打标并锁定勾选框。 */
  sources: MemberPermissionSource[];
  /** 是否为直接授予（游离权限点），只有这部分可编辑。 */
  direct: boolean;
  /** 角色 / 组织 / 岗位已经带入，且不靠直接授予：勾选框置灰。 */
  locked: boolean;
}

interface MemberPermissionInput {
  directCodes: string[];
  rolePermittedCodes: string[];
  inheritedCodes: MemberInheritedPermission[];
}

/**
 * 把成员的三类授权来源合成一个索引：直接授予可编辑，角色与组织岗位来源只读。
 * 目录外的历史授权不建节点，避免树上出现无法识别的编码。
 */
export function buildMemberPermissionIndex(
  input: MemberPermissionInput,
): Map<string, MemberPermissionState> {
  const index = new Map<string, MemberPermissionState>();
  const ensure = (code: string): MemberPermissionState => {
    const existing = index.get(code);
    if (existing) {
      return existing;
    }
    const created: MemberPermissionState = { sources: [], direct: false, locked: false };
    index.set(code, created);
    return created;
  };

  for (const code of input.rolePermittedCodes) {
    ensure(code).sources.push('ROLE');
  }
  for (const item of input.inheritedCodes) {
    ensure(item.code).sources.push(item.source);
  }
  for (const code of input.directCodes) {
    ensure(code).direct = true;
  }
  for (const state of index.values()) {
    state.locked = state.sources.length > 0 && !state.direct;
  }
  return index;
}

/** 勾选态取三类来源的并集：成员实际生效的目录内权限。 */
export function effectiveCodes(
  catalog: PermissionCatalogItem[],
  input: MemberPermissionInput,
): string[] {
  const union = new Set<string>([
    ...input.directCodes,
    ...input.rolePermittedCodes,
    ...input.inheritedCodes.map((item) => item.code),
  ]);
  return catalog.filter((item) => union.has(item.code)).map((item) => item.code);
}

/**
 * 勾选变化只落到「直接授予」这一份上：新增时补齐祖先菜单，
 * 取消时回收子孙；角色 / 组织 / 岗位带入的编码不会被写进直接授予。
 */
export function toggleMemberPermission(
  catalog: PermissionCatalogItem[],
  directCodes: string[],
  lockedCodes: Set<string>,
  code: string,
  checked: boolean,
): string[] {
  if (checked) {
    return applyCatalogCheck(catalog, directCodes, code, true).filter(
      (item) => !lockedCodes.has(item),
    );
  }
  return applyCatalogCheck(catalog, directCodes, code, false);
}

/** 保存时只提交直接授予的增量，目录外的历史授权不回收。 */
export function diffMemberPermissions(
  catalog: PermissionCatalogItem[],
  saved: string[],
  next: string[],
): { addCodes: string[]; removeCodes: string[] } {
  return diffPermissions(
    catalog.map((item) => item.code),
    saved,
    next,
  );
}
