import { describe, expect, it } from 'vitest';
import { resolvePreviewKind } from './material-preview-kind';

describe('resolvePreviewKind', () => {
  it('按常见办公格式分流到对应渲染器', () => {
    expect(resolvePreviewKind('pdf')).toBe('pdf');
    expect(resolvePreviewKind('DOCX')).toBe('docx');
    expect(resolvePreviewKind('xlsx')).toBe('sheet');
    expect(resolvePreviewKind('csv')).toBe('sheet');
    expect(resolvePreviewKind('pptx')).toBe('pptx');
    expect(resolvePreviewKind('PNG')).toBe('image');
    expect(resolvePreviewKind('.md')).toBe('markdown');
    expect(resolvePreviewKind('java')).toBe('text');
  });

  it('旧版 .doc 单列一类，其余老格式与未知格式走下载兜底', () => {
    expect(resolvePreviewKind('doc')).toBe('doc');
    expect(resolvePreviewKind('.DOC')).toBe('doc');
    expect(resolvePreviewKind('ppt')).toBe('unsupported');
    expect(resolvePreviewKind('zip')).toBe('unsupported');
    expect(resolvePreviewKind(undefined)).toBe('unsupported');
    expect(resolvePreviewKind('')).toBe('unsupported');
  });
});
