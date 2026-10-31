import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type AiStatus = 'draft' | 'published' | 'paused';

export interface AiRuntimeStatus {
  runtime: string;
  model: string;
  realModel: boolean;
  /** 知识库页「问 AI」使用的智能体编码；远端运行时会换成它自己的命名。 */
  qaAgentCode?: string;
}

export interface AiAgentRecord {
  code: string;
  name: string;
  description?: string;
  status: AiStatus;
  statusLabel: string;
  version?: number;
  publishedVersion?: number | null;
  systemPrompt?: string;
  llmCode?: string;
  kbId?: string;
  skillCodes: string[];
  toolCodes: string[];
  createTime?: string;
  updateTime?: string;
}

export interface AiSkillRecord {
  code: string;
  name: string;
  description?: string;
  status: AiStatus;
  statusLabel: string;
  version?: number;
  publishedVersion?: number | null;
  prompt?: string;
  toolCodes: string[];
  createTime?: string;
  updateTime?: string;
}

export interface AiToolParameter {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

export interface AiToolRecord {
  code: string;
  name: string;
  description?: string;
  kind?: string;
  risk?: string;
  riskLabel?: string;
  status: AiStatus;
  statusLabel: string;
  provider?: string;
  executable?: boolean;
  parameters: AiToolParameter[];
  createTime?: string;
  updateTime?: string;
}

export interface AiUsageRecord {
  agentCodes: string[];
  skillCodes: string[];
  empty: boolean;
}

export interface AiToolInvokeResult {
  success: boolean;
  content: string;
  details: Record<string, unknown>;
}

export interface AiAgentSavePayload {
  code: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  kbId?: string;
  skillCodes: string[];
  toolCodes: string[];
}

export interface AiSkillSavePayload {
  code: string;
  name: string;
  description?: string;
  prompt?: string;
  toolCodes: string[];
}

export interface AiToolRegisterPayload {
  code: string;
  name: string;
  description?: string;
  risk: string;
  parameters: AiToolParameter[];
}

export interface AiToolInvokePayload {
  code: string;
  kbId?: string;
  arguments: Record<string, unknown>;
}

export interface AiChatStreamPayload {
  agentCode: string;
  conversationId?: string;
  kbId?: string;
  userInput: string;
  /** 页面上下文（当前视图、选中资料等），后端并入提示词变量。 */
  context?: Record<string, string>;
}

export interface AiChatEvent {
  type: string;
  data: unknown;
  seq?: number;
  messageId?: string;
}

const BASE = '/future-brain/v1/ai';

const tenantHeaders = () => ({
  'X-Tenant-Code': getTenantCode(),
});

async function call<T>(
  run: () => Promise<T>,
  successMessage?: string,
): Promise<T | undefined> {
  try {
    const result = await run();
    if (successMessage) {
      toast(successMessage, '', 'success');
    }
    return result;
  } catch (error) {
    toast(
      '请求失败',
      error instanceof Error ? error.message : '服务器错误',
      'error',
    );
    return undefined;
  }
}

/* ---------- 智能体 ---------- */

export function listAiAgents(params: { keyword?: string; status?: string } = {}) {
  return call(() =>
    request<AiAgentRecord[]>(`${BASE}/agent/list`, {
      method: 'get',
      params,
      headers: tenantHeaders(),
    }),
  );
}

export function getAiAgent(code: string) {
  return call(() =>
    request<AiAgentRecord>(`${BASE}/agent/detail`, {
      method: 'get',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function createAiAgent(data: AiAgentSavePayload) {
  return call(() =>
    request<AiAgentRecord>(`${BASE}/agent/add`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function updateAiAgent(data: AiAgentSavePayload) {
  return call(() =>
    request<AiAgentRecord>(`${BASE}/agent/update`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function publishAiAgent(code: string) {
  return call(() =>
    request<AiAgentRecord>(`${BASE}/agent/publish`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function pauseAiAgent(code: string) {
  return call(() =>
    request<AiAgentRecord>(`${BASE}/agent/pause`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function resumeAiAgent(code: string) {
  return call(() =>
    request<AiAgentRecord>(`${BASE}/agent/resume`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function removeAiAgent(code: string) {
  return call(() =>
    request<boolean>(`${BASE}/agent/remove`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

/* ---------- 技能 ---------- */

export function listAiSkills(params: { keyword?: string; status?: string } = {}) {
  return call(() =>
    request<AiSkillRecord[]>(`${BASE}/skill/list`, {
      method: 'get',
      params,
      headers: tenantHeaders(),
    }),
  );
}

export function createAiSkill(data: AiSkillSavePayload) {
  return call(() =>
    request<AiSkillRecord>(`${BASE}/skill/add`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function updateAiSkill(data: AiSkillSavePayload) {
  return call(() =>
    request<AiSkillRecord>(`${BASE}/skill/update`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function publishAiSkill(code: string) {
  return call(() =>
    request<AiSkillRecord>(`${BASE}/skill/publish`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function removeAiSkill(code: string) {
  return call(() =>
    request<boolean>(`${BASE}/skill/remove`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function getAiSkillUsage(code: string) {
  return call(() =>
    request<AiUsageRecord>(`${BASE}/skill/usedBy`, {
      method: 'get',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

/* ---------- 工具 ---------- */

export function listAiTools(params: { keyword?: string; status?: string } = {}) {
  return call(() =>
    request<AiToolRecord[]>(`${BASE}/tool/list`, {
      method: 'get',
      params,
      headers: tenantHeaders(),
    }),
  );
}

export function registerAiTool(data: AiToolRegisterPayload) {
  return call(() =>
    request<AiToolRecord>(`${BASE}/tool/register`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

export function changeAiToolStatus(code: string, status: 'published' | 'paused') {
  return call(() =>
    request<AiToolRecord>(`${BASE}/tool/changeStatus`, {
      method: 'post',
      data: { code, status },
      headers: tenantHeaders(),
    }),
  );
}

export function removeAiTool(code: string) {
  return call(() =>
    request<boolean>(`${BASE}/tool/remove`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function getAiToolUsage(code: string) {
  return call(() =>
    request<AiUsageRecord>(`${BASE}/tool/usedBy`, {
      method: 'get',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function invokeAiTool(data: AiToolInvokePayload) {
  return call(() =>
    request<AiToolInvokeResult>(`${BASE}/tool/invoke`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

/* ---------- 问答（SSE） ---------- */

export interface AiChatStreamCallbacks {
  onEvent: (event: AiChatEvent) => void;
  onError?: (message: string) => void;
}

export interface AiChatStreamHandle {
  abort: () => void;
  done: Promise<void>;
}

/** 解析单个 SSE 事件块，拼接多行 data: 为完整 JSON 文本；本体建模对话流也复用。 */
export function parseSseBlock(block: string): string {
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith(':') || !line.startsWith('data:')) {
      continue;
    }
    dataLines.push(line.slice(5).replace(/^\s/, ''));
  }
  return dataLines.join('\n');
}

function toMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : '问答执行失败';
}

/**
 * POST + SSE。直接使用 fetch 读取流，避免 axios 把响应整体缓冲。
 * 断流通过 AbortController；服务端会在连接关闭后尽力中断当前轮次。
 */
export function streamAiChat(
  payload: AiChatStreamPayload,
  callbacks: AiChatStreamCallbacks,
): AiChatStreamHandle {
  const controller = new AbortController();

  const done = (async () => {
    try {
      const response = await fetch(`/kapi${BASE}/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'text/event-stream',
          ...tenantHeaders(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `问答请求失败（HTTP ${response.status}）`;
        try {
          const text = await response.text();
          if (text) {
            const body = JSON.parse(text) as { message?: string };
            if (body.message) {
              message = body.message;
            }
          }
        } catch {
          // 保留默认提示
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error('当前浏览器不支持流式响应');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      const dispatch = (block: string) => {
        const raw = parseSseBlock(block);
        if (!raw) {
          return;
        }
        try {
          callbacks.onEvent(JSON.parse(raw) as AiChatEvent);
        } catch {
          // 忽略不可解析的心跳片段
        }
      };

      while (true) {
        const { done: finished, value } = await reader.read();
        if (finished) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let index = buffer.search(/\r?\n\r?\n/);
        while (index >= 0) {
          const block = buffer.slice(0, index);
          const boundary = buffer.slice(index).match(/^\r?\n\r?\n/);
          buffer = buffer.slice(index + (boundary ? boundary[0].length : 2));
          dispatch(block);
          index = buffer.search(/\r?\n\r?\n/);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        dispatch(buffer);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      callbacks.onError?.(toMessage(error));
    }
  })();

  return {
    abort: () => controller.abort(),
    done,
  };
}

export function interruptAiChat(agentCode: string, conversationId: string) {
  return call(() =>
    request<boolean>(`${BASE}/chat/interrupt`, {
      method: 'post',
      data: { agentCode, conversationId },
      headers: tenantHeaders(),
    }),
  );
}

/* ---------- 运行时状态 ---------- */

/** 状态探测失败不弹 toast，页面按“未知”展示。 */
export async function getAiRuntimeStatus(): Promise<AiRuntimeStatus | undefined> {
  try {
    return await request<AiRuntimeStatus>(`${BASE}/status`, {
      method: 'get',
      headers: tenantHeaders(),
    });
  } catch {
    return undefined;
  }
}
