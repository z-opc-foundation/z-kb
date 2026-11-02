import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import {
  cancelCompilation,
  cancelCompilationBatch,
  CompilationBatchRecord,
  CompilationJobRecord,
  getCompilationBatch,
  getCompilationByJob,
  isCompilationActive,
  listCompilationJobs,
  pageCompilationBatches,
  retryCompilation,
  runCompilation,
} from '@/services/compilation';
import { MaterialRecord, pageMaterial } from '@/services/material';
import { pageTasks, TaskRecord, getTaskSummary } from '@/services/task';
import { toast } from '@/utils/toast';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatShortDateTime } from '@/utils/format';
import ObservabilityTab from './observability';

const BATCH_STATUS: Record<string, { label: string; tag: string }> = {
  RUNNING: { label: '运行中', tag: 'amber' },
  COMPLETED: { label: '已完成', tag: 'green' },
  PARTIAL: { label: '部分失败', tag: 'amber' },
  FAILED: { label: '失败', tag: 'red' },
  CANCELED: { label: '已取消', tag: 'gray' },
};

const JOB_STATUS: Record<string, { label: string; tag: string }> = {
  QUEUED: { label: '排队中', tag: 'gray' },
  RUNNING: { label: '运行中', tag: 'amber' },
  PAUSED: { label: '已暂停', tag: 'amber' },
  COMPLETED: { label: '已完成', tag: 'green' },
  FAILED: { label: '失败', tag: 'red' },
  CANCELED: { label: '已取消', tag: 'gray' },
};

const SCOPE_LABEL: Record<string, string> = {
  WORKSPACE: '工作台多选',
  CATEGORY: '分类节点',
  FOLDER: '文件夹节点',
  NONE: '无范围',
};

const TASK_TYPE_LABEL: Record<string, string> = {
  MATERIAL_PARSE: '文档解析',
  COMPILATION: '知识编译',
  WIKI: 'Wiki 编译',
};

const DISPATCH_STATUS: Record<string, { label: string; tag: string }> = {
  QUEUED: { label: '排队中', tag: 'gray' },
  RUNNING: { label: '执行中', tag: 'amber' },
  SUCCEEDED: { label: '成功', tag: 'green' },
  FAILED: { label: '失败', tag: 'red' },
  CANCELED: { label: '已取消', tag: 'gray' },
  DEAD: { label: '已死信', tag: 'red' },
};

// 调度查询接口不接受 DEAD（返回「知识库参数不合法」），死信只在展示层保留。
const DISPATCH_FILTER_STATUS = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'];

const TASK_PAGE_SIZE = 20;
const JOB_PAGE_SIZE = 10;
type TaskTab = 'groups' | 'jobs' | 'dispatch' | 'obs';
type ListTab = Exclude<TaskTab, 'obs'>;
const ACTIVE_DISPATCH_STATUS = ['QUEUED', 'RUNNING'];

function parseConfigSnapshot(raw?: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch (e) {
    return null;
  }
}

const STAGE_LABEL: Record<string, string> = {
  REGISTER: 'P0 登记',
  PARSE: 'P1 解析',
  CHUNK: 'P2 切块',
  INDEX: 'P3 索引',
  EXTRACT: 'P4 萃取',
  WIKI: 'Wiki 编译',
};

const STAGE_STATUS: Record<string, { label: string; tag: string }> = {
  PENDING: { label: '待执行', tag: 'gray' },
  RUNNING: { label: '执行中', tag: 'amber' },
  SUCCEEDED: { label: '成功', tag: 'green' },
  FAILED: { label: '失败', tag: 'red' },
  SKIPPED: { label: '跳过', tag: 'gray' },
};

const RETRY_STAGES: { value: string; effect: string }[] = [
  { value: 'REGISTER', effect: '全量重跑：从 P0 登记开始，重新解析、切块并重建检索块。' },
  { value: 'PARSE', effect: '从 P1 解析起：沿用物料版本，重新解析、切块并重建检索块。' },
  { value: 'CHUNK', effect: '从 P2 切块起：按当前解析稿重新切块并重建检索块。' },
  { value: 'INDEX', effect: '从 P3 索引起：复用现有检索块，只重建索引。' },
  { value: 'EXTRACT', effect: '从 P4 萃取起：保留现有检索块，只重跑萃取阶段。' },
];

const GROUP_PAGE_SIZE = 20;

function fmtDuration(start?: string, end?: string): string {
  if (!start || !end) {
    return '—';
  }
  const diff = dayjs(end).diff(dayjs(start), 'second');
  if (!Number.isFinite(diff) || diff < 0) {
    return '—';
  }
  if (diff < 60) {
    return `${diff}s`;
  }
  return `${Math.floor(diff / 60)}m ${diff % 60}s`;
}

function statusOf(
  map: Record<string, { label: string; tag: string }>,
  status?: string,
): { label: string; tag: string } {
  if (!status) {
    return { label: '—', tag: 'gray' };
  }
  return map[status] || { label: status, tag: 'gray' };
}

interface TaskManagerProps {
  kbId: string;
  canManage: boolean;
  canCompile?: boolean;
  focusBatchId?: string;
  onFocusHandled?: () => void;
  initialTab?: TaskTab;
}

