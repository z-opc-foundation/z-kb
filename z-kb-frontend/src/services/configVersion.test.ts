import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  CONFIG_FIELDS,
  discardConfigDraft,
  getKnowledgeBaseConfig,
  publishConfig,
  saveConfigDraft,
  submitFullRebuild,
  validateConfigDraft,
} from './configVersion';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };
const BASE = '/future-brain/v1/knowledgeBase';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(request).mockResolvedValue({} as never);
});

describe('知识库配置版本接口', () => {
  it('读取当前配置', async () => {
    await getKnowledgeBaseConfig('kb-1');
    expect(request).toHaveBeenCalledWith(`${BASE}/queryConfig`, {
      method: 'get',
      params: { kbId: 'kb-1' },
      headers,
    });
  });

  it('保存草稿携带完整策略与超时', async () => {
    const payload = {
      kbId: 'kb-1',
      presetVersion: 'v1',
      parserPolicy: 'p',
      chunkingPolicy: 'c',
      extractionPolicy: 'e',
      wikiPolicy: 'w',
      graphPolicy: 'g',
      reviewPolicy: 'r',
      freshnessPolicy: 'f',
      retrievalPolicy: 'ret',
      remark: '备注',
    };
    await saveConfigDraft(payload);
    expect(request).toHaveBeenLastCalledWith(`${BASE}/saveConfigDraft`, {
      method: 'post',
      data: payload,
      headers,
      timeout: 60_000,
    });
  });

  it('丢弃草稿与校验只传知识库', async () => {
    await discardConfigDraft('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/discardConfigDraft`, {
      method: 'post',
      data: { kbId: 'kb-1' },
      headers,
    });

    await validateConfigDraft('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/validateConfigDraft`, {
      method: 'post',
      data: { kbId: 'kb-1' },
      headers,
    });
  });

  it('发布与全量重建带确认标记', async () => {
    await publishConfig('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/publishConfig`, {
      method: 'post',
      data: { kbId: 'kb-1', confirm: true, remark: undefined },
      headers,
      timeout: 60_000,
    });

    await publishConfig('kb-1', '发版');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/publishConfig`, {
      method: 'post',
      data: { kbId: 'kb-1', confirm: true, remark: '发版' },
      headers,
      timeout: 60_000,
    });

    await submitFullRebuild('kb-1');
    expect(request).toHaveBeenLastCalledWith(`${BASE}/submitRebuild`, {
      method: 'post',
      data: { kbId: 'kb-1', confirm: true },
      headers,
      timeout: 180_000,
    });
  });

  it('失败时提示操作失败并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('策略非法'));
    await expect(publishConfig('kb-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('操作失败', '策略非法', 'error');

    vi.mocked(request).mockRejectedValueOnce('bad');
    await expect(getKnowledgeBaseConfig('kb-1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenLastCalledWith('操作失败', '请求失败', 'error');
  });

  it('配置字段覆盖各影响范围', () => {
    expect(CONFIG_FIELDS).toHaveLength(9);
    expect(CONFIG_FIELDS.filter((field) => field.scope === 'FULL').map((field) => field.key)).toEqual([
      'presetVersion',
      'parserPolicy',
      'chunkingPolicy',
    ]);
    expect(CONFIG_FIELDS.every((field) => field.label && field.hint)).toBe(true);
  });
});
