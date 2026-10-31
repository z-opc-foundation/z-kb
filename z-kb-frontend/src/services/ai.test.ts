import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import { toast } from '@/utils/toast';
import {
  changeAiToolStatus,
  createAiAgent,
  createAiSkill,
  getAiAgent,
  getAiRuntimeStatus,
  getAiSkillUsage,
  getAiToolUsage,
  interruptAiChat,
  invokeAiTool,
  listAiAgents,
  listAiSkills,
  listAiTools,
  pauseAiAgent,
  publishAiAgent,
  publishAiSkill,
  registerAiTool,
  removeAiAgent,
  removeAiSkill,
  removeAiTool,
  resumeAiAgent,
  streamAiChat,
  updateAiAgent,
  updateAiSkill,
} from './ai';

vi.mock('@/services/http', () => ({ request: vi.fn() }));
vi.mock('@/utils/tenant', () => ({ getTenantCode: vi.fn(() => 'tenant-a') }));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const headers = { 'X-Tenant-Code': 'tenant-a' };

function sseResponse(
  chunks: string[],
  init: { ok?: boolean; status?: number; text?: string } = {},
) {
  let index = 0;
  const encoder = new TextEncoder();
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => init.text ?? '',
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: encoder.encode(chunks[index++]) }
            : { done: true, value: undefined },
      }),
    },
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI 智能体接口', () => {
  it('列表与详情携带查询条件和租户头', async () => {
    const agents = [{ code: 'a1', name: '助手', status: 'draft', statusLabel: '草稿', skillCodes: [], toolCodes: [] }];
    vi.mocked(request).mockResolvedValue(agents as never);

    await expect(listAiAgents({ keyword: '助', status: 'draft' })).resolves.toBe(agents);
    expect(request).toHaveBeenNthCalledWith(1, '/future-brain/v1/ai/agent/list', {
      method: 'get',
      params: { keyword: '助', status: 'draft' },
      headers,
    });

    await getAiAgent('a1');
    expect(request).toHaveBeenNthCalledWith(2, '/future-brain/v1/ai/agent/detail', {
      method: 'get',
      params: { code: 'a1' },
      headers,
    });
  });

  it.each([
    ['createAiAgent', createAiAgent, '/add'],
    ['updateAiAgent', updateAiAgent, '/update'],
  ] as const)('%s 提交完整载荷', async (_name, fn, suffix) => {
    const payload = { code: 'a1', name: '助手', skillCodes: [], toolCodes: [] };
    vi.mocked(request).mockResolvedValue({} as never);
    await fn(payload);
    expect(request).toHaveBeenCalledWith(`/future-brain/v1/ai/agent${suffix}`, {
      method: 'post',
      data: payload,
      headers,
    });
  });

  it.each([
    ['publishAiAgent', publishAiAgent, '/agent/publish'],
    ['pauseAiAgent', pauseAiAgent, '/agent/pause'],
    ['resumeAiAgent', resumeAiAgent, '/agent/resume'],
    ['removeAiAgent', removeAiAgent, '/agent/remove'],
  ] as const)('%s 只提交 code', async (_name, fn, suffix) => {
    vi.mocked(request).mockResolvedValue(true as never);
    await fn('a1');
    expect(request).toHaveBeenCalledWith(`/future-brain/v1/ai${suffix}`, {
      method: 'post',
      data: { code: 'a1' },
      headers,
    });
  });
});

