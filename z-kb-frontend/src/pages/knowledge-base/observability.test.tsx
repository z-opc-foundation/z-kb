import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { renderAt } from '@/test/render';
import { listCompilationJobs } from '@/services/compilation';
import { pageMaterial } from '@/services/material';
import { getKbOverview } from '@/services/overview';
import { pageTasks } from '@/services/task';
import ObservabilityTab from './observability';

vi.mock('@/services/overview', () => ({ getKbOverview: vi.fn() }));
vi.mock('@/services/material', () => ({ pageMaterial: vi.fn() }));
vi.mock('@/services/task', () => ({ pageTasks: vi.fn() }));
vi.mock('@/services/compilation', () => ({ listCompilationJobs: vi.fn() }));

const TODAY = dayjs().hour(10).minute(0).second(0);
const at = (hour: number, minute: number, second = 0) =>
  TODAY.hour(hour).minute(minute).second(second).format('YYYY-MM-DDTHH:mm:ss');

const OVERVIEW = {
  kbId: 'kb-1',
  fileCount: 10,
  compiledCount: 6,
  partialCount: 1,
  notCompiledCount: 4,
  wikiCount: 4,
  runningTaskCount: 1,
  failedCount: 2,
  recentMaterials: [],
  refreshedAt: at(11, 0),
};

