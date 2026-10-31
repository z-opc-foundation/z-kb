import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  getKbTaskConfig,
  getTaskConfig,
  publishKbTaskConfig,
  publishTaskConfig,
} from './taskConfig';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/taskConfig';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('任务配置接口', () => {
  it('读取与发布任务配置', async () => {
    const record = { version: 'v1', items: [] };
    vi.mocked(request).mockResolvedValue(record as never);

    await expect(getTaskConfig()).resolves.toBe(record);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/query`, {
      method: 'get',
      headers,
    });

    const items = [
      {
        taskNature: 'COMPILE',
        executionMode: 'AUTO',
        executor: 'agent',
        timeoutSeconds: 60,
        retryLimit: 1,
      },
    ];
    await publishTaskConfig(items);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/publish`, {
      method: 'post',
      data: { items },
      headers,
    });
  });

  it('读取与发布知识库级任务配置带 kbId', async () => {
    const record = { version: '2026.10-r2', items: [] };
    vi.mocked(request).mockResolvedValue(record as never);

    await expect(getKbTaskConfig('kb-1')).resolves.toBe(record);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/kb/query?kbId=kb-1`, {
      method: 'get',
      headers,
    });

    const items = [
      {
        taskNature: 'WIKI',
        executionMode: 'AGENT',
        executor: 'wiki-agent',
        timeoutSeconds: 300,
        retryLimit: 1,
      },
    ];
    await publishKbTaskConfig('kb-1', items);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/kb/publish`, {
      method: 'post',
      data: { kbId: 'kb-1', items },
      headers,
    });
  });

  it('失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(publishTaskConfig([])).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');
  });
});
