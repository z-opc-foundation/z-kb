import type { KnowledgeBaseType } from '@/services/knowledgeBase';

export const TYPE_META: Record<KnowledgeBaseType, { label: string; icon: string }> = {
  FILE: { label: '文件库', icon: 'file-text' },
  MIX: { label: '混合库', icon: 'layers' },
  YUQUE: { label: '语雀库', icon: 'book' },
  CODE: { label: '代码库', icon: 'code' },
  DATABASE: { label: '数据库', icon: 'database' },
};

export interface KbStatusMeta {
  label: string;
  kind: string;
  tag: string;
}

export function typeMeta(type: KnowledgeBaseType) {
  return TYPE_META[type] || TYPE_META.FILE;
}

export function statusMeta(status: string): KbStatusMeta {
  if (status === 'ACTIVE') {
    return { label: '运行中', kind: 'success', tag: 'green' };
  }
  if (status === 'ARCHIVED') {
    return { label: '已归档', kind: 'neutral', tag: 'gray' };
  }
  if (status === 'DELETING') {
    return { label: '删除中', kind: 'danger', tag: 'red' };
  }
  return { label: status || '未知', kind: 'neutral', tag: 'gray' };
}
