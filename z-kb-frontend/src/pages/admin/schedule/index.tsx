import Icon from '@/components/icon';
import { AiLoading } from '@/pages/ai/shared';
import ScheduleConfigModal from '@/pages/admin/schedule/components/config-modal';
import { useScheduleOverview } from '@/pages/admin/schedule/hooks/use-schedule-overview';
import '@/pages/ai/ai.less';
import '@/pages/admin/schedule/schedule.less';
import { useState } from 'react';

const STS_LABEL: Record<string, string> = {
  resume: '运行中',
  pause: '已暂停',
};

const QUEUE_STATUSES: { key: string; label: string; tone: string }[] = [
  { key: 'PENDING', label: '未轮到', tone: 'gray' },
  { key: 'QUEUED', label: '排队', tone: 'amber' },
  { key: 'RUNNING', label: '执行中', tone: 'blue' },
  { key: 'SUCCEEDED', label: '成功', tone: 'green' },
  { key: 'FAILED', label: '失败', tone: 'red' },
  { key: 'CANCELED', label: '取消', tone: 'gray' },
  { key: 'SKIPPED', label: '跳过', tone: 'gray' },
];

/** uuid 形如 taskInstanceSchedule$10.100.108.14$CEA5…$0000000020，表格里只留 IP 与分片序号。 */
function shortServer(uuid?: string | null) {
  if (!uuid) {
    return '—';
  }
  const parts = uuid.split('$');
  if (parts.length < 4) {
    return uuid;
  }
  return `${parts[1]} · ${parts[3]}`;
}

function stsTag(sts?: string | null) {
  if (!sts) {
    return <span className="tag sm gray">未知</span>;
  }
  const tone = sts === 'resume' ? 'green' : sts === 'pause' ? 'amber' : 'gray';
  return <span className={`tag sm ${tone}`}>{STS_LABEL[sts] || sts}</span>;
}

/** 排队等待时长按人读的单位给，面板只做粗粒度提示。 */
function formatWait(seconds?: number | null) {
  const total = Math.max(0, Math.floor(seconds || 0));
  if (total < 60) {
    return `${total} 秒`;
  }
  if (total < 3600) {
    return `${Math.floor(total / 60)} 分钟`;
  }
  return `${Math.floor(total / 3600)} 小时 ${Math.floor((total % 3600) / 60)} 分钟`;
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <section className="panel schedule-metric">
      <div className="schedule-metric-head">
        <span className="ic-wrap">
          <Icon name={icon} size={13} />
        </span>
        {label}
      </div>
      <div className="schedule-metric-value">{value}</div>
      {sub ? <div className="schedule-metric-sub">{sub}</div> : null}
    </section>
  );
}

