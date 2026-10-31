/**
 * 展示格式化与行数据去重工具：自 galaxy-meta ontology-fulldata.tsx 平移。
 */
import type { NormalizedProperty } from '../types';

/** 路径查询中顶点 ID 的列名后缀（`${objectCode}__vertexId`） */
export const VERTEX_ID_SUFFIX = '__vertexId';

/**
 * 取属性中文名：description 即 Nebula 属性 Comment（中文说明），
 * 个别场景写入的是 JSON（{displayName, description}），先尝试解析再回退原文。
 * 无注释或注释与英文 code 相同时返回空串。
 */
export function getPropCnName(
  prop: Partial<NormalizedProperty> & { comment?: string },
): string {
  const raw = String(prop?.description ?? prop?.comment ?? '').trim();
  if (!raw) return '';
  let text = raw;
  try {
    const parsed = JSON.parse(raw) as {
      displayName?: string;
      name?: string;
      description?: string;
    };
    text = String(parsed?.displayName || parsed?.name || parsed?.description || raw).trim();
  } catch {
    // 非 JSON 注释，直接用原文
  }
  return text === String(prop?.name ?? '') ? '' : text;
}

/**
 * 估算一段文本的渲染宽度（px）：CJK 汉字与全角符号按整字宽计，
 * 字母 / 数字 / 半角符号按 0.55 字宽计。供关系列按列头文字长度定宽使用。
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text
    .split('')
    .reduce(
      (sum, ch) =>
        sum +
        (/[\u2190-\u21ff\u2e80-\uffff]/.test(ch) ? fontSize : fontSize * 0.55),
      0,
    );
}

/** 单元格值是否视为「无值」：null / undefined / 空串 / 纯空白串 */
export function isBlankCellValue(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

interface ValueGetterParams {
  value?: unknown;
}

/** 属性列的空值占位：无值统一渲成「-」 */
export function formatCellValue(params: ValueGetterParams): string {
  return isBlankCellValue(params?.value) ? '-' : String(params?.value);
}

/** 模板注入前的 HTML 转义 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 属性列头模板：照搬 AG Grid v32 内建 HeaderComp 的默认结构，
 * 仅在属性名（eText）之后插入一段淡色中文名，
 * 完整保留内建的排序点击 / 过滤图标 / 列头菜单。
 */
export function buildAttrHeaderTemplate(cnName: string): string {
  return `<div class="ag-cell-label-container" role="presentation">
    <span data-ref="eMenu" class="ag-header-icon ag-header-cell-menu-button" aria-hidden="true"></span>
    <span data-ref="eFilterButton" class="ag-header-icon ag-header-cell-filter-button" aria-hidden="true"></span>
    <div data-ref="eLabel" class="ag-header-cell-label" role="presentation">
      <span data-ref="eText" class="ag-header-cell-text"></span>
      <span class="lc-fd-col-cname">${escapeHtml(cnName)}</span>
      <span data-ref="eFilter" class="ag-header-icon ag-header-label-icon ag-filter-icon" aria-hidden="true"></span>
      <ag-sort-indicator data-ref="eSortIndicator"></ag-sort-indicator>
    </div>
  </div>`;
}

/** 实例行按 vertexId 去重（多重关系可能返回重复顶点） */
export function dedupeInstanceRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const list: Array<Record<string, unknown>> = [];
  (rows || []).forEach((row) => {
    const vid = String(row?.vertexId ?? '');
    if (vid && seen.has(vid)) return;
    if (vid) seen.add(vid);
    list.push({ ...row });
  });
  return list;
}

/**
 * 路径行按「各节点 vertexId 组合」去重：
 * 无向匹配下同一条路径仍可能因多重关系被图库返回多次。
 */
export function dedupePathRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const list: Array<Record<string, unknown>> = [];
  (rows || []).forEach((row) => {
    const key = Object.keys(row || {})
      .filter((k) => k.includes(VERTEX_ID_SUFFIX))
      .sort()
      .map((k) => String(row[k] ?? ''))
      .join('|');
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    list.push({ ...row });
  });
  return list;
}

/** 过滤操作符 → 中文文案（与 AG Grid 内建 localeText 口径一致） */
export const FILTER_OP_LABEL: Record<string, string> = {
  contains: '包含',
  notContains: '不包含',
  equals: '等于',
  notEqual: '不等于',
  startsWith: '开头是',
  endsWith: '结尾是',
  blank: '为空',
  notBlank: '不为空',
  lessThan: '小于',
  lessThanOrEqual: '小于等于',
  greaterThan: '大于',
  greaterThanOrEqual: '大于等于',
  inRange: '介于',
};

interface FilterCondition {
  type?: string;
  filter?: string;
  filterTo?: string;
}

interface ColumnFilterModel {
  operator?: string;
  conditions?: FilterCondition[];
}

/** 单个过滤条件 → 中文描述，如「包含 "PS"」 */
export function describeFilterCondition(cond: FilterCondition): string {
  const type = String(cond?.type ?? '');
  const op = FILTER_OP_LABEL[type] ?? type;
  if (!op) return '';
  if (type === 'blank' || type === 'notBlank') return op;
  if (type === 'inRange') {
    return `${op} ${cond?.filter ?? ''} ~ ${cond?.filterTo ?? ''}`;
  }
  return `${op} "${cond?.filter ?? ''}"`;
}

/** 单列过滤模型 → 中文描述（多条件按 且 / 或 串联） */
export function describeColumnFilter(model: ColumnFilterModel | null): string {
  if (!model) return '';
  const conditions = Array.isArray(model.conditions)
    ? model.conditions
    : [model as FilterCondition];
  const joiner = model?.operator === 'OR' ? ' 或 ' : ' 且 ';
  return conditions.map(describeFilterCondition).filter(Boolean).join(joiner);
}

/** 过滤条件 → 中文描述，如「name 包含 "PS"」（无条件时返回空串） */
export function describeFilters(filters: Record<string, string>): string {
  return Object.keys(filters)
    .sort()
    .map((prop) => `${prop} 包含 "${filters[prop]}"`)
    .join('、');
}

/** CSV 单元格转义：含逗号 / 双引号 / 换行时用双引号包裹，内部双引号翻倍 */
export function escapeCsvCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

/**
 * 生成 CSV（UTF-8 BOM，确保 Excel 正确识别中文）并触发浏览器下载。
 * 无数据行时只写表头，不拼末尾换行，避免 Excel 多读出一行空记录。
 */
export function downloadCsv(
  fileName: string,
  headers: string[],
  rows: string[][],
): void {
  const BOM = '\uFEFF';
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  const csv =
    dataLines.length > 0
      ? BOM + headerLine + '\n' + dataLines.join('\n')
      : BOM + headerLine;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
