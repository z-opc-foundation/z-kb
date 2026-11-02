import dayjs from 'dayjs';

/** 空值返回 fallback，无法解析的时间原样返回 */
export function formatDateTime(
  value?: string | null,
  pattern = 'YYYY-MM-DD HH:mm',
  fallback = '—',
): string {
  if (!value) {
    return fallback;
  }
  const date = dayjs(value);
  return date.isValid() ? date.format(pattern) : value;
}

export function formatShortDateTime(value?: string | null, fallback = '—'): string {
  return formatDateTime(value, 'MM-DD HH:mm', fallback);
}

export function formatDate(value?: string | null, fallback = '—'): string {
  return formatDateTime(value, 'YYYY-MM-DD', fallback);
}

export function formatFileSize(size?: number): string {
  if (size == null) {
    return '—';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
