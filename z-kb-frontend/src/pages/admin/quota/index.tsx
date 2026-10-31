import { useMemo, useState, type ReactNode } from 'react';
import Icon from '@/components/icon';
import { getTenantInfo } from '@/utils/tenant';
import './quota.less';

type QuotaCategory = 'storage' | 'compute' | 'call' | 'member';

interface QuotaItem {
  key: string;
  name: string;
  hint: string;
  category: QuotaCategory;
  icon: string;
  used: number;
  limit: number;
  unit: string;
  decimals?: number;
}

const CATEGORY_LABEL: Record<QuotaCategory, string> = {
  storage: '存储',
  compute: '计算',
  call: '调用',
  member: '成员',
};

const CATEGORY_OPTIONS: { value: 'ALL' | QuotaCategory; label: string }[] = [
  { value: 'ALL', label: '全部配额' },
  { value: 'storage', label: '存储' },
  { value: 'compute', label: '计算' },
  { value: 'call', label: '调用' },
  { value: 'member', label: '成员' },
];

const QUOTA_ITEMS: QuotaItem[] = [
  {
    key: 'material-storage',
    name: '资料原件存储',
    hint: '上传的资料与解析原件',
    category: 'storage',
    icon: 'database',
    used: 48.6,
    limit: 80,
    unit: 'GB',
    decimals: 1,
  },
  {
    key: 'vector-index',
    name: '向量索引',
    hint: '知识库切片与向量库占用',
    category: 'storage',
    icon: 'layers',
    used: 12.4,
    limit: 30,
    unit: 'GB',
    decimals: 1,
  },
  {
    key: 'compile-output',
    name: 'Wiki 与编译产物',
    hint: '编译任务产出的正文与附件',
    category: 'storage',
    icon: 'file-text',
    used: 8.9,
    limit: 24,
    unit: 'GB',
    decimals: 1,
  },
  {
    key: 'compile-task',
    name: '编译任务',
    hint: '本月提交的编译次数',
    category: 'compute',
    icon: 'package',
    used: 1284,
    limit: 3000,
    unit: '次',
  },
  {
    key: 'parse-page',
    name: '解析页数',
    hint: '文档解析累计页数',
    category: 'compute',
    icon: 'scan',
    used: 184600,
    limit: 500000,
    unit: '页',
  },
  {
    key: 'compile-concurrency',
    name: '并发编译',
    hint: '同时执行的任务上限',
    category: 'compute',
    icon: 'zap',
    used: 6,
    limit: 8,
    unit: '路',
  },
  {
    key: 'agent-qa',
    name: 'Agent 问答',
    hint: '本月智能体问答调用次数',
    category: 'call',
    icon: 'message-square',
    used: 42180,
    limit: 100000,
    unit: '次',
  },
  {
    key: 'model-token',
    name: '模型 Token',
    hint: '本月问答与总结消耗的 Token',
    category: 'call',
    icon: 'sparkles',
    used: 38.4,
    limit: 80,
    unit: '百万',
    decimals: 1,
  },
  {
    key: 'retrieval-call',
    name: '检索请求',
    hint: '向量与图谱检索累计请求',
    category: 'call',
    icon: 'search',
    used: 512300,
    limit: 1000000,
    unit: '次',
  },
  {
    key: 'tenant-member',
    name: '租户成员',
    hint: '已授权的机构成员数',
    category: 'member',
    icon: 'users',
    used: 86,
    limit: 200,
    unit: '人',
  },
  {
    key: 'knowledge-base',
    name: '知识库数量',
    hint: '当前租户下的知识库',
    category: 'member',
    icon: 'book',
    used: 12,
    limit: 20,
    unit: '个',
  },
];

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function percentOf(item: QuotaItem): number {
  return item.limit > 0 ? (item.used / item.limit) * 100 : 0;
}

function quotaTone(percent: number): { tone: 'green' | 'amber' | 'red'; label: string } {
  if (percent >= 90) {
    return { tone: 'red', label: '接近上限' };
  }
  if (percent >= 75) {
    return { tone: 'amber', label: '偏高' };
  }
  return { tone: 'green', label: '正常' };
}

function sumBy(category: QuotaCategory) {
  return QUOTA_ITEMS.filter((item) => item.category === category).reduce(
    (total, item) => total + item.used,
    0,
  );
}

function sumLimitBy(category: QuotaCategory) {
  return QUOTA_ITEMS.filter((item) => item.category === category).reduce(
    (total, item) => total + item.limit,
    0,
  );
}

