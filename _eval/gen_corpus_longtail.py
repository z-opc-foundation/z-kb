#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「长尾私有事实」语料 + 标注集，用于验证 RAG 的检索增益。

为什么需要它
------------
第一份语料（eval2）全是 Redis 缓存、ES 分片这类公开常识，无检索臂靠模型自身知识
就能答到 7.83/10，检索臂 7.75 —— 增益被基准的天花板抹平了。这不是 RAG 无效，
是这套题测不出差异。

要让检索增益可被证明，语料里必须有模型不可能知道的东西：具体阈值、编号、
内部人名、版本号、错误码。本脚本围绕虚构的内部平台「Zorp」编造这些事实，
并生成只能靠检索才能答对的问法。

输出
----
<out>/corpus/corpus-<key>.md      每篇一篇文档
<out>/golden-set-v3.json          标注集，标签落在文档粒度

环境变量
--------
OLLAMA_HOST   默认 http://192.168.31.249:11434
EVAL_MODEL    默认 qwen2.5:14b-instruct-q4_K_M
"""

import json
import os
import random
import re
import urllib.request

OLLAMA = os.environ.get("OLLAMA_HOST", "http://192.168.31.249:11434")
MODEL = os.environ.get("EVAL_MODEL", "qwen2.5:14b-instruct-q4_K_M")

random.seed(20261018)

TOPICS = [
    "order-timeout",
    "quota-ladder",
    "settle-ledger",
    "risk-rulebook",
    "deploy-gate",
    "oncall-rota",
]

# 每个主题的「私有事实」骨架：具体到无法从公开知识推出
SEEDS = {
    "order-timeout": {
        "title": "Zorp 订单超时裁决规则",
        "system": "订单裁决服务 ordcut",
        "owner": "林岸",
        "facts": [
            ("默认超时阈值", "137 秒", "自订单进入待支付起算，低于 60 秒的走快速通道"),
            ("快速通道阈值", "41 秒", "快速通道不触发二次确认"),
            ("重试次数上限", "3 次", "每次重试间隔递增 17 秒"),
            ("裁决日志分区键", "order_no 前 8 位", "按分区键散列到 16 个分区"),
            ("超时后补偿单类型", "COMP-4", "补偿单在 8 秒内由对账服务反向补写"),
        ],
    },
    "quota-ladder": {
        "title": "Zorp 配额阶梯与降级策略",
        "system": "配额服务 qltd",
        "owner": "柯野",
        "facts": [
            ("基础配额", "每月 2,400 万次", "超出部分按 1.6 元/万次计费"),
            ("第一级降级触发", "占用达 82%", "第二级为 91%，第三级为 97%"),
            ("第三级降级后响应", "只读", "写接口统一返回 ERR-5031"),
            ("配额快照周期", "每 53 秒", "快照存于 qltd_snapshot 表"),
            ("临时提额单号前缀", "TMP-Q", "单次提额上限为基线的 1.25 倍"),
        ],
    },
    "settle-ledger": {
        "title": "Zorp 结算台账口径",
        "system": "结算服务 stlgr",
        "owner": "闻樾",
        "facts": [
            ("日切时间", "凌晨 3 点 17 分", "以东八区为准，跨日订单归入次日台账"),
            ("台账差错容忍度", "每万笔不超过 2 笔", "超限触发全量重算"),
            ("重算批次大小", "500 笔", "并发度固定为 3"),
            ("差异科目编码", "GL-2077", "计入管理费用而非营业成本"),
            ("对账文件落地目录", "/settle/daily/GL", "文件名后缀为 .dat"),
        ],
    },
    "risk-rulebook": {
        "title": "Zorp 风控规则手册",
        "system": "风控引擎 rskd",
        "owner": "姜屿",
        "facts": [
            ("单笔拦截阈值", "金额超过 27,400 元", "命中后转人工复核"),
            ("人工复核 SLA", "19 分钟", "超时自动放行并记录例外"),
            ("设备指纹维度数", "13 个", "含 canvas 噪声与字体度量"),
            ("名单同步周期", "每 6 分钟", "名单存于 rsk_list 表"),
            ("误伤申诉入口码", "AP-8", "申诉通过率统计口径为 30 天滚动"),
        ],
    },
    "deploy-gate": {
        "title": "Zorp 发布闸门规范",
        "system": "流水线 gatek",
        "owner": "岑野",
        "facts": [
            ("灰度首批比例", "3%", "观察窗口为 23 分钟"),
            ("回滚判定指标", "错误率超过基线 1.8 倍", "或 P99 上升超过 240ms"),
            ("强制人工确认环节", "第 3 道闸", "确认人须为非提交人"),
            ("发布窗口", "工作日 10 点至 16 点", "周五不发布"),
            ("闸门豁免单前缀", "EXEMPT-A", "豁免有效期 72 小时"),
        ],
    },
    "oncall-rota": {
        "title": "Zorp 值班与升级路径",
        "system": "值班系统 oncall",
        "owner": "苏屿",
        "facts": [
            ("一线响应时限", "4 分钟", "二线 12 分钟，三线 35 分钟"),
            ("升级到二线的条件", "一线 12 分钟未闭环", "或影响面判定为 P2 以上"),
            ("P1 定义", "核心交易链路全断", "复盘在 5 个工作日内完成"),
            ("值班交接时间", "每天 9 点 45 分", "交接内容须含未闭环工单"),
            ("演练频率", "每季度 1 次", "演练由 SRE 组主导"),
        ],
    },
}

DOC_TMPL = """# {title}