const MATERIALS = [
  {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '急性胸痛诊疗规范',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-1',
    parseStatus: 'READY',
    compileStatus: 'COMPILED',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  {
    materialId: 'mat-2',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '护理操作手册',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-2',
    parseStatus: 'READY',
    compileStatus: 'FAILED',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  {
    materialId: 'mat-3',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '待解析制度',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-3',
    parseStatus: 'PARSING',
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
];

const TASKS = [
  {
    taskId: 'task-1',
    taskType: 'MATERIAL_PARSE',
    bizKey: 'biz-1',
    status: 'SUCCEEDED',
    attempt: 1,
    maxAttempts: 3,
    materialId: 'mat-1',
    materialTitle: '急性胸痛诊疗规范',
    createTime: at(8, 0),
    startedAt: at(8, 0),
    finishedAt: at(8, 2),
  },
  {
    taskId: 'task-2',
    taskType: 'COMPILATION',
    bizKey: 'biz-2',
    status: 'FAILED',
    attempt: 3,
    maxAttempts: 3,
    materialId: 'mat-2',
    materialTitle: '护理操作手册',
    failureSummary: 'GPU 队列超时',
    createTime: at(9, 0),
    startedAt: at(9, 0),
    finishedAt: at(9, 0, 30),
  },
  {
    taskId: 'task-3',
    taskType: 'MATERIAL_PARSE',
    bizKey: 'biz-3',
    status: 'FAILED',
    attempt: 2,
    maxAttempts: 3,
    materialId: 'mat-3',
    resultSummary: '未重试，等待人工介入',
    createTime: at(9, 30),
    startedAt: at(9, 30),
    finishedAt: at(9, 31),
  },
  {
    taskId: 'task-4',
    taskType: 'WIKI',
    bizKey: 'biz-4',
    status: 'RUNNING',
    attempt: 1,
    maxAttempts: 3,
    materialId: 'mat-1',
    createTime: at(10, 30),
    startedAt: at(10, 30),
  },
  {
    taskId: 'task-5',
    taskType: 'COMPILATION',
    bizKey: 'biz-5',
    status: 'DEAD',
    attempt: 3,
    maxAttempts: 3,
    materialId: 'mat-2',
    failureSummary: '重试耗尽',
    createTime: at(10, 40),
    startedAt: at(10, 40),
    finishedAt: at(10, 40, 10),
  },
];

const JOBS = [
  {
    jobId: 'job-1',
    kbId: 'kb-1',
    materialId: 'mat-1',
    materialVersionId: 'mv-1',
    pipelineType: 'DOCUMENT',
    configVersion: 'v1',
    compilerVersion: '1.0',
    runStatus: 'COMPLETED',
    milestone: 'M2',
    chunkCount: 12,
    startedAt: at(9, 30),
    finishedAt: at(9, 35),
    reused: false,
    stages: [],
  },
  {
    jobId: 'job-2',
    kbId: 'kb-1',
    materialId: 'mat-2',
    materialVersionId: 'mv-2',
    pipelineType: 'DOCUMENT',
    configVersion: 'v1',
    compilerVersion: '1.0',
    runStatus: 'FAILED',
    milestone: 'M0',
    chunkCount: 0,
    startedAt: at(9, 0),
    finishedAt: at(9, 0, 45),
    reused: false,
    stages: [],
  },
  {
    jobId: 'job-3',
    kbId: 'kb-1',
    materialId: 'mat-3333',
    materialVersionId: 'mv-3',
    pipelineType: 'DOCUMENT',
    configVersion: 'v1',
    compilerVersion: '1.0',
    runStatus: 'COMPLETED',
    milestone: 'M0',
    chunkCount: 0,
    startedAt: at(10, 0),
    finishedAt: at(10, 0, 20),
    reused: false,
    stages: [],
  },
];

function renderObs() {
  return renderAt(<ObservabilityTab kbId="kb-1" />, { route: '/knowledge-bases/kb-1/governance' });
}

function metricText(label: string): string | null {
  const node = [...document.querySelectorAll('.obs-metric')].find(
    (item) => item.firstElementChild?.textContent === label,
  );
  return node?.textContent ?? null;
}

function barRowText(label: string): string {
  const labelNode = [...document.querySelectorAll('.obs-bar-label')].find(
    (item) => item.textContent === label,
  );
  return labelNode?.closest('.obs-bar-row')?.textContent ?? '';
}

describe('可观测面板', () => {
  beforeEach(() => {
    vi.mocked(getKbOverview).mockResolvedValue(OVERVIEW);
    vi.mocked(pageMaterial).mockResolvedValue({
      records: MATERIALS,
      total: MATERIALS.length,
      current: 1,
      size: 200,
    } as never);
    vi.mocked(pageTasks).mockResolvedValue({
      records: TASKS,
      total: TASKS.length,
      pageNo: 1,
      pageSize: 200,
    } as never);
    vi.mocked(listCompilationJobs).mockResolvedValue(JOBS as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('加载后汇总指标、状态分布、漏斗与耗时', async () => {
    renderObs();

    expect(screen.getByText('正在汇总观测数据…')).toBeTruthy();

    expect(await screen.findByText('近 14 天任务量')).toBeTruthy();
    expect(getKbOverview).toHaveBeenCalledWith('kb-1');
    expect(pageMaterial).toHaveBeenCalledWith({ kbId: 'kb-1', current: 1, size: 200 });
    expect(pageTasks).toHaveBeenCalledWith({ kbId: 'kb-1', pageNo: 1, pageSize: 200 });
    expect(listCompilationJobs).toHaveBeenCalledWith('kb-1', undefined, 50);

    expect(metricText('资料')).toBe('资料10份');
    expect(metricText('已解析')).toBe('已解析2份');
    expect(metricText('已编译')).toBe('已编译6份');
    expect(metricText('Wiki 页')).toBe('Wiki 页4页');
    expect(metricText('调度任务')).toBe('调度任务5条');
    expect(metricText('任务成功率')).toBe('任务成功率25%');

    expect(screen.getByText('共 5 条调度任务')).toBeTruthy();
    expect(barRowText('失败')).toBe('失败2');
    expect(screen.getAllByText('成功').length).toBeGreaterThan(0);
    expect(screen.getByText('死信')).toBeTruthy();
    expect(barRowText('执行中')).toBe('执行中1');

    expect(screen.getAllByText('文档解析').length).toBeGreaterThan(0);
    expect(barRowText('文档解析')).toBe('文档解析1m 30s');
    expect(barRowText('知识编译')).toBe('知识编译20s');

    expect(barRowText('急性胸痛诊疗规范')).toBe('急性胸痛诊疗规范5m 0s');
    expect(barRowText('护理操作手册')).toBe('护理操作手册45s');
    expect(barRowText('mat-3333')).toBe('mat-333320s');
    expect(screen.getByText('另有 1 份部分完成')).toBeTruthy();

    const chart = screen.getByTitle(`${TODAY.format('YYYY-MM-DD')} · 5 条`);
    expect(chart).toBeTruthy();
    expect(document.querySelectorAll('.obs-col')).toHaveLength(14);

    expect(screen.getByText('GPU 队列超时')).toBeTruthy();
    expect(screen.getByText('未重试，等待人工介入')).toBeTruthy();
    expect(screen.getByText('重试耗尽')).toBeTruthy();
    expect(screen.getByText('文档解析 · 尝试 2/3')).toBeTruthy();
  });

  it('无任务无编译记录时展示各区块空态', async () => {
    vi.mocked(pageMaterial).mockResolvedValue({
      records: [],
      total: 0,
      current: 1,
      size: 200,
    } as never);
    vi.mocked(pageTasks).mockResolvedValue({
      records: [],
      total: 0,
      pageNo: 1,
      pageSize: 200,
    } as never);
    vi.mocked(listCompilationJobs).mockResolvedValue([]);

    renderObs();

    expect(await screen.findByText('还没有调度任务')).toBeTruthy();
    expect(screen.getByText('暂无状态可统计')).toBeTruthy();
    expect(screen.getByText('暂无已结束任务')).toBeTruthy();
    expect(screen.getByText('还没有编译任务')).toBeTruthy();
    expect(screen.getByText('没有失败任务')).toBeTruthy();
    expect(metricText('已解析')).toBe('已解析0份');
    expect(metricText('调度任务')).toBe('调度任务0条');
    expect(metricText('任务成功率')).toBe('任务成功率—');
    expect(document.querySelectorAll('.obs-col')).toHaveLength(0);
  });

  it('概览缺失时指标降级并提示统计不可用', async () => {
    vi.mocked(getKbOverview).mockResolvedValue(undefined);
    vi.mocked(pageMaterial).mockResolvedValue({
      records: [],
      total: 0,
      current: 1,
      size: 200,
    } as never);
    vi.mocked(pageTasks).mockResolvedValue({
      records: [],
      total: 0,
      pageNo: 1,
      pageSize: 200,
    } as never);
    vi.mocked(listCompilationJobs).mockResolvedValue([]);

    renderObs();

    expect(await screen.findByText('库统计不可用')).toBeTruthy();
    expect(metricText('资料')).toBe('资料—份');
    expect(metricText('已编译')).toBe('已编译—份');
    expect(metricText('Wiki 页')).toBe('Wiki 页—页');
    expect(screen.getByText('概览接口未返回数据，稍后重试。')).toBeTruthy();
  });
});
