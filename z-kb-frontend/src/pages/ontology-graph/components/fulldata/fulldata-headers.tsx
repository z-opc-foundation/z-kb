/**
 * AG Grid 自定义列组头：自 galaxy-meta ontology-fulldata.tsx 平移。
 * - GroupHeaderWithFilter：对象列组头，订阅 filterChanged 实时汇总组内过滤条件；
 * - EdgeGroupHeader：关系列组头，关系名后跟「源对象→目标对象」淡色小字，
 *   完整指向（含链路方向）由原生 title 气泡承载。
 */
import type { IHeaderGroupParams } from 'ag-grid-community';
import { useEffect, useState } from 'react';
import { describeColumnFilter } from '../../utils/format';

/** 分组头需要知道组内叶子列的 colId 与属性名，才能自行拼出过滤摘要 */
export interface GroupLeafCol {
  colId: string;
  label: string;
}

export interface GroupHeaderParams extends IHeaderGroupParams {
  leafCols?: GroupLeafCol[];
}

export interface EdgeGroupHeaderParams extends IHeaderGroupParams {
  pointText?: string;
  pointTip?: string;
}

export function GroupHeaderWithFilter(props: GroupHeaderParams) {
  const { displayName, api, leafCols } = props;
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!api) return undefined;
    const syncSummary = () => {
      const model = api.getFilterModel() as Record<string, unknown>;
      const text = (leafCols || [])
        .map((col) => {
          const desc = describeColumnFilter(
            (model[col.colId] ?? null) as Parameters<
              typeof describeColumnFilter
            >[0],
          );
          return desc ? `${col.label} ${desc}` : '';
        })
        .filter(Boolean)
        .join('; ');
      setSummary(text);
    };
    syncSummary();
    api.addEventListener('filterChanged', syncSummary);
    return () => {
      // grid 卸载时 api 可能已销毁，移除监听会抛错，忽略即可
      try {
        api.removeEventListener('filterChanged', syncSummary);
      } catch {
        // noop
      }
    };
  }, [api, leafCols]);

  return (
    <span className="lc-fd-group-head">
      <span className="lc-fd-group-head-name">{displayName}</span>
      {!!summary && (
        <span className="lc-fd-group-head-filter" title={summary}>
          {summary}
        </span>
      )}
    </span>
  );
}

export function EdgeGroupHeader(props: EdgeGroupHeaderParams) {
  const { displayName, pointText, pointTip } = props;
  return (
    <span
      className="lc-fd-group-head lc-fd-edge-group-head"
      title={pointTip || pointText || undefined}
    >
      <span className="lc-fd-group-head-name">{displayName}</span>
      {!!pointText && <span className="lc-fd-edge-point-text">{pointText}</span>}
    </span>
  );
}

/** 每列过滤器支持的最大条件数（AG Grid 默认为 2，此处放开到 5 级） */
export const MAX_FILTER_CONDITIONS = 5;

/**
 * 关系列（对象列组之间的关系标识列）的 colId 前缀（`${prefix}${段序}`）。
 * 该列值为静态方向箭头、不对应任何行数据字段，故导出时按此前缀跳过。
 */
export const EDGE_COL_ID_PREFIX = '__edge_';

/** 关系列宽度区间（px）：下限给足关系名与指向小字并排空间，上限避免长对象名撑成主角 */
export const EDGE_COL_MIN_WIDTH = 120;
export const EDGE_COL_MAX_WIDTH = 240;
/** 关系列头文字两侧的留白（px）：列头左右内边距 + 一点呼吸位 */
export const EDGE_COL_TEXT_PADDING = 20;
/** 关系列头「源→目标」的字号（px），与 fulldata.less 中列头文字保持一致 */
export const EDGE_COL_HEADER_FONT_SIZE = 10;

/** AG Grid 内建 UI 的中文化文案（仅覆盖本视图会用到的过滤 / 菜单项） */
export const AG_LOCALE_TEXT: Record<string, string> = {
  filterOoo: '过滤…',
  searchOoo: '搜索…',
  applyFilter: '应用',
  resetFilter: '清除',
  clearFilter: '清空',
  cancelFilter: '取消',
  contains: '包含',
  notContains: '不包含',
  equals: '等于',
  notEqual: '不等于',
  startsWith: '开头是',
  endsWith: '结尾是',
  blank: '为空',
  notBlank: '不为空',
  andCondition: '且',
  orCondition: '或',
  noRowsToShow: '暂无数据',
  lessThan: '小于',
  lessThanOrEqual: '小于等于',
  greaterThan: '大于',
  greaterThanOrEqual: '大于等于',
  inRange: '介于',
  pinColumn: '固定列',
  autosizeThiscolumn: '自适应此列宽',
  autosizeAllColumns: '自适应全部列宽',
  resetColumns: '重置列',
};
