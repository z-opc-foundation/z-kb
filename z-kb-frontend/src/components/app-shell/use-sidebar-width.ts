import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const STORAGE_KEY = 'kb.sidebarWidth';
const DEFAULT_WIDTH = 252;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function clampWidth(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

function readWidth(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : DEFAULT_WIDTH;
  } catch (e) {
    return DEFAULT_WIDTH;
  }
}

function persistWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  } catch (e) {
    // 隐私模式下 localStorage 可能不可写，宽度只在本次会话生效
  }
}

/** 侧栏宽度由拖动分隔条决定，宽度写进 CSS 变量，壳层与弹窗居中一起跟随。 */
export function useSidebarWidth() {
  const [width, setWidth] = useState(readWidth);
  // 宽度只会经 applyWidth 变更，ref 在那里同步，无需在渲染期回写
  const widthRef = useRef(width);
  const draggingRef = useRef(false);

  const applyWidth = useCallback((next: number) => {
    const clamped = clampWidth(next);
    // pointerup 先于重渲染到达，ref 必须在这里同步更新，否则保存的是上一次的宽度
    widthRef.current = clamped;
    setWidth(clamped);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${width}px`);
  }, [width]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      applyWidth(event.clientX);
    };
    const stop = () => {
      if (!draggingRef.current) {
        return;
      }
      draggingRef.current = false;
      document.body.classList.remove('sidebar-resizing');
      persistWidth(widthRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.classList.remove('sidebar-resizing');
    };
  }, [applyWidth]);

  const startResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    document.body.classList.add('sidebar-resizing');
  }, []);

  const resetWidth = useCallback(() => {
    applyWidth(DEFAULT_WIDTH);
    persistWidth(DEFAULT_WIDTH);
  }, [applyWidth]);

  return { width, startResize, resetWidth };
}
