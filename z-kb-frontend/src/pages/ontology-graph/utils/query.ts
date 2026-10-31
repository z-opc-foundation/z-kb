/**
 * nGQL 查询语句构造与校验：自 galaxy-meta ontology-fulldata.tsx 平移。
 *
 * 顶点与边的属性寻址语法不同：Nebula 3.x 里顶点属性须带 Tag 前缀消歧
 * （`v.\`Tag\`.\`prop\``），边只有唯一类型直接写 `r.\`prop\``；
 * 给边套上 EdgeType 前缀会在执行期报错，整条查询随之失败。
 */
import type { ChainEdge } from '../types';
import { VERTEX_ID_SUFFIX } from './format';

/** nGQL 字符串字面量转义：反斜杠与双引号须转义 */
export function escapeNGQLString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 把某对象 / 关系的过滤条件拼成 nGQL `CONTAINS` 条件片段数组。
 * varName 为语句里的变量名：顶点独立查询用 n、路径查询用 v0 / v1 / …，关系用 r0 / r1 / …
 */
export function buildFilterConds(
  varName: string,
  code: string,
  filters: Record<string, string>,
  isEdge = false,
): string[] {
  return Object.keys(filters)
    .sort()
    .map((prop) => {
      const accessor = isEdge
        ? `${varName}.\`${prop}\``
        : `${varName}.\`${code}\`.\`${prop}\``;
      return `${accessor} CONTAINS "${escapeNGQLString(filters[prop])}"`;
    });
}

/** 过滤条件的稳定序列化结果，供缓存键使用 */
export function serializeFilters(filters: Record<string, string>): string {
  return Object.keys(filters)
    .sort()
    .map((prop) => `${prop}=${filters[prop]}`)
    .join(',');
}

/** 行数上限 → nGQL `LIMIT` 子句（含前置空格）；limit 为空表示不限 */
export function buildLimitClause(limit: number | null): string {
  return limit ? ` LIMIT ${limit}` : '';
}

/** 构建单对象实例查询的 nGQL 语句（独立查询模式） */
export function buildInstanceNGQL(
  spaceName: string,
  code: string,
  props: string[],
  filters: Record<string, string>,
  limit: number | null,
): string {
  const propSelect = props
    .map((p) => `, n.\`${code}\`.\`${p}\` AS \`${p}\``)
    .join('');
  const conds = buildFilterConds('n', code, filters);
  const whereClause = conds.length > 0 ? `WHERE ${conds.join(' AND ')} ` : '';
  return `USE ${spaceName}; MATCH (n:\`${code}\`) ${whereClause}RETURN id(n) AS vertexId${propSelect}${buildLimitClause(limit)}`;
}

/**
 * 构建沿链路的路径查询 nGQL（关系查询模式）：
 * MATCH 覆盖链路上全部节点与关系，RETURN 各对象的顶点 ID + 已勾选属性。
 * - 自关联关系用有向匹配 `-[]->`，其他关系用无向匹配 `-[]-`；
 * - 重复出现的对象带下标 alias；关系属性列名带链路段下标；
 * - 属性过滤条件按出现位置独立应用（stepKey）。
 */
