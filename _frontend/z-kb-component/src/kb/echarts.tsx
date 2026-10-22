/**
 * z-kb-component 的 echarts 统一入口 —— tree-shaken（2026-10-22 包体优化）。
 *
 * **改之前**：`GraphPage.tsx` 直接 `import ReactECharts from 'echarts-for-react'`，
 * 而该入口内部静态引全量 `echarts`（1,549.5 KB raw / 422.7 KB gzip，190+ 图表类型）。
 * 宿主主壳为一张关系图（graph series）付出全量 echarts 的带宽。
 *
 * **改之后**：`echarts-for-react/lib/core`（由 prop 注入 echarts 实例）
 * + `echarts/core` 按需注册 ⇒ 实测 843.7 KB raw / 229.7 KB gzip。
 *
 * ⚠ 本包实际只用到 **graph** 一种 series（知识图谱页的关系图），
 *   组件用到 grid / legend / tooltip。bar / line 也一并注册着 ——
 *   因为 echarts 的 grid/axis 体系与 bar/line 共享，缺任一都会导致坐标轴不渲染。
 *
 * ⚠ 新增图表类型时**必须**在本文件补注册，否则运行时报 "Series xxx is not exists"。
 */
import * as echarts from 'echarts/core';
import {BarChart, LineChart, GraphChart} from 'echarts/charts';
import {
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';

echarts.use([
    BarChart,
    LineChart,
    GraphChart,
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
    CanvasRenderer,
]);

export {echarts};

/**
 * 与 `echarts-for-react` 默认导出的**等价 drop-in 包装**：
 * 差别只有一处 —— 把 tree-shaken 的 echarts 实例通过 prop 注入，
 * 而不是在库里静态引全量包。其它 props（option / style / onEvents …）原样透传。
 */
export default function ReactECharts(props) {
    return <ReactEChartsCore echarts={echarts} {...props}/>;
}
