// PDF.js 的 worker 打包入口：以本地模块方式交给 Vite 产出 .js 资源，
// 避免直接引 .mjs 被静态服务按 application/octet-stream 返回而无法作为 module worker 加载。
import 'pdfjs-dist/build/pdf.worker.min.mjs';
