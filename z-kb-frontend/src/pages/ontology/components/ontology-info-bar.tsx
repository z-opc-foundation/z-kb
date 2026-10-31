import Icon from '@/components/icon';
import type { OntologyDetail } from '@/services/ontology';
import { formatCount } from './shared';

interface OntologyInfoBarProps {
  detail: OntologyDetail;
  instanceTotal?: string;
  onOpenSettings: () => void;
}

/** 本体信息栏：身份一行 + 四个 mini 统计，「设置」唯一操作入口。 */
export function OntologyInfoBar({
  detail,
  instanceTotal,
  onOpenSettings,
}: OntologyInfoBarProps) {
  const stats = [
    { label: '对象类型', value: formatCount(detail.tagCount), unit: '个' },
    { label: '关系类型', value: formatCount(detail.edgeCount), unit: '个' },
    { label: '实例合计', value: formatCount(instanceTotal), unit: '个' },
    { label: '结构版本', value: `v${detail.schemaVersion ?? 0}`, unit: '' },
  ];

  return (
    <section className="panel ont-info-bar">
      <div className="ont-info-identity">
        <div className="ont-info-icon">
          <Icon name="git-branch" size={18} />
        </div>
        <div className="ont-info-copy">
          <div className="ont-info-title">
            <b>{detail.name}</b>
            <span className={`tag sm ${detail.graphBound ? 'green' : 'amber'}`}>
              {detail.graphBound ? '图库已接入' : '图库未接入'}
            </span>
          </div>
          <div className="ont-info-meta">
            <span className="tag gray sm" title={detail.code}>
              编码 {detail.code}
            </span>
            <span className="tag gray sm" title={detail.graphSpace || ''}>
              图空间 {detail.graphSpace || '待分配'}
            </span>
            {detail.description ? (
              <span className="ont-info-desc" title={detail.description}>
                {detail.description}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="ont-info-stats">
        {stats.map((item) => (
          <div className="ont-info-stat" key={item.label}>
            <span className="label">{item.label}</span>
            <span className="value">
              {item.value}
              {item.unit ? <small>{item.unit}</small> : null}
            </span>
          </div>
        ))}
      </div>
      <div className="ont-info-actions">
        <button className="btn ghost xs" type="button" onClick={onOpenSettings}>
          <Icon name="settings" size={13} />
          设置
        </button>
      </div>
    </section>
  );
}