describe('AI 技能与工具接口', () => {
  it('技能列表、写入、发布、删除与使用情况', async () => {
    vi.mocked(request).mockResolvedValue({} as never);

    await listAiSkills();
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/skill/list', {
      method: 'get',
      params: {},
      headers,
    });

    const payload = { code: 's1', name: '技能', toolCodes: ['t1'] };
    await createAiSkill(payload);
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/skill/add', {
      method: 'post',
      data: payload,
      headers,
    });

    await updateAiSkill(payload);
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/skill/update', {
      method: 'post',
      data: payload,
      headers,
    });

    await publishAiSkill('s1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/skill/publish', {
      method: 'post',
      data: { code: 's1' },
      headers,
    });

    await removeAiSkill('s1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/skill/remove', {
      method: 'post',
      data: { code: 's1' },
      headers,
    });

    await getAiSkillUsage('s1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/skill/usedBy', {
      method: 'get',
      params: { code: 's1' },
      headers,
    });
  });

  it('工具列表、注册、状态切换、删除、使用情况与调用', async () => {
    vi.mocked(request).mockResolvedValue({} as never);

    await listAiTools({ status: 'published' });
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/tool/list', {
      method: 'get',
      params: { status: 'published' },
      headers,
    });

    const tool = { code: 't1', name: '检索', risk: 'low', parameters: [] };
    await registerAiTool(tool);
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/tool/register', {
      method: 'post',
      data: tool,
      headers,
    });

    await changeAiToolStatus('t1', 'paused');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/tool/changeStatus', {
      method: 'post',
      data: { code: 't1', status: 'paused' },
      headers,
    });

    await removeAiTool('t1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/tool/remove', {
      method: 'post',
      data: { code: 't1' },
      headers,
    });

    await getAiToolUsage('t1');
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/tool/usedBy', {
      method: 'get',
      params: { code: 't1' },
      headers,
    });

    const invoke = { code: 't1', kbId: 'kb-1', arguments: { q: '你好' } };
    await invokeAiTool(invoke);
    expect(request).toHaveBeenLastCalledWith('/future-brain/v1/ai/tool/invoke', {
      method: 'post',
      data: invoke,
      headers,
    });
  });

  it('中断问答只提交智能体与会话编号', async () => {
    vi.mocked(request).mockResolvedValue(true as never);
    await interruptAiChat('a1', 'c1');
    expect(request).toHaveBeenCalledWith('/future-brain/v1/ai/chat/interrupt', {
      method: 'post',
      data: { agentCode: 'a1', conversationId: 'c1' },
      headers,
    });
  });
});

describe('AI 问答流', () => {
  const payload = {
    agentCode: 'a1',
    conversationId: 'c1',
    userInput: '你好',
    context: { view: 'kb' },
  };

  it('跨块解析 SSE 事件，忽略心跳与非法片段', async () => {
    const onEvent = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          ': keepalive\n\n',
          'data: {"type":"delta","data":{"text":"你',
          '好"},"seq":1}\n\n',
          'data: not-json\n\n',
          'data: {"type":"done","data":null}',
        ]),
      ),
    );

    await streamAiChat(payload, { onEvent }).done;

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, {
      type: 'delta',
      data: { text: '你好' },
      seq: 1,
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, { type: 'done', data: null });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/kapi/future-brain/v1/ai/chat/stream');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'text/event-stream',
      'X-Tenant-Code': 'tenant-a',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('HTTP 失败时优先读取后端 message，否则使用状态码提示', async () => {
    const onError = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        sseResponse([], { ok: false, status: 503, text: '{"message":"模型不可用"}' }),
      ),
    );
    await streamAiChat(payload, { onEvent: vi.fn(), onError }).done;
    expect(onError).toHaveBeenLastCalledWith('模型不可用');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(sseResponse([], { ok: false, status: 502, text: '' })),
    );
    await streamAiChat(payload, { onEvent: vi.fn(), onError }).done;
    expect(onError).toHaveBeenLastCalledWith('问答请求失败（HTTP 502）');
  });

  it('缺少流式响应体时提示浏览器不支持', async () => {
    const onError = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, body: null } as unknown as Response),
    );
    await streamAiChat(payload, { onEvent: vi.fn(), onError }).done;
    expect(onError).toHaveBeenCalledWith('当前浏览器不支持流式响应');
  });

  it('主动中断后不回调错误', async () => {
    const onError = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    const handle = streamAiChat(payload, { onEvent: vi.fn(), onError });
    handle.abort();
    await handle.done;
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('AI 错误处理', () => {
  it('写操作失败时提示并返回 undefined', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('boom'));
    await expect(publishAiAgent('a1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith('请求失败', 'boom', 'error');

    vi.mocked(request).mockRejectedValueOnce('bad');
    await expect(publishAiAgent('a1')).resolves.toBeUndefined();
    expect(toast).toHaveBeenLastCalledWith('请求失败', '服务器错误', 'error');
  });

  it('运行时状态探测失败静默返回 undefined', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      runtime: 'galaxy',
      model: 'gpt',
      realModel: true,
    } as never);
    await expect(getAiRuntimeStatus()).resolves.toEqual({
      runtime: 'galaxy',
      model: 'gpt',
      realModel: true,
    });

    vi.mocked(request).mockRejectedValueOnce(new Error('offline'));
    await expect(getAiRuntimeStatus()).resolves.toBeUndefined();
    expect(toast).not.toHaveBeenCalled();
  });
});
