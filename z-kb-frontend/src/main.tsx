import { createRoot } from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from '@/components/auth';
import { clearLoginReturnParam } from '@/services/sso';
import App from './App';

clearLoginReturnParam();

createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={zhCN} theme={{ token: { borderRadius: 6, colorPrimary: '#1677ff' } }}>
    <AntdApp>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </AntdApp>
  </ConfigProvider>,
);
