import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  createEvalRun,
  listEvalBadcases,
  pageEvalCaseResults,
  pageEvaluationKnowledgeBases,
  publishEvalDataset,
  queryEvalDataset,
  queryEvalOverview,
  queryEvalRun,
  queryEvalTrustEvidence,
  saveEvalDatasetDraft,
  updateEvalBadcase,
} from './evaluation';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/evaluation';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('知识评测查询接口', () => {
  it('知识库分页只在有关键字时带 keyword', async () => {
    await pageEvaluationKnowledgeBases({ current: 1, size: 20 });
    expect(request).toHaveBeenLastCalledWith(`${BASE}/pageKnowledgeBase`, {
      method: 'get',
      params: { current: 1, size: 20 },
      headers,
    });

    await pageEvaluationKnowledgeBases({ current: 2, size: 10, keyword: '手册' });
    expect(request).toHaveBeenLastCalledWith(`${BASE}/pageKnowledgeBase`, {
      method: 'get',
      params: { current: 2, size: 10, keyword: '手册' },
      headers,
    });
  });

  it('概览与数据集携带可选基线、版本参数', async () => {
    await queryEvalOverview('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryOverview`, {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });

    await queryEvalOverview('kb-1', 'run-0');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryOverview`, {
      method: 'get',
      params: { kbId: 'kb-1', baselineRunId: 'run-0' },
      headers,
    });

    await queryEvalDataset('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryDataset`, {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });

    await queryEvalDataset('kb-1', 'v2');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryDataset`, {
      method: 'get',
      params: { kbId: 'kb-1', versionNo: 'v2' },
      headers,
    });
  });

  it('运行详情、用例分页与信任证据', async () => {
    await queryEvalRun('run-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryRun`, {
      method: 'get',
      params: { runId: 'run-1' },
      headers,
    });

    const casePage = { runId: 'run-1', current: 1, size: 20, onlyBad: true, stageCode: 'RETRIEVE' };
    await pageEvalCaseResults(casePage);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/pageCaseResults`, {
      method: 'post',
      data: casePage,
      headers,
    });

    await queryEvalTrustEvidence('run-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/queryTrustEvidence`, {
      method: 'get',
      params: { runId: 'run-1' },
      headers,
    });
  });

  it('坏例列表拼接可选状态与阶段', async () => {
    await listEvalBadcases('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listBadcases`, {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });

    await listEvalBadcases('kb-1', 'OPEN', 'RETRIEVE');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/listBadcases`, {
      method: 'get',
      params: { kbId: 'kb-1', status: 'OPEN', stageCode: 'RETRIEVE' },
      headers,
    });
  });

  it('读取失败只记录日志并返回 undefined', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(request).mockRejectedValueOnce(new Error('offline'));
    await expect(queryEvalRun('run-1')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('[evaluation]', 'offline');
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('知识评测写入接口', () => {
  it('保存草稿、发布数据集与创建运行', async () => {
    const draft = {
      kbId: 'kb-1',
      name: '数据集',
      cases: [{ caseNo: '1', question: 'q', expectedAnswer: 'a', expectedBehavior: 'b', expectedEvidence: [], tags: [] }],
    };
    await saveEvalDatasetDraft(draft);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/saveDatasetDraft`, {
      method: 'post',
      data: draft,
      headers,
    });

    const publish = { kbId: 'kb-1', expectedVersionNo: 'v1' };
    await publishEvalDataset(publish);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/publishDataset`, {
      method: 'post',
      data: publish,
      headers,
    });

    const run = { kbId: 'kb-1', allowReuse: true as const, datasetVersionNo: 'v2' };
    await createEvalRun(run);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/createRun`, {
      method: 'post',
      data: run,
      headers,
    });
  });

  it('更新坏例提交处理状态', async () => {
    const payload = { badcaseId: 'b1', status: 'FIXED', owner: '张三', note: '已修复' };
    await updateEvalBadcase(payload);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/updateBadcase`, {
      method: 'post',
      data: payload,
      headers,
    });
  });
});
