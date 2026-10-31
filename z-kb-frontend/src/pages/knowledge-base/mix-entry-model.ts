import type { CategoryNode } from '@/services/category';
import type { MaterialRecord } from '@/services/material';

export type MixEntryType =
  | 'document'
  | 'table'
  | 'image'
  | 'audio'
  | 'video'
  | 'web'
  | 'code'
  | 'json';

export interface MixEntryTypeMeta {
  label: string;
  icon: string;
}

export const MIX_ENTRY_TYPES: MixEntryType[] = [
  'document',
  'table',
  'image',
  'audio',
  'video',
  'web',
  'code',
  'json',
];

export const MIX_ENTRY_TYPE_META: Record<MixEntryType, MixEntryTypeMeta> = {
  document: { label: '文档', icon: 'file-text' },
  table: { label: '表格', icon: 'table' },
  image: { label: '图片', icon: 'image' },
  audio: { label: '音频', icon: 'music' },
  video: { label: '视频', icon: 'film' },
  web: { label: '网页', icon: 'globe' },
  code: { label: '代码', icon: 'code' },
  json: { label: '接口数据', icon: 'braces' },
};

export type MixEntryState = 'parsed' | 'parsing' | 'queued' | 'failed';

export const MIX_ENTRY_STATE_META: Record<
  MixEntryState,
  { label: string; tag: string }
> = {
  parsed: { label: '已解析', tag: 'green' },
  parsing: { label: '解析中', tag: 'blue' },
  queued: { label: '待解析', tag: 'gray' },
  failed: { label: '解析失败', tag: 'red' },
};

export interface MixEntry {
  material: MaterialRecord;
  type: MixEntryType;
}

export interface MixTreeNode {
  category: CategoryNode;
  children: MixTreeNode[];
  entries: MixEntry[];
  count: number;
  depth: number;
}

export interface MixTreeModel {
  roots: MixTreeNode[];
  unclassified: MixEntry[];
  folderCount: number;
}

const ENTRY_TYPE_LOOKUP: Record<string, MixEntryType> = {
  document: 'document',
  table: 'table',
  image: 'image',
  audio: 'audio',
  video: 'video',
  web: 'web',
  code: 'code',
  json: 'json',
};

const EXT_TYPE_MAP: Record<string, MixEntryType> = {
  xlsx: 'table',
  xls: 'table',
  xlsm: 'table',
  csv: 'table',
  tsv: 'table',
  ods: 'table',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  tif: 'image',
  tiff: 'image',
  ico: 'image',
  heic: 'image',
  avif: 'image',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  aac: 'audio',
  flac: 'audio',
  ogg: 'audio',
  wma: 'audio',
  amr: 'audio',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  webm: 'video',
  flv: 'video',
  wmv: 'video',
  m4v: 'video',
  html: 'web',
  htm: 'web',
  mhtml: 'web',
  mht: 'web',
  json: 'json',
  jsonl: 'json',
  ndjson: 'json',
  py: 'code',
  java: 'code',
  js: 'code',
  jsx: 'code',
  ts: 'code',
  tsx: 'code',
  go: 'code',
  rs: 'code',
  c: 'code',
  h: 'code',
  cpp: 'code',
  hpp: 'code',
  cs: 'code',
  rb: 'code',
  php: 'code',
  sh: 'code',
  bash: 'code',
  sql: 'code',
  yaml: 'code',
  yml: 'code',
  xml: 'code',
  toml: 'code',
  kt: 'code',
  swift: 'code',
  scala: 'code',
  lua: 'code',
  css: 'code',
  scss: 'code',
  less: 'code',
  vue: 'code',
  svelte: 'code',
};

export function normalizeExt(fileExt?: string): string {
  return (fileExt || '').toLowerCase().replace(/^\./, '');
}

