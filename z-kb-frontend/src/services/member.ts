import { request } from '@/services/http';
import { getTenantCode } from '@/utils/tenant';
import { toast } from '@/utils/toast';

export type KnowledgeBaseRole =
  | 'KB_ADMIN'
  | 'EDITOR'
  | 'CONTRIBUTOR'
  | 'REVIEWER'
  | 'READER';

export interface KnowledgeBaseMemberRecord {
  principalId: number;
  principalType: string;
  name?: string;
  employeeId?: string;
  dept?: string;
  role: KnowledgeBaseRole | string;
  owner: boolean;
  grantedBy?: number;
  grantedAt?: string;
  expiresAt?: string;
}

export interface KnowledgeBaseMemberCandidateRecord {
  principalId: number;
  name?: string;
  employeeId?: string;
  dept?: string;
}

export interface KnowledgeBaseEffectiveRecord {
  kbId: string;
  actorId: number;
  role: KnowledgeBaseRole | string;
  owner: boolean;
  canEnter: boolean;
  canManageKb: boolean;
  canManageDoc: boolean;
  canReview: boolean;
  actions: string[];
}

const BASE = '/future-brain/v1/knowledgeBase/member';

const tenantHeaders = () => ({ 'X-Tenant-Code': getTenantCode() });

async function call<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    toast('请求失败', (error as Error).message || '服务器错误', 'error');
    return undefined;
  }
}

export function listMembers(kbId: string) {
  return call(() =>
    request<KnowledgeBaseMemberRecord[]>(`${BASE}/list`, {
      method: 'post',
      data: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export function searchMemberCandidates(kbId: string, keyword?: string) {
  return call(() =>
    request<KnowledgeBaseMemberCandidateRecord[]>(`${BASE}/candidates`, {
      method: 'post',
      data: { kbId, keyword: keyword || '' },
      headers: tenantHeaders(),
    }),
  );
}

export function grantMember(kbId: string, principalId: number, role: string) {
  return call(() =>
    request<KnowledgeBaseMemberRecord>(`${BASE}/grant`, {
      method: 'post',
      data: { kbId, principalId, role },
      headers: tenantHeaders(),
    }),
  );
}

export function revokeMember(kbId: string, principalId: number) {
  return call(() =>
    request<boolean>(`${BASE}/revoke`, {
      method: 'post',
      data: { kbId, principalId },
      headers: tenantHeaders(),
    }),
  );
}

export function getEffectiveAccess(kbId: string) {
  return call(() =>
    request<KnowledgeBaseEffectiveRecord>(`${BASE}/effective`, {
      method: 'get',
      params: { kbId },
      headers: tenantHeaders(),
    }),
  );
}

export const ROLE_META: Record<
  string,
  { label: string; hint: string; tag: 'violet' | 'green' | 'gray' | 'blue' | 'amber' }
> = {
  KB_ADMIN: {
    label: '知识库管理员',
    hint: '设置、成员、内容与审核全量动作',
    tag: 'violet',
  },
  EDITOR: {
    label: '编辑',
    hint: '写物料、发起编译与审核，不改成员与设置',
    tag: 'green',
  },
  CONTRIBUTOR: {
    label: '贡献者',
    hint: '上传与维护物料，不审核、不编译',
    tag: 'blue',
  },
  REVIEWER: {
    label: '审核者',
    hint: '审核内容与读取产物，不写物料',
    tag: 'amber',
  },
  READER: {
    label: '只读',
    hint: '读取与检索，不产生任何写入',
    tag: 'gray',
  },
};

export const ROLE_ORDER: KnowledgeBaseRole[] = [
  'KB_ADMIN',
  'EDITOR',
  'CONTRIBUTOR',
  'REVIEWER',
  'READER',
];

export function roleLabel(role?: string): string {
  if (!role) {
    return '—';
  }
  return ROLE_META[role]?.label || role;
}
