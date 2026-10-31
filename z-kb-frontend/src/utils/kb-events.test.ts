import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitKbChanged, KB_CHANGED_EVENT } from './kb-events';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('知识库变更广播', () => {
  it('向 window 派发约定事件', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    emitKbChanged();
    expect(KB_CHANGED_EVENT).toBe('future-knowledge:kb-changed');
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0]).toBeInstanceOf(Event);
    expect((dispatch.mock.calls[0][0] as Event).type).toBe(KB_CHANGED_EVENT);
  });

  it('监听方可以收到广播', () => {
    const listener = vi.fn();
    window.addEventListener(KB_CHANGED_EVENT, listener);
    emitKbChanged();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(KB_CHANGED_EVENT, listener);
  });
});
