import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSplitWidth } from './use-split-width';

const STORAGE_KEY = 'kb.testSplitWidth';
const OPTIONS = {
  storageKey: STORAGE_KEY,
  defaultWidth: 225,
  minWidth: 180,
  maxWidth: 420,
};

function startResize(result: { current: ReturnType<typeof useSplitWidth> }) {
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
});

describe('useSplitWidth', () => {
  it('默认宽度取配置值', () => {
    const { result } = renderHook(() => useSplitWidth(OPTIONS));
    expect(result.current.width).toBe(225);
  });

  it.each([
    ['900', 420],
    ['20', 180],
  ])('本地记录的 %s 被限制在 180-420 之间', (stored, expected) => {
    localStorage.setItem(STORAGE_KEY, stored);
    const { result } = renderHook(() => useSplitWidth(OPTIONS));
    expect(result.current.width).toBe(expected);
  });

  it('拖动分隔条实时改宽度并在松开后持久化', () => {
    const { result } = renderHook(() => useSplitWidth(OPTIONS));
    startResize(result);
    expect(document.body).toHaveClass('split-resizing');

    pointer('pointermove', 300);
    expect(result.current.width).toBe(300);

    pointer('pointerup');
    expect(document.body).not.toHaveClass('split-resizing');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('300');
  });

  it('拖动越界时按最小宽度收敛', () => {
    const { result } = renderHook(() => useSplitWidth(OPTIONS));
    startResize(result);
    pointer('pointermove', 10);
    expect(result.current.width).toBe(180);
  });

  it('双击恢复默认宽度并写回存储', () => {
    localStorage.setItem(STORAGE_KEY, '330');
    const { result } = renderHook(() => useSplitWidth(OPTIONS));

    act(() => result.current.resetWidth());

    expect(result.current.width).toBe(225);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('225');
  });

  it('存储不可用时使用默认宽度且不抛错', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const { result } = renderHook(() => useSplitWidth(OPTIONS));
    expect(result.current.width).toBe(225);

    startResize(result);
    pointer('pointermove', 300);
    expect(result.current.width).toBe(300);
    expect(() => pointer('pointerup')).not.toThrow();
  });
});
