import { downloadMaterial, pageMaterial, type MaterialRecord } from '@/services/material';
import type { CategoryNode } from '@/services/category';
import { toast } from '@/utils/toast';
import type { MaterialDetailTab } from './material-detail-tabs';
import { deriveMixEntryType, normalizeExt, type MixEntryType } from './mix-entry-model';

export const PAGE_SIZE = 10;

export const COMPILE_POLL_MS = 3000;

const TREE_PAGE_SIZE = 200;

const TREE_MAX_PAGES = 5;

export type MaterialTypeKey = 'DOCUMENT' | 'CODE' | 'DATA_TABLE';

export const MATERIAL_TYPE_META: Record<
  MaterialTypeKey,
  { label: string; ready: boolean; hint: string }
> = {
  DOCUMENT: { label: '文档', ready: true, hint: '本地上传与编译链路已接入' },
  CODE: { label: '代码', ready: false, hint: 'Git 仓库接入后续版本开放' },
  DATA_TABLE: { label: '数据表', ready: false, hint: '数据源接入后续版本开放' },
};

export type MaterialFileTone =
  | 'pdf'
  | 'word'
  | 'sheet'
  | 'slides'
  | 'markdown'
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'web'
  | 'code'
  | 'json'
  | 'archive'
  | 'data';

export interface MaterialFileIcon {
  icon: string;
  tone: MaterialFileTone;
}

const FILE_ICON_BY_EXT: Record<string, MaterialFileIcon> = {
  pdf: { icon: 'file-pdf', tone: 'pdf' },
  doc: { icon: 'file-word', tone: 'word' },
  docx: { icon: 'file-word', tone: 'word' },
  rtf: { icon: 'file-word', tone: 'word' },
  odt: { icon: 'file-word', tone: 'word' },
  wps: { icon: 'file-word', tone: 'word' },
  xls: { icon: 'file-sheet', tone: 'sheet' },
  xlsx: { icon: 'file-sheet', tone: 'sheet' },
  xlsm: { icon: 'file-sheet', tone: 'sheet' },
  csv: { icon: 'file-sheet', tone: 'sheet' },
  tsv: { icon: 'file-sheet', tone: 'sheet' },
  ods: { icon: 'file-sheet', tone: 'sheet' },
  ppt: { icon: 'file-slides', tone: 'slides' },
  pptx: { icon: 'file-slides', tone: 'slides' },
  odp: { icon: 'file-slides', tone: 'slides' },
  md: { icon: 'file-text', tone: 'markdown' },
  markdown: { icon: 'file-text', tone: 'markdown' },
  txt: { icon: 'file-text', tone: 'text' },
  log: { icon: 'file-text', tone: 'text' },
  zip: { icon: 'archive', tone: 'archive' },
  rar: { icon: 'archive', tone: 'archive' },
  '7z': { icon: 'archive', tone: 'archive' },
  gz: { icon: 'archive', tone: 'archive' },
  tar: { icon: 'archive', tone: 'archive' },
};

const FILE_ICON_BY_ENTRY_TYPE: Record<MixEntryType, MaterialFileIcon> = {
  document: { icon: 'file-text', tone: 'text' },
  table: { icon: 'file-sheet', tone: 'sheet' },
  image: { icon: 'image', tone: 'image' },
  audio: { icon: 'music', tone: 'audio' },
  video: { icon: 'film', tone: 'video' },
  web: { icon: 'globe', tone: 'web' },
  code: { icon: 'code', tone: 'code' },
  json: { icon: 'braces', tone: 'json' },
};

export function materialFileIcon(
  material: Pick<MaterialRecord, 'materialType'> &
    Partial<Pick<MaterialRecord, 'fileExt' | 'fileName'>>,
): MaterialFileIcon {
  if (material.materialType === 'CODE') {
    return FILE_ICON_BY_ENTRY_TYPE.code;
  }
  const ext =
    normalizeExt(material.fileExt) ||
    normalizeExt(material.fileName?.split('.').pop());
  const byExt = FILE_ICON_BY_EXT[ext];
  if (byExt) {
    return byExt;
  }
  if (material.materialType === 'DATA_TABLE') {
    return { icon: 'database', tone: 'data' };
  }
  return FILE_ICON_BY_ENTRY_TYPE[
    deriveMixEntryType({ materialType: material.materialType, fileExt: ext })
  ];
}

export function collectCategoryIds(nodes: CategoryNode[], ids = new Set<string>()) {
  nodes.forEach((node) => {
    ids.add(node.categoryId);
    if (node.children && node.children.length) {
      collectCategoryIds(node.children, ids);
    }
  });
  return ids;
}

export function countCategoryMaterials(
  nodes: CategoryNode[],
  byCategory: Map<string, MaterialRecord[]>,
  counts: Map<string, number>,
): number {
  let total = 0;
  nodes.forEach((node) => {
    const own = (byCategory.get(node.categoryId) || []).length;
    const childTotal = countCategoryMaterials(node.children || [], byCategory, counts);
    counts.set(node.categoryId, own + childTotal);
    total += own + childTotal;
  });
  return total;
}

export async function loadLibraryMaterials(kbId: string) {
  const records: MaterialRecord[] = [];
  let total = 0;
  for (let current = 1; current <= TREE_MAX_PAGES; current += 1) {
    const result = await pageMaterial({ kbId, current, size: TREE_PAGE_SIZE });
    if (!result) {
      return undefined;
    }
    total = result.total;
    records.push(...result.records);
    if (records.length >= total || !result.records.length) {
      break;
    }
  }
  return { records, total };
}

export async function downloadMaterialFile(
  materialId: string,
  fileName: string,
  versionId?: string,
) {
  try {
    const blob = await downloadMaterial(materialId, versionId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    toast('下载失败', (error as Error).message, 'error');
  }
}

export function findCategory(
  nodes: CategoryNode[],
  categoryId: string,
): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.categoryId === categoryId) {
      return node;
    }
    const child = node.children ? findCategory(node.children, categoryId) : undefined;
    if (child) {
      return child;
    }
  }
  return undefined;
}

export interface MaterialWorkspaceProps {
  kbId: string;
  canManage: boolean;
  canWrite?: boolean;
  canCompile?: boolean;
  materialType?: MaterialTypeKey;
  initialMaterialId?: string;
  initialDetailTab?: MaterialDetailTab | 'compile';
  /** 外部（知识助手）请求上传时递增的计数，变化一次打开一次上传弹窗。 */
  uploadSignal?: number;
  onBatchCreated?: (batchId?: string) => void;
  onDetailClosed?: () => void;
  onOpenConcept?: (conceptId: string) => void;
}
