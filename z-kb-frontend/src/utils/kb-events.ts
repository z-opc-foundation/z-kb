/** 知识库数据变动广播，用于侧边栏计数等跨组件刷新。 */
export const ***REMOVED***CHANGED_EVENT = 'z***REMOVED***:***REMOVED***-changed';

export function emit***REMOVED***Changed(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(***REMOVED***CHANGED_EVENT));
  }
}
