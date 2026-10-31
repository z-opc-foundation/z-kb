# 研发大脑前端（fe_future-brain）

基于 future-brain 的 React 19 + TypeScript + Vite 工程，使用 Ant Design、React Router 与 Axios。当前分支 `feature/feature001` 承载从 `fe_future-knowledge` 迁入的知识中台页面（知识库、资料、Wiki、图谱、评估、AI 基建等）。

## 环境与启动

- Node.js 20 或更高版本（`.nvmrc` 为 20）
- fnpm 1.1 或更高版本

沿用基准的 Node 20 配置；当前 `@testing-library/jest-dom` 的版本范围会解析到声明要求 Node 22 的版本。此次在 Node 20.20.2 下通过测试和构建，日常使用建议 Node 22 或更高版本，以符合依赖声明。

```bash
fnpm install
fnpm run dev        # 联调本地后端时配合 KB_API_TARGET，见「本地代理」
fnpm run dev:dev    # 固定打 dev 后端，忽略 shell 里的 KB_API_TARGET
```

开发服务监听 `5173`，访问 `http://localhost:5173/`。允许 `*.cfuture.shop` 和局域网地址访问。

本地登录联调（dev 后端 + apex dev 登录）：

1. `/etc/hosts` 配置 `127.0.0.1 local.cfuture.shop`（本机已配）。
2. `fnpm run dev:dev`，用 `http://local.cfuture.shop:5173/` 进站，不要用 `127.0.0.1`。
3. 未登录时接口返回 `101012001`，前端自动跳 apex dev 登录页；登录后回到本地页面，接口直连 `future-brain-dev.cfuture.shop`。

原因：apex 把登录 cookie 种在 `.cfuture.shop` 域（非 Secure），只有 `local.cfuture.shop` 这类子域能带上，vite 再原样透传给 dev 后端；`127.0.0.1` 拿不到该 cookie，会一直被判定未登录。

三个脚手架工程和 future-brain 使用相同端口，不能同时按默认配置启动。

## 目录

```text
src/
  main.tsx       React 入口、Ant Design 配置、BrowserRouter
  App.tsx        路由渲染与页面加载反馈
  layout/        壳层布局、登录用户、Outlet
  routes/        路由与菜单元数据
  services/      业务接口封装、Axios 实例、拦截器、SSO
  pages/         业务页面（knowledge-base、ai、evaluation 等）
  components/    共享组件（图标、弹窗、应用壳）
  styles/        全局样式
  utils/         租户、提示、格式化、知识库事件等工具
  test/          Vitest 启动配置
config/          FE 平台构建配置
scripts/         本地启动脚本
```

路由在 `src/routes/index.tsx` 注册。`appRoutes` 为应用菜单来源，`blankRoutes` 用于独立页面，`allRoutes` 用于渲染；懒加载页面带 `Suspense` 反馈。

## 请求与登录

业务接口统一通过 `src/services/http.ts` 的 `request<T>(url, options)`、`downloadFile`、`buildApiUrl` 调用。Axios 的 `baseURL` 为 `/kapi`；知识中台接口统一走 `/kapi/future-brain/v1/...`（对应 Matrix 应用 `future-brain`，dev 站点 `http://future-brain-dev.cfuture.shop`）。

响应包含 `data` 以及 `code` 或 `success` 时会自动解包。`success: true` 或 `code` 为 `0`、`200`（含字符串形式）表示成功，其他业务状态抛出 `RequestError`。非统一响应直接透传，文件下载返回 Blob。

登录行为沿用平台约定：SSO 根据 `BUILD_ENV` 选择 Apex 域名，未登录跳转登录页并携带返回地址；生产构建直连对应 Apex 域名，本地开发把 `/kapi/apex-sso` 交给 vite 同源代理，登录/退出与业务接口共用同一份 `.cfuture.shop` cookie。

## 本地代理

`vite.config.ts` 与平台工程一致：

| 前缀 | 目标及处理 |
| --- | --- |
| `/kapi/future-brain` | `KB_API_TARGET` 或 `http://future-brain-dev.cfuture.shop`；设置 `KB_API_TARGET` 时剥掉 `/kapi` 打本地 18080，并补 `X-Tenant-Code`/`X-Actor-Id` |
| `/kapi/development-brain-portal` | `http://127.0.0.1:8080`，仅剥掉 `/kapi` |
| `/kapi/apex-sso` | `APEX_SSO_TARGET` 或 `http://c2f.apex-dev.cfuture.shop`（本地开发用同源代理完成登录/退出） |
| `/kapi/hbos-emr` | `https://hbos-test.cfuture.shop` |
| `/kapi/galaxy-ai`、`/kapi` | `https://galaxy-ai.cfuture.shop`，保留原路径 |
| `/galaxy-meta-service`、`/apex-spc` | `https://galaxy-ai.cfuture.shop`，保留原路径 |
| `/galaxy-meta-admin` | `https://galaxy-ai.cfuture.shop`，改写为 `/kapi/galaxy-meta-admin` |

## 构建与验证

```bash
fnpm run typecheck
fnpm test
fnpm run build
fnpm run preview
```

`build` 仅执行 Vite 构建，类型检查须独立执行。`test:watch` 启动 Vitest 监听；保留 `test:e2e` 脚本，但当前没有 Playwright 用例。

`VERSION` 控制构建资源前缀（`/<VERSION>/`，未设置时为 `/`）；`BUILD_ENV` 注入为 `__BUILD_ENV__`，默认 `dev`。FE 平台构建配置位于 `config/fe.config.js`，包名和默认构建标识均为 `brain`。示例环境文件中的 `VITE_API_BASE_URL` 为基准工程保留项，当前 HTTP 封装仍固定使用 `/kapi`。

## 部署到 dev（Matrix）

- Matrix 应用：`fe_future-brain`（id `4019`），dev 流水线 `fe_future-brain_dev_defaultPipeline`，环境 `base-dev`，构建类型 `feMultiBuild`。
- dev 站点：`http://future-brain-dev.cfuture.shop/`，构建产物带版本前缀（`/<version>/assets/...`）；深链直连可能因 nginx 无 SPA 回退而 500，从 `/` 进站后客户端跳转。
- 发布方式：从 Matrix 主干 `master` 切出 feature 分支，合并待发布分支后提交 dev 部署；发布记录见应用「部署信息」。
