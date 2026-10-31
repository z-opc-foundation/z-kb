/**
 * 轻提示。使用 global.css 中的 .toast-root / .toast 样式，
 * 不引入 antd message，避免两套视觉并存。
 */
export type ToastKind = 'success' | 'error' | 'warn' | 'info';

const ICON_PATHS: Record<ToastKind, string> = {
  success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  error:
    '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
};

function escape(value: string): string {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[char];
  });
}

function iconSvg(kind: ToastKind): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[kind]}</svg>`;
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    document.body.appendChild(root);
  }
  return root;
}

export function toast(
  title: string,
  message?: string,
  kind: ToastKind = 'success',
): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = ensureRoot();
  const textKey = `${kind}|${title}|${message || ''}`;
  const existing = Array.prototype.find.call(
    root.children,
    (node: HTMLElement) =>
      node.dataset.key === textKey && !node.classList.contains('out'),
  ) as HTMLElement | undefined;
  if (existing) {
    return;
  }
  while (root.children.length >= 3) {
    root.removeChild(root.children[0]);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.dataset.key = textKey;
  el.innerHTML = `<div class="t-icon">${iconSvg(
    kind,
  )}</div><div class="t-copy"><b>${escape(title)}</b>${
    message ? `<small>${escape(message)}</small>` : ''
  }</div>`;
  root.appendChild(el);
  window.setTimeout(() => {
    el.classList.add('out');
    window.setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 240);
  }, 3400);
}