export default function TaskManager({
  kbId,
  canManage,
  canCompile = canManage,
  focusBatchId,
  onFocusHandled,
  initialTab,
}: TaskManagerProps) {
  const [tab, setTab] = useState<TaskTab>(initialTab ?? 'groups');
  // 列表按页签懒加载：进过哪个页签才拉哪个页签的数据，避免一次并发四五个重查询。
  const [visited, setVisited] = useState<Record<ListTab, boolean>>(() => ({
    groups: !initialTab || initialTab === 'groups',
    jobs: initialTab === 'jobs',
    dispatch: initialTab === 'dispatch',
  }));
  const [groups, setGroups] = useState<CompilationBatchRecord[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupPage, setGroupPage] = useState(1);
  const [groupLoading, setGroupLoading] = useState(false);
  const [jobs, setJobs] = useState<CompilationJobRecord[]>([]);
  const [jobTotal, setJobTotal] = useState(0);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskFilterTotal, setTaskFilterTotal] = useState(0);
  const [taskPage, setTaskPage] = useState(1);
  const [taskStatus, setTaskStatus] = useState('');
  const [taskType, setTaskType] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);
  const [summaryReady, setSummaryReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [groupDetail, setGroupDetail] = useState<CompilationBatchRecord | null>(null);
  const [jobDetail, setJobDetail] = useState<CompilationJobRecord | null>(null);
  const [retryTarget, setRetryTarget] = useState<CompilationJobRecord | null>(null);
  const [retryStage, setRetryStage] = useState('REGISTER');
  const [jobStatus, setJobStatus] = useState('');
  const [jobKeyword, setJobKeyword] = useState('');
  const [jobPage, setJobPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [newMaterialId, setNewMaterialId] = useState('');

  const loadSummary = useCallback(async () => {
    const data = await getTaskSummary(kbId);
    if (data) {
      setGroupTotal(Number(data.groupTotal) || 0);
      setJobTotal(Number(data.jobTotal) || 0);
      setTaskTotal(Number(data.taskTotal) || 0);
      setSummaryReady(true);
    }
  }, [kbId]);

  const loadGroups = useCallback(async (silent = false) => {
    if (!silent) {
      setGroupLoading(true);
    }
    try {
      const data = await pageCompilationBatches(kbId, groupPage, GROUP_PAGE_SIZE);
      if (data) {
        setGroups(data.records);
        setGroupTotal(Number(data.total) || 0);
      }
    } finally {
      if (!silent) {
        setGroupLoading(false);
      }
    }
  }, [kbId, groupPage]);

  const loadJobs = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [jobData, materialData] = await Promise.all([
        listCompilationJobs(kbId, undefined, 50),
        pageMaterial({ kbId, current: 1, size: 100 }),
      ]);
      if (jobData) {
        setJobs(jobData);
      }
      if (materialData) {
        setMaterials(materialData.records);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [kbId]);

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) {
      setTaskLoading(true);
    }
    try {
      const data = await pageTasks({
        kbId,
        taskType: taskType || undefined,
        status: taskStatus || undefined,
        pageNo: taskPage,
        pageSize: TASK_PAGE_SIZE,
      });
      if (data) {
        setTasks(data.records);
        setTaskFilterTotal(Number(data.total) || 0);
      }
    } finally {
      if (!silent) {
        setTaskLoading(false);
      }
    }
  }, [kbId, taskPage, taskStatus, taskType]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!visited.groups) {
      return;
    }
    void loadGroups();
  }, [visited.groups, loadGroups]);

  useEffect(() => {
    if (!visited.jobs) {
      return;
    }
    void loadJobs();
  }, [visited.jobs, loadJobs]);

  useEffect(() => {
    if (!visited.dispatch) {
      return;
    }
    void loadTasks();
  }, [visited.dispatch, loadTasks]);

  const dispatchActive = useMemo(
    () => tasks.some((task) => ACTIVE_DISPATCH_STATUS.includes(task.status)),
    [tasks],
  );

  useEffect(() => {
    if (tab !== 'dispatch') {
      return;
    }
    // 有排队/执行中的记录时快轮询，空闲时降频，避免页签常驻时每 3 秒打一次全表查询。
    const timer = window.setInterval(() => {
      void loadTasks(true);
    }, dispatchActive ? 3000 : 10000);
    return () => window.clearInterval(timer);
  }, [tab, dispatchActive, loadTasks]);

  useEffect(() => {
    if (!focusBatchId) {
      return;
    }
    void getCompilationBatch(focusBatchId).then((detail) => {
      if (detail) {
        setGroupDetail(detail);
      }
    });
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBatchId]);

  const hasActiveWork =
    groups.some((item) => item.status === 'RUNNING')
    || jobs.some((item) => isCompilationActive(item.runStatus));

  useEffect(() => {
    if (!hasActiveWork) {
      return;
    }
    const timer = window.setInterval(() => {
      if (visited.groups) {
        void loadGroups(true);
      }
      if (visited.jobs) {
        void loadJobs(true);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveWork, visited.groups, visited.jobs, loadGroups, loadJobs]);

  const openBatchId = groupDetail?.batchId;
  const openBatchRunning = groupDetail?.status === 'RUNNING';

  useEffect(() => {
    if (!openBatchId || !openBatchRunning) {
      return;
    }
    const timer = window.setInterval(() => {
      void getCompilationBatch(openBatchId).then((detail) => {
        if (detail) {
          setGroupDetail(detail);
        }
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [openBatchId, openBatchRunning]);

  const openJobId = jobDetail?.jobId;
  const openJobActive = isCompilationActive(jobDetail?.runStatus);

  useEffect(() => {
    if (!openJobId || !openJobActive) {
      return;
    }
    const timer = window.setInterval(() => {
      void getCompilationByJob(openJobId).then((detail) => {
        if (detail) {
          setJobDetail(detail);
        }
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [openJobId, openJobActive]);

  const titleMap = useMemo(() => {
    const map = new Map<string, string>();
    materials.forEach((item) => map.set(item.materialId, item.title));
    return map;
  }, [materials]);

  const materialTitle = (materialId?: string | null) =>
    materialId
      ? titleMap.get(materialId) || `物料 ${materialId.slice(0, 8)}`
      : '未关联物料';

  const groupPages = Math.max(1, Math.ceil(groupTotal / GROUP_PAGE_SIZE));
  const taskPages = Math.max(1, Math.ceil(taskFilterTotal / TASK_PAGE_SIZE));

  const filteredJobs = useMemo(() => {
    const keyword = jobKeyword.trim().toLowerCase();
    return jobs.filter((item) => {
      if (jobStatus && item.runStatus !== jobStatus) {
        return false;
      }
      if (keyword) {
        const title = materialTitle(item.materialId).toLowerCase();
        if (!title.includes(keyword) && !item.jobId.toLowerCase().includes(keyword)) {
          return false;
        }
      }
      return true;
    });
  }, [jobs, jobKeyword, jobStatus, titleMap]);

  const jobPages = Math.max(1, Math.ceil(filteredJobs.length / JOB_PAGE_SIZE));
  const jobPageSafe = Math.min(jobPage, jobPages);
  const pagedJobs = filteredJobs.slice(
    (jobPageSafe - 1) * JOB_PAGE_SIZE,
    jobPageSafe * JOB_PAGE_SIZE,
  );

  const openGroup = async (batchId: string) => {
    const detail = await getCompilationBatch(batchId);
    if (detail) {
      setGroupDetail(detail);
    }
  };

  const openJob = async (jobId: string) => {
    const detail = await getCompilationByJob(jobId);
    if (detail) {
      setJobDetail(detail);
    }
  };

  const openRetry = (job: CompilationJobRecord) => {
    setRetryStage('REGISTER');
    setRetryTarget(job);
  };

  const openTab = (next: TaskTab) => {
    setTab(next);
    if (next !== 'obs') {
      setVisited((prev) => (prev[next] ? prev : { ...prev, [next]: true }));
    }
  };

  // 触发动作后只刷新打开过的页签，顺带更新角标。
  const refreshOpenedTabs = useCallback(() => {
    void loadSummary();
    if (visited.groups) {
      void loadGroups(true);
    }
    if (visited.jobs) {
      void loadJobs(true);
    }
    if (visited.dispatch) {
      void loadTasks(true);
    }
  }, [visited, loadSummary, loadGroups, loadJobs, loadTasks]);

  const confirmRetry = async () => {
    if (!retryTarget) {
      return;
    }
    setBusy(true);
    const result = await retryCompilation(retryTarget.jobId, retryStage);
    setBusy(false);
    if (result) {
      toast(
        '重试已提交',
        `起始阶段 ${STAGE_LABEL[retryStage] || retryStage} · 状态：${statusOf(JOB_STATUS, result.runStatus).label}`,
      );
      setRetryTarget(null);
      setJobDetail(result);
      refreshOpenedTabs();
    }
  };

  const cancelGroup = async (batchId?: string) => {
    const target = batchId || groupDetail?.batchId;
    if (!target) {
      return;
    }
    setBusy(true);
    const result = await cancelCompilationBatch(target);
    setBusy(false);
    if (!result) {
      return;
    }
    if (groupDetail?.batchId === result.batchId) {
      setGroupDetail(result);
    }
    toast(
      result.status === 'CANCELED' ? '组别已取消' : '组别已结束',
      `${result.successCount}/${result.totalCount} 成功 · ${statusOf(BATCH_STATUS, result.status).label}`,
      result.status === 'CANCELED' ? 'warn' : 'info',
    );
    void loadGroups(true);
  };

  const cancelJob = async () => {
    if (!jobDetail) {
      return;
    }
    setBusy(true);
    const result = await cancelCompilation(jobDetail.jobId);
    setBusy(false);
    if (!result) {
      return;
    }
    setJobDetail(result);
    if (isCompilationActive(result.runStatus)) {
      toast('取消已提交', '任务将在阶段边界停止', 'warn');
    } else if (result.runStatus === 'CANCELED') {
      toast('任务已取消', result.failureSummary || '后续阶段未执行', 'warn');
    } else {
      toast('任务已结束', `当前状态 ${statusOf(JOB_STATUS, result.runStatus).label}`, 'info');
    }
    void loadGroups(true);
    void loadJobs(true);
  };

  const createJob = async () => {
    if (!newMaterialId) {
      toast('请选择资料', '单任务需要先选一份库内资料', 'error');
      return;
    }
    setBusy(true);
    const result = await runCompilation(newMaterialId);
    setBusy(false);
    if (result) {
      toast(
        result.reused ? '已复用编译任务' : '编译已触发',
        `对象：${materialTitle(newMaterialId)} · 状态：${statusOf(JOB_STATUS, result.runStatus).label}`,
      );
      setCreateOpen(false);
      setNewMaterialId('');
      openTab('jobs');
      refreshOpenedTabs();
    }
  };

  // 已有数据时刷新只做静默更新，不把整块内容换成加载态，避免点页签/翻页闪烁。
  const listLoading =
    tab === 'groups'
      ? groupLoading && groups.length === 0
      : tab === 'jobs'
        ? loading && jobs.length === 0
        : tab === 'dispatch'
          ? taskLoading && tasks.length === 0
          : false;

  return (
    <div className="task-page">
      <div className="subtabs mb-16">
        <button
          className={`btn sm ${tab === 'groups' ? 'primary-soft' : 'ghost'}`}
          type="button"
          onClick={() => openTab('groups')}
        >
          <Icon name="layers" size={13} />
          任务组别
          {summaryReady || visited.groups ? <span className="tag gray">{groupTotal}</span> : null}
        </button>
        <button
          className={`btn sm ${tab === 'jobs' ? 'primary-soft' : 'ghost'}`}
          type="button"
          onClick={() => openTab('jobs')}
        >
          <Icon name="activity" size={13} />
          单任务
          {summaryReady || visited.jobs ? (
            <span className="tag gray">{summaryReady ? jobTotal : jobs.length}</span>
          ) : null}
        </button>
        <button
          className={`btn sm ${tab === 'dispatch' ? 'primary-soft' : 'ghost'}`}
          type="button"
          onClick={() => openTab('dispatch')}
        >
          <Icon name="clock" size={13} />
          调度
          {summaryReady || visited.dispatch ? (
            <span className="tag gray">{summaryReady ? taskTotal : taskFilterTotal}</span>
          ) : null}
        </button>
        <button
          className={`btn sm ${tab === 'obs' ? 'primary-soft' : 'ghost'}`}
          type="button"
          onClick={() => setTab('obs')}
        >
          <Icon name="pie-chart" size={13} />
          可观测
        </button>
      </div>

      {tab === 'obs' ? (
        <ObservabilityTab kbId={kbId} />
      ) : listLoading ? (
        <section className="panel">
          <div className="empty">
            <div className="empty-icon">
              <Icon name="activity" size={20} />
            </div>
            <b>正在加载任务…</b>
            <p>组别、单任务与调度记录分别取真实数据。</p>
          </div>
        </section>
      ) : tab === 'groups' ? (
        <section className="panel">
          <div className="table-toolbar">
            <div className="left">
              <span className="note">
                组别只聚合成员结果，不展示阶段与产物；成员任务在单任务中查看。
              </span>
            </div>
            <div className="right">
              <button className="icon-btn" type="button" title="刷新" onClick={refreshOpenedTabs}>
                <Icon name="refresh" size={14} />
              </button>
            </div>
          </div>
          {groups.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Icon name="layers" size={22} />
              </div>
              <b>还没有任务组别</b>
              <p>
                从知识工作台勾选资料后点「知识编译」发起，按每份资料扇出编译单任务并归入同一组别。
              </p>
              <a
                className="btn mt-12"
                href={`#/knowledge-bases/${encodeURIComponent(kbId)}/workspace`}
              >
                去知识工作台
                <Icon name="arrow-right" size={13} />
              </a>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>组别</th>
                      <th>范围</th>
                      <th>进度</th>
                      <th>状态</th>
                      <th>提交人</th>
                      <th>创建时间</th>
                      <th style={{ textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                  {groups.map((group) => {
                    const status = statusOf(BATCH_STATUS, group.status);
                    return (
                      <tr key={group.batchId}>
                        <td>
                          <div className="task-group-name">{group.name}</div>
                          <div className="note mono">
                            {group.batchId} ·{' '}
                            {TASK_TYPE_LABEL[group.taskType] || group.taskType}
                          </div>
                        </td>
                        <td>
                          {SCOPE_LABEL[group.scopeType] || group.scopeType}
                          <div className="note">范围 {group.scopeCount} 份</div>
                        </td>
                        <td>
                          {group.successCount}/{group.totalCount} 成功
                          <div className="note">
                            失败 {group.failedCount} · 范围样本与成员数分开计
                          </div>
                        </td>
                        <td>
                          <span className={`tag ${status.tag}`}>{status.label}</span>
                          {group.failureSummary ? (
                            <div className="note" title={group.failureSummary}>
                              {group.failureSummary.length > 24
                                ? `${group.failureSummary.slice(0, 24)}…`
                                : group.failureSummary}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {group.submitterName || '—'}
                          {!group.submitterName && group.createBy ? (
                            <div className="note mono">#{group.createBy}</div>
                          ) : null}
                        </td>
                        <td>{formatShortDateTime(group.createTime || group.startedAt)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {canCompile && group.status === 'RUNNING' ? (
                            <button
                              className="btn sm"
                              type="button"
                              disabled={busy}
                              style={{ marginRight: 6 }}
                              onClick={() => void cancelGroup(group.batchId)}
                            >
                              取消
                            </button>
                          ) : null}
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => void openGroup(group.batchId)}
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>
                共 {groupTotal} 个组别 · 第 {groupPage}/{groupPages} 页
              </span>
              <div className="btn-group">
                <button
                  className="btn sm"
                  type="button"
                  disabled={groupPage <= 1}
                  onClick={() => setGroupPage((prev) => Math.max(1, prev - 1))}
                >
                  上一页
                </button>
                <button
                  className="btn sm"
                  type="button"
                  disabled={groupPage >= groupPages}
                  onClick={() => setGroupPage((prev) => Math.min(groupPages, prev + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
            </>
          )}
        </section>
      ) : tab === 'jobs' ? (
        <section className="panel">
          <div className="table-toolbar">
            <div className="left">
              <div className="input-icon">
                <span className="ic">
                  <Icon name="search" size={13} />
                </span>
                <input
                  className="input"
                  placeholder="搜索资料标题或任务标识"
                  value={jobKeyword}
                  onChange={(event) => {
                    setJobKeyword(event.target.value);
                    setJobPage(1);
                  }}
                />
              </div>
              <select
                className="select"
                value={jobStatus}
                onChange={(event) => {
                  setJobStatus(event.target.value);
                  setJobPage(1);
                }}
              >
                <option value="">全部状态</option>
                {Object.entries(JOB_STATUS).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <span className="note">性质：文档编译（P0–P4）</span>
            </div>
            <div className="right">
              <button className="icon-btn" type="button" title="刷新" onClick={refreshOpenedTabs}>
                <Icon name="refresh" size={14} />
              </button>
              {canCompile ? (
                <button
                  className="btn primary sm"
                  type="button"
                  onClick={() => setCreateOpen(true)}
                >
                  <Icon name="plus" size={13} />
                  新建编译
                </button>
              ) : null}
            </div>
          </div>
          {filteredJobs.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Icon name="activity" size={22} />
              </div>
              <b>{jobs.length ? '没有匹配的任务' : '还没有编译任务'}</b>
              <p>
                {jobs.length
                  ? '调整状态或关键词再试。'
                  : '从资料详情触发编译，或新建编译单任务；任务会在这里统一呈现。'}
              </p>
              {jobs.length ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setJobKeyword('');
                    setJobStatus('');
                    setJobPage(1);
                  }}
                >
                  清空筛选
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="table-wrap">
              <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>执行对象</th>
                    <th>性质</th>
                    <th>阶段</th>
                    <th>状态</th>
                    <th>里程碑</th>
                    <th>检索块</th>
                    <th>开始时间</th>
                    <th>耗时</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedJobs.map((job) => {
                    const status = statusOf(JOB_STATUS, job.runStatus);
                    return (
                      <tr key={job.jobId}>
                        <td>
                          <div>{materialTitle(job.materialId)}</div>
                          <div className="note mono">{job.jobId}</div>
                        </td>
                        <td>文档编译</td>
                        <td>{job.currentStage ? STAGE_LABEL[job.currentStage] || job.currentStage : '—'}</td>
                        <td>
                          <span className={`tag ${status.tag}`}>{status.label}</span>
                        </td>
                        <td>
                          {job.milestone ? (
                            <span className={`tag ${job.milestone === 'M1' || job.milestone === 'M2' ? 'green' : 'gray'}`}>
                              {job.milestone === 'NONE' ? '未达成' : job.milestone}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{job.chunkCount == null ? '—' : job.chunkCount}</td>
                        <td>{formatShortDateTime(job.startedAt)}</td>
                        <td>{fmtDuration(job.startedAt, job.finishedAt)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => void openJob(job.jobId)}
                          >
                            详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div className="pager">
                <span>
                  共 {filteredJobs.length} 条单任务 · 第 {jobPageSafe}/{jobPages} 页
                </span>
                <div className="btn-group">
                  <button
                    className="btn sm"
                    type="button"
                    disabled={jobPageSafe <= 1}
                    onClick={() => setJobPage((prev) => Math.max(1, prev - 1))}
                  >
                    上一页
                  </button>
                  <button
                    className="btn sm"
                    type="button"
                    disabled={jobPageSafe >= jobPages}
                    onClick={() => setJobPage((prev) => Math.min(jobPages, prev + 1))}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="panel">
          <div className="table-toolbar">
            <div className="left">
              <select
                className="select"
                value={taskType}
                onChange={(event) => {
                  setTaskType(event.target.value);
                  setTaskPage(1);
                }}
              >
                <option value="">全部类型</option>
                {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={taskStatus}
                onChange={(event) => {
                  setTaskStatus(event.target.value);
                  setTaskPage(1);
                }}
              >
                <option value="">全部状态</option>
                {DISPATCH_FILTER_STATUS.map((value) => (
                  <option key={value} value={value}>
                    {DISPATCH_STATUS[value].label}
                  </option>
                ))}
              </select>
              <span className="note">上传资料后自动投递解析任务，编译单任务同样在这里留痕。</span>
            </div>
            <div className="right">
              <button
                className="icon-btn"
                type="button"
                title="刷新"
                onClick={() => void loadTasks()}
              >
                <Icon name="refresh" size={14} />
              </button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Icon name="clock" size={22} />
              </div>
              <b>{taskStatus || taskType ? '没有匹配的调度任务' : '还没有调度任务'}</b>
              <p>
                {taskStatus || taskType
                  ? '调整类型或状态再试。'
                  : '上传一份资料后会自动生成解析任务，状态、尝试次数与摘要在这里持续更新。'}
              </p>
              {taskStatus || taskType ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setTaskStatus('');
                    setTaskType('');
                    setTaskPage(1);
                  }}
                >
                  清空筛选
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>执行对象</th>
                      <th>类型</th>
                      <th>状态</th>
                      <th>尝试</th>
                      <th>入队时间</th>
                      <th>最近心跳</th>
                      <th>耗时</th>
                      <th>摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => {
                      const status = statusOf(DISPATCH_STATUS, task.status);
                      const objectTitle =
                        task.materialTitle
                        || (task.materialId ? materialTitle(task.materialId) : '—');
                      const summary = task.failureSummary || task.resultSummary || '—';
                      return (
                        <tr key={task.taskId}>
                          <td>
                            <div>{objectTitle}</div>
                            <div className="note mono">{task.taskId}</div>
                          </td>
                          <td>{TASK_TYPE_LABEL[task.taskType] || task.taskType}</td>
                          <td>
                            <span className={`tag ${status.tag}`}>{status.label}</span>
                          </td>
                          <td>
                            {task.attempt}/{task.maxAttempts}
                          </td>
                          <td>{formatShortDateTime(task.createTime)}</td>
                          <td>{formatShortDateTime(task.heartbeatAt)}</td>
                          <td>
                            {task.finishedAt
                              ? fmtDuration(task.startedAt, task.finishedAt)
                              : task.startedAt
                                ? '执行中'
                                : '—'}
                          </td>
                          <td>
                            <span className="note" title={summary}>
                              {summary}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pager">
                <span>
                  共 {taskFilterTotal} 条调度记录 · 第 {taskPage}/{taskPages} 页
                </span>
                <div className="btn-group">
                  <button
                    className="btn sm"
                    type="button"
                    disabled={taskPage <= 1}
                    onClick={() => setTaskPage((prev) => Math.max(1, prev - 1))}
                  >
                    上一页
                  </button>
                  <button
                    className="btn sm"
                    type="button"
                    disabled={taskPage >= taskPages}
                    onClick={() => setTaskPage((prev) => Math.min(taskPages, prev + 1))}
                  >
                    下一页
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {groupDetail ? (
        <AppModal
          icon="layers"
          title={groupDetail.name}
          sub={`${SCOPE_LABEL[groupDetail.scopeType] || groupDetail.scopeType} · 创建 ${formatShortDateTime(groupDetail.createTime || groupDetail.startedAt)}`}
          width={860}
          onClose={() => setGroupDetail(null)}
          body={
            <div>
              <div className="panel mb-16">
                <div className="panel-body">
                  <dl className="kv">
                    <dt>组别标识</dt>
                    <dd className="mono">{groupDetail.batchId}</dd>
                    <dt>状态</dt>
                    <dd>
                      <span className={`tag ${statusOf(BATCH_STATUS, groupDetail.status).tag}`}>
                        {statusOf(BATCH_STATUS, groupDetail.status).label}
                      </span>
                    </dd>
                    <dt>进度</dt>
                    <dd>
                      成功 {groupDetail.successCount} · 失败 {groupDetail.failedCount} · 成员{' '}
                      {groupDetail.totalCount}
                    </dd>
                    <dt>范围来源</dt>
                    <dd>
                      {SCOPE_LABEL[groupDetail.scopeType] || groupDetail.scopeType} ·{' '}
                      {groupDetail.scopeCount} 份
                    </dd>
                    <dt>提交人</dt>
                    <dd>{groupDetail.submitterName || '—'}</dd>
                    <dt>开始 / 结束</dt>
                    <dd>
                      {formatShortDateTime(groupDetail.startedAt)} / {formatShortDateTime(groupDetail.finishedAt)}
                    </dd>
                    <dt>失败摘要</dt>
                    <dd>{groupDetail.failureSummary || '—'}</dd>
                  </dl>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3>
                    <Icon name="activity" size={14} />
                    成员任务
                  </h3>
                  <span className="hint">{groupDetail.members?.length || 0} 条</span>
                </div>
                <div className="table-wrap">
                  <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>资料</th>
                        <th>本次结果</th>
                        <th>任务状态</th>
                        <th>里程碑</th>
                        <th>检索块</th>
                        <th>失败摘要</th>
                        <th style={{ textAlign: 'right' }}>任务</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(groupDetail.members || []).map((member) => (
                        <tr key={`${member.materialId}-${member.jobId}`}>
                          <td>{member.materialTitle || materialTitle(member.materialId)}</td>
                          <td>
                            <span className={`tag ${statusOf(JOB_STATUS, member.itemStatus).tag}`}>
                              {statusOf(JOB_STATUS, member.itemStatus).label}
                            </span>
                          </td>
                          <td>{statusOf(JOB_STATUS, member.jobStatus).label}</td>
                          <td>{member.milestone || '—'}</td>
                          <td>{member.chunkCount == null ? '—' : member.chunkCount}</td>
                          <td className="note">{member.itemFailureSummary || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            {member.jobId ? (
                              <button
                                className="btn xs"
                                type="button"
                                onClick={() => void openJob(member.jobId as string)}
                              >
                                查看
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          }
          footRight={
            <>
              {canCompile && groupDetail.status === 'RUNNING' ? (
                <button
                  className="btn danger"
                  type="button"
                  disabled={busy}
                  onClick={() => void cancelGroup()}
                >
                  <Icon name="x" size={13} />
                  {busy ? '取消中…' : '取消组别'}
                </button>
              ) : null}
              <button className="btn" type="button" onClick={() => setGroupDetail(null)}>
                关闭
              </button>
            </>
          }
        />
      ) : null}

      {jobDetail ? (
        <AppModal
          icon="activity"
          title="编译任务详情"
          sub={materialTitle(jobDetail.materialId)}
          width={860}
          onClose={() => setJobDetail(null)}
          body={
            <div>
              <div className="panel mb-16">
                <div className="panel-body">
                  <dl className="kv">
                    <dt>任务标识</dt>
                    <dd className="mono">{jobDetail.jobId}</dd>
                    <dt>状态</dt>
                    <dd>
                      <span className={`tag ${statusOf(JOB_STATUS, jobDetail.runStatus).tag}`}>
                        {statusOf(JOB_STATUS, jobDetail.runStatus).label}
                      </span>{' '}
                      <span className={`tag ${jobDetail.milestone === 'NONE' ? 'gray' : 'green'}`}>
                        {jobDetail.milestone === 'NONE' ? '里程碑未达成' : `${jobDetail.milestone} 已达成`}
                      </span>
                    </dd>
                    <dt>当前阶段</dt>
                    <dd>
                      {jobDetail.currentStage
                        ? STAGE_LABEL[jobDetail.currentStage] || jobDetail.currentStage
                        : '—'}
                    </dd>
                    <dt>配置 / 编译器</dt>
                    <dd>
                      {jobDetail.configVersion} · {jobDetail.compilerVersion}
                    </dd>
                    <dt>调度任务</dt>
                    <dd className="mono-sm">
                      {jobDetail.taskId
                        ? `${jobDetail.taskId} · ${jobDetail.taskStatus || '—'}`
                        : '—'}
                    </dd>
                    <dt>检索块</dt>
                    <dd>{jobDetail.chunkCount == null ? '—' : jobDetail.chunkCount}</dd>
                    <dt>开始 / 结束</dt>
                    <dd>
                      {formatShortDateTime(jobDetail.startedAt)} / {formatShortDateTime(jobDetail.finishedAt)}
                    </dd>
                    <dt>失败摘要</dt>
                    <dd>{jobDetail.failureSummary || '—'}</dd>
                  </dl>
                </div>
              </div>
              {(() => {
                const snapshot = parseConfigSnapshot(jobDetail.configSnapshot);
                return (
                  <div className="panel mb-16">
                    <div className="panel-head">
                      <h3>
                        <Icon name="layers" size={14} />
                        任务配置快照
                      </h3>
                      <span className="hint">来源版本 {jobDetail.configVersion}</span>
                    </div>
                    <div className="panel-body">
                      {snapshot ? (
                        <dl className="kv">
                          <dt>任务性质</dt>
                          <dd>
                            {String(snapshot.taskLabel || '—')} ·{' '}
                            <span className="mono-sm">{String(snapshot.taskNature || '—')}</span>
                          </dd>
                          <dt>执行方式 / 执行器</dt>
                          <dd className="mono-sm">
                            {String(snapshot.executionMode || '—')} /{' '}
                            {String(snapshot.executor || '—')}
                          </dd>
                          <dt>智能体 / 模型</dt>
                          <dd>
                            {String(snapshot.agentCode || '—')} / {String(snapshot.model || '—')}
                          </dd>
                          <dt>提示词 / 工具</dt>
                          <dd className="mono-sm">
                            {String(snapshot.promptVersion || '—')} / {String(snapshot.tools || '—')}
                          </dd>
                          <dt>输出契约</dt>
                          <dd className="mono-sm">{String(snapshot.outputContract || '—')}</dd>
                          <dt>超时 / 重试</dt>
                          <dd>
                            {String(snapshot.timeoutSeconds ?? '—')} 秒 /{' '}
                            {String(snapshot.retryLimit ?? '—')} 次
                          </dd>
                          <dt>边界说明</dt>
                          <dd>{String(snapshot.boundaryNote || '—')}</dd>
                        </dl>
                      ) : (
                        <p className="note">
                          该任务创建于配置快照上线前，只记录了来源版本，未保存完整快照。
                        </p>
                      )}
                      <p className="note mt-8">
                        创建任务时整体拷贝当时版本；之后发布新版本不回溯本任务。
                      </p>
                    </div>
                  </div>
                );
              })()}
              <div className="panel mb-16">
                <div className="panel-head">
                  <h3>
                    <Icon name="layers" size={14} />
                    阶段执行
                  </h3>
                  <span className="hint">{jobDetail.stages.length} 个阶段</span>
                </div>
                <div className="table-wrap">
                  <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>阶段</th>
                        <th>状态</th>
                        <th>尝试</th>
                        <th>开始</th>
                        <th>结束</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobDetail.stages.map((stage, index) => (
                        <tr key={`${stage.stage}-${stage.attempt ?? index}`}>
                          <td>{STAGE_LABEL[stage.stage] || stage.stage}</td>
                          <td>
                            <span className={`tag ${statusOf(STAGE_STATUS, stage.status).tag}`}>
                              {statusOf(STAGE_STATUS, stage.status).label}
                            </span>
                          </td>
                          <td>{stage.attempt ?? '—'}</td>
                          <td>{formatShortDateTime(stage.startedAt)}</td>
                          <td>{formatShortDateTime(stage.finishedAt)}</td>
                          <td className="note">{stage.detail || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {jobDetail.ledger ? (
                <div className="panel mb-16">
                  <div className="panel-head">
                    <h3>
                      <Icon name="package" size={14} />
                      产物账本
                    </h3>
                    <span className="hint">{jobDetail.ledger.status}</span>
                  </div>
                  <div className="panel-body">
                    <dl className="kv">
                      <dt>应结算</dt>
                      <dd>{jobDetail.ledger.expectedCount}</dd>
                      <dt>已结算</dt>
                      <dd>{jobDetail.ledger.settledCount}</dd>
                      <dt>失败 / 死信</dt>
                      <dd>
                        {jobDetail.ledger.failedCount} / {jobDetail.ledger.deadCount}
                      </dd>
                      <dt>关闭时间</dt>
                      <dd>{formatShortDateTime(jobDetail.ledger.closedAt)}</dd>
                    </dl>
                  </div>
                </div>
              ) : null}
              {jobDetail.artifact ? (
                <div className="callout">
                  <Icon name="info" size={15} />
                  <div className="ct">
                    <b>
                      产物 {jobDetail.artifact.artifactType}
                      {jobDetail.artifact.versionNo
                        ? ` · v${jobDetail.artifact.versionNo}`
                        : ''}
                    </b>
                    <p>
                      {jobDetail.artifact.title} · {jobDetail.artifact.lifecycleStatus} /{' '}
                      {jobDetail.artifact.retrievalState}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          }
          footRight={
            <>
              {canCompile && isCompilationActive(jobDetail.runStatus) ? (
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() => void cancelJob()}
                >
                  <Icon name="x" size={13} />
                  {busy ? '取消中…' : '取消任务'}
                </button>
              ) : canCompile ? (
                <button
                  className="btn primary"
                  type="button"
                  disabled={busy}
                  onClick={() => openRetry(jobDetail)}
                >
                  <Icon name="refresh" size={13} />
                  重试编译
                </button>
              ) : null}
              <button className="btn" type="button" onClick={() => setJobDetail(null)}>
                关闭
              </button>
            </>
          }
        />
      ) : null}

      {retryTarget ? (
        <AppModal
          icon="refresh"
          title="重试编译任务"
          sub={materialTitle(retryTarget.materialId)}
          width={620}
          onClose={() => setRetryTarget(null)}
          body={
            <div>
              <div className="panel mb-16">
                <div className="panel-body">
                  <dl className="kv">
                    <dt>任务标识</dt>
                    <dd className="mono">{retryTarget.jobId}</dd>
                    <dt>当前状态</dt>
                    <dd>
                      <span className={`tag ${statusOf(JOB_STATUS, retryTarget.runStatus).tag}`}>
                        {statusOf(JOB_STATUS, retryTarget.runStatus).label}
                      </span>
                    </dd>
                    <dt>当前阶段 / 检索块</dt>
                    <dd>
                      {retryTarget.currentStage
                        ? STAGE_LABEL[retryTarget.currentStage] || retryTarget.currentStage
                        : '—'}{' '}
                      / {retryTarget.chunkCount == null ? '—' : retryTarget.chunkCount}
                    </dd>
                  </dl>
                </div>
              </div>
              <label className="note" htmlFor="retry-stage">
                起始阶段
              </label>
              <select
                id="retry-stage"
                className="select mt-8"
                style={{ width: '100%' }}
                value={retryStage}
                onChange={(event) => setRetryStage(event.target.value)}
              >
                {RETRY_STAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {STAGE_LABEL[item.value] || item.value}
                  </option>
                ))}
              </select>
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>本阶段影响</b>
                  <p>{RETRY_STAGES.find((item) => item.value === retryStage)?.effect}</p>
                </div>
              </div>
              <p className="note mt-8">
                重试会立即执行，阶段记录按新一轮追加，不覆盖历史尝试；任务处于运行中时不可重试；
                无论从哪个阶段起跑，Wiki 编译都会重新执行。
              </p>
            </div>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setRetryTarget(null)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={busy}
                onClick={() => void confirmRetry()}
              >
                {busy ? '执行中…' : '确认重试'}
              </button>
            </>
          }
        />
      ) : null}

      {createOpen ? (
        <AppModal
          icon="plus"
          title="新建编译单任务"
          sub="选择一份库内资料，按当前解析稿触发 P0–P4"
          width={560}
          onClose={() => setCreateOpen(false)}
          body={
            <div>
              <label className="note" htmlFor="task-material">
                执行对象
              </label>
              <select
                id="task-material"
                className="select mt-8"
                style={{ width: '100%' }}
                value={newMaterialId}
                onChange={(event) => setNewMaterialId(event.target.value)}
              >
                <option value="">请选择资料</option>
                {materials.map((item) => (
                  <option key={item.materialId} value={item.materialId}>
                    {item.title}
                  </option>
                ))}
              </select>
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>只进入排队与执行</b>
                  <p>
                    任务配置在「运营管理 → 任务配置」维护；此处不覆盖配置。解析稿未就绪时任务会直接置为失败并记录原因。
                  </p>
                </div>
              </div>
            </div>
          }
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setCreateOpen(false)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={busy}
                onClick={() => void createJob()}
              >
                {busy ? '执行中…' : '触发编译'}
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
