/** 知识库数据变动广播，用于侧边栏计数等跨组件刷新。 */
export const KB_CHANGED_EVENT = 'future-knowledge:kb-changed';

export function emitKbChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(KB_CHANGED_EVENT));
  }
}
