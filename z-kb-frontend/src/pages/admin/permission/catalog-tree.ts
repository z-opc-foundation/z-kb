import type { PermissionCatalogItem } from '@/services/identity';

export interface CatalogTreeNode {
  key: string;
  label: string;
  type: 'MENU' | 'BUTTON';
  path?: string;
  children: CatalogTreeNode[];
}

/**
 * 扁平目录 → 勾选树：菜单按 parentCode 组树，按钮挂到所属菜单下；
 * 找不到父节点的项提升为根，避免目录脏数据丢节点。
 */
export function buildCatalogTree(items: PermissionCatalogItem[]): CatalogTreeNode[] {
  const nodes = new Map<string, CatalogTreeNode>();
  const ordered = [...items].sort((a, b) => a.order - b.order);
  for (const item of ordered) {
    nodes.set(item.code, {
      key: item.code,
      label: item.name,
      type: item.type,
      path: item.path,
      children: [],
    });
  }

  const roots: CatalogTreeNode[] = [];
  for (const item of ordered) {
    const node = nodes.get(item.code);
    if (!node) {
      continue;
    }
    const parent = item.parentCode ? nodes.get(item.parentCode) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** 只对目录内编码做增删，避免把 Apex 里已有但目录已下线的授权误回收。 */
export function diffPermissions(
  catalogCodes: Iterable<string>,
  granted: string[],
  checked: string[],
): { addCodes: string[]; removeCodes: string[] } {
  const known = new Set(catalogCodes);
  const grantedSet = new Set(granted);
  const checkedSet = new Set(checked);
  const addCodes = [...checkedSet].filter((code) => !grantedSet.has(code));
  const removeCodes = granted.filter(
    (code) => known.has(code) && !checkedSet.has(code),
  );
  return { addCodes, removeCodes };
}

function buildIndex(items: PermissionCatalogItem[]) {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const item of items) {
    if (item.parentCode) {
      parentOf.set(item.code, item.parentCode);
      const siblings = childrenOf.get(item.parentCode) ?? [];
      siblings.push(item.code);
      childrenOf.set(item.parentCode, siblings);
    }
  }
  return { parentOf, childrenOf };
}

/**
 * 树使用 checkStrictly，勾选态必须显式维护：
 * 勾选任意项时补齐祖先菜单（按钮脱离菜单不可见），取消菜单时连同其子孙一并回收。
 */
export function applyCatalogCheck(
  items: PermissionCatalogItem[],
  current: string[],
  code: string,
  checked: boolean,
): string[] {
  const { parentOf, childrenOf } = buildIndex(items);
  const next = new Set(current);
  if (checked) {
    next.add(code);
    const seen = new Set([code]);
    let parent = parentOf.get(code);
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      next.add(parent);
      parent = parentOf.get(parent);
    }
    return [...next];
  }

  const queue = [code];
  while (queue.length) {
    const currentCode = queue.shift() as string;
    next.delete(currentCode);
    queue.push(...(childrenOf.get(currentCode) ?? []));
  }
  return [...next];
}
