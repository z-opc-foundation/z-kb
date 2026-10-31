import { useLayoutEffect, useState, type RefObject } from 'react';

const MIN_PAGE_SIZE = 6;
const MAX_PAGE_SIZE = 50;

/**
 * 按表格容器高度换算每页行数：明细页一页正好铺满可视区，不再出现内部滚动条。
 * 行高取实际渲染的第一行，窗口或侧栏尺寸变化时重新换算。
 */
export function useFitPageSize(
  wrapRef: RefObject<HTMLDivElement | null>,
  sampleKey: string,
  fallback: number,
): number {
  const [size, setSize] = useState(fallback);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node) {
      return;
    }
    const measure = () => {
      const head = node.querySelector('thead');
      const row = node.querySelector('tbody tr');
      if (!head || !row) {
        return;
      }
      const available = node.clientHeight - head.getBoundingClientRect().height;
      const rowHeight = row.getBoundingClientRect().height;
      if (available <= 0 || rowHeight <= 0) {
        return;
      }
      const next = Math.max(
        MIN_PAGE_SIZE,
        Math.min(MAX_PAGE_SIZE, Math.floor(available / rowHeight)),
      );
      setSize((prev) => (prev === next ? prev : next));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [wrapRef, sampleKey]);

  return size;
}
