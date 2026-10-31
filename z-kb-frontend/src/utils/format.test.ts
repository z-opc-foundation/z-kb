import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatFileSize, formatShortDateTime } from './format';

describe('format', () => {
  it('空值返回占位符', () => {
    expect(formatDateTime()).toBe('—');
    expect(formatFileSize()).toBe('—');
  });

  it('无法解析的时间原样返回', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
  });

  it('按指定格式输出时间', () => {
    expect(formatDateTime('2026-10-27T09:05:00')).toBe('2026-10-27 09:05');
    expect(formatShortDateTime('2026-10-27T09:05:00')).toBe('10-27 09:05');
    expect(formatDate('2026-10-27T09:05:00')).toBe('2026-10-27');
  });

  it('按单位格式化文件大小', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });
});
