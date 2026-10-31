import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const { VERSION, BUILD_ENV } = loadEnv(mode, '.', '');
  const publicPathPrefix = VERSION ? `/${VERSION}/` : '/';

  return {
    base: publicPathPrefix,
    define: {
      __BUILD_ENV__: JSON.stringify(BUILD_ENV || 'dev'),
      __LOCAL_ACTOR_ID__: JSON.stringify(process.env.KB_ACTOR_ID || '1'),
    },
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['.cfuture.shop'],
      proxy: {
        // z-kb 后端：参考契约前缀 /kapi/future-brain/v1/* 一一映射到 z-kb 的 /api/kb/v1/*；
        // 本地没有 SSO 会话，租户 / 操作人头由代理补上（线上由网关注入）
        '/kapi/future-brain': {
          target: process.env.KB_API_TARGET || 'http://127.0.0.1:8889',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/kapi\/future-brain/, '/api/kb'),
          headers: {
            'X-Tenant-Code': process.env.KB_TENANT_CODE || 'future_hospital',
            'X-Actor-Id': process.env.KB_ACTOR_ID || '1',
          },
        },
        // 其余前缀（apex-sso 登录态、galaxy-ai、本体代理等）在 z-kb 独立形态下统一指到
        // 同一本地后端：z-kb 未提供的端点如实 404，页面按失败态展示，不做静默兜底
        '/kapi': {
          target: process.env.KB_API_TARGET || 'http://127.0.0.1:8889',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/kapi/, '/api/kb'),
        },
        '/galaxy-meta-service': {
          target: process.env.KB_API_TARGET || 'http://127.0.0.1:8889',
          changeOrigin: true,
        },
        '/galaxy-meta-admin': {
          target: process.env.KB_API_TARGET || 'http://127.0.0.1:8889',
          changeOrigin: true,
        },
        '/apex-spc': {
          target: process.env.KB_API_TARGET || 'http://127.0.0.1:8889',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 10000,
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'json-summary', 'html'],
        reportsDirectory: './coverage',
        reportOnFailure: true,
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/**/*.test.{ts,tsx}',
          'src/vite-env.d.ts',
        ],
        thresholds: {
          statements: 50,
          branches: 50,
          functions: 50,
          lines: 50,
        },
      },
    },
  };
});
