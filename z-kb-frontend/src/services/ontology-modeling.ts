import { parseSseBlock, type AiChatEvent } from '@/services/ai';
import { request } from '@/services/http';
import type { PageResult } from '@/services/knowledgeBase';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

/** 业务场景：1-本体建模 2-数据同步 */
export const BIZ_TYPE_MODELING = 1;

/** 中台本体建模智能体编码（注册于 AI 智能管理） */
export const ONTOLOGY_MODELING_AGENT_CODE = 'ontology_modeler';

/* ---------- 会话 ---------- */

export interface AgentSessionRecord {
  code: string;
  ontologyCode: string;
  conversationId: string;
  agentCode: string;
  conversationName?: string;
  bizType: number;
  status: number;
  lastMessageTime?: string;
  createTime?: string;
}

export interface AgentSessionPageQuery {
  ontologyCode: string;
  bizType?: number;
  current: number;
  size: number;
}

export function pageAgentSessions(data: AgentSessionPageQuery) {
  return call(() =>
    request<PageResult<AgentSessionRecord>>(`${BASE}/agent/session/page`, {
      method: 'post',
      data,
      headers: tenantHeaders(),
    }),
  );
}

/* ---------- 对话（SSE） ---------- */

export interface OntologyChatStreamPayload {
  agentCode: string;
  conversationId?: string;
  ontologyCode: string;
  bizType: number;
  userInput: string;
}

export interface OntologyChatStreamCallbacks {
  onEvent: (event: AiChatEvent) => void;
  onError?: (message: string) => void;
}

export interface OntologyChatStreamHandle {
  abort: () => void;
  done: Promise<void>;
}

