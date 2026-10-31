import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/dom';

// 懒加载路由在 jsdom 下首次 transform 可能超过 1s，放宽异步断言等待。
configure({ asyncUtilTimeout: 5000 });

// Node ≥22 自带 localStorage/sessionStorage 全局，未传 --localstorage-file 时取值为 undefined；
// vitest 的 populateGlobal 见 key 已存在便跳过 jsdom 实现，故此处把 jsdom 的 Storage 接回全局。
// Node 20（.nvmrc 钉版）上这些 key 本就不存在，下面判断为假，不做任何改写。
const jsdomWindow = (globalThis as { jsdom?: { window?: unknown } }).jsdom?.window as
  | Record<string, unknown>
  | undefined;
const globalScope = globalThis as Record<string, unknown>;
for (const storageKey of ['localStorage', 'sessionStorage']) {
  if (globalScope[storageKey] === undefined && jsdomWindow?.[storageKey] !== undefined) {
    Object.defineProperty(globalThis, storageKey, {
      configurable: true,
      get: () => jsdomWindow[storageKey],
    });
  }
}

// AntD 的响应式组件在 jsdom 里没有 matchMedia。
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: NoopObserver,
});
Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  value: NoopObserver,
});

Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} });
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: () => {},
});

if (!URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', { writable: true, value: () => 'blob:mock' });
}
if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: () => {} });
}
