import { createElement, type ReactElement } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth';
import { clearLoginReturnParam } from '@/services/sso';

const renderMock = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(),
}));

vi.mock('@/services/sso', () => ({
  clearLoginReturnParam: vi.fn(),
}));

vi.mock('./App', () => ({
  default: () => createElement('div', null, 'APP'),
}));

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('main entry', () => {
  it('清理登录回跳参数并在 #root 上挂载应用外壳', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.mocked(createRoot).mockReturnValue({
      render: renderMock,
    } as unknown as Root);

    await import('./main');

    expect(clearLoginReturnParam).toHaveBeenCalledTimes(1);
    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledTimes(1);

    const config = renderMock.mock.calls[0][0] as ReactElement<{
      children: ReactElement;
      locale: unknown;
    }>;
    expect(config.type).toBe(ConfigProvider);
    expect(config.props.locale).toBeTruthy();

    const antd = config.props.children as ReactElement<{ children: ReactElement }>;
    expect(antd.type).toBe(AntdApp);

    const auth = antd.props.children as ReactElement<{ children: ReactElement }>;
    expect(auth.type).toBe(AuthProvider);

    const router = auth.props.children as ReactElement<{ children: ReactElement }>;
    expect(router.type).toBe(HashRouter);

    const app = router.props.children;
    expect(app.type).toBe((await import('./App')).default);
  });
});
