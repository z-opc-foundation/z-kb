import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/app-shell';
import Icon from '@/components/icon';
import { usePermission } from './index';

function NoAccess({ menuCode }: { menuCode?: string }) {
  const navigate = useNavigate();
  const { reload } = usePermission();
  return (
    <div>
      <section className="panel">
        <div className="panel-body empty" style={{ padding: '48px 0' }}>
          <Icon name="shield" size={26} />
          <b>没有访问权限</b>
          <p>
            当前账号没有获得「{menuCode || '该页面'}」的菜单授权。请联系管理员在 Apex
            权限中心为角色勾选该菜单；授权后点「重新校验」即可。
          </p>
          <p>权限在 Apex 维护，知识中台不保存授权副本。</p>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button className="btn" type="button" onClick={() => navigate('/index')}>
              返回首页
            </button>
            <button className="btn primary" type="button" onClick={reload}>
              <Icon name="refresh" size={13} />
              重新校验
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * 路由级菜单校验：强制期未授权的菜单不渲染页面，直接给无权限说明。
 * 首次加载等待权限视图，避免先闪出受限页面。
 */
export default function RouteAccess({
  menuCode,
  children,
}: {
  menuCode?: string;
  children: ReactNode;
}) {
  const { loading, canSeeMenu } = usePermission();

  if (loading) {
    return (
      <div className="brain-page-fallback" role="status" aria-label="权限加载中">
        <Spin size="large" />
      </div>
    );
  }

  if (!canSeeMenu(menuCode)) {
    return (
      <AppShell>
        <NoAccess menuCode={menuCode} />
      </AppShell>
    );
  }

  return <>{children}</>;
}
