import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/components/auth';

interface RenderAtOptions {
  route?: string;
  withAuth?: boolean;
}

/** 页面测试统一入口：默认只套 MemoryRouter；需要权限上下文时 withAuth。 */
export function renderAt(
  ui: ReactElement,
  { route = '/', withAuth = false }: RenderAtOptions = {},
): RenderResult {
  const tree = withAuth ? <AuthProvider>{ui}</AuthProvider> : ui;
  return render(<MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter>);
}
