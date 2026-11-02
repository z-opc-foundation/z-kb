/**
 * 属性勾选面板（对象 / 关系共用结构）：自 galaxy-meta ontology-fulldata.tsx 平移。
 * 列出全部属性定义：勾选决定属性进表格与查询；已勾选属性附带关键词过滤输入框，
 * 关键词以 nGQL CONTAINS 条件下推图库收窄结果集。面板底部是「在列表中隐藏」
 * 勾选行——仅控列显隐，不影响查询。
 */
import Icon from '@/components/icon';
import type { NormalizedProperty } from '../../types';
import { getPropCnName } from '../../utils/format';

export interface PropPanelPropDef {
  /** 属性英文 code（对象侧 name / 关系侧 propertyName，由调用方归一） */
  name: string;
  /** 中文名（无则为空串） */
  cnName: string;
}

export interface FulldataPropPanelProps {
  /** 面板标题：对象名或关系名 */
  title: string;
  /** 属性定义（已归一为 name/cnName） */
  props: PropPanelPropDef[];
  /** 已勾选的属性名列表 */
  selected: string[];
  /** 属性 → 过滤关键词（即时值，输入无延迟回显） */
  filters: Record<string, string>;
  /** 是否勾选了「在列表中隐藏」 */
  hidden: boolean;
  /** 空态文案（对象与关系侧措辞不同） */
  emptyText: string;
  onToggleProp: (prop: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onFilterChange: (prop: string, keyword: string) => void;
  onHiddenChange: (hidden: boolean) => void;
  onClose: () => void;
}

function PropRow(props: FulldataPropPanelProps & { name: string; cnName: string }) {
  const checked = props.selected.includes(props.name);
  return (
    <div className="lc-fd-prop-row">
      <label className="lc-fd-prop-item">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => props.onToggleProp(props.name, e.target.checked)}
        />
        <span className="lc-fd-prop-code">{props.name}</span>
        {!!props.cnName && (
          <span className="lc-fd-prop-name" title={props.cnName}>
            {props.cnName}
          </span>
        )}
      </label>
      {checked && (
        <input
          type="text"
          className="lc-fd-prop-filter"
          placeholder="关键词过滤"
          value={props.filters[props.name] || ''}
          onChange={(e) => props.onFilterChange(props.name, e.target.value)}
        />
      )}
    </div>
  );
}

export function FulldataPropPanel(props: FulldataPropPanelProps) {
  return (
    <div className="lc-fd-prop-panel">
      <div className="lc-fd-prop-head">
        <span className="lc-fd-prop-title">{props.title}</span>
        <span className="lc-fd-prop-actions">
          <button type="button" className="lc-fd-prop-action-btn" onClick={props.onSelectAll}>
            全选
          </button>
          <button type="button" className="lc-fd-prop-action-btn" onClick={props.onClearAll}>
            清空
          </button>
          <button
            type="button"
            className="lc-fd-prop-action-btn lc-fd-prop-close-btn"
            aria-label="关闭"
            onClick={props.onClose}
          >
            <Icon name="x" size={12} />
          </button>
        </span>
      </div>
      {props.props.length === 0 ? (
        <div className="lc-fd-cell-empty">{props.emptyText}</div>
      ) : (
        props.props.map((p) => <PropRow key={p.name} {...props} name={p.name} cnName={p.cnName} />)
      )}
      <div className="lc-fd-prop-hide-divider" />
      <label className="lc-fd-prop-hide-row">
        <input
          type="checkbox"
          checked={props.hidden}
          onChange={(e) => props.onHiddenChange(e.target.checked)}
        />
        <span className="lc-fd-prop-hide-label">在列表中隐藏</span>
        <span className="lc-fd-prop-hide-tip">仅隐藏列显示，不影响数据查询</span>
      </label>
    </div>
  );
}

/** 对象属性面板：properties 已在 OntologyObjectInfo 归一为 name/description */
export function toObjectPropDefs(properties: NormalizedProperty[]): PropPanelPropDef[] {
  return (properties || [])
    .map((p) => ({ name: String(p?.name ?? ''), cnName: getPropCnName(p) }))
    .filter((p) => !!p.name);
}