export function deriveMixEntryType(
  material: Pick<MaterialRecord, 'materialType'> &
    Partial<Pick<MaterialRecord, 'fileExt' | 'entryType'>>,
): MixEntryType {
  const backendType = ENTRY_TYPE_LOOKUP[(material.entryType || '').toLowerCase()];
  if (backendType) {
    return backendType;
  }
  if (material.materialType === 'CODE') {
    return 'code';
  }
  if (material.materialType === 'DATA_TABLE') {
    return 'table';
  }
  return EXT_TYPE_MAP[normalizeExt(material.fileExt)] || 'document';
}

export function deriveMixEntryState(parseStatus?: string): MixEntryState {
  if (parseStatus === 'READY') {
    return 'parsed';
  }
  if (parseStatus === 'PARSING') {
    return 'parsing';
  }
  if (parseStatus === 'FAILED') {
    return 'failed';
  }
  return 'queued';
}

function sortFolders(nodes: CategoryNode[]): CategoryNode[] {
  return nodes
    .slice()
    .sort(
      (a, b) =>
        (a.sortNo ?? 0) - (b.sortNo ?? 0) || a.name.localeCompare(b.name),
    );
}

function sortEntries(entries: MixEntry[]): MixEntry[] {
  return entries
    .slice()
    .sort((a, b) =>
      a.material.title.localeCompare(b.material.title, 'zh-Hans-CN'),
    );
}

export function buildMixTree(
  categories: CategoryNode[],
  entries: MixEntry[],
): MixTreeModel {
  const known = new Set<string>();
  const collectIds = (nodes: CategoryNode[]) => {
    nodes.forEach((node) => {
      known.add(node.categoryId);
      if (node.children?.length) {
        collectIds(node.children);
      }
    });
  };
  collectIds(categories);

  const byCategory = new Map<string, MixEntry[]>();
  entries.forEach((entry) => {
    const categoryId = entry.material.categoryId;
    const key = categoryId && known.has(categoryId) ? categoryId : '';
    const list = byCategory.get(key) || [];
    list.push(entry);
    byCategory.set(key, list);
  });

  const buildNode = (category: CategoryNode, depth: number): MixTreeNode => {
    const children = sortFolders(category.children || []).map((child) =>
      buildNode(child, depth + 1),
    );
    const own = sortEntries(byCategory.get(category.categoryId) || []);
    const count =
      own.length + children.reduce((sum, child) => sum + child.count, 0);
    return { category, children, entries: own, count, depth };
  };

  const roots = sortFolders(categories).map((category) =>
    buildNode(category, 0),
  );

  return {
    roots,
    unclassified: sortEntries(byCategory.get('') || []),
    folderCount: known.size,
  };
}

export function flattenMixTree(
  node: MixTreeNode,
): { node: MixTreeNode; depth: number }[] {
  const rows: { node: MixTreeNode; depth: number }[] = [
    { node, depth: node.depth },
  ];
  node.children.forEach((child) => {
    rows.push(...flattenMixTree(child));
  });
  return rows;
}

export function findMixTreeNode(
  roots: MixTreeNode[],
  folderId: string,
): MixTreeNode | undefined {
  for (const node of roots) {
    if (node.category.categoryId === folderId) {
      return node;
    }
    const found = findMixTreeNode(node.children, folderId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function mixFolderPath(
  model: MixTreeModel,
  folderId?: string | null,
): string[] {
  if (!folderId) {
    return [];
  }
  const walk = (nodes: MixTreeNode[], trail: string[]): string[] | null => {
    for (const node of nodes) {
      const next = [...trail, node.category.name];
      if (node.category.categoryId === folderId) {
        return next;
      }
      const found = walk(node.children, next);
      if (found) {
        return found;
      }
    }
    return null;
  };
  return walk(model.roots, []) || [];
}

export function collectMixEntries(node: MixTreeNode): MixEntry[] {
  return [
    ...node.entries,
    ...node.children.flatMap((child) => collectMixEntries(child)),
  ];
}