export default function ScheduleAdminPage() {
  const {
    overview,
    loading,
    acting,
    savingConfig,
    reloading,
    paused,
    load,
    toggle,
    saveConfig,
    reload,
  } = useScheduleOverview();
  const [configOpen, setConfigOpen] = useState(false);

  const aliveServers = overview?.servers.filter((server) => server.alive).length ?? 0;
  const queued = overview?.queue?.QUEUED ?? 0;
  const running = overview?.queue?.RUNNING ?? 0;
  /** 运行中节点的线程数还是旧值，说明改了配置但进程没重建，提示用。 */
  const liveThreadNums = Array.from(
    new Set(overview?.servers.filter((server) => server.alive).map((server) => server.threadNum)),
  );
  const threadPending =
    !!overview?.taskType &&
    liveThreadNums.length > 0 &&
    liveThreadNums.some((num) => num !== overview.taskType?.threadNumber);

  return (
    <div className="view schedule-admin">
      <div className="view-bar">
        {overview ? (
          overview.available ? (
            <span className="tag green">
              <i className="dot" />
              调度中心已连接
            </span>
          ) : (
            <span className="tag red">
              <i className="dot" />
              调度中心不可用
            </span>
          )
        ) : null}
        {overview?.cluster ? (
          <span className="note mono">
            {overview.cluster.zkAddress} · {overview.cluster.rootPath}
          </span>
        ) : null}
        <span className="spacer" />
        {overview?.cluster?.consoleUrl ? (
          <a
            className="btn ghost"
            href={overview.cluster.consoleUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="external-link" size={14} />
            控制台
          </a>
        ) : null}
        <button className="btn ghost" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon name="refresh" size={14} />}
          刷新
        </button>
        <button
          className={`btn ${paused ? 'primary' : 'danger'}`}
          type="button"
          onClick={() => void toggle()}
          disabled={!overview?.available || acting}
        >
          {acting ? <span className="spinner" /> : null}
          {paused ? '恢复调度' : '暂停调度'}
        </button>
      </div>

      {loading && !overview ? (
        <section className="panel">
          <AiLoading text="正在读取调度运行态…" />
        </section>
      ) : overview ? (
        <>
          {overview.message ? (
            <div className={`callout ${overview.available ? '' : 'danger'} schedule-callout`}>
              <Icon name="alert-triangle" size={14} />
              <div className="ct">
                <b>{overview.available ? '部分数据缺失' : '调度中心读不到配置'}</b>
                <p>{overview.message}</p>
              </div>
            </div>
          ) : null}

          {overview.backlogWarning ? (
            <div className="callout danger schedule-callout">
              <Icon name="alert-triangle" size={14} />
              <div className="ct">
                <b>队列积压</b>
                <p>
                  最早一条排队已等待 {formatWait(overview.oldestQueuedSeconds)}，共 {queued}{' '}
                  条排队。检查在线节点是否正常，或调大线程数、每批取数。
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-4 schedule-metrics">
            <Metric
              icon="activity"
              label="任务类型"
              value={overview.taskType?.baseTaskType || '—'}
              sub={overview.taskType ? stsTag(overview.taskType.sts) : '未注册'}
            />
            <Metric
              icon="git-compare"
              label="排期"
              value={overview.strategy?.strategyName || '—'}
              sub={
                overview.strategy ? (
                  <span className="schedule-metric-line">
                    {stsTag(overview.strategy.sts)}
                    <span className="mono-sm">{overview.strategy.kind}</span>
                    <span className="mono-sm">
                      {overview.strategy.ipList.length} 个 IP · 分配 {overview.strategy.assignNum}
                    </span>
                  </span>
                ) : (
                  '未注册'
                )
              }
            />
            <Metric
              icon="network"
              label="在线节点"
              value={`${aliveServers} / ${overview.servers.length}`}
              sub={<span className="mono-sm">心跳正常 / 已注册</span>}
            />
            <Metric
              icon="layers"
              label="队列"
              value={`${queued} 排队 · ${running} 执行`}
              sub={
                <span className="mono-sm">
                  {overview.oldestQueuedAt ? `最早排队 ${overview.oldestQueuedAt}` : '暂无排队'}
                </span>
              }
            />
          </div>

          <section className="panel schedule-queue">
            <div className="panel-head">
              <h3>
                <Icon name="layers" size={14} />
                队列健康
              </h3>
              <div className="actions">
                <span className="note">服务端时间 {overview.serverTime || '—'}</span>
              </div>
            </div>
            <div className="panel-body tight schedule-queue-body">
              {QUEUE_STATUSES.map((item) => (
                <div className={`schedule-queue-cell ${item.tone}`} key={item.key}>
                  <small>{item.label}</small>
                  <b>{overview.queue?.[item.key] ?? 0}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <Icon name="network" size={14} />
                在线节点
              </h3>
              <div className="actions">
                <span className="note">
                  {paused
                    ? '调度已暂停，节点随心跳超时下线'
                    : overview.servers.length === 0
                      ? '没有节点注册'
                      : `${aliveServers} 个心跳正常`}
                </span>
              </div>
            </div>
            {overview.servers.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">
                  <Icon name="network" size={20} />
                </span>
                <b>暂无在线节点</b>
                <p>
                  {paused
                    ? '调度已暂停，节点随任务类型一起下线；恢复调度后重新注册'
                    : '控制台排期未拉到应用，或应用与当前 ZK 不是同一套'}
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="list-table schedule-server-table">
                  <thead>
                    <tr>
                      <th>节点</th>
                      <th>IP</th>
                      <th>线程</th>
                      <th>心跳</th>
                      <th>最近取数</th>
                      <th>累计取数</th>
                      <th>处理成功/失败</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.servers.map((server) => (
                      <tr key={server.uuid}>
                        <td>
                          <div className="name-cell">
                            <div className="nc">
                              <b>{server.hostName || server.ip}</b>
                              <small className="mono-sm" title={server.uuid}>
                                {shortServer(server.uuid)}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="mono-sm">{server.ip}</td>
                        <td className="mono-sm">{server.threadNum}</td>
                        <td className="mono-sm">{server.heartBeatTime || '—'}</td>
                        <td className="mono-sm">{server.lastFetchDataTime || '—'}</td>
                        <td className="mono-sm">
                          {server.fetchDataCount} 次 / {server.fetchDataNum} 条
                        </td>
                        <td className="mono-sm">
                          {server.dealDataSuccess} / {server.dealDataFail}
                        </td>
                        <td>
                          <span className={`tag sm ${server.alive ? 'green' : 'red'}`}>
                            <i className="dot" />
                            {server.alive ? '正常' : '失联'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid schedule-row-split">
            <section className="panel">
              <div className="panel-head">
                <h3>
                  <Icon name="git-branch" size={14} />
                  数据分片
                </h3>
                <div className="actions">
                  <span className="note">id mod {overview.taskItems.length || 0}</span>
                </div>
              </div>
              {overview.taskItems.length === 0 ? (
                <div className="empty">
                  <span className="empty-icon">
                    <Icon name="git-branch" size={20} />
                  </span>
                  <b>没有分片</b>
                  <p>任务类型下未创建 taskItem，调度器不会取数</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="list-table schedule-split-table">
                    <thead>
                      <tr>
                        <th>分片</th>
                        <th>状态</th>
                        <th>当前节点</th>
                        <th>申请节点</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.taskItems.map((item) => (
                        <tr key={item.taskItem}>
                          <td className="mono-sm">{item.taskItem}</td>
                          <td>
                            <span
                              className={`tag sm ${item.sts === 'ACTIVTE' ? 'green' : 'gray'}`}
                            >
                              {item.sts}
                            </span>
                          </td>
                          <td className="mono-sm" title={item.currentScheduleServer || undefined}>
                            {shortServer(item.currentScheduleServer)}
                          </td>
                          <td className="mono-sm" title={item.requestScheduleServer || undefined}>
                            {shortServer(item.requestScheduleServer)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>
                  <Icon name="settings" size={14} />
                  运行参数
                </h3>
                <div className="actions">
                  {threadPending ? (
                    <span className="tag sm amber" title="运行中节点仍是旧线程数，暂停→恢复或重启后生效">
                      线程数待重建
                    </span>
                  ) : null}
                  <span className="note">
                    {overview.taskType ? `v${overview.taskType.version}` : '—'}
                  </span>
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => void reload()}
                    disabled={!overview.available || reloading}
                  >
                    {reloading ? <span className="spinner" /> : <Icon name="refresh" size={13} />}
                    重载任务项
                  </button>
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => setConfigOpen(true)}
                    disabled={!overview.available || !overview.taskType}
                  >
                    <Icon name="edit" size={13} />
                    调整参数
                  </button>
                </div>
              </div>
              <div className="panel-body tight schedule-params">
                {overview.taskType ? (
                  <>
                    <div>
                      <small>处理 Bean</small>
                      <b className="mono-sm">{overview.taskType.dealBeanName || '—'}</b>
                    </div>
                    <div>
                      <small>线程数</small>
                      <b>{overview.taskType.threadNumber}</b>
                    </div>
                    <div>
                      <small>每批取数</small>
                      <b>{overview.taskType.fetchDataNumber}</b>
                    </div>
                    <div>
                      <small>空转休眠</small>
                      <b>{overview.taskType.sleepTimeNoData} ms</b>
                    </div>
                    <div>
                      <small>心跳</small>
                      <b>{overview.taskType.heartBeatRate} ms</b>
                    </div>
                    <div>
                      <small>判死</small>
                      <b>{overview.taskType.judgeDeadInterval} ms</b>
                    </div>
                    <div>
                      <small>处理器</small>
                      <b>{overview.taskType.processorType}</b>
                    </div>
                    <div>
                      <small>任务类别</small>
                      <b>{overview.taskType.taskKind}</b>
                    </div>
                    <div>
                      <small>执行窗口</small>
                      <b className="mono-sm">
                        {overview.taskType.permitRunStartTime && overview.taskType.permitRunEndTime
                          ? `${overview.taskType.permitRunStartTime} ~ ${overview.taskType.permitRunEndTime}`
                          : '不限'}
                      </b>
                    </div>
                    <div>
                      <small>单线程组分片上限</small>
                      <b>{overview.taskType.maxTaskItemsOfOneThreadGroup || '不限'}</b>
                    </div>
                  </>
                ) : (
                  <p className="note">没有任务类型配置</p>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {configOpen && overview?.taskType ? (
        <ScheduleConfigModal
          taskType={overview.taskType}
          saving={savingConfig}
          onClose={() => setConfigOpen(false)}
          onSubmit={(threadNumber, fetchDataNumber) => {
            void saveConfig(threadNumber, fetchDataNumber).then((ok) => {
              if (ok) {
                setConfigOpen(false);
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}
