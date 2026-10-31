import { describe, expect, it } from 'vitest';
import type { PermissionCatalogItem } from '@/services/identity';
import { applyCatalogCheck, buildCatalogTree, diffPermissions } from './catalog-tree';

function item(overrides: Partial<PermissionCatalogItem>): PermissionCatalogItem {
  return {
    code: 'menu.x',
    name: 'X',
    type: 'MENU',
    typeCode: 1,
    order: 10,
    ...overrides,
  };
}

describe('buildCatalogTree', () => {
  it('菜单按 parentCode 组树，按钮挂在所属菜单下', () => {
    const tree = buildCatalogTree([
      item({ code: 'menu.admin', name: '管理员', order: 60 }),
      item({ code: 'menu.admin.permission', name: '权限管理', parentCode: 'menu.admin', order: 64 }),
      item({ code: 'identity.role.manage', name: '角色授权', type: 'BUTTON', typeCode: 2, parentCode: 'menu.admin.permission', order: 131 }),
      item({ code: 'menu.***REMOVED***', name: '知识库', parentCode: 'menu.space', order: 41 }),
    ]);

    expect(tree.map((node) => node.key)).toEqual(['menu.***REMOVED***', 'menu.admin']);
    const admin = tree.find((node) => node.key === 'menu.admin');
    expect(admin?.children[0].key).toBe('menu.admin.permission');
    expect(admin?.children[0].children[0]).toMatchObject({
      key: 'identity.role.manage',
      type: 'BUTTON',
    });
  });
});

const flat = [
  item({ code: 'menu.space', name: '知识空间', order: 40 }),
  item({ code: 'menu.***REMOVED***', name: '知识库', parentCode: 'menu.space', order: 41 }),
  item({ code: '***REMOVED***.create', name: '新建知识库', type: 'BUTTON', typeCode: 2, parentCode: 'menu.***REMOVED***', order: 101 }),
  item({ code: '***REMOVED***.delete', name: '删除知识库', type: 'BUTTON', typeCode: 2, parentCode: 'menu.***REMOVED***', order: 103 }),
];

describe('applyCatalogCheck', () => {
  it('勾选按钮会补齐祖先菜单', () => {
    expect(applyCatalogCheck(flat, [], '***REMOVED***.create', true).sort()).toEqual([
      '***REMOVED***.create',
      'menu.***REMOVED***',
      'menu.space',
    ]);
  });

  it('勾选菜单不会自动授予子按钮', () => {
    expect(applyCatalogCheck(flat, [], 'menu.***REMOVED***', true).sort()).toEqual([
      'menu.***REMOVED***',
      'menu.space',
    ]);
  });

  it('取消菜单会回收全部子孙', () => {
    const current = ['menu.space', 'menu.***REMOVED***', '***REMOVED***.create', '***REMOVED***.delete'];
    expect(applyCatalogCheck(flat, current, 'menu.***REMOVED***', false)).toEqual(['menu.space']);
  });

  it('取消单个按钮保留父菜单', () => {
    const current = ['menu.space', 'menu.***REMOVED***', '***REMOVED***.create', '***REMOVED***.delete'];
    expect(applyCatalogCheck(flat, current, '***REMOVED***.delete', false).sort()).toEqual([
      '***REMOVED***.create',
      'menu.***REMOVED***',
      'menu.space',
    ]);
  });
});

describe('diffPermissions', () => {
  const catalog = ['menu.***REMOVED***', '***REMOVED***.create', '***REMOVED***.delete'];

  it('新增与回收分开计算', () => {
    expect(diffPermissions(catalog, ['menu.***REMOVED***'], ['menu.***REMOVED***', '***REMOVED***.create'])).toEqual({
      addCodes: ['***REMOVED***.create'],
      removeCodes: [],
    });
    expect(diffPermissions(catalog, ['menu.***REMOVED***', '***REMOVED***.delete'], ['menu.***REMOVED***'])).toEqual({
      addCodes: [],
      removeCodes: ['***REMOVED***.delete'],
    });
  });

  it('目录外的历史授权不回收', () => {
    expect(
      diffPermissions(catalog, ['menu.***REMOVED***', 'legacy.code'], ['menu.***REMOVED***']),
    ).toEqual({ addCodes: [], removeCodes: [] });
  });
});
