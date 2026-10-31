/**
 * utils/query.ts 聚焦测试：nGQL 构建合同（列名口径 / 自关联方向 / 重复对象下标 / 转义与校验）。
 * 这些口径与后端 nGQL 执行直接相关，回归时优先看这里。
 */
import { describe, expect, it } from 'vitest';
import type { ChainEdge } from '../types';
import {
  buildFilterConds,
  buildInstanceNGQL,
  buildLimitClause,
  buildRelationNGQL,
  describeQueryFailure,
  escapeNGQLString,
  serializeFilters,
  validateNGQL,
} from './query';

describe('escapeNGQLString', () => {
  it('转义反斜杠与双引号', () => {
    expect(escapeNGQLString('a"b\\c')).toBe('a\\"b\\\\c');
  });

  it('普通文本保持原样', () => {
    expect(escapeNGQLString('普通 text 123')).toBe('普通 text 123');
  });
});

describe('buildFilterConds', () => {
  it('顶点属性带 Tag 前缀消歧', () => {
    expect(
      buildFilterConds('v0', 'Drug', { name: '阿司' }),
    ).toEqual(['v0.`Drug`.`name` CONTAINS "阿司"']);
  });

  it('边属性不带 EdgeType 前缀（Nebula 边属性寻址直接 r.`prop`）', () => {
    expect(
      buildFilterConds('r0', 'TREATS', { dose: '5mg' }, true),
    ).toEqual(['r0.`dose` CONTAINS "5mg"']);
  });

  it('过滤值做字符串转义且按属性名排序', () => {
    expect(
      buildFilterConds('n', 'Drug', { b: 'x"y', a: '1' }),
    ).toEqual(['n.`Drug`.`a` CONTAINS "1"', 'n.`Drug`.`b` CONTAINS "x\\"y"']);
  });
});

describe('serializeFilters', () => {
  it('键排序后拼接，与插入顺序无关（缓存键稳定性）', () => {
    expect(serializeFilters({ b: '2', a: '1' })).toBe('a=1,b=2');
    expect(serializeFilters({ a: '1', b: '2' })).toBe('a=1,b=2');
  });
});

describe('buildLimitClause', () => {
  it('正整数生成 LIMIT 子句，空值不限', () => {
    expect(buildLimitClause(100)).toBe(' LIMIT 100');
    expect(buildLimitClause(null)).toBe('');
  });
});

describe('buildInstanceNGQL', () => {
  it('勾选属性沉为 alias 列，顶点 ID 列名固定 vertexId', () => {
    const nGql = buildInstanceNGQL('gs_demo', 'Drug', ['name', 'code'], {}, 10);
    expect(nGql).toBe(
      'USE gs_demo; MATCH (n:`Drug`) RETURN id(n) AS vertexId, '
        + 'n.`Drug`.`name` AS `name`, n.`Drug`.`code` AS `code` LIMIT 10',
    );
  });

  it('过滤条件进 WHERE，limit 为空则不加 LIMIT', () => {
    const nGql = buildInstanceNGQL('gs_demo', 'Drug', ['name'], { name: '药' }, null);
    expect(nGql).toBe(
      'USE gs_demo; MATCH (n:`Drug`) WHERE n.`Drug`.`name` CONTAINS "药" '
        + 'RETURN id(n) AS vertexId, n.`Drug`.`name` AS `name`',
    );
  });
});

