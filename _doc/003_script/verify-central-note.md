# Central 发布件欠账：z-kb-protocol 1.0.5 缺 sources/javadoc

`bash _doc/003_script/verify_central.sh` 报的唯一一项：

```
z-kb-protocol — 缺失: -sources.jar:404 -javadoc.jar:404
```

已独立复核（curl 直连 repo1，2026-10-05）：
`z-kb-protocol-1.0.5.jar` / `.pom` / `.pom.asc` 都是 200，
`-sources.jar` 与 `-javadoc.jar` 都是 404。**是真欠账，不是脚本误报。**

## 性质

已发布件的**历史**缺陷 —— 1.0.5 那次 deploy 时，本仓根 pom 的 central profile
还没把 maven-source-plugin / maven-javadoc-plugin 绑到该模块上（当前 pom 已配好，
见根 pom 的 `central` profile）。**Central 不允许同版本重发**，所以 1.0.5 补不回来。

## 修法

抬版本（1.0.5 → 1.0.6）重新发布。届时 `verify_central.sh` 应转为全绿。
在此之前该仓的闸门会一直报这 1 项红 —— 那是欠账的信号，不是闸门坏了。
