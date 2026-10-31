import type { StructureStatus } from '@/services/ontology';

export function formatCount(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) {
    return String(value);
  }
  return num.toLocaleString('zh-Hans-CN');
}

export function StructureStatusTag({ status }: { status?: StructureStatus }) {
  if (!status) {
    return <span className="note">-</span>;
  }
  const active = status === 'ACTIVE';
  return (
    <span className={`status ${active ? 'success' : 'neutral'}`}>
      <span className="dot" />
      {active ? '生效' : '已退役'}
    </span>
  );
}

export function SourceTag({ source }: { source?: string }) {
  if (!source) {
    return <span className="note">-</span>;
  }
  const label =
    source === 'DIALOG' ? '对话' : source === 'IMPORT' ? '导入' : '手工';
  return <span className="tag gray sm">{label}</span>;
}

export function LevelTag({ levelCode }: { levelCode?: string }) {
  if (!levelCode) {
    return <span className="note">-</span>;
  }
  return <span className="tag blue sm">{levelCode}</span>;
}
