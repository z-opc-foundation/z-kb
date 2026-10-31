export interface SsoUserInfo {
  name?: string;
  accountNo?: string;
  deptName?: string;
  orgName?: string;
  extendMap?: Record<string, unknown>;
}

interface SsoResponse<T> {
  code?: number | string;
  success?: boolean;
  data?: T;
}

const UNAUTHENTICATED_CODE = 101012001;
let redirecting = false;
const APEX_ORIGIN_BY_ENV: Record<string, string> = {
  // apex-dev 只起了 http（https 同路径 404），显式写协议，避免 https 站点跳登录时被升级
  local: 'http://c2f.apex-dev.cfuture.shop',
  dev: 'http://c2f.apex-dev.cfuture.shop',
  test: '//c2f.apex-test.cfuture.shop',
  pre: '//c2f.apex.cfuture.shop',
  poc: '//c2f.apex.cfuture.shop',
  prod: '//c2f.apex.cfuture.shop',
};

export function redirectToLogin() {
  // 页面并发请求会同时失败，只跳一次
  if (redirecting) {
    return;
  }
  redirecting = true;
  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.set('_from_login', '1');
  window.location.assign(`${getRedirectLoginUrl()}?redirect=${encodeURIComponent(returnUrl.toString())}`);
}

/** 从 apex 登录页回来时去掉 _from_login，避免地址栏一直挂着联调参数。 */
export function clearLoginReturnParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('_from_login')) {
    return;
  }
  url.searchParams.delete('_from_login');
  window.history.replaceState(null, '', url);
}

export async function queryCurrentUser(): Promise<SsoUserInfo | null> {
  const response = await fetch(getQueryUserInfoApi(), {
    method: 'POST',
    credentials: 'include',
  });
  const result = (await response.json()) as SsoResponse<SsoUserInfo>;

  if (result.code === UNAUTHENTICATED_CODE) {
    return null;
  }
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error('获取登录用户信息失败');
}

export async function logout() {
  await fetch(getDoLogoutApi(), {
    method: 'POST',
    credentials: 'include',
  });
}

function getQueryUserInfoApi() {
  return `${getApexApiOrigin()}/apex-sso/getLoginUserInfo`;
}

function getDoLogoutApi() {
  return `${getApexApiOrigin()}/apex-sso/logout`;
}

function getRedirectLoginUrl() {
  return `${getApexOrigin()}/login`;
}

function getApexApiOrigin() {
  // 本地开发走 vite 代理：同源请求才会带上 apex 种在 local.cfuture.shop 下的登录 cookie
  return import.meta.env.DEV ? '/kapi' : `${getApexOrigin()}/kapi`;
}

function getApexOrigin() {
  return APEX_ORIGIN_BY_ENV[getBuildEnv().toLowerCase()] ?? APEX_ORIGIN_BY_ENV.prod;
}

function getBuildEnv() {
  return __BUILD_ENV__ || window.ENV_TYPE || 'prod';
}
