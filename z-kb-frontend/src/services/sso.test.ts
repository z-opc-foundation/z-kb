import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logout, queryCurrentUser } from './sso';

async function loadSso() {
  vi.resetModules();
  return import('./sso');
}

function stubWindow(href: string) {
  const assign = vi.fn();
  const replaceState = vi.fn();
  vi.stubGlobal('window', {
    location: { href, assign },
    history: { replaceState },
  });
  return { assign, replaceState };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('当前登录人接口', () => {
  it('未登录返回 null，成功返回用户信息', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ code: 101012001 }) })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: { name: '张三', accountNo: 'A1' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(queryCurrentUser()).resolves.toBeNull();
    await expect(queryCurrentUser()).resolves.toEqual({ name: '张三', accountNo: 'A1' });

    expect(fetchMock).toHaveBeenCalledWith('/kapi/apex-sso/getLoginUserInfo', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('接口失败时抛出统一错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }));
    await expect(queryCurrentUser()).rejects.toThrow('获取登录用户信息失败');
  });

  it('注销调用 apex 登出接口', async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal('fetch', fetchMock);

    await logout();
    expect(fetchMock).toHaveBeenCalledWith('/kapi/apex-sso/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });
});

describe('登录跳转', () => {
  it('带上回跳地址且并发失败只跳一次', async () => {
    const { assign } = stubWindow('https://brain.example.com/index?source=demo#section');
    const { redirectToLogin: redirect } = await loadSso();

    redirect();
    redirect();

    expect(assign).toHaveBeenCalledOnce();
    const target = String(assign.mock.calls[0][0]);
    expect(target.startsWith('http://c2f.apex-dev.cfuture.shop/login?redirect=')).toBe(true);
    const returnUrl = new URL(decodeURIComponent(target.split('redirect=')[1]));
    expect(returnUrl.searchParams.get('_from_login')).toBe('1');
    expect(returnUrl.searchParams.get('source')).toBe('demo');
    expect(returnUrl.hash).toBe('#section');
  });

  it('从登录页返回后清理回跳参数', async () => {
    const { replaceState } = stubWindow('https://brain.example.com/index?_from_login=1&keep=1#section');
    const { clearLoginReturnParam: clear } = await loadSso();

    clear();

    expect(replaceState).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(null, '', expect.anything());
    const url = String(replaceState.mock.calls[0][2]);
    expect(url).toContain('keep=1');
    expect(url).toContain('#section');
    expect(url).not.toContain('_from_login');
  });

  it('没有回跳参数时不改写历史', async () => {
    const { replaceState } = stubWindow('https://brain.example.com/index?keep=1');
    const { clearLoginReturnParam: clear } = await loadSso();

    clear();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
