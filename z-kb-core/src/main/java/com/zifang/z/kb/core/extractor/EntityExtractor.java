package com.zifang.z.kb.core.extractor;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.EntityType;
import com.zifang.z.kb.core.util.HanLpTokenizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 实体抽取器 — 基于词典 + 词频统计 + wikilink 的轻量混合策略。
 *
 * <p>策略：
 * <ol>
 *   <li>wikilink 目标天然是实体（CONCEPT）</li>
 *   <li>基于词典匹配（PERSON / ORG / LOCATION / TOOL / DATABASE）</li>
 *   <li>基于后缀词典识别技术名词（TECHNOLOGY）</li>
 *   <li>基于首字母大写英文术语识别（TOOL / TECH）</li>
 *   <li>基于高频词识别候选概念（CONCEPT）</li>
 * </ol>
 */
public class EntityExtractor {

    private static final Logger log = LoggerFactory.getLogger(EntityExtractor.class);

    private static final Set<String> TECH_KEYWORDS = new LinkedHashSet<>(List.of(
            "数据库", "框架", "平台", "系统", "服务", "引擎", "协议",
            "算法", "模型", "库", "工具", "中间件", "网关", "代理",
            "集群", "节点", "索引", "事务", "查询", "存储", "缓存"
    ));

    private static final Set<String> TOOL_DICT = new LinkedHashSet<>(List.of(
            "InfluxDB", "TimescaleDB", "TDengine", "Prometheus", "Grafana",
            "Elasticsearch", "Lucene", "Solr", "OpenSearch",
            "MySQL", "PostgreSQL", "MongoDB", "Redis", "Memcached", "KeyDB",
            "Kafka", "RabbitMQ", "RocketMQ", "Pulsar", "NATS",
            "Hadoop", "Spark", "Flink", "Storm", "Beam",
            "Neo4j", "NebulaGraph", "JanusGraph", "TigerGraph",
            "Docker", "Kubernetes", "Helm", "Istio", "Envoy",
            "Tomcat", "Nginx", "Apache", "HAProxy", "Traefik",
            "Spring", "MyBatis", "Hibernate", "Dubbo", "gRPC",
            "ZooKeeper", "etcd", "Consul", "Nacos", "Eureka",
            "TensorFlow", "PyTorch", "PaddlePaddle", "MindSpore",
            "OpenAI", "Claude", "Qwen", "GLM", "HuggingFace",
            "Lucene", "Tika", "HanLP", "Jieba", "Snowflake",
            "GitLab", "GitHub", "Jenkins", "CircleCI", "GitHub Actions",
            "Terraform", "Ansible", "Puppet", "Chef",
            "LangChain", "LlamaIndex", "Haystack", "RAGFlow",
            "Zookeeper", "RocketMQ", "Seata", "Sentinel"
    ));

    private static final Set<String> DB_DICT = new LinkedHashSet<>(List.of(
            "MySQL", "PostgreSQL", "MongoDB", "Redis", "Memcached",
            "Elasticsearch", "InfluxDB", "TimescaleDB", "TDengine",
            "ClickHouse", "Doris", "StarRocks", "TiDB", "OceanBase",
            "Neo4j", "NebulaGraph", "Cassandra", "HBase", "Couchbase",
            "Oracle", "SQLServer", "DB2", "Postgres", "MariaDB"
    ));

    /** 中文后缀技术名词 */
    private static final Pattern ZH_TERM = Pattern.compile("[\\u4e00-\\u9fff]{2,8}");
    /** 英文术语（首字母大写开头的多词组合） */
    private static final Pattern EN_TERM = Pattern.compile("\\b([A-Z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*)\\b");
    /** 全小写技术词（postgres, mysql 等） */
    private static final Pattern EN_TERM_LOWER = Pattern.compile("\\b([a-z][a-z0-9]{2,15})\\b");

    /**
     * 从 chunk 中抽取实体。
     */
    public List<Entity> extract(Chunk chunk) {
        if (chunk == null || chunk.getContent() == null || chunk.getContent().isEmpty()) {
            return new ArrayList<>();
        }
        String content = chunk.getContent();
        Map<String, Entity> entityMap = new LinkedHashMap<>();

        // 1. wikilink 直接作为实体
        if (chunk.getWikilinkTargets() != null) {
            for (String target : chunk.getWikilinkTargets()) {
                addEntity(entityMap, target, EntityType.CONCEPT, chunk);
            }
        }

        // 2. 词典匹配：工具 / 数据库
        Matcher en = EN_TERM.matcher(content);
        while (en.find()) {
            String term = en.group(1);
            if (TOOL_DICT.contains(term)) {
                addEntity(entityMap, term, EntityType.TOOL, chunk);
            } else if (DB_DICT.contains(term)) {
                addEntity(entityMap, term, EntityType.DATABASE, chunk);
            }
        }

        // 3. 中文技术名词（含 TECH_KEYWORDS 后缀）
        Matcher zh = ZH_TERM.matcher(content);
        while (zh.find()) {
            String term = zh.group();
            for (String suffix : TECH_KEYWORDS) {
                if (term.endsWith(suffix) && term.length() > suffix.length() && term.length() <= 8) {
                    addEntity(entityMap, term, EntityType.TECHNOLOGY, chunk);
                }
            }
        }

        // 4. 高频词作为候选概念（CONCEPT）
        List<String> tokens = HanLpTokenizer.tokenize(content);
        Map<String, Integer> tokenCount = new LinkedHashMap<>();
        for (String t : tokens) {
            tokenCount.merge(t, 1, Integer::sum);
        }
        // 取 top 3 高频且长度 >= 2 的词
        tokenCount.entrySet().stream()
                .filter(e -> e.getKey().length() >= 2)
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(3)
                .forEach(e -> addEntity(entityMap, e.getKey(), EntityType.CONCEPT, chunk));

        return new ArrayList<>(entityMap.values());
    }

    private void addEntity(Map<String, Entity> map, String name, EntityType type, Chunk chunk) {
        if (name == null || name.isEmpty()) return;
        name = name.trim();
        Entity existing = map.get(name);
        if (existing == null) {
            existing = new Entity(name, type);
            existing.setWorkspace(chunk.getWorkspace());
            existing.setSourceChunkIds(new ArrayList<>());
            existing.setSourceDocumentIds(new ArrayList<>());
            map.put(name, existing);
        } else {
            // 类型优先级：更具体的覆盖 CONCEPT
            if (existing.getType() == EntityType.CONCEPT && type != EntityType.OTHER && type != EntityType.CONCEPT) {
                existing.setType(type);
            }
        }
        if (!existing.getSourceDocumentIds().contains(chunk.getDocumentId())) {
            existing.getSourceDocumentIds().add(chunk.getDocumentId());
        }
        if (!existing.getSourceChunkIds().contains(chunk.getId())) {
            existing.getSourceChunkIds().add(chunk.getId());
        }
        existing.setFrequency(existing.getFrequency() + 1);
    }
}
