import { Suspense } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { allRoutes, defaultRoutePath } from '@/routes';
import RouteAccess from '@/components/auth/route-access';
import './App.css';

function RouteLoading() {
  return (
    <div className="brain-page-fallback" role="status" aria-label="页面加载中">
      <Spin size="large" />
    </div>
  );
}

function DefaultRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: defaultRoutePath, search, hash }} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DefaultRedirect />} />
      {allRoutes.map(({ key, path, menuCode, component: Component }) => (
        <Route
          key={key}
          path={path}
          element={
            <Suspense fallback={<RouteLoading />}>
              {menuCode ? (
                <RouteAccess menuCode={menuCode}>
                  <Component />
                </RouteAccess>
              ) : (
                <Component />
              )}
            </Suspense>
          }
        />
      ))}
      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
