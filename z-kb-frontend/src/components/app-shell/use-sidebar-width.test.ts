import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSidebarWidth } from './use-sidebar-width';

const STORAGE_KEY = 'kb.sidebarWidth';

function startResize(result: { current: ReturnType<typeof useSidebarWidth> }) {
  act(() => {
    result.current.startResize({
      preventDefault: vi.fn(),
    } as unknown as ReactPointerEvent<HTMLElement>);
  });
}

function pointer(type: 'pointermove' | 'pointerup', clientX = 0) {
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX }));
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.body.className = '';
  document.documentElement.style.removeProperty('--sidebar-w');
});

describe('useSidebarWidth', () => {
  it('默认宽度写入 CSS 变量', () => {
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(252);
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('252px');
  });

  it.each([
    ['500', 400],
    ['120', 200],
  ])('本地宽度 %s 被限制在 200-400 之间', (stored, expected) => {
    localStorage.setItem(STORAGE_KEY, stored);
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(expected);
  });

  it('拖动分隔条实时更新宽度并在松开后持久化', () => {
    const { result } = renderHook(() => useSidebarWidth());
    startResize(result);
    expect(document.body).toHaveClass('sidebar-resizing');

    pointer('pointermove', 320);
    expect(result.current.width).toBe(320);
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('320px');

    pointer('pointerup');
    expect(document.body).not.toHaveClass('sidebar-resizing');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('320');
  });

  it('拖动越界时按最小宽度收敛', () => {
    const { result } = renderHook(() => useSidebarWidth());
    startResize(result);
    pointer('pointermove', 10);
    expect(result.current.width).toBe(200);
  });

  it('双击恢复默认宽度并写回存储', () => {
    localStorage.setItem(STORAGE_KEY, '330');
    const { result } = renderHook(() => useSidebarWidth());

    act(() => result.current.resetWidth());

    expect(result.current.width).toBe(252);
    expect(document.documentElement.style.getPropertyValue('--sidebar-w')).toBe('252px');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('252');
  });

  it('存储不可用时使用默认宽度且不抛错', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(252);

    startResize(result);
    pointer('pointermove', 300);
    expect(result.current.width).toBe(300);
    expect(() => pointer('pointerup')).not.toThrow();
  });
});
