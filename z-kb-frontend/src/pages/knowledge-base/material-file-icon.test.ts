import { describe, expect, it } from 'vitest';
import { materialFileIcon } from './material-workspace-model';

const doc = (fileExt?: string, fileName?: string) => ({
  materialType: 'DOCUMENT' as const,
  fileExt,
  fileName,
});

describe('materialFileIcon', () => {
  it('按扩展名区分文档图标', () => {
    expect(materialFileIcon(doc('pdf'))).toEqual({ icon: 'file-pdf', tone: 'pdf' });
    expect(materialFileIcon(doc('.docx'))).toEqual({ icon: 'file-word', tone: 'word' });
    expect(materialFileIcon(doc('xlsx'))).toEqual({ icon: 'file-sheet', tone: 'sheet' });
    expect(materialFileIcon(doc('pptx'))).toEqual({ icon: 'file-slides', tone: 'slides' });
    expect(materialFileIcon(doc('md'))).toEqual({ icon: 'file-text', tone: 'markdown' });
    expect(materialFileIcon(doc('zip'))).toEqual({ icon: 'archive', tone: 'archive' });
  });

  it('扩展名缺失时回退到文件名', () => {
    expect(materialFileIcon(doc(undefined, '季度报告.xlsx'))).toEqual({
      icon: 'file-sheet',
      tone: 'sheet',
    });
    expect(materialFileIcon(doc('', '数据.jsonl'))).toEqual({
      icon: 'braces',
      tone: 'json',
    });
  });

  it('代码与数据表按资料类型取图标', () => {
    expect(materialFileIcon({ materialType: 'CODE' })).toEqual({
      icon: 'code',
      tone: 'code',
    });
    expect(materialFileIcon({ materialType: 'DATA_TABLE' })).toEqual({
      icon: 'database',
      tone: 'data',
    });
    expect(materialFileIcon({ materialType: 'DATA_TABLE', fileExt: 'csv' })).toEqual({
      icon: 'file-sheet',
      tone: 'sheet',
    });
  });

  it('未知扩展名回退到文档', () => {
    expect(materialFileIcon(doc('unknown'))).toEqual({
      icon: 'file-text',
      tone: 'text',
    });
    expect(materialFileIcon(doc())).toEqual({ icon: 'file-text', tone: 'text' });
  });
});
