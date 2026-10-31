import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl, downloadFile, http, request, RequestError } from '@/services/http';
import { redirectToLogin } from '@/services/sso';

vi.mock('@/services/sso', () => ({ redirectToLogin: vi.fn() }));

const originalAdapter = http.defaults.adapter;

function respondWith(data: unknown, status = 200) {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    data,
    status,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  }));
  http.defaults.adapter = adapter;
  return adapter;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  http.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe('HTTP 基础能力', () => {
  it.each([0, 200, '0', '200'])('解包成功状态 %s', async (code) => {
    const adapter = respondWith({ code, data: { value: 1 } });
    await expect(request('/example')).resolves.toEqual({ value: 1 });
    const config = adapter.mock.calls[0][0];
    expect(config.baseURL).toBe('/kapi');
    expect(config.withCredentials).toBe(true);
    expect(config.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
  });

  it('兼容 success 响应并透传普通响应', async () => {
    respondWith({ success: true, data: ['ok'] });
    await expect(request('/example')).resolves.toEqual(['ok']);
    respondWith({ status: 'ok' });
    await expect(request('/example')).resolves.toEqual({ status: 'ok' });
  });

  it('将业务错误转换为 RequestError', async () => {
    respondWith({ code: 400, message: '请求不合法', data: null });
    const error = await request('/example', { silent: true }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(RequestError);
    expect(error).toMatchObject({ message: '请求不合法', code: 400, status: 200 });
  });

  it('登录失效时跳转并拒绝请求', async () => {
    respondWith({ code: 101012001, data: null });
    await expect(request('/example')).rejects.toMatchObject({ code: 101012001 });
    expect(redirectToLogin).toHaveBeenCalledOnce();
  });

  it('登录失效响应缺少 data 字段时仍然跳转', async () => {
    respondWith({
      code: 101012001,
      success: false,
      message: '登录失效，请重新登录！',
    });
    await expect(request('/example')).rejects.toMatchObject({
      code: 101012001,
      message: '登录已失效，请重新登录',
    });
    expect(redirectToLogin).toHaveBeenCalledOnce();
  });

  it('区分网关超时与网络异常', async () => {
    http.defaults.adapter = async (config) => {
      throw new AxiosError('网关超时', 'ERR_BAD_RESPONSE', config, undefined, {
        data: { code: 504, message: '服务超时', data: null },
        status: 504,
        statusText: 'Gateway Timeout',
        headers: new AxiosHeaders(),
        config,
      });
    };
    await expect(request('/example')).rejects.toMatchObject({
      message: '服务超时', status: 504, isGatewayTimeout: true, isNetworkError: false,
    });
    http.defaults.adapter = async () => {
      throw new AxiosError('Network Error', 'ERR_NETWORK');
    };
    await expect(request('/example')).rejects.toMatchObject({
      isGatewayTimeout: false, isNetworkError: true,
    });
  });

  it('下载响应透传 Blob', async () => {
    const blob = new Blob(['测试文件']);
    const adapter = respondWith(blob);
    await expect(downloadFile('/export')).resolves.toBe(blob);
    expect(adapter.mock.calls[0][0].responseType).toBe('blob');
  });

  it('构建完整 URL，避免重复添加网关前缀', () => {
    const params = new URLSearchParams({ name: '测试 文件' });
    expect(buildApiUrl('/development-brain-portal/example', params)).toBe(
      `${window.location.origin}/kapi/development-brain-portal/example?${params}`,
    );
    expect(buildApiUrl('/kapi/example')).toBe(`${window.location.origin}/kapi/example`);
  });
});
