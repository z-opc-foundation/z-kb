import AppModal from '@/components/app-modal';
import { useEffect, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  /** 一句话说明影响面，写清「不可撤销 / 后端会拒绝」这类后果 */
  sub?: string;
  confirmText?: string;
  cancelText?: string;
  /** 默认按危险操作处理：确认按钮为红色 */
  danger?: boolean;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

let pending: PendingConfirm | null = null;
const listeners = new Set<(value: PendingConfirm | null) => void>();

function publish(next: PendingConfirm | null) {
  listeners.forEach((listener) => listener(next));
}

function settle(value: boolean) {
  const current = pending;
  if (!current) {
    return;
  }
  pending = null;
  publish(null);
  current.resolve(value);
}

/** 统一的应用内确认框，替代 window.confirm，避免原生弹窗与页面风格脱节。 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (pending) {
    settle(false);
  }
  return new Promise((resolve) => {
    pending = { options, resolve };
    publish(pending);
  });
}

export function ConfirmHost() {
  const [current, setCurrent] = useState<PendingConfirm | null>(pending);

  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  if (!current) {
    return null;
  }

  const { options } = current;
  const danger = options.danger !== false;

  return (
    <AppModal
      icon={danger ? 'alert-triangle' : 'help-circle'}
      title={options.title}
      sub={options.sub}
      width={420}
      className={`confirm-modal${danger ? ' danger' : ''}`}
      onClose={() => settle(false)}
      body={null}
      footLeft={<span className="note">Esc 取消</span>}
      footRight={
        <>
          <button className="btn" type="button" autoFocus onClick={() => settle(false)}>
            {options.cancelText || '取消'}
          </button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            type="button"
            onClick={() => settle(true)}
          >
            {options.confirmText || '确定'}
          </button>
        </>
      }
    />
  );
}