> 归属系统：{system}　　当前负责人：{owner}　　文档版本：v{v}

## 适用范围

本手册描述 {title} 的现行口径，与线上配置一致。若与代码默认值冲突，以配置中心为准。

## 核心参数

{table}

## 补充说明

{supp}

## 常见问题

**问：这些参数改了要审批吗？**
答：需要。{owner} 是本主题的口径负责人，改动前须在其工位系统提交变更单。

**问：新人怎么快速上手？**
答：先读完上面的参数表，再看同目录下的 {system} 接入说明。

**问：这份文档多久复核一次？**
答：每季度复核一次，最近一次复核由 {owner} 完成。
"""

ROW_TMPL = "| 项目 | 取值 | 说明 |\n| --- | --- | --- |"

Q_TMPL = [
    "在{title}里，{k}是怎么定的？有什么附加约束吗？",
    "{title}对「{k}」这一项给出的是什么口径？",
    "按{title}的规定，{k}应当取什么值？",
    "我想确认一下{title}里跟「{k}」有关的规定，具体是什么？",
]


def call_ollama(prompt, system=None, max_tokens=1200, temperature=0.2):
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    body = json.dumps({
        "model": MODEL, "messages": msgs, "temperature": temperature,
        "max_tokens": max_tokens,
    }).encode()
    req = urllib.request.Request(
        OLLAMA + "/v1/chat/completions", body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.load(r)
    return data["choices"][0]["message"]["content"].strip()


def build_doc(key):
    s = SEEDS[key]
    rows = "\n".join("| {a} | {b} | {c} |".format(a=a, b=b, c=c) for a, b, c in s["facts"])
    table = ROW_TMPL + "\n" + rows
    supp = call_ollama(
        "你在为虚构的内部平台「Zorp」撰写运维手册《{title}》的「补充说明」一节，"
        "约 150 字中文。不要重复参数表里的具体数字，不要引入新的参数名，"
        "只讲这条口径为什么这样定、日常怎么用、出问题先看哪里。\n\n"
        "主题背景：归属系统 {system}，负责人 {owner}。".format(**s))
    doc = DOC_TMPL.format(
        title=s["title"], system=s["system"], owner=s["owner"],
        v=random.randint(2, 9), table=table, supp=supp)
    return doc


def build_cases(key):
    """每篇 5 条：4 条针对私有事实（答案不可能靠模型知识猜到）+ 1 条拒答"""
    s = SEEDS[key]
    cases = []
    facts = s["facts"][:]
    random.shuffle(facts)
    for i, (a, b, c) in enumerate(facts[:4], 1):
        q = Q_TMPL[i % len(Q_TMPL)].format(title=s["title"], k=a)
        cases.append({
            "caseId": "%s-fact-%d" % (key, i),
            "question": q,
            "expectedDocIds": [key],
            "groundTruth": "%s：%s。%s。" % (a, b, c),
            "isUnanswerable": False,
            "sourceType": "longtail_private_fact",
            "topic": key,
            "difficulty": "简单",
        })
    cases.append({
        "caseId": "%s-boundary-1" % key,
        "question": "Zorp 的%s这个系统，用什么编程语言写的？团队多少人？" % s["system"],
        "expectedDocIds": [],
        "groundTruth": "知识库中没有提到该系统的技术栈与团队规模。",
        "isUnanswerable": True,
        "sourceType": "longtail_boundary",
        "topic": key,
        "difficulty": "简单",
    })
    return cases


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "eval3-out")
    corpus_dir = os.path.join(out, "corpus")
    os.makedirs(corpus_dir, exist_ok=True)

    cases = []
    for key in TOPICS:
        print("==> 生成 %s" % key, flush=True)
        doc = build_doc(key)
        with open(os.path.join(corpus_dir, "corpus-%s.md" % key), "w") as f:
            f.write(doc)
        cases.extend(build_cases(key))

    dataset = {
        "datasetVersion": "v3-longtail",
        "knowledgeVersion": "corpus-v3",
        "cases": cases,
    }
    with open(os.path.join(out, "golden-set-v3.json"), "w") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    print("完成：%d 篇文档, %d 条标注 -> %s" % (len(TOPICS), len(cases), out))


if __name__ == "__main__":
    main()
