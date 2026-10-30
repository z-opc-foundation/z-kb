import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import {safeEmptyOutDir} from '../../build-tools/safe-vite-plugin.mjs'

export default defineConfig({
    plugins: [safeEmptyOutDir(), react()],
    build: {
        lib: {entry: {index: path.resolve(__dirname, 'src/index.js'), pages: path.resolve(__dirname, 'src/pages.js')}, formats: ['es']},
        outDir: 'dist', emptyOutDir: false,
        rollupOptions: {
            // rollup 的 external 是**精确字符串匹配**，不是前缀匹配（下面 echarts/* 走
            // startsWith 是显式加的例外）。只写主桶 '@yuku123/z-frontend-common' 的话，
            // 源码里的 '@yuku123/z-frontend-common/ui' 会被当普通依赖打包 ⇒ 基座 UI 组件
            // 被复制进本包 dist（打破「共享基座单一真源」+ 包体膨胀 + 宿主侧出现两份 antd）。
            // 子路径必须逐个列出（与 z-ext / z-mist 的做法一致）。
            external: (id) => [
                'react', 'react-dom', 'react-dom/client', 'react-router-dom',
                'antd', '@ant-design/icons', 'axios', '@yuku123/z-frontend-common',
                '@yuku123/z-frontend-common/ui', '@yuku123/z-frontend-common/ui/echarts',
                'dayjs', 'echarts', 'echarts-for-react', 'marked', 'highlight.js',
            ].includes(id)
                // echarts/* 与 echarts-for-react/lib/* 同样要 external。
                // 2026-10-22: 知识图谱页改成 tree-shaken 后源码引的是子路径
                // （echarts/core、echarts/charts、echarts-for-react/lib/core）。
                // 若这些子路径不 external, 本包会把 800KB+ 的 echarts 打进自己的 dist ——
                // 既让包体凭空膨胀, 又绕开了宿主侧"按需注册"的 tree-shaking 能力。
                // external 后由宿主（主壳）用自己的 node_modules 解析。
                || id.startsWith('echarts/')
                || id.startsWith('echarts-for-react/'),
        },
    },
})
