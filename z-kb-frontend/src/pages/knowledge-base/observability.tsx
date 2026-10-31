import Icon from '@/components/icon';
import { CompilationJobRecord, listCompilationJobs } from '@/services/compilation';
import { MaterialRecord, pageMaterial } from '@/services/material';
import { KbOverview, getKbOverview } from '@/services/overview';
import { TaskRecord, pageTasks } from '@/services/task';
import { formatShortDateTime } from '@/utils/format';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

const TASK_TYPE_LABEL: Record<string, string> = {
  MATERIAL_PARSE: '文档解析',
  COMPILATION: '知识编译',
  WIKI: 'Wiki 编译',
};

const TASK_STATUS_TONE: Record<string, { label: string; color: string }> = {
  SUCCEEDED: { label: '成功', color: '#1f9d6b' },
  RUNNING: { label: '执行中', color: '#f0a03c' },
  QUEUED: { label: '排队中', color: '#7c8aa0' },
  FAILED: { label: '失败', color: '#d94a4a' },
  DEAD: { label: '死信', color: '#a03b3b' },
  CANCELED: { label: '已取消', color: '#b6bfcc' },
};

const DAYS = 14;

function secondsBetween(from?: string, to?: string): number | null {
  if (!from) {
    return null;
  }
  const start = dayjs(from);
  const end = to ? dayjs(to) : dayjs();
  if (!start.isValid() || !end.isValid()) {
    return null;
  }
  const diff = end.diff(start, 'second');
  return diff >= 0 ? diff : null;
}

