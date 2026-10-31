import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAt } from '@/test/render';
import {
  cancelCompilation,
  cancelCompilationBatch,
  CompilationBatchRecord,
  CompilationJobRecord,
  getCompilationBatch,
  getCompilationByJob,
  listCompilationJobs,
  pageCompilationBatches,
  retryCompilation,
  runCompilation,
} from '@/services/compilation';
import { pageMaterial } from '@/services/material';
import { getTaskSummary, pageTasks } from '@/services/task';
import { toast } from '@/utils/toast';
import TaskManager from './task-manager';

vi.mock('@/services/compilation', () => ({
  pageCompilationBatches: vi.fn(),
  getCompilationBatch: vi.fn(),
  listCompilationJobs: vi.fn(),
  getCompilationByJob: vi.fn(),
  retryCompilation: vi.fn(),
  runCompilation: vi.fn(),
  cancelCompilation: vi.fn(),
  cancelCompilationBatch: vi.fn(),
  isCompilationActive: (status?: string) => status === 'QUEUED' || status === 'RUNNING',
}));

vi.mock('@/services/material', () => ({
  pageMaterial: vi.fn(),
}));

vi.mock('@/services/task', () => ({
  pageTasks: vi.fn(),
  getTaskSummary: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

vi.mock('./observability', () => ({
  default: ({ kbId }: { kbId: string }) => (
    <div data-testid="observability-tab">可观测视图 · {kbId}</div>
  ),
}));

const GROUP_RUNNING: CompilationBatchRecord = {
  batchId: 'batch-1',
  kbId: 'kb-1',
  name: '护理规范批量编译',
  taskType: 'COMPILATION',
  scopeType: 'WORKSPACE',
  scopeCount: 2,
  totalCount: 2,
  successCount: 1,
  failedCount: 1,
  status: 'RUNNING',
  failureSummary: '一份资料解析稿缺失，需要重新上传后再编译',
  submitterName: '王护士',
  createTime: '2026-03-01T10:00:00',
};

const GROUP_DONE: CompilationBatchRecord = {
  batchId: 'batch-2',
  kbId: 'kb-1',
  name: '制度文件编译',
  taskType: 'WIKI',
  scopeType: 'CATEGORY',
  scopeCount: 5,
  totalCount: 5,
  successCount: 5,
  failedCount: 0,
  status: 'COMPLETED',
  createBy: 42,
  createTime: '2026-02-20T09:00:00',
};

const GROUP_DETAIL: CompilationBatchRecord = {
  ...GROUP_RUNNING,
  members: [
    {
      jobId: 'job-2',
      materialId: 'mat-2',
      materialVersionId: 'mv-2',
      itemStatus: 'FAILED',
      jobStatus: 'FAILED',
      milestone: 'NONE',
      itemFailureSummary: '解析稿未就绪',
    },
    {
      materialId: 'mat-1',
      materialVersionId: 'mv-1',
      itemStatus: 'SUCCEEDED',
      jobStatus: 'SUCCEEDED',
      milestone: 'M2',
      chunkCount: 18,
    },
  ],
};

const JOB_RUNNING: CompilationJobRecord = {
  jobId: 'job-1',
  kbId: 'kb-1',
  materialId: 'mat-1',
  materialVersionId: 'mv-1',
  pipelineType: 'DOCUMENT',
  configVersion: 'v3',
  compilerVersion: '1.2.0',
  runStatus: 'RUNNING',
  milestone: 'M1',
  currentStage: 'PARSE',
  chunkCount: 12,
  startedAt: '2026-03-01T10:05:00',
  reused: false,
  stages: [],
};

const JOB_DONE: CompilationJobRecord = {
  jobId: 'job-3',
  kbId: 'kb-1',
  materialId: 'mat-2',
  materialVersionId: 'mv-2',
  pipelineType: 'DOCUMENT',
  configVersion: 'v2',
  configSnapshot: JSON.stringify({
    taskLabel: '文档编译',
    taskNature: 'COMPILATION',
    executionMode: 'SYNC',
    executor: 'compile-worker',
    agentCode: 'agent-1',
    model: 'deepseek-v3',
    promptVersion: 'p7',
    tools: 'ocr,chunk',
    outputContract: 'chunk.v1',
    timeoutSeconds: 600,
    retryLimit: 2,
    boundaryNote: '仅处理库内资料',
  }),
  compilerVersion: '1.1.0',
  runStatus: 'COMPLETED',
  milestone: 'M2',
  currentStage: 'INDEX',
  chunkCount: 24,
  startedAt: '2026-02-21T08:00:00',
  finishedAt: '2026-02-21T08:03:20',
  reused: false,
  taskId: 'task-9',
  taskStatus: 'SUCCEEDED',
  stages: [
    {
      stage: 'PARSE',
      status: 'SUCCEEDED',
      attempt: 1,
      detail: '解析 12 页',
      startedAt: '2026-02-21T08:00:00',
      finishedAt: '2026-02-21T08:01:00',
    },
    {
      stage: 'INDEX',
      status: 'SUCCEEDED',
      attempt: 1,
      startedAt: '2026-02-21T08:02:00',
      finishedAt: '2026-02-21T08:03:20',
    },
  ],
  ledger: {
    ledgerId: 'ledger-1',
    expectedCount: 24,
    settledCount: 24,
    failedCount: 0,
    deadCount: 0,
    status: 'CLOSED',
    closedAt: '2026-02-21T08:03:20',
  },
  artifact: {
    artifactId: 'art-1',
    artifactType: 'WIKI',
    title: '护理操作 Wiki',
    lifecycleStatus: 'PUBLISHED',
    retrievalState: 'INDEXED',
    versionNo: 2,
    evidenceRef: 'ev-1',
  },
};

const MATERIALS = {
  records: [
    { materialId: 'mat-1', title: '急性胸痛诊疗规范' },
    { materialId: 'mat-2', title: '护理操作手册' },
  ],
  total: 2,
  current: 1,
  size: 100,
};

const TASK_QUEUED = {
  taskId: 'task-1',
  taskType: 'MATERIAL_PARSE',
  bizKey: 'biz-1',
  status: 'QUEUED',
  attempt: 1,
  maxAttempts: 3,
  materialId: 'mat-1',
  createTime: '2026-03-02T09:00:00',
  heartbeatAt: '2026-03-02T09:00:10',
};

const TASK_FAILED = {
  taskId: 'task-2',
  taskType: 'COMPILATION',
  bizKey: 'biz-2',
  status: 'FAILED',
  attempt: 3,
  maxAttempts: 3,
  failureSummary: '解析超时',
  startedAt: '2026-03-02T08:00:00',
  finishedAt: '2026-03-02T08:01:00',
  createTime: '2026-03-02T07:59:00',
};

function renderPage() {
  return renderAt(<TaskManager kbId="kb-1" canManage canCompile />, { route: '/knowledge-bases/kb-1' });
}

describe('任务管理页', () => {
  beforeEach(() => {
    vi.mocked(getTaskSummary).mockResolvedValue({ groupTotal: 2, jobTotal: 2, taskTotal: 2 });
    vi.mocked(pageCompilationBatches).mockResolvedValue({
      records: [GROUP_RUNNING, GROUP_DONE],
      total: 2,
      pageNo: 1,
      pageSize: 20,
    });
    vi.mocked(getCompilationBatch).mockResolvedValue(GROUP_DETAIL);
    vi.mocked(listCompilationJobs).mockResolvedValue([JOB_RUNNING, JOB_DONE]);
    vi.mocked(pageMaterial).mockResolvedValue(MATERIALS as never);
    vi.mocked(getCompilationByJob).mockResolvedValue(JOB_DONE);
    vi.mocked(retryCompilation).mockResolvedValue({
      ...JOB_DONE,
      runStatus: 'QUEUED',
      finishedAt: undefined,
      currentStage: 'PARSE',
    });
    vi.mocked(runCompilation).mockResolvedValue({
      ...JOB_RUNNING,
      jobId: 'job-new',
      reused: true,
    });
    vi.mocked(cancelCompilationBatch).mockResolvedValue({
      ...GROUP_RUNNING,
      status: 'CANCELED',
      successCount: 2,
    });
    vi.mocked(cancelCompilation).mockResolvedValue({ ...JOB_RUNNING, runStatus: 'CANCELED' });
    vi.mocked(pageTasks).mockResolvedValue({
      records: [TASK_QUEUED, TASK_FAILED],
      total: 2,
      pageNo: 1,
      pageSize: 20,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('加载后展示组别表格、进度与提交人', async () => {
    let resolveGroups: (value: unknown) => void = () => undefined;
    vi.mocked(pageCompilationBatches).mockImplementation(
      () => new Promise((resolve) => { resolveGroups = resolve as (value: unknown) => void; }) as never,
    );

    renderPage();
    expect(screen.getByText('正在加载任务…')).toBeTruthy();

    resolveGroups({
      records: [GROUP_RUNNING, GROUP_DONE],
      total: 2,
      pageNo: 1,
      pageSize: 20,
    });

    expect(await screen.findByText('护理规范批量编译')).toBeTruthy();
    expect(pageCompilationBatches).toHaveBeenCalledWith('kb-1', 1, 20);
    expect(getTaskSummary).toHaveBeenCalledWith('kb-1');

    expect(screen.getByText('工作台多选')).toBeTruthy();
    expect(screen.getByText('1/2 成功')).toBeTruthy();
    expect(screen.getByText('王护士')).toBeTruthy();
    expect(screen.getByText('运行中')).toBeTruthy();
    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText('制度文件编译')).toBeTruthy();
    expect(screen.getByText(/共 2 个组别/)).toBeTruthy();
    expect(screen.getByText(/一份资料解析稿缺失/)).toBeTruthy();
  });

  it('组别为空时引导去知识工作台', async () => {
    vi.mocked(pageCompilationBatches).mockResolvedValue({
      records: [],
      total: 0,
      pageNo: 1,
      pageSize: 20,
    });

    renderPage();

    expect(await screen.findByText('还没有任务组别')).toBeTruthy();
    const link = screen.getByRole('link', { name: /去知识工作台/ });
    expect(link.getAttribute('href')).toBe('#/knowledge-bases/kb-1/workspace');
  });

  it('查看组别详情并取消运行中的组别', async () => {
    renderPage();
    await screen.findByText('护理规范批量编译');

    fireEvent.click(screen.getAllByRole('button', { name: '查看' })[0]);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.textContent).toContain('batch-1'));
    expect(getCompilationBatch).toHaveBeenCalledWith('batch-1');
    expect(dialog.textContent).toContain('成功 1 · 失败 1 · 成员 2');
    expect(dialog.textContent).toContain('物料 mat-2');
    expect(dialog.textContent).toContain('解析稿未就绪');
    expect(dialog.textContent).toContain('M2');

    fireEvent.click(within(dialog).getByRole('button', { name: /取消组别/ }));
    await waitFor(() => expect(cancelCompilationBatch).toHaveBeenCalledWith('batch-1'));
    expect(toast).toHaveBeenCalledWith('组别已取消', '2/2 成功 · 已取消', 'warn');
    await waitFor(() => expect(within(dialog).getByText('已取消')).toBeTruthy());
  });

  it('单任务页签展示任务并可搜索过滤、查看详情、重试编译', async () => {
    renderPage();
    await screen.findByText('护理规范批量编译');

    fireEvent.click(screen.getByRole('button', { name: /^单任务/ }));

    expect(await screen.findByText('护理操作手册')).toBeTruthy();
    expect(listCompilationJobs).toHaveBeenCalledWith('kb-1', undefined, 50);
    expect(pageMaterial).toHaveBeenCalledWith({ kbId: 'kb-1', current: 1, size: 100 });
    expect(screen.getByText('急性胸痛诊疗规范')).toBeTruthy();
    expect(screen.getByText('P1 解析')).toBeTruthy();
    expect(screen.getByText('3m 20s')).toBeTruthy();

    const search = screen.getByPlaceholderText('搜索资料标题或任务标识');
    fireEvent.change(search, { target: { value: '不存在' } });
    expect(await screen.findByText('没有匹配的任务')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
    expect(await screen.findByText('护理操作手册')).toBeTruthy();

    const doneRow = screen.getByText('护理操作手册').closest('tr') as HTMLElement;
    fireEvent.click(within(doneRow).getByRole('button', { name: '详情' }));

    const detail = await screen.findByRole('dialog');
    await waitFor(() => expect(detail.textContent).toContain('编译任务详情'));
    expect(getCompilationByJob).toHaveBeenCalledWith('job-3');
    expect(detail.textContent).toContain('M2 已达成');
    expect(detail.textContent).toContain('产物账本');
    expect(detail.textContent).toContain('护理操作 Wiki');
    expect(detail.textContent).toContain('仅处理库内资料');
    expect(detail.textContent).toContain('解析 12 页');

    fireEvent.click(within(detail).getByRole('button', { name: /重试编译/ }));
    const retry = await waitFor(() => {
      const found = screen
        .getAllByRole('dialog')
        .find((item) => item.textContent?.includes('重试编译任务'));
      if (!found) {
        throw new Error('重试弹窗未打开');
      }
      return found;
    });
    expect(retry.textContent).toContain('重试编译任务');
    fireEvent.change(screen.getByLabelText('起始阶段'), { target: { value: 'PARSE' } });
    expect(screen.getByText(/从 P1 解析起/)).toBeTruthy();
    fireEvent.click(within(retry).getByRole('button', { name: '确认重试' }));

    await waitFor(() => expect(retryCompilation).toHaveBeenCalledWith('job-3', 'PARSE'));
    expect(toast).toHaveBeenCalledWith('重试已提交', '起始阶段 P1 解析 · 状态：排队中');
  });

  it('新建编译单任务校验资料并触发编译', async () => {
    renderPage();
    await screen.findByText('护理规范批量编译');
    fireEvent.click(screen.getByRole('button', { name: /^单任务/ }));
    await screen.findByText('护理操作手册');

    fireEvent.click(screen.getByRole('button', { name: /新建编译/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('新建编译单任务');

    fireEvent.click(within(dialog).getByRole('button', { name: '触发编译' }));
    expect(toast).toHaveBeenCalledWith('请选择资料', '单任务需要先选一份库内资料', 'error');
    expect(runCompilation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('执行对象'), { target: { value: 'mat-2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '触发编译' }));

    await waitFor(() => expect(runCompilation).toHaveBeenCalledWith('mat-2'));
    expect(toast).toHaveBeenCalledWith('已复用编译任务', '对象：护理操作手册 · 状态：运行中');
    await waitFor(() => expect(screen.queryByText('新建编译单任务')).toBeNull());
    expect(screen.getByText('单任务')).toBeTruthy();
  });

  it('调度页签展示任务、按状态过滤并支持空态清空', async () => {
    renderPage();
    await screen.findByText('护理规范批量编译');

    fireEvent.click(screen.getByRole('button', { name: /^调度/ }));

    expect(await screen.findByText('解析超时')).toBeTruthy();
    expect(pageTasks).toHaveBeenCalledWith({
      kbId: 'kb-1',
      taskType: undefined,
      status: undefined,
      pageNo: 1,
      pageSize: 20,
    });
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('3/3')).toBeTruthy();
    expect(screen.getAllByText('文档解析').length).toBeGreaterThan(0);
    expect(screen.getByText(/共 2 条调度记录/)).toBeTruthy();

    vi.mocked(pageTasks).mockResolvedValue({
      records: [],
      total: 0,
      pageNo: 1,
      pageSize: 20,
    });
    fireEvent.change(screen.getByDisplayValue('全部状态'), { target: { value: 'FAILED' } });

    expect(await screen.findByText('没有匹配的调度任务')).toBeTruthy();
    expect(pageTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'FAILED', pageNo: 1 }),
    );

    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
    await waitFor(() =>
      expect(pageTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: undefined, taskType: undefined }),
      ),
    );
  });

  it('可观测页签渲染观测视图', async () => {
    renderPage();
    await screen.findByText('护理规范批量编译');

    fireEvent.click(screen.getByRole('button', { name: /可观测/ }));

    expect(await screen.findByTestId('observability-tab')).toBeTruthy();
    expect(screen.getByText('可观测视图 · kb-1')).toBeTruthy();
    expect(screen.queryByText('还没有任务组别')).toBeNull();
  });
});
