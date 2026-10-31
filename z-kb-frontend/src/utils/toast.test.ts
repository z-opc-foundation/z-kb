import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toast } from './toast';

function root() {
  return document.getElementById('toast-root');
}

function items() {
  return Array.from(root()?.children ?? []) as HTMLElement[];
}

beforeEach(() => {
  root()?.remove();
});

afterEach(() => {
  root()?.remove();
});

describe('轻提示', () => {
  it('首次调用创建根节点并展示标题、说明与图标', () => {
    toast('保存成功', '配置已生效', 'success');

    expect(root()).toBeTruthy();
    expect(root()).toHaveClass('toast-root');
    const [item] = items();
    expect(item).toHaveClass('toast', 'success');
    expect(item.querySelector('b')?.textContent).toBe('保存成功');
    expect(item.querySelector('small')?.textContent).toBe('配置已生效');
    expect(item.querySelector('svg')).toBeTruthy();
  });

  it('转义标题与说明中的 HTML', () => {
    toast('<b>危险</b>', '<img src=x>', 'error');

    const [item] = items();
    expect(item.querySelector('b')?.textContent).toBe('<b>危险</b>');
    expect(item.querySelector('small')?.textContent).toBe('<img src=x>');
    expect(item.querySelector('img')).toBeNull();
  });

  it('相同内容重复调用只保留一条', () => {
    toast('提示', '内容', 'info');
    toast('提示', '内容', 'info');
    expect(items()).toHaveLength(1);
  });

  it('最多同时保留三条提示', () => {
    toast('一');
    toast('二');
    toast('三');
    toast('四');

    expect(items()).toHaveLength(3);
    expect(items().map((item) => item.querySelector('b')?.textContent)).toEqual([
      '二',
      '三',
      '四',
    ]);
  });

  it('未传说明时只渲染标题', () => {
    toast('仅标题', undefined, 'warn');
    const [item] = items();
    expect(item).toHaveClass('warn');
    expect(item.querySelector('small')).toBeNull();
  });
});