/** 全局管理 · 配额管理：按配额项展示当前租户的用量与上限。 */
export default function QuotaAdminPage() {
  const tenant = getTenantInfo();
  const [category, setCategory] = useState<'ALL' | QuotaCategory>('ALL');

  const rows = useMemo(
    () =>
      QUOTA_ITEMS.filter((item) => category === 'ALL' || item.category === category),
    [category],
  );

  const storageUsed = sumBy('storage');
  const storageLimit = sumLimitBy('storage');
  const qa = QUOTA_ITEMS.find((item) => item.key === 'agent-qa');
  const compile = QUOTA_ITEMS.find((item) => item.key === 'compile-task');
  const member = QUOTA_ITEMS.find((item) => item.key === 'tenant-member');

  let body: ReactNode;
  if (!rows.length) {
    body = (
      <div className="empty">
        <span className="empty-icon">
          <Icon name="bar-chart" size={20} />
        </span>
        <b>该分类下没有配额项</b>
        <p>换一个分类看看。</p>
      </div>
    );
  } else {
    body = (
      <div className="table-wrap">
        <table className="list-table quota-table">
          <thead>
            <tr>
              <th>配额项</th>
              <th style={{ width: 150 }}>当前用量</th>
              <th style={{ width: 150 }}>配额上限</th>
              <th style={{ width: 240 }}>使用率</th>
              <th style={{ width: 110 }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const percent = percentOf(item);
              const { tone, label } = quotaTone(percent);
              return (
                <tr key={item.key}>
                  <td>
                    <div className="name-cell">
                      <span className="quota-mark">
                        <Icon name={item.icon} size={13} />
                      </span>
                      <div className="nc">
                        <b>{item.name}</b>
                        <small>
                          {CATEGORY_LABEL[item.category]} · {item.hint}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td className="mono-sm">
                    {formatNumber(item.used, item.decimals)} {item.unit}
                  </td>
                  <td className="mono-sm">
                    {formatNumber(item.limit, item.decimals)} {item.unit}
                  </td>
                  <td>
                    <div className="quota-usage">
                      <span className={`progress ${tone}`}>
                        <i style={{ width: `${Math.min(100, percent)}%` }} />
                      </span>
                      <span className="mono-sm">{percent.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`tag sm ${tone}`}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="view quota-admin">
      <div className="view-bar">
        <span className="tag blue">
          <i className="dot" />
          {tenant.name}
        </span>
        <span className="note">统计周期 本月</span>
        <span className="spacer" />
        <span className="note">用量超限后新建任务会被拒绝</span>
      </div>

      <div className="grid grid-4 quota-stats">
        <div className="stat">
          <div className="label">
            <Icon name="database" size={13} />
            存储空间
          </div>
          <div className="value">
            {formatNumber(storageUsed, 1)}
            <small>/ {formatNumber(storageLimit)} GB</small>
          </div>
          <div className="foot">
            已用 {((storageUsed / storageLimit) * 100).toFixed(1)}% · 含原件、索引与编译产物
          </div>
          <span className="s-icon">
            <Icon name="database" size={15} />
          </span>
        </div>

        <div className="stat">
          <div className="label">
            <Icon name="message-square" size={13} />
            本月问答
          </div>
          <div className="value">
            {formatNumber(qa?.used ?? 0)}
            <small>次</small>
          </div>
          <div className="foot">配额上限 {formatNumber(qa?.limit ?? 0)} 次</div>
          <span className="s-icon">
            <Icon name="message-square" size={15} />
          </span>
        </div>

        <div className="stat violet">
          <div className="label">
            <Icon name="package" size={13} />
            编译任务
          </div>
          <div className="value">
            {formatNumber(compile?.used ?? 0)}
            <small>次</small>
          </div>
          <div className="foot">配额上限 {formatNumber(compile?.limit ?? 0)} 次</div>
          <span className="s-icon">
            <Icon name="package" size={15} />
          </span>
        </div>

        <div className="stat green">
          <div className="label">
            <Icon name="users" size={13} />
            租户成员
          </div>
          <div className="value">
            {formatNumber(member?.used ?? 0)}
            <small>/ {formatNumber(member?.limit ?? 0)} 人</small>
          </div>
          <div className="foot">
            剩余 {formatNumber((member?.limit ?? 0) - (member?.used ?? 0))} 个成员名额
          </div>
          <span className="s-icon">
            <Icon name="users" size={15} />
          </span>
        </div>
      </div>

      <section className="panel quota-panel">
        <div className="panel-head">
          <div>
            <h3>
              <Icon name="bar-chart" size={14} />
              配额明细
            </h3>
            <div className="hint">共 {rows.length} 项 · 使用率 ≥ 90% 标记为接近上限</div>
          </div>
          <div className="segmented sm">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={category === option.value ? 'active' : ''}
                onClick={() => setCategory(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="quota-body">{body}</div>
        <div className="quota-foot">
          <span className="note">配额按租户生效，调整上限需要平台管理员在租户侧配置。</span>
        </div>
      </section>
    </div>
  );
}
