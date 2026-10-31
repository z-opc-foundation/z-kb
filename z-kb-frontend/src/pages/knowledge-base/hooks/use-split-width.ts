import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export interface SplitWidthOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** 右栏至少保留的宽度：容器变窄时按剩余空间收口 */
  minRightWidth?: number;
}

function readWidth(options: SplitWidthOptions): number {
  const { storageKey, defaultWidth, minWidth, maxWidth } = options;
  try {
    const stored = Number(localStorage.getItem(storageKey));
    return Number.isFinite(stored) && stored > 0
      ? Math.min(maxWidth, Math.max(minWidth, stored))
      : defaultWidth;
  } catch (e) {
    return defaultWidth;
  }
}

function persistWidth(storageKey: string, width: number) {
  try {
    localStorage.setItem(storageKey, String(Math.round(width)));
  } catch (e) {
    // 隐私模式下 localStorage 可能不可写，宽度只在本次会话生效
  }
}

/** 左右两栏之间的分隔条：拖动改左栏宽度，双击复位。 */
export function useSplitWidth(options: SplitWidthOptions) {
  const { storageKey, defaultWidth, minWidth, maxWidth, minRightWidth = 320 } = options;
  const [width, setWidth] = useState(() => readWidth(options));
  const widthRef = useRef(width);
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const applyWidth = useCallback(
    (raw: number) => {
      const containerWidth = containerRef.current?.getBoundingClientRect().width || 0;
      const room =
        containerWidth > minWidth + minRightWidth
          ? containerWidth - minRightWidth
          : maxWidth;
      const next = Math.round(Math.min(Math.min(maxWidth, room), Math.max(minWidth, raw)));
      // pointerup 先于重渲染到达，ref 必须在这里同步更新，否则保存的是上一次的宽度
      widthRef.current = next;
      setWidth(next);
    },
    [maxWidth, minRightWidth, minWidth],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      const left = containerRef.current?.getBoundingClientRect().left ?? 0;
      applyWidth(event.clientX - left);
    };
    const stop = () => {
      if (!draggingRef.current) {
        return;
      }
      draggingRef.current = false;
      document.body.classList.remove('split-resizing');
      persistWidth(storageKey, widthRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.classList.remove('split-resizing');
    };
  }, [applyWidth, storageKey]);

  const startResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    document.body.classList.add('split-resizing');
  }, []);

  const resetWidth = useCallback(() => {
    applyWidth(defaultWidth);
    persistWidth(storageKey, defaultWidth);
  }, [applyWidth, defaultWidth, storageKey]);

  return { width, containerRef, startResize, resetWidth };
}
