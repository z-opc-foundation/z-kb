/**
 * 图谱工作台标签页栏：浏览器式多标签（对象层图谱 / 实例数据详情 / 实例图谱）。
 * 自 galaxy-meta sc-graph-tab-bar 平移，样式见 ontology-graph.less 的 .og-tab-*。
 */
import type { ReactNode } from 'react';
import type { GraphTabItem } from '../types';

interface GraphTabBarProps {
  tabs: GraphTabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
  /** 右侧统计区（节点/边数量、统计刷新等） */
  extra?: ReactNode;
}

export function GraphTabBar(props: GraphTabBarProps) {
  const { tabs, activeKey, onSelect, onClose, extra } = props;
  return (
    <div className="og-tab-bar">
      <div className="og-tab-bar-inner">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`og-tab-item${activeKey === tab.key ? ' active' : ''}`}
            onClick={() => onSelect(tab.key)}
            title={tab.label}
          >
            <span className="og-tab-label">{tab.label}</span>
            {tab.closable && (
              <span
                className="og-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.key);
                }}
              >
                ✕
              </span>
            )}
          </div>
        ))}
      </div>
      {extra ? <span className="og-tab-extra">{extra}</span> : null}
    </div>
  );
}
