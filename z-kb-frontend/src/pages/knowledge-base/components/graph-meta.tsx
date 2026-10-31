export const NODE_TYPE_LABEL: Record<string, string> = {
  DISEASE: '疾病',
  SYMPTOM: '症状',
  DRUG: '药物',
  EXAM: '检查',
  TREATMENT: '治疗',
  OPERATION: '手术',
  DEPARTMENT: '科室',
  ORGANIZATION: '机构',
  PERSON: '人物',
  TERM: '术语',
  CONCEPT: '概念',
  QUESTION: '问句',
  FAQ: 'FAQ',
  MATERIAL: '资料',
  WIKI: 'Wiki',
};

export function nodeTypeLabel(nodeType: string): string {
  return NODE_TYPE_LABEL[nodeType] || nodeType || '图谱节点';
}

export function formatEvidence(evidence?: string | null): string {
  if (!evidence) return '—';
  try {
    const parsed = JSON.parse(evidence) as Record<string, unknown> | null;
    if (parsed && typeof parsed === 'object' && typeof parsed.chunk === 'number') {
      return `块 ${parsed.chunk}`;
    }
  } catch {
    // 非 JSON 证据按原文展示
  }
  return evidence.length > 24 ? `${evidence.slice(0, 24)}…` : evidence;
}

interface EvidenceTagProps {
  evidence?: string | null;
}

export function EvidenceTag({ evidence }: EvidenceTagProps) {
  return (
    <span className="tag gray mono" title={evidence || undefined}>
      证据 {formatEvidence(evidence)}
    </span>
  );
}