export function buildRelationNGQL(
  spaceName: string,
  nodeCodes: string[],
  nodeStepIdxs: number[],
  chainEdges: ChainEdge[],
  selectedProps: Record<string, string[]>,
  filters: Record<string, Record<string, string>>,
  limit: number | null,
  selectedEdgeProps: Record<string, string[]>,
  edgeFilters: Record<string, Record<string, string>>,
): string {
  let matchClause = `(v0:\`${nodeCodes[0]}\`)`;
  for (let i = 1; i < nodeCodes.length; i += 1) {
    const ce = chainEdges?.[i - 1];
    const edgeType = String(ce?.edgeType ?? '');
    const dir = ce?.source === ce?.target ? '->' : '-';
    matchClause += `-[r${i - 1}:\`${edgeType}\`]${dir}(v${i}:\`${nodeCodes[i]}\`)`;
  }

  const seen = new Set<string>();
  const returnParts: string[] = [];
  const whereParts: string[] = [];
  nodeCodes.forEach((code, i) => {
    const stepKey = `${code}__${nodeStepIdxs[i]}`;
    if (seen.has(code)) {
      const propSuffix = `_${i}`;
      returnParts.push(`id(v${i}) AS \`${code}${VERTEX_ID_SUFFIX}${propSuffix}\``);
      (selectedProps[stepKey] || []).forEach((prop) => {
        returnParts.push(
          `v${i}.\`${code}\`.\`${prop}\` AS \`${code}_${prop}${propSuffix}\``,
        );
      });
      whereParts.push(...buildFilterConds(`v${i}`, code, filters[stepKey] || {}));
      return;
    }
    seen.add(code);
    returnParts.push(`id(v${i}) AS \`${code}${VERTEX_ID_SUFFIX}\``);
    (selectedProps[stepKey] || []).forEach((prop) => {
      returnParts.push(`v${i}.\`${code}\`.\`${prop}\` AS \`${code}_${prop}\``);
    });
    whereParts.push(...buildFilterConds(`v${i}`, code, filters[stepKey] || {}));
  });

  // 关系属性：各段各自返回（alias 带段下标），过滤条件只加在首段出现的关系变量上
  const seenEdge = new Set<string>();
  chainEdges.forEach((edge, i) => {
    const edgeType = String(edge?.edgeType ?? '');
    if (!edgeType) return;
    (selectedEdgeProps[edgeType] || []).forEach((prop) => {
      returnParts.push(`r${i}.\`${prop}\` AS \`${edgeType}_${prop}_${i}\``);
    });
    if (seenEdge.has(edgeType)) return;
    seenEdge.add(edgeType);
    whereParts.push(
      ...buildFilterConds(`r${i}`, edgeType, edgeFilters[edgeType] || {}, true),
    );
  });

  const whereClause =
    whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')} ` : '';
  return `USE ${spaceName}; MATCH ${matchClause} ${whereClause}RETURN ${returnParts.join(', ')}${buildLimitClause(limit)}`;
}

/** 「数据量太大」类失败特征：超时、内存 / 资源超限、RPC 断连等 */
const OVERLOAD_ERROR_PATTERN =
  /timeout|timed?\s?out|超时|memory|exceed|too\s+(many|large)|E_RPC_FAILURE|abort|network|failed to fetch/i;

/** 查询失败原因 → 面向用户的提示文案（超限类统一口播，其余保留原因便于排查） */
export function describeQueryFailure(reason: string): string {
  const text = String(reason ?? '').trim();
  if (!text || OVERLOAD_ERROR_PATTERN.test(text)) {
    return '数据量太大，查询崩掉了';
  }
  return `查询失败：${text.slice(0, 120)}`;
}

/** 左括号 → 中文名，用于拼校验提示 */
const BRACKET_LABEL: Record<string, string> = {
  '(': '圆括号',
  '[': '方括号',
  '{': '花括号',
};
const BRACKET_PAIR: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
};
/** 可作为查询起始的 nGQL 关键字（缺失即认定不是一条查询语句） */
const NGQL_QUERY_KEYWORD =
  /\b(MATCH|LOOKUP|GO|FETCH|SHOW|DESCRIBE|UNWIND|FIND|SUBGRAPH)\b/i;

/**
 * nGQL 语句的基础语法校验：只做提交前的静态自查
 * （空语句 / 缺关键字 / 括号与引号未闭合），真正的语法错误仍由图库执行时返回。
 */
export function validateNGQL(nGql: string): { valid: boolean; error?: string } {
  const text = String(nGql ?? '').trim();
  if (!text) return { valid: false, error: '查询语句不能为空' };

  const stack: string[] = [];
  let quote = '';
  let bare = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      // 反引号内不支持反斜杠转义，其余字面量里 \" 不算闭合
      if (ch === '\\' && quote !== '`') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (BRACKET_LABEL[ch]) {
      stack.push(ch);
    } else if (BRACKET_PAIR[ch]) {
      if (stack.pop() !== BRACKET_PAIR[ch]) {
        return {
          valid: false,
          error: `${BRACKET_LABEL[BRACKET_PAIR[ch]]}不匹配：多余的「${ch}」`,
        };
      }
    }
    bare += ch;
  }

  if (quote) {
    return {
      valid: false,
      error: quote === '`' ? '反引号未闭合' : `引号未闭合：缺少配对的 ${quote}`,
    };
  }
  if (stack.length > 0) {
    const open = stack[stack.length - 1];
    return {
      valid: false,
      error: `${BRACKET_LABEL[open]}未闭合：缺少与「${open}」配对的右括号`,
    };
  }
  if (!NGQL_QUERY_KEYWORD.test(bare)) {
    return {
      valid: false,
      error: '缺少查询关键字（MATCH / LOOKUP / GO / FETCH 等）',
    };
  }
  if (/\bMATCH\b/i.test(bare) && !/\b(RETURN|WITH|YIELD)\b/i.test(bare)) {
    return { valid: false, error: 'MATCH 语句缺少 RETURN 子句' };
  }
  return { valid: true };
}