/** POST + SSE 透传 galaxy-ai 事件流（meta/token/thought/tool_call/tool_result/done/error）。 */
export function streamOntologyAgentChat(
  payload: OntologyChatStreamPayload,
  callbacks: OntologyChatStreamCallbacks,
): OntologyChatStreamHandle {
  const controller = new AbortController();

  const done = (async () => {
    try {
      const response = await fetch(`/kapi${BASE}/agent/chat/stream`, {
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
        let message = `对话请求失败（HTTP ${response.status}）`;
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
      callbacks.onError?.(
        error instanceof Error && error.message ? error.message : '对话执行失败',
      );
    }
  })();

  return { abort: () => controller.abort(), done };
}

export function interruptOntologyAgentChat(agentCode: string, conversationId: string) {
  return call(() =>
    request<boolean>(`${BASE}/agent/chat/interrupt`, {
      method: 'post',
      data: { agentCode, conversationId },
      headers: tenantHeaders(),
    }),
  );
}

/* ---------- 提案 ---------- */

/** 提案状态：1-待提交 2-已提交 3-已驳回 */
export type ProposalStatus = 1 | 2 | 3;

/** 提案类型：1-结构 2-数据 */
export type ProposalType = 1 | 2;

export interface ProposalRecord {
  code: string;
  ontologyCode?: string;
  proposalType: ProposalType;
  title: string;
  sourceType?: string;
  conversationId?: string;
  storageFile?: string;
  contentHash?: string;
  rowCount?: number;
  summaryJson?: string;
  status: ProposalStatus;
  orderCode?: string;
  rejectReason?: string;
  submittedAt?: string;
  createTime?: string;
}

export interface ProposalPageQuery {
  current?: number;
  size?: number;
  proposalType?: number;
  status?: number;
}

export interface ProposalFreezeResult {
  proposalCode: string;
  orderCode: string;
  orderNo?: string;
  itemCount: number;
  restrictedReasons: string[];
}

export function pageProposals(params: ProposalPageQuery) {
  return call(() =>
    request<PageResult<ProposalRecord>>(`${BASE}/proposal/page`, {
      method: 'get',
      params,
      headers: tenantHeaders(),
    }),
  );
}

export function getProposalDetail(code: string) {
  return call(() =>
    request<ProposalRecord>(`${BASE}/proposal/detail`, {
      method: 'get',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function rejectProposal(code: string, reason: string) {
  return call(() =>
    request<void>(`${BASE}/proposal/reject`, {
      method: 'post',
      data: { code, reason },
      headers: tenantHeaders(),
    }),
  );
}

/** 冻结提交：校验通过后编译为工单（restrictedReasons 非空表示被阻断）。 */
export function submitProposal(code: string) {
  return call(() =>
    request<ProposalFreezeResult>(`${BASE}/proposal/submit`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

/* ---------- 工单 ---------- */

/** 工单状态：1-待审批 2-已驳回 3-已审批 4-执行中 5-已生效 6-生效有失败 7-执行失败 */
export type OrderStatus = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ChangeOrderRecord {
  code: string;
  orderNo?: string;
  ontologyCode?: string;
  orderType: 1 | 2;
  title?: string;
  status: OrderStatus;
  sourceType?: string;
  sourceRef?: string;
  itemCount?: number;
  failedItemCount?: number;
  submitterId?: string;
  approverId?: string;
  approveTime?: string;
  rejectReason?: string;
  effectiveTime?: string;
  scopeId?: string;
  schemaVersionBefore?: number;
  schemaVersionAfter?: number;
  createTime?: string;
}

export interface ChangeItemRecord {
  code: string;
  orderCode?: string;
  seqNo?: number;
  itemType?: string;
  targetType?: string;
  targetName?: string;
  beforeJson?: string;
  afterJson?: string;
  compatLevel?: string;
  compatReason?: string;
  status?: number;
  attemptCount?: number;
  errorMsg?: string;
}

export interface OrderDetail {
  order: ChangeOrderRecord;
  items: ChangeItemRecord[];
}

export interface OrderTaskNode {
  nodeCode?: string;
  nodeRole?: string;
  handlerType?: string;
  runStatus?: string;
  attempts?: number;
  maxAttempts?: number;
  targetId?: string;
  startedAt?: string;
  finishedAt?: string;
  failureSummary?: string;
}

export interface OrderTaskProgress {
  scopeId?: string;
  orderCode?: string;
  runStatus?: string;
  currentRoundNo?: number;
  totalCount?: number;
  successCount?: number;
  failedCount?: number;
  startedAt?: string;
  finishedAt?: string;
  failureSummary?: string;
  nodes?: OrderTaskNode[];
}

export interface OrderPageQuery {
  current?: number;
  size?: number;
  orderType?: number;
  status?: number;
}

export function pageOrders(params: OrderPageQuery) {
  return call(() =>
    request<PageResult<ChangeOrderRecord>>(`${BASE}/order/page`, {
      method: 'get',
      params,
      headers: tenantHeaders(),
    }),
  );
}

export function getOrderDetail(code: string) {
  return call(() =>
    request<OrderDetail>(`${BASE}/order/detail`, {
      method: 'get',
      params: { code },
      headers: tenantHeaders(),
    }),
  );
}

/** 审批通过：通过即自动下发执行任务。 */
export function approveOrder(code: string) {
  return call(() =>
    request<void>(`${BASE}/order/approve`, {
      method: 'post',
      data: { code },
      headers: tenantHeaders(),
    }),
  );
}

export function rejectOrder(code: string, reason: string) {
  return call(() =>
    request<void>(`${BASE}/order/reject`, {
      method: 'post',
      data: { code, reason },
      headers: tenantHeaders(),
    }),
  );
}

/** 失败项重试（仅生效有失败状态），不重新审批。 */
export function retryOrderItem(itemCode: string) {
  return call(() =>
    request<void>(`${BASE}/order/retryItem`, {
      method: 'post',
      data: { itemCode },
      headers: tenantHeaders(),
    }),
  );
}

export function getOrderTaskProgress(code: string) {
  return call(
    () =>
      request<OrderTaskProgress>(`${BASE}/order/task/progress`, {
        method: 'get',
        params: { code },
        headers: tenantHeaders(),
      }),
    { silent: true },
  );
}

/* ---------- 状态文案 ---------- */

export function proposalStatusLabel(status: number): string {
  return { 1: '待提交', 2: '已提交', 3: '已驳回' }[status] || `状态${status}`;
}

export function orderStatusLabel(status: number): string {
  return (
    {
      1: '待审批',
      2: '已驳回',
      3: '已审批',
      4: '执行中',
      5: '已生效',
      6: '生效有失败',
      7: '执行失败',
    }[status] || `状态${status}`
  );
}

export function proposalTypeLabel(type: number): string {
  return { 1: '结构', 2: '数据' }[type] || `类型${type}`;
}

const BASE = '/future-brain/v1/ontology';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

/** silent 为 true 时不弹全局错误提示，供 3 秒轮询等高频调用使用。 */
async function call<T>(
  run: () => Promise<T>,
  options?: { silent?: boolean },
): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    if (!options?.silent) {
      toast('请求失败', (error as Error).message || '服务器错误', 'error');
    }
    return undefined;
  }
}
