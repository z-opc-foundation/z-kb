export type PreviewKind =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'sheet'
  | 'pptx'
  | 'image'
  | 'markdown'
  | 'text'
  | 'unsupported';

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico']);
const SHEET_EXT = new Set(['xlsx', 'xls', 'csv']);
const TEXT_EXT = new Set([
  'txt', 'log', 'json', 'yml', 'yaml', 'xml', 'html', 'htm', 'css', 'scss', 'less',
  'js', 'jsx', 'ts', 'tsx', 'java', 'kt', 'py', 'go', 'rs', 'c', 'h', 'cpp', 'sh',
  'sql', 'ini', 'conf', 'properties', 'toml', 'rst',
]);

/** 按扩展名决定用哪个原件渲染器；不认识的走下载兜底。 */
export function resolvePreviewKind(fileExt?: string | null): PreviewKind {
  const ext = (fileExt || '').trim().toLowerCase().replace(/^\./, '');
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (ext === 'docx') {
    return 'docx';
  }
  // 旧版 .doc 是 OLE2 二进制，docx-preview 读不了，只能退化为解析文本
  if (ext === 'doc') {
    return 'doc';
  }
  if (SHEET_EXT.has(ext)) {
    return 'sheet';
  }
  if (ext === 'pptx') {
    return 'pptx';
  }
  if (IMAGE_EXT.has(ext)) {
    return 'image';
  }
  if (ext === 'md' || ext === 'markdown') {
    return 'markdown';
  }
  if (TEXT_EXT.has(ext)) {
    return 'text';
  }
  return 'unsupported';
}

export const PREVIEW_KIND_LABEL: Record<PreviewKind, string> = {
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word（旧版）',
  sheet: '表格',
  pptx: '演示文稿',
  image: '图片',
  markdown: 'Markdown',
  text: '文本',
  unsupported: '文件',
};
