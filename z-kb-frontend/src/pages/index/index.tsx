import { Link } from 'react-router-dom';
import Icon, { type IconName } from '@/components/icon';

interface IndexEntry {
  label: string;
  desc: string;
  icon: IconName;
  path: string;
}

const entries: IndexEntry[] = [
  {
    label: '知识库',
    desc: '查看本租户的知识库，管理资料、Wiki、图谱与检索。',
    icon: 'database',
    path: '/knowledge-bases',
  },
  {
    label: '评测',
    desc: '维护 QA 集合、运行跑批并查看结果与坏例台账。',
    icon: 'shield-check',
    path: '/evaluations',
  },
  {
    label: '智能管理',
    desc: '管理 Agent、Skill 与 Tool 等 AI 资源。',
    icon: 'brain',
    path: '/ai/agents',
  },
];

export default function IndexPage() {
  return (
    <div className="view">
      <div className="grid grid-3">
        {entries.map((entry) => (
          <Link key={entry.path} className="panel" to={entry.path}>
            <div className="panel-head">
              <h3>
                <Icon name={entry.icon} size={15} />
                {entry.label}
              </h3>
              <Icon name="arrow-right" size={14} />
            </div>
            <div className="panel-body muted">{entry.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
