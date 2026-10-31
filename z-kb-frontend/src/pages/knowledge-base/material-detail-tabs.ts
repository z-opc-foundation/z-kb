export type MaterialDetailTab =
  | 'basic'
  | 'versions'
  | 'draft'
  | 'compile'
  | 'compare'
  | 'wiki'
  | 'graph'
  | 'knowledge';

export const MATERIAL_DETAIL_TABS: { key: MaterialDetailTab; label: string }[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'versions', label: '版本' },
  { key: 'draft', label: '原文' },
  { key: 'compile', label: '编译' },
  { key: 'compare', label: '加工对照' },
  { key: 'wiki', label: 'Wiki' },
  { key: 'graph', label: '图谱' },
  { key: 'knowledge', label: '知识点' },
];

/** 深链兼容：未知值回落到基本信息。 */
export function resolveMaterialDetailTab(raw?: string | null): MaterialDetailTab {
  const tab = MATERIAL_DETAIL_TABS.find((item) => item.key === raw);
  return tab ? tab.key : 'basic';
}
