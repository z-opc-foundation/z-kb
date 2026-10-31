# 知识中台前端编码规范

本文件定义知识中台前端工程（`fe_future-brain`）的编码规范，**所有开发者及 AI 编码工具在本工程内开发时必须遵循**。

本文件是对根目录 [AGENTS.md](../AGENTS.md) 开发约束的具体补充：AGENTS.md 管架构边界与改动纪律，本文件管具体 UI 形态与实现口径。后续新增规范按章节追加，保持「一条规范一节」。

## 1. 表格规范

本工程内**所有新增表格**（antd `Table`）必须满足以下两条硬性要求，且必须基于工程已有的全局实现落地，禁止自研或引入第三方方案。

### 1.1 列头拖拽调整列宽（必须）

- 统一使用公共 Hook [`useResizableColumns`](../src/components/use-resizable-columns.ts)，它向列定义注入列宽状态与 `onHeaderCell`，配合 `ResizableHeaderCell`（表头右缘全高热区、拖动实时跟随）实现拖拽调整列宽。
- 标准接入方式：

```tsx
import { useResizableColumns } from '@/components/use-resizable-columns';

const { columns: resizableColumns, components } = useResizableColumns(columns, {
  excludeKeys: ['action'], // 操作列等交互列在此排除
});

<Table components={components} columns={resizableColumns} ... />
```

- 约束：
  1. 参与拖拽的列**必须显式声明 `width`**；不声明 `width` 的列视为自适应填充列，不参与拖拽（Hook 自动跳过）。
  2. 操作列、开关列等纯交互列必须通过 `excludeKeys` 排除（按列的 `key` 或 `dataIndex`）。
  3. 分组表头（`children`）不支持拖拽，Hook 自动透传，无需特殊处理。
  4. 禁止自行实现拖拽逻辑，禁止引入 `react-resizable` 等第三方依赖。
  5. 列初始宽度必须保证表头单行展示（含排序/过滤图标，参考：标题字数 × 字号 + 图标约 40px + 单元格内边距 16px）；`scroll.x` 不得小于全部列宽之和，否则 `table-layout: fixed` 会整体压缩列宽导致表头换行。

### 1.2 列排序（必须）

- **除操作列外，所有列必须显式声明 `sorter`**。
- 本工程列表接口均为报表型全量返回，排序统一采用**前端排序**（不给 `sorter` 传 `true` 走服务端）：

```tsx
// 文本列：字典序，空串兜底
sorter: (a, b) => (a.name || '').localeCompare(b.name || '');

// 数值列：减法比较，空值（null）按 -1 处理沉底
sorter: (a, b) => (a.count ?? -1) - (b.count ?? -1);
```

- 如列展示值经过格式化（如产品全路径剥掉顶层节点），排序键应与展示口径一致，避免"看着乱序"。

### 1.3 全局样式约束（必须）

- 表头样式由全局统一控制：[`main.tsx`](../src/main.tsx) 的 `ConfigProvider` 已设置 `components.Table.headerBorderRadius: 0`（表头去圆角）。**禁止在页面级样式中重复覆盖表头圆角等全局 token 已管控的样式**。
- 表格统一 `size="small"`；页级样式只写本页面特有的布局，样式文件放在所属页面/组件目录（`.less` / `.css`）。

### 1.4 配套建议（推荐，非强制）

以下形态已在工程内多处落地，新增表格建议一并采用：

1. **枚举文本列加表头过滤**：`filters` 从当前结果集动态去重生成，`onFilter` 精确匹配（参考 `src/pages/console/agent-metrics/index.tsx` 的 `buildColumnFilters`）。
2. **长文本列**：`ellipsis: { showTitle: false }` + `Tooltip` 悬浮展示全文。
3. **数值列**：`align: 'right'`，统一格式化函数处理空值（无数据显示 `-`）。
4. **分页**：`showSizeChanger` + `showTotal`，页大小档位覆盖大容量场景（如 `[50, 100, 200, 500, 1000]`）。

### 1.5 新增表格验收清单

提交前逐项自检（AI 工具生成代码后同样逐项核对）：

- [ ] 已通过 `useResizableColumns` 接入拖拽，并把返回的 `components` 传给 `Table`
- [ ] 每个可拖拽列都显式声明了 `width`
- [ ] 操作列已加入 `excludeKeys`，且未声明 `sorter`
- [ ] 除操作列外所有列都声明了 `sorter`，空值处理正确
- [ ] 未自研拖拽、未引入第三方拖拽库、未覆盖全局表头样式
- [ ] 各列初始宽度保证表头单行，`scroll.x` ≥ 列宽之和
