import { type CSSProperties, type ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/icon';

interface AppModalProps {
  icon?: string;
  title: ReactNode;
  sub?: ReactNode;
  width?: number;
  className?: string;
  body: ReactNode;
  footLeft?: ReactNode;
  footRight?: ReactNode;
  onClose: () => void;
}

export default function AppModal({
  icon = 'info',
  title,
  sub,
  width = 720,
  className,
  body,
  footLeft,
  footRight,
  onClose,
}: AppModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const style: CSSProperties & { '--w': string } = { '--w': `${width}px` };
  // 挂到 body：弹窗可能被放在带 z-index/transform 的容器里，留在原地会盖不住同层兄弟节点
  return createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div
        className={`modal ${className || ''}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={sub ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div className="m-icon">
            <Icon name={icon} size={18} />
          </div>
          <div className="m-copy">
            <h2 id={titleId}>{title}</h2>
            {sub ? <p id={descriptionId}>{sub}</p> : null}
          </div>
          <button
            className="close-btn"
            type="button"
            aria-label="关闭"
            onClick={onClose}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="modal-body">{body}</div>
        {footLeft || footRight ? (
          <div className="modal-foot">
            <span className="left">{footLeft}</span>
            <div className="row gap-6">{footRight}</div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
