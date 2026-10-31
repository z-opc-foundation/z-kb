import { useEffect, useRef } from 'react';

/** 遮罩层统一用 Esc 关闭，与 AppModal 行为保持一致。 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handlerRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
