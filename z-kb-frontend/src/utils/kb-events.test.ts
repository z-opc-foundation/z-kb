import { afterEach, describe, expect, it, vi } from 'vitest';
import { emit***REMOVED***Changed, ***REMOVED***CHANGED_EVENT } from './***REMOVED***-events';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('知识库变更广播', () => {
  it('向 window 派发约定事件', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    emit***REMOVED***Changed();
    expect(***REMOVED***CHANGED_EVENT).toBe('z***REMOVED***:***REMOVED***-changed');
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0]).toBeInstanceOf(Event);
    expect((dispatch.mock.calls[0][0] as Event).type).toBe(***REMOVED***CHANGED_EVENT);
  });

  it('监听方可以收到广播', () => {
    const listener = vi.fn();
    window.addEventListener(***REMOVED***CHANGED_EVENT, listener);
    emit***REMOVED***Changed();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(***REMOVED***CHANGED_EVENT, listener);
  });
});
