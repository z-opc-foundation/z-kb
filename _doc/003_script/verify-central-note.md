# z-kb 协议层：空壳模块与 Central 缺件欠账（已还清）

## 结论先行

`z-kb-protocol` 曾经是 **0 源文件的空壳模块**，因此它的 Maven Central 发布件**永远不会**有
`sources.jar` / `javadoc.jar` —— 不是发布配置漏了，是没有源码可打包。
本轮已实现该模块并重新发布，欠账在 `1.0.7` 还清。

## 欠账的原始记录与它的错误归因

初版记录（`verify_central.sh` 首次报红时）把原因写成：

> 1.0.5 那次 deploy 时，本仓根 pom 的 central profile 还没把 maven-source-plugin /
> maven-javadoc-plugin 绑到该模块上（当前 pom 已配好）。

**这个归因是错的。** central profile 当时就已经正确绑定了两个插件；对**有源码**的模块，
同样的配置在 `1.0.5`/其余 9 个模块上都正常产出了 sources + javadoc。
唯一解释得通的事实是：`z-kb-protocol/src/main` 下一个文件都没有。

## 证据链

1. `z-kb-protocol/src/main` 文件数 = **0**（其余模块 4~29）。
2. `z-kb-protocol/target/*.jar` 内容只有 7 条 `META-INF`（1897 字节）。
3. `1.0.6` 的 `central-bundle.zip` 里，该 artifact 只有 `jar` / `pom` 及各自签名与校验和，
   **无** `-sources.jar` / `-javadoc.jar`；其余 9 个模块四件齐全。
4. `1.0.6` 落地后直连 repo1 复核，与 bundle 预测**逐项一致**：
   `z-kb-protocol 1.0.6` = `pom jar pom.asc jar.asc`，其余 9 模块 = 六件齐全。

第 3、4 步是这条链的关键：先看本机打出的 bundle（能精确区分"插件没跑"与"没东西可打包"），
再用线上实测对账，而不是靠猜。

## 修法与结果

给 `z-kb-protocol` 实现真实内容（协议层 DTO + 契约注解），
并把 `z-kb-web` 里原先收发裸 `Map<String,Object>` 的 9 条边接到这些 DTO 上：

- 协议层新增 14 个类：`protocol.request` 5 个、`protocol.response` 8 个、包级说明 1 个
- `z-kb-web` 的 Document / Workspace / Chat / Ingest 四个 controller 与统一异常处理改用 DTO
- 刻意**不**建模的两处：`IngestController#run` 的 `config`（各数据源形状自定，透传自由参数）、
  `IngestPipeline.Stats`（流水线内部状态的直接投影，建模等于抄实现）

`1.0.7` 的 bundle：11 个坐标，10 个 jar 模块 pom/jar/sources/javadoc 四件齐全
（根 `z-kb` 是 `pom` 打包，只要 pom + 签名）。

## 怎么验的（两道反向验证）

重构把裸 `Map` 换成 DTO，最大风险是"编译通过但线上 JSON 悄悄变了"。为此：

1. **判据有效性自检** —— 摘掉 `IngestItemSummary` 上的 `@JsonInclude(NON_NULL)`，
   `ProtocolContractTest` 立刻 2 条变红（成功项会凭空多出 `"error": null`）。还原后全绿。
2. **接线错误可检出** —— 把 `DocumentController#importMarkdown` 的 `title`/`content`
   两个形参对调（类型相同、编译通过），`RestContractTest` 立刻 1 条变红。还原后全绿。

两处都确认补丁真实生效后才采信结果；否则结论作数。

## 复现命令

```bash
mvn -o clean install              # 42 测全绿：storage 10 + protocol 18 + web 14
bash _doc/003_script/verify_central.sh    # 应全绿
```

## 附：两个已知的量具坑

- `search.maven.org` 对本 namespace **不可用**：它对确定在中央的 `z-kb-protocol:1.0.5`
  也返回 `numFound=0`。判"发没发上去"只能用 `curl` 直连 repo1。
- Central 自动发布到 repo1 可见**实测超过 20 分钟**（`1.0.6` 用了约 20 分钟才 200）。
  轮询必须带一个已知存在的坐标作对照，否则分不清"还没同步"和"网络断了"。
