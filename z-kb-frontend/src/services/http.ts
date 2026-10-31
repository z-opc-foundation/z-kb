import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { redirectToLogin } from './sso';

/* ---------- 类型 ---------- */

/** 旧后端统一响应包装 */
export interface ApiEnvelope<T = unknown> {
  success?: boolean;
  code?: number | string;
  message?: string;
  data: T;
}

export class RequestError extends Error {
  readonly code?: number | string;
  readonly status?: number;
  readonly isGatewayTimeout?: boolean;
  readonly isNetworkError?: boolean;

  constructor(
    message: string,
    options: { code?: number | string; status?: number } = {},
  ) {
    super(message);
    this.name = 'RequestError';
    this.code = options.code;
    this.status = options.status;
    this.isGatewayTimeout = options.status === 504;
    this.isNetworkError = options.status === undefined;
  }
}

/* ---------- 常量 ---------- */

const UNAUTHENTICATED_CODE = 101012001;

/* ---------- Axios 实例 ---------- */

const http = axios.create({
  baseURL: '/kapi',
  timeout: 30_000,
  withCredentials: true,
});

/* ---------- 请求拦截器 ---------- */

http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers.set('X-Requested-With', 'XMLHttpRequest');

    // FormData 不设置 Content-Type，让浏览器自动带 boundary
    if (!(config.data instanceof FormData)) {
      config.headers.set('Accept', 'application/json');
      if (!config.headers.has('Content-Type')) {
        config.headers.set('Content-Type', 'application/json; charset=utf-8');
      }
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(toRequestError(error)),
);

/* ---------- 响应拦截器 ---------- */

http.interceptors.response.use(
  (response) => {
    // 文件下载等二进制响应直接透传
    if (response.config.responseType === 'blob') {
      return response;
    }

    const body = response.data as ApiEnvelope | unknown;

    // 登录失效响应不带 data 字段，必须在解包判断之前识别
    if (isUnauthenticated(body)) {
      redirectToLogin();
      return Promise.reject(
        new RequestError('登录已失效，请重新登录', { code: UNAUTHENTICATED_CODE }),
      );
    }

    if (isApiEnvelope(body)) {
      // 旧接口 success 字段判断
      if (body.success === true || isSuccessCode(body.code)) {
        response.data = body.data;
        return response;
      }

      // 业务错误
      const silent = (response.config as InternalAxiosRequestConfig & { silent?: boolean }).silent;
      const msg = body.message || '服务器错误';

      if (!silent) {
        // 延迟导入避免循环依赖，由调用方通过 App.useApp() 处理
        console.error(`[API Error] ${msg}`);
      }

      return Promise.reject(
        new RequestError(msg, { code: body.code, status: response.status }),
      );
    }

    return response;
  },
  (error: AxiosError) => Promise.reject(toRequestError(error)),
);

/* ---------- 工具函数 ---------- */

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('code' in value || 'success' in value) &&
    'data' in value
  );
}

function isUnauthenticated(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    (value as { code?: unknown }).code === UNAUTHENTICATED_CODE
  );
}

function isSuccessCode(code: ApiEnvelope['code']) {
  return code === 0 || code === 200 || code === '0' || code === '200';
}

function toRequestError(error: AxiosError<unknown>) {
  const data = error.response?.data;
  const envelope = isApiEnvelope(data) ? data : undefined;
  const message = envelope?.message ?? error.message ?? '网络连接异常';
  return new RequestError(message, {
    code: envelope?.code,
    status: error.response?.status,
  });
}

/* ---------- 请求方法 ---------- */

export interface RequestOptions extends Omit<AxiosRequestConfig, 'url'> {
  /** 为 true 时不弹出全局错误提示（适用于轮询等静默场景） */
  silent?: boolean;
}

/**
 * 通用请求函数，自动解包 ApiEnvelope
 */
export async function request<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { silent, ...axiosConfig } = options;
  const response = await http.request<T>({
    url,
    ...axiosConfig,
    // 将 silent 标记附加到 config 上供拦截器读取
    silent,
  } as InternalAxiosRequestConfig & { silent?: boolean });
  return response.data;
}

/**
 * 文件下载（返回 Blob）
 */
export async function downloadFile(
  url: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const response = await http.request<Blob>({
    url,
    responseType: 'blob',
    ...options,
  });
  return response.data;
}

/**
 * 构建完整 API URL（用于需要绝对地址的场景，如文件上传 action）
 */
export function buildApiUrl(path: string, searchParams?: URLSearchParams | string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const kapiPath = normalizedPath.startsWith('/kapi')
    ? normalizedPath
    : `/kapi${normalizedPath}`;
  const qs =
    typeof searchParams === 'string'
      ? searchParams
      : searchParams?.toString() || '';
  const q = qs ? `?${qs}` : '';
  return `${window.location.origin}${kapiPath}${q}`;
}

export { http };
