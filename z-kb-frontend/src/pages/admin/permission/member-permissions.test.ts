import { describe, expect, it } from 'vitest';
import type { PermissionCatalogItem } from '@/services/identity';
import {
  buildMemberPermissionIndex,
  diffMemberPermissions,
  effectiveCodes,
  toggleMemberPermission,
} from './member-permissions';

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

const catalog = [
  item({ code: 'menu.space', name: '知识空间', order: 40 }),
  item({ code: 'menu.kb', name: '知识库', parentCode: 'menu.space', order: 41 }),
  item({ code: 'kb.create', name: '新建知识库', type: 'BUTTON', typeCode: 2, parentCode: 'menu.kb', order: 101 }),
  item({ code: 'kb.delete', name: '删除知识库', type: 'BUTTON', typeCode: 2, parentCode: 'menu.kb', order: 103 }),
];

describe('buildMemberPermissionIndex', () => {
  it('角色与组织岗位来源标记只读，直接授予可编辑', () => {
    const index = buildMemberPermissionIndex({
      directCodes: ['kb.create'],
      rolePermittedCodes: ['menu.space', 'menu.kb', 'kb.create'],
      inheritedCodes: [
        { code: 'menu.space', source: 'UNIT' },
        { code: 'kb.delete', source: 'POSITION' },
      ],
    });

    expect(index.get('menu.kb')).toEqual({ sources: ['ROLE'], direct: false, locked: true });
    expect(index.get('menu.space')).toEqual({
      sources: ['ROLE', 'UNIT'],
      direct: false,
      locked: true,
    });
    expect(index.get('kb.delete')).toEqual({
      sources: ['POSITION'],
      direct: false,
      locked: true,
    });
    // 直接授予与角色带入同时存在时，直接授予仍然可改
    expect(index.get('kb.create')).toEqual({
      sources: ['ROLE'],
      direct: true,
      locked: false,
    });
  });

  it('目录外的授权码不进索引', () => {
    const index = buildMemberPermissionIndex({
      directCodes: [],
      rolePermittedCodes: ['menu.kb', 'legacy.code'],
      inheritedCodes: [],
    });
    expect([...index.keys()]).toEqual(['menu.kb', 'legacy.code']);
  });
});

describe('effectiveCodes', () => {
  it('取三类来源并集并按目录顺序输出', () => {
    expect(
      effectiveCodes(catalog, {
        directCodes: ['kb.delete'],
        rolePermittedCodes: ['menu.space', 'menu.kb'],
        inheritedCodes: [{ code: 'kb.create', source: 'UNIT' }],
      }),
    ).toEqual(['menu.space', 'menu.kb', 'kb.create', 'kb.delete']);
  });

  it('过滤目录外的编码', () => {
    expect(
      effectiveCodes(catalog, {
        directCodes: ['legacy.code'],
        rolePermittedCodes: [],
        inheritedCodes: [],
      }),
    ).toEqual([]);
  });
});

describe('toggleMemberPermission', () => {
  const locked = new Set(['menu.space', 'menu.kb']);

  it('勾选按钮补齐祖先菜单，但不把只读来源写进直接授予', () => {
    expect(toggleMemberPermission(catalog, [], locked, 'kb.create', true)).toEqual(['kb.create']);
  });

  it('勾选菜单只补菜单自身，不连带子按钮', () => {
    expect(toggleMemberPermission(catalog, [], new Set<string>(), 'menu.kb', true).sort()).toEqual([
      'menu.kb',
      'menu.space',
    ]);
  });

  it('取消菜单回收子孙，保留目录外的历史授权', () => {
    expect(
      toggleMemberPermission(
        catalog,
        ['menu.space', 'menu.kb', 'kb.create', 'kb.delete', 'legacy.code'],
        locked,
        'menu.kb',
        false,
      ).sort(),
    ).toEqual(['legacy.code', 'menu.space']);
  });

  it('取消单个按钮保留父菜单', () => {
    expect(
      toggleMemberPermission(catalog, ['menu.kb', 'kb.create', 'kb.delete'], locked, 'kb.delete', false).sort(),
    ).toEqual(['kb.create', 'menu.kb']);
  });
});

describe('diffMemberPermissions', () => {
  it('只计算目录内的直接授予增量', () => {
    expect(diffMemberPermissions(catalog, ['legacy.code'], ['kb.create'])).toEqual({
      addCodes: ['kb.create'],
      removeCodes: [],
    });
    expect(diffMemberPermissions(catalog, ['kb.delete', 'legacy.code'], [])).toEqual({
      addCodes: [],
      removeCodes: ['kb.delete'],
    });
  });
});
