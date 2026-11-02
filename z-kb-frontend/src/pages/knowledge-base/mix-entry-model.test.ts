import type { CategoryNode } from '@/services/category';
import type { MaterialRecord } from '@/services/material';
import { describe, expect, it } from 'vitest';
import {
  buildMixTree,
  collectMixEntries,
  deriveMixEntryState,
  deriveMixEntryType,
  findMixTreeNode,
  flattenMixTree,
  mixFolderPath,
  normalizeExt,
} from './mix-entry-model';

function material(overrides: Partial<MaterialRecord>): MaterialRecord {
  return {
    materialId: 'm-default',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '条目',
    sourceType: 'LOCAL',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp',
    compileStatus: 'NONE',
    governanceStatus: 'NONE',
    registeredBy: 0,
    ...overrides,
  };
}

function category(
  categoryId: string,
  name: string,
  sortNo: number,
  children?: CategoryNode[],
): CategoryNode {
  return { categoryId, name, sortNo, children };
}

describe('MIX 条目类型推导', () => {
  it('优先使用物料类型', () => {
    expect(
      deriveMixEntryType(material({ materialType: 'CODE', fileExt: '.pdf' })),
    ).toBe('code');
    expect(
      deriveMixEntryType(
        material({ materialType: 'DATA_TABLE', fileExt: '.txt' }),
      ),
    ).toBe('table');
  });

  it('优先使用后端落库的 entryType', () => {
    expect(
      deriveMixEntryType(
        material({ materialType: 'CODE', fileExt: '.pdf', entryType: 'IMAGE' }),
      ),
    ).toBe('image');
    expect(
      deriveMixEntryType(
        material({ materialType: 'DOCUMENT', fileExt: '.xlsx', entryType: 'TABLE' }),
      ),
    ).toBe('table');
  });

  it('未知或缺失 entryType 时按物料类型与扩展名回落', () => {
    expect(
      deriveMixEntryType(
        material({ materialType: 'DOCUMENT', fileExt: '.png', entryType: 'UNKNOWN' }),
      ),
    ).toBe('image');
    expect(
      deriveMixEntryType(
        material({ materialType: 'CODE', fileExt: '.pdf', entryType: undefined }),
      ),
    ).toBe('code');
  });

  it('按扩展名区分文档与媒体类型', () => {
    const cases: [string, string][] = [
      ['.pdf', 'document'],
      ['.XLSX', 'table'],
      ['png', 'image'],
      ['.mp3', 'audio'],
      ['.mp4', 'video'],
      ['.html', 'web'],
      ['.py', 'code'],
      ['.json', 'json'],
    ];
    cases.forEach(([fileExt, expected]) => {
      expect(deriveMixEntryType(material({ fileExt }))).toBe(expected);
    });
  });

  it('未知扩展名回落到文档', () => {
    expect(deriveMixEntryType(material({ fileExt: '.unknown' }))).toBe(
      'document',
    );
    expect(deriveMixEntryType(material({ fileExt: undefined }))).toBe('document');
    expect(normalizeExt('.JSON')).toBe('json');
  });
});

describe('MIX 条目解析状态', () => {
  it('映射解析状态', () => {
    expect(deriveMixEntryState('READY')).toBe('parsed');
    expect(deriveMixEntryState('PARSING')).toBe('parsing');
    expect(deriveMixEntryState('FAILED')).toBe('failed');
    expect(deriveMixEntryState(undefined)).toBe('queued');
  });
});

describe('MIX 条目树', () => {
  const categories: CategoryNode[] = [
    category('dir-a', '院级制度', 1, [
      category('dir-a1', '医疗质量', 1),
      category('dir-a2', '护理', 2),
    ]),
    category('dir-b', '培训', 2),
  ];
  const entries = [
    {
      material: material({ materialId: 'm-a1', title: 'B 文档', categoryId: 'dir-a1' }),
      type: 'document' as const,
    },
    {
      material: material({ materialId: 'm-a2', title: 'A 图片', categoryId: 'dir-a1' }),
      type: 'image' as const,
    },
    {
      material: material({ materialId: 'm-b', title: '培训表', categoryId: 'dir-b' }),
      type: 'table' as const,
    },
    {
      material: material({ materialId: 'm-root', title: 'A 根条目' }),
      type: 'code' as const,
    },
    {
      material: material({
        materialId: 'm-unknown',
        title: 'B 未知目录',
        categoryId: 'gone',
      }),
      type: 'json' as const,
    },
  ];

  it('按目录聚合条目并累计子树数量', () => {
    const model = buildMixTree(categories, entries);
    expect(model.folderCount).toBe(4);
    expect(model.roots.map((node) => node.category.categoryId)).toEqual([
      'dir-a',
      'dir-b',
    ]);
    const dirA = model.roots[0];
    expect(dirA.count).toBe(2);
    expect(dirA.children[0].entries.map((entry) => entry.material.title)).toEqual([
      'A 图片',
      'B 文档',
    ]);
    expect(model.roots[1].count).toBe(1);
  });

  it('目录缺失或无分类的条目进入未分类桶', () => {
    const model = buildMixTree(categories, entries);
    expect(model.unclassified.map((entry) => entry.material.materialId)).toEqual([
      'm-root',
      'm-unknown',
    ]);
  });

  it('提供路径、查找与树展开', () => {
    const model = buildMixTree(categories, entries);
    expect(mixFolderPath(model, 'dir-a1')).toEqual(['院级制度', '医疗质量']);
    expect(mixFolderPath(model, 'missing')).toEqual([]);
    expect(findMixTreeNode(model.roots, 'dir-b')?.category.name).toBe('培训');
    expect(flattenMixTree(model.roots[0]).map((row) => row.node.category.name)).toEqual([
      '院级制度',
      '医疗质量',
      '护理',
    ]);
    expect(collectMixEntries(model.roots[0])).toHaveLength(2);
  });
});
