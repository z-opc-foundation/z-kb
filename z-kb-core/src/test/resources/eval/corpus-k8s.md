# Kubernetes 调度与探针

Kubernetes 的调度器依据 predicates 和 priorities 两阶段决定 Pod 落到哪个节点。
taints 与 tolerations 配合使用可以保证有状态负载不被调度到不具备对应标签的节点上。

## liveness 与 readiness 的区别

livenessProbe 失败意味着容器需要被重启，readinessProbe 失败只是从 Service 的
Endpoint 列表中摘除。混淆两者会导致依赖未就绪的容器被反复重启，把启动慢的服务打死。

## 滚动更新

maxSurge 控制更新期间可以多起的 Pod 数，maxUnavailable 控制可以少掉的 Pod 数。
两个值不能同时为 0，否则更新无法推进。readinessProbe 的 periodSeconds 直接决定
滚动更新的实际速度。

## 资源限额

requests 影响调度决策，limits 影响运行时限制。只设 limits 不设 requests 会让
调度器按最大额度预留，导致节点资源迅速耗尽。