describe('buildRelationNGQL', () => {
  const edges = (list: Array<[string, string, string]>): ChainEdge[] =>
    list.map(([edgeType, source, target]) => ({
      edgeType,
      label: edgeType,
      forward: true,
      source,
      target,
    }));

  it('常规链路：无向匹配，顶点 ID 列带 __vertexId 后缀', () => {
    const nGql = buildRelationNGQL(
      'gs_demo',
      ['Patient', 'Drug'],
      [0, 2],
      edges([['TAKES', 'Patient', 'Drug']]),
      { Patient__0: ['name'], Drug__2: ['code'] },
      {},
      null,
      {},
      {},
    );
    expect(nGql).toContain('MATCH (v0:`Patient`)-[r0:`TAKES`]-(v1:`Drug`)');
    expect(nGql).toContain('id(v0) AS `Patient__vertexId`');
    expect(nGql).toContain('id(v1) AS `Drug__vertexId`');
    expect(nGql).toContain('v0.`Patient`.`name` AS `Patient_name`');
    expect(nGql).toContain('v1.`Drug`.`code` AS `Drug_code`');
    expect(nGql).not.toContain('WHERE');
  });

  it('自关联关系用有向匹配 ->', () => {
    const nGql = buildRelationNGQL(
      'gs_demo',
      ['Drug', 'Drug'],
      [0, 2],
      edges([['HAS_PARENT', 'Drug', 'Drug']]),
      { Drug__0: ['name'], Drug__2: ['name'] },
      {},
      null,
      {},
      {},
    );
    expect(nGql).toContain('MATCH (v0:`Drug`)-[r0:`HAS_PARENT`]->(v1:`Drug`)');
    // 重复出现的对象：首次无下标，第二次起带位置下标
    expect(nGql).toContain('id(v0) AS `Drug__vertexId`');
    expect(nGql).toContain('id(v1) AS `Drug__vertexId_1`');
    expect(nGql).toContain('v1.`Drug`.`name` AS `Drug_name_1`');
  });

  it('关系属性列名带段下标，过滤条件只加在首段出现的关系变量上', () => {
    const chainEdges = edges([
      ['TAKES', 'Patient', 'Drug'],
      ['TAKES', 'Patient', 'Drug'],
    ]);
    const nGql = buildRelationNGQL(
      'gs_demo',
      ['Patient', 'Drug', 'Patient'],
      [0, 2, 4],
      chainEdges,
      {},
      {},
      null,
      { TAKES: ['dose'] },
      { TAKES: { dose: '5' } },
    );
    expect(nGql).toContain('r0.`dose` AS `TAKES_dose_0`');
    expect(nGql).toContain('r1.`dose` AS `TAKES_dose_1`');
    expect(nGql.match(/r\d+\.`dose` CONTAINS "5"/g)).toHaveLength(1);
    expect(nGql).toContain('r0.`dose` CONTAINS "5"');
  });

  it('各位置过滤条件按 stepKey 独立应用', () => {
    const nGql = buildRelationNGQL(
      'gs_demo',
      ['Patient', 'Drug'],
      [0, 2],
      edges([['TAKES', 'Patient', 'Drug']]),
      {},
      { Patient__0: { name: '张' }, Drug__2: { code: 'D1' } },
      50,
      {},
      {},
    );
    expect(nGql).toContain('v0.`Patient`.`name` CONTAINS "张"');
    expect(nGql).toContain('v1.`Drug`.`code` CONTAINS "D1"');
    expect(nGql.endsWith(' LIMIT 50')).toBe(true);
  });
});

describe('describeQueryFailure', () => {
  it('超时/超限类失败统一口播', () => {
    expect(describeQueryFailure('E_RPC_FAILURE timeout')).toBe(
      '数据量太大，查询崩掉了',
    );
    expect(describeQueryFailure('')).toBe('数据量太大，查询崩掉了');
  });

  it('其余失败保留原因并截断到 120 字', () => {
    expect(describeQueryFailure('语法错误')).toBe('查询失败：语法错误');
    const long = 'x'.repeat(200);
    expect(describeQueryFailure(long)).toBe(`查询失败：${'x'.repeat(120)}`);
  });
});

describe('validateNGQL', () => {
  it('空语句与缺关键字拒绝', () => {
    expect(validateNGQL('   ').error).toBe('查询语句不能为空');
    expect(validateNGQL('foo bar').error).toContain('缺少查询关键字');
  });

  it('括号与引号未闭合报具体位置', () => {
    expect(validateNGQL('MATCH (n) RETURN n)').error).toContain('不匹配');
    expect(validateNGQL('MATCH (n RETURN n').error).toContain('未闭合');
    expect(validateNGQL('MATCH (n) WHERE n.x = "v RETURN n').error).toContain(
      '引号未闭合',
    );
    expect(validateNGQL('MATCH (n:`Tag) RETURN n').error).toBe('反引号未闭合');
  });

  it('引号内的括号不参与配对，MATCH 缺 RETURN 拒绝', () => {
    expect(validateNGQL('MATCH (n) WHERE n.x = "){[" RETURN n').valid).toBe(true);
    expect(validateNGQL('MATCH (n)').error).toContain('缺少 RETURN 子句');
  });

  it('合法语句通过', () => {
    expect(validateNGQL('USE g; MATCH (n) RETURN id(n) LIMIT 10').valid).toBe(true);
    expect(validateNGQL('SHOW TAGS').valid).toBe(true);
  });
});
