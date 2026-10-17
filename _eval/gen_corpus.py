#!/usr/bin/env python3
"""用 .249 Mac mini 上的 Ollama 生成评测语料 + 黄金集。

设计要点（决定评测有没有区分度）：
  1. 问题必须**避开文档里的字面词**，只用同义/口语表述。否则 BM25 靠字面重合就能满分，
     向量路的语义能力完全体现不出来，消融实验三路都会打平，结论失去意义。
  2. 每份文档配 3 类问题：paraphrase（同义改写）、cross_doc（需综合两份文档）、
     boundary（知识库外，应当拒答）。
  3. 标注写到文档粒度（expectedDocIds），与检索排序输出无关，不会自我循环。

用法: python3 gen_corpus.py --out ../z-kb-core/src/test/resources/eval2
"""
import argparse
import json
import os
import re
import sys
import urllib.request

OLLAMA = os.environ.get("OLLAMA_HOST", "http://192.168.31.249:11434")
JUDGE_MODEL = os.environ.get("EVAL_MODEL", "qwen2.5:14b-instruct-q4_K_M")

TOPICS = [
    ("redis-cache", "Redis 缓存一致性与淘汰策略"),
    ("es-shard", "Elasticsearch 分片与查询调优"),
    ("mq-order", "消息队列的顺序性与幂等"),
    ("pg-partition", "PostgreSQL 分区表与执行计划"),
    ("kafka-lag", "Kafka 消费者组与积压治理"),
    ("nginx-upstream", "Nginx 反向代理与负载均衡"),
]


def chat(prompt, system=None, max_tokens=2000, temperature=0.3, retries=3):
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    body = json.dumps({
        "model": JUDGE_MODEL,
        "messages": msgs,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }).encode()
    req = urllib.request.Request(
        OLLAMA + "/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.load(r)
            content = d["choices"][0]["message"].get("content") or ""
            if content.strip():
                return content
            last = "empty content"
        except Exception as e:  # noqa: BLE001
            last = repr(e)
        print(f"    retry {attempt+1}/{retries}: {last}", file=sys.stderr)
    raise RuntimeError(f"LLM 调用失败: {last}")


def gen_doc(key, title):
    prompt = f"""请写一篇中文技术文档，主题是「{title}」。

要求：
- 用 Markdown，一级标题就是「{title}」
- 3-4 个二级小节，每节 3-5 段
- 内容要具体、有技术细节和数字，不要空话套话
- 全文 600-900 字
- 不要出现「本文」「如上所述」这类元叙述
- 直接输出 Markdown 正文，不要任何前言或解释"""
    return chat(prompt, system="你是一位资深技术文档工程师。", max_tokens=2200)


def gen_questions(docs, key, title, content):
    others = [t for k, t in TOPICS if k != key]
    prompt = f"""下面是一篇技术文档。请基于它出 5 道评测题。

【文档标题】{title}
【文档正文】
{content}

出题要求：
- 第 1-2 题 paraphrase：把文档里的说法**改写成同义的口语化提问**。
  关键：提问中**绝对不能出现文档里的原词或专有名词**（例如文档写「最左前缀原则」，
  你就要问「为什么建了多个字段的索引后，从第二个字段开始查就变慢了」）。
  这些题考察语义检索能力，字面重合度必须接近零。
- 第 3-4 题 cross_doc：需要**综合本文档**才能答，但问法仍然避开原文词。
- 第 5 题 boundary：问一个**本文档和相关文档都答不了**的问题，答案应当是「知识库里没有这部分内容」。
  这个问题不要涉及任何其他主题的正经内容。

严格输出 JSON，格式：
{{"paraphrase": [{{"question":"...","answer":"...","difficulty":"简单或中等或困难"}}, {{...}}],
  "cross_doc": [{{"question":"...","answer":"...","difficulty":"..."}}, {{...}}],
  "boundary": [{{"question":"...","answer":"...","difficulty":"简单"}}]}}

只输出 JSON，不要 markdown 代码块，不要任何解释。"""
    raw = chat(prompt, system="你是技术评测集的命题人，擅长出考题而不泄题。",
               max_tokens=2500, temperature=0.4)
    return parse_json(raw)


def parse_json(raw):
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"```\s*$", "", raw).strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < 0:
        raise ValueError(f"未找到 JSON: {raw[:300]}")
    return json.loads(raw[start:end + 1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    corpus_dir = os.path.join(args.out, "corpus")
    os.makedirs(corpus_dir, exist_ok=True)

    cases = []
    unanswerable = []

    for key, title in TOPICS:
        print(f"[doc] {key} — {title}", file=sys.stderr)
        content = gen_doc(key, title)
        with open(os.path.join(corpus_dir, f"corpus-{key}.md"), "w", encoding="utf-8") as f:
            f.write(content)

        print(f"[q]   {key}", file=sys.stderr)
        q = gen_questions(docs=None, key=key, title=title, content=content)
        n = 0
        for kind, target_doc in (("paraphrase", key), ("cross_doc", key)):
            for item in q.get(kind, [])[:2]:
                n += 1
                cases.append({
                    "caseId": f"{key}-{kind}-{n}",
                    "question": item["question"],
                    "expectedDocIds": [target_doc],
                    "groundTruth": item.get("answer", ""),
                    "isUnanswerable": False,
                    "sourceType": "llm_generated_" + kind,
                    "topic": key,
                    "difficulty": item.get("difficulty", "中等"),
                })
        for item in q.get("boundary", [])[:1]:
            unanswerable.append({
                "caseId": f"{key}-boundary-1",
                "question": item["question"],
                "expectedDocIds": [],
                "groundTruth": item.get("answer", "知识库内无相关内容，应当拒答。"),
                "isUnanswerable": True,
                "sourceType": "llm_generated_boundary",
                "topic": key,
                "difficulty": "简单",
            })

    cases.extend(unanswerable)
    dataset = {
        "datasetVersion": "v2-llm-generated",
        "knowledgeVersion": "kb-llm-corpus-2026-10-18",
        "cases": cases,
    }
    with open(os.path.join(args.out, "golden-set-v2.json"), "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    scored = sum(1 for c in cases if not c["isUnanswerable"])
    print(f"OK: {len(TOPICS)} docs, {len(cases)} cases ({scored} scored) -> {args.out}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
