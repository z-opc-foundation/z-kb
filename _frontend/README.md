# _frontend

z-kb 现有前端是 `../z-kb-frontend/`（Maven 模块下的 Vite+TS 工程），按 lead 005 §9
规范应迁入 `_frontend/z-kb-suit/`。本目录先建一个最小空壳（Hello + AppLayout），
保证仓可独立 `npm run dev` 跑起来。

迁移路径：把 `z-kb-frontend/src` 的页面拆为 `z-kb-component/src/pages/*` + 配置
`pages-manifest.jsx` + `pages.js`，`z-kb-suit` 通过 `import {routeTable} from
'@yuku123/z-kb-component/pages'` 组装。模板与 z-meta / z-mist 第五批次同。