function fmtDuration(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

interface DailyBucket {
  key: string;
  label: string;
  counts: Record<string, number>;
  total: number;
}

export default function ObservabilityTab({ kbId }: { kbId: string }) {
  const [overview, setOverview] = useState<KbOverview | null>(null);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [jobs, setJobs] = useState<CompilationJobRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [ov, mat, tk, jb] = await Promise.all([
        getKbOverview(kbId),
        pageMaterial({ kbId, current: 1, size: 200 }),
        pageTasks({ kbId, pageNo: 1, pageSize: 200 }),
        listCompilationJobs(kbId, undefined, 50),
      ]);
      if (cancelled) {
        return;
      }
      setOverview(ov || null);
      setMaterials(mat?.records || []);
      setTasks(tk?.records || []);
      setJobs(jb || []);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  const parsedCount = materials.filter((item) => item.parseStatus === 'READY').length;

  const statusGroups = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((item) => {
      map.set(item.status, (map.get(item.status) || 0) + 1);
    });
    return [...map.entries()]
      .map(([status, count]) => ({
        status,
        count,
        ...(TASK_STATUS_TONE[status] || { label: status, color: '#7c8aa0' }),
      }))
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  const daily = useMemo<DailyBucket[]>(() => {
    const buckets: DailyBucket[] = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const date = dayjs().subtract(i, 'day');
      buckets.push({
        key: date.format('YYYY-MM-DD'),
        label: date.format('MM-DD'),
        counts: {},
        total: 0,
      });
    }
    const byKey = new Map(buckets.map((item) => [item.key, item]));
    tasks.forEach((task) => {
      const created = task.createTime ? dayjs(task.createTime) : null;
      if (!created || !created.isValid()) {
        return;
      }
      const bucket = byKey.get(created.format('YYYY-MM-DD'));
      if (!bucket) {
        return;
      }
      const tone = TASK_STATUS_TONE[task.status] ? task.status : 'OTHER';
      bucket.counts[tone] = (bucket.counts[tone] || 0) + 1;
      bucket.total += 1;
    });
    return buckets;
  }, [tasks]);

  const dailyMax = Math.max(1, ...daily.map((item) => item.total));

  const typeDurations = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    tasks.forEach((task) => {
      const seconds = secondsBetween(task.startedAt, task.finishedAt);
      if (seconds === null) {
        return;
      }
      const current = map.get(task.taskType) || { total: 0, count: 0 };
      map.set(task.taskType, { total: current.total + seconds, count: current.count + 1 });
    });
    return [...map.entries()]
      .map(([type, item]) => ({
        type,
        label: TASK_TYPE_LABEL[type] || type,
        avg: Math.round(item.total / item.count),
        count: item.count,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [tasks]);

  const compileDurations = useMemo(() => {
    return jobs
      .map((job) => {
        const seconds = secondsBetween(job.startedAt, job.finishedAt);
        return { job, seconds };
      })
      .filter((item): item is { job: CompilationJobRecord; seconds: number } => item.seconds !== null)
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 8);
  }, [jobs]);

  const compileMax = Math.max(1, ...compileDurations.map((item) => item.seconds));

  const successCount = tasks.filter((item) => item.status === 'SUCCEEDED').length;
  const settledTasks = tasks.filter(
    (item) => item.status === 'SUCCEEDED' || item.status === 'FAILED' || item.status === 'DEAD',
  ).length;
  const successRate = settledTasks > 0 ? Math.round((successCount / settledTasks) * 100) : null;

  const recentFailures = tasks
    .filter((item) => item.status === 'FAILED' || item.status === 'DEAD')
    .slice(0, 5);

  const funnel = [
    {
      label: '已登记资料',
      value: overview ? overview.fileCount : null,
      hint: '库内资料总数',
      color: 'var(--primary)',
    },
    {
      label: '已解析',
      value: materials.length ? parsedCount : overview ? overview.fileCount - overview.notCompiledCount : null,
      hint: '正文已抽取，可参与编译',
      color: '#5a9df5',
    },
    {
      label: '已编译',
      value: overview ? overview.compiledCount : null,
      hint: overview && overview.partialCount ? `另有 ${overview.partialCount} 份部分完成` : '已产出检索块',
      color: '#1f9d6b',
    },
    {
      label: 'Wiki 页',
      value: overview ? overview.wikiCount : null,
      hint: '按页计，与资料数不同口径',
      color: '#8a6ff0',
    },
  ];
  const funnelMax = Math.max(1, ...funnel.map((item) => item.value || 0));

  if (loading) {
    return (
      <section className="panel">
        <div className="empty">
          <div className="empty-icon">
            <Icon name="pie-chart" size={20} />
          </div>
          <b>正在汇总观测数据…</b>
          <p>同时读取库统计、资料、调度任务与编译任务。</p>
        </div>
      </section>
    );
  }

  return (
    <div className="obs-page">
      <div className="obs-metrics">
        <div className="obs-metric">
          <div className="k">资料</div>
          <div className="v tnum">
            {overview ? overview.fileCount : '—'}
            <small>份</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">已解析</div>
          <div className="v tnum">
            {parsedCount}
            <small>份</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">已编译</div>
          <div className="v tnum">
            {overview ? overview.compiledCount : '—'}
            <small>份</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">Wiki 页</div>
          <div className="v tnum">
            {overview ? overview.wikiCount : '—'}
            <small>页</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">调度任务</div>
          <div className="v tnum">
            {tasks.length}
            <small>条</small>
          </div>
        </div>
        <div className="obs-metric">
          <div className="k">任务成功率</div>
          <div className="v tnum">
            {successRate === null ? '—' : successRate}
            <small>{successRate === null ? '' : '%'}</small>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mt-16">
        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="bar-chart" size={14} />
              近 {DAYS} 天任务量
            </h3>
            <div className="obs-legend">
              <span>
                <i style={{ background: '#1f9d6b' }} />
                成功
              </span>
              <span>
                <i style={{ background: '#d94a4a' }} />
                失败
              </span>
              <span>
                <i style={{ background: '#f0a03c' }} />
                执行中
              </span>
              <span>
                <i style={{ background: '#b6bfcc' }} />
                其他
              </span>
            </div>
          </div>
          <div className="panel-body">
            {tasks.length === 0 ? (
              <div className="empty">
                <b>还没有调度任务</b>
                <p>上传资料触发解析、或在工作台发起编译后，这里按天汇总。</p>
              </div>
            ) : (
              <div className="obs-chart" style={{ height: 190 }}>
                {daily.map((day) => (
                  <div className="obs-col" key={day.key} title={`${day.key} · ${day.total} 条`}>
                    <div className="obs-stack">
                      {(['SUCCEEDED', 'FAILED', 'RUNNING', 'OTHER'] as const).map((tone) => {
                        const value = day.counts[tone] || 0;
                        if (!value) {
                          return null;
                        }
                        const color =
                          tone === 'OTHER' ? '#b6bfcc' : TASK_STATUS_TONE[tone].color;
                        return (
                          <div
                            key={tone}
                            className="obs-seg"
                            style={{
                              height: `${(value / dailyMax) * 100}%`,
                              background: color,
                              minHeight: 3,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="obs-x">{day.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="activity" size={14} />
              任务状态分布
            </h3>
            <span className="hint">共 {tasks.length} 条调度任务</span>
          </div>
          <div className="panel-body">
            {statusGroups.length === 0 ? (
              <div className="empty">
                <b>暂无状态可统计</b>
                <p>任务产生后按执行状态聚合。</p>
              </div>
            ) : (
              <div className="obs-bars">
                {statusGroups.map((item) => (
                  <div className="obs-bar-row" key={item.status}>
                    <span className="obs-bar-label">{item.label}</span>
                    <span className="obs-track">
                      <span
                        className="obs-fill"
                        style={{
                          width: `${(item.count / Math.max(1, statusGroups[0].count)) * 100}%`,
                          background: item.color,
                        }}
                      />
                    </span>
                    <span className="obs-val tnum">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="filter" size={14} />
              资料加工漏斗
            </h3>
            <span className="hint">登记 → 解析 → 编译 → Wiki</span>
          </div>
          <div className="panel-body">
            {overview === null ? (
              <div className="empty">
                <b>库统计不可用</b>
                <p>概览接口未返回数据，稍后重试。</p>
              </div>
            ) : (
              <div className="obs-funnel">
                {funnel.map((item) => (
                  <div className="obs-funnel-row" key={item.label}>
                    <span className="obs-bar-label">{item.label}</span>
                    <span className="obs-track" style={{ height: 26 }}>
                      <span
                        className="obs-fill"
                        style={{
                          width: `${((item.value || 0) / funnelMax) * 100}%`,
                          background: item.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 8,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 650,
                          minWidth: 34,
                        }}
                      >
                        {item.value === null ? '—' : item.value}
                      </span>
                    </span>
                    <span className="note">{item.hint}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="clock" size={14} />
              任务类型平均耗时
            </h3>
            <span className="hint">取已结束任务的 startedAt → finishedAt</span>
          </div>
          <div className="panel-body">
            {typeDurations.length === 0 ? (
              <div className="empty">
                <b>暂无已结束任务</b>
                <p>任务结束后才能计算耗时。</p>
              </div>
            ) : (
              <div className="obs-bars">
                {typeDurations.map((item) => (
                  <div className="obs-bar-row" key={item.type}>
                    <span className="obs-bar-label">{item.label}</span>
                    <span className="obs-track">
                      <span
                        className="obs-fill"
                        style={{
                          width: `${(item.avg / Math.max(1, typeDurations[0].avg)) * 100}%`,
                          background: 'var(--primary)',
                        }}
                      />
                    </span>
                    <span className="obs-val tnum">{fmtDuration(item.avg)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="layers" size={14} />
              编译任务耗时 Top {compileDurations.length || 8}
            </h3>
            <span className="hint">按 job 的起止时间排序</span>
          </div>
          <div className="panel-body">
            {compileDurations.length === 0 ? (
              <div className="empty">
                <b>还没有编译任务</b>
                <p>在工作台勾选资料发起知识编译后出现。</p>
              </div>
            ) : (
              <div className="obs-bars wide">
                {compileDurations.map(({ job, seconds }) => (
                  <div className="obs-bar-row" key={job.jobId}>
                    <span
                      className="obs-bar-label"
                      title={`${materialTitleOf(materials, job.materialId)} · ${job.jobId}`}
                    >
                      {materialTitleOf(materials, job.materialId)}
                    </span>
                    <span className="obs-track">
                      <span
                        className="obs-fill"
                        style={{
                          width: `${(seconds / compileMax) * 100}%`,
                          background: job.runStatus === 'FAILED' ? '#d94a4a' : '#5a9df5',
                        }}
                      />
                    </span>
                    <span className="obs-val tnum">{fmtDuration(seconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>
              <Icon name="alert-triangle" size={14} />
              最近失败任务
            </h3>
            <span className="hint">按创建时间倒序，最多 5 条</span>
          </div>
          <div className="panel-body flush">
            {recentFailures.length === 0 ? (
              <div className="empty">
                <b>没有失败任务</b>
                <p>解析与编译均未出现失败记录。</p>
              </div>
            ) : (
              <table className="list-table obs-fail-table">
                <thead>
                  <tr>
                    <th>任务</th>
                    <th>失败原因</th>
                    <th style={{ textAlign: 'right' }}>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFailures.map((task) => (
                    <tr key={task.taskId}>
                      <td>
                        <div className="obs-fail-title">
                          {task.materialTitle || task.bizKey || task.taskId.slice(0, 8)}
                        </div>
                        <div className="note">
                          {TASK_TYPE_LABEL[task.taskType] || task.taskType} · 尝试 {task.attempt}/
                          {task.maxAttempts}
                        </div>
                      </td>
                      <td className="obs-fail-reason">
                        {task.failureSummary || task.resultSummary || '未返回失败信息'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="note">
                        {formatShortDateTime(task.finishedAt || task.createTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function materialTitleOf(materials: MaterialRecord[], materialId: string): string {
  const matched = materials.find((item) => item.materialId === materialId);
  return matched?.title || materialId.slice(0, 8);
}
