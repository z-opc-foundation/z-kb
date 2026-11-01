package com.zifang.z.kb.resource.ops;

import com.zifang.z.cognition.client.CognitionClient;
import com.zifang.z.cognition.client.CognitionClientException;
import com.zifang.z.cognition.model.EvidenceDraft;
import com.zifang.z.cognition.model.ResolveHit;
import com.zifang.z.cognition.model.ResolveResult;
import com.zifang.z.cognition.model.Term;
import com.zifang.z.cognition.model.TermDraft;
import com.zifang.z.kb.core.extraction.CognitionGateway;
import com.zifang.z.kb.core.extraction.ConceptNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 认知域网关的 HTTP 实现：走 {@link CognitionClient}（零 Spring 裸 SDK）连 z-cognition。
 *
 * <p><b>降级优先</b>：认知域不可达（连接失败/超时/5xx）时返回空结果并置降级位，
 * 绝不把异常抛给编译管线 —— 知识库编译不能被认知域拖垮。</p>
 *
 * <p><b>幂等</b>：新词提议前先查一次，已存在就跳过；并发下撞到「已存在」按幂等成功处理。</p>
 *
 * <p><b>命中阈值</b>：认知侧打分里 KEY=100 / 名=90 / 别名=80 / 包含=50 / DEPRECATED −10。
 * 「包含」这种弱匹配容易把不相关词误判成同一个概念，所以下限取 50（含），
 * 即：只认精确命中与别名命中。</p>
 */
public class RemoteCognitionGateway implements CognitionGateway {

    private static final Logger LOG = LoggerFactory.getLogger(RemoteCognitionGateway.class);

    /** 认知侧给出的可接受命中分数下限；低于此值视为「没命中」。 */
    private static final int MIN_ACCEPTABLE_SCORE = 50;

    /** 术语键前缀：标明这条术语来自 z-kb 萃取，不是人工登记。 */
    public static final String KEY_PREFIX = "kb.extracted.";

    /** 认知域里 DRAFT 的语义域标记。 */
    public static final String DOMAIN = "kb";

    private final CognitionClient client;

    private final String token;

    /** 同一次运行内同词的消歧结果只算一次。 */
    private final Map<String, ResolveHit> cache = new LinkedHashMap<>();

    /** 已提议过的词（归一化后），保证同一次运行内不重复提议。 */
    private final Map<String, String> proposed = new LinkedHashMap<>();

    private boolean degraded;

    public RemoteCognitionGateway(CognitionClient client, String token) {
        this.client = client;
        this.token = token;
    }

    @Override
    public boolean isDegraded() {
        return degraded;
    }

    @Override
    public Map<String, String> resolveAll(List<String> names) {
        Map<String, String> out = new LinkedHashMap<>();
        if (client == null || names == null || names.isEmpty()) {
            return out;
        }
        List<String> pending = new ArrayList<>();
        for (String name : names) {
            if (name == null || name.trim().isEmpty()) {
                continue;
            }
            if (!cache.containsKey(name.trim())) {
                pending.add(name.trim());
            }
        }
        if (pending.isEmpty()) {
            for (Map.Entry<String, ResolveHit> entry : cache.entrySet()) {
                String key = conceptKeyOf(entry.getValue());
                if (key != null) {
                    out.put(entry.getKey(), key);
                }
            }
            return out;
        }
        try {
            List<ResolveResult> results = client.resolveBatch(token, pending);
            for (ResolveResult result : results) {
                if (result == null || result.getQuery() == null) {
                    continue;
                }
                ResolveHit best = bestHit(result.getHits());
                if (best == null) {
                    continue;
                }
                cache.put(result.getQuery(), best);
            }
        } catch (CognitionClientException e) {
            degraded = true;
            LOG.warn("[cognition] 批量消歧失败，降级为库内归一（不阻断编译管线）：{}", e.getMessage());
        } catch (RuntimeException e) {
            degraded = true;
            LOG.warn("[cognition] 批量消歧异常，降级为库内归一（不阻断编译管线）：{}", e.getMessage());
        }
        // 统一从 cache 构建 out：远端新命中 + 此前已缓存的命中都要进结果。
        // ⚠️ 不能只返回本次远端结果 —— 同库第二次编译时，老词都在 cache 里、
        // pending 只有新词，若只看远端返回，老词的认知键会被整批丢掉
        // （实测：同进程第二次编译，已消歧的「订单/对账」全变回未消歧）。
        for (Map.Entry<String, ResolveHit> entry : cache.entrySet()) {
            String key = conceptKeyOf(entry.getValue());
            if (key != null) {
                out.putIfAbsent(entry.getKey(), key);
            }
        }
        return out;
    }

    @Override
    public String proposeTerm(String name, String definition, String kbId,
                              String materialVersionId, String chunkId) {
        if (client == null || name == null || name.trim().isEmpty()) {
            return null;
        }
        String canonical = name.trim();
        String normalized = ConceptNames.normalize(canonical);
        if (normalized.isEmpty() || proposed.containsKey(normalized)) {
            return null;
        }
        String termKey = KEY_PREFIX + toKeySegment(normalized);
        boolean exists = false;
        try {
            Term existing = client.getTerm(token, termKey);
            exists = existing != null;
        } catch (CognitionClientException e) {
            if (e.getStatus() == 404) {
                exists = false;
            } else if (e.getStatus() < 0 || e.getStatus() >= 500) {
                degraded = true;
                LOG.warn("[cognition] 认知域不可达，跳过新词提议 {}：{}", canonical, e.getMessage());
                return null;
            } else {
                LOG.warn("[cognition] 查询术语 {} 失败，跳过提议：{}", termKey, e.getMessage());
                return null;
            }
        } catch (RuntimeException e) {
            degraded = true;
            LOG.warn("[cognition] 认知域异常，跳过新词提议 {}：{}", canonical, e.getMessage());
            return null;
        }
        if (exists) {
            proposed.put(normalized, termKey);
            return null;
        }

        TermDraft draft = new TermDraft();
        draft.setTermKey(termKey);
        draft.setCanonical(canonical);
        draft.setDefinition(definition == null || definition.trim().isEmpty()
                ? canonical : definition.trim());
        draft.setDomain(DOMAIN);
        draft.setStatus("DRAFT");
        draft.setOwner("z-kb-extraction");
        draft.setActor("z-kb-extraction");
        draft.setNote("z-kb 规则萃取提议，待人工审核");
        draft.setEvidences(Collections.singletonList(
                new EvidenceDraft("KB_CHUNK", kbId + "|" + materialVersionId + "|" + chunkId,
                        "kb-chunk")));
        try {
            Term created = client.createTerm(token, draft);
            proposed.put(normalized, created == null ? termKey : created.getTermKey());
            return created == null ? termKey : created.getTermKey();
        } catch (CognitionClientException e) {
            if (e.getStatus() == 400) {
                // 并发下别人先登记了 ⇒ 幂等成功
                proposed.put(normalized, termKey);
                return null;
            }
            degraded = e.getStatus() < 0 || e.getStatus() >= 500;
            LOG.warn("[cognition] 登记术语 {} 失败，不阻断编译：{}", termKey, e.getMessage());
            return null;
        } catch (RuntimeException e) {
            LOG.warn("[cognition] 登记术语 {} 异常，不阻断编译：{}", termKey, e.getMessage());
            return null;
        }
    }

    /** 取分数最高的命中；低于下限视为没命中。 */
    private static ResolveHit bestHit(List<ResolveHit> hits) {
        ResolveHit best = null;
        if (hits == null) {
            return null;
        }
        for (ResolveHit hit : hits) {
            if (hit == null || hit.getTerm() == null || hit.getScore() < MIN_ACCEPTABLE_SCORE) {
                continue;
            }
            if (best == null || hit.getScore() > best.getScore()) {
                best = hit;
            }
        }
        return best;
    }

    /**
     * 从命中里取公司级认知键。
     *
     * <p>优先取概念键（conceptKey）；术语自身没挂概念时退回术语键 ——
     * 术语键同样是公司级稳定键，能保证跨库归一。</p>
     */
    private static String conceptKeyOf(ResolveHit hit) {
        if (hit == null || hit.getTerm() == null) {
            return null;
        }
        if (hit.getConcept() != null && hit.getConcept().getConceptKey() != null
                && !hit.getConcept().getConceptKey().isEmpty()) {
            return hit.getConcept().getConceptKey();
        }
        String termKey = hit.getTerm().getTermKey();
        if (termKey != null && !termKey.isEmpty()) {
            return termKey;
        }
        return null;
    }

    /**
     * 把归一化词转成合法的术语键片段（认知域要求 {@code ^[a-z][a-z0-9_.-]{1,127}$}）。
     *
     * <p>中文词没法直接进 key ⇒ 用 SHA-256 前 24 位做稳定指纹，保证同词同键（幂等的前提）。</p>
     */
    static String toKeySegment(String normalized) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < normalized.length(); i++) {
            char ch = normalized.charAt(i);
            if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
                sb.append(ch);
            } else {
                sb.append('_');
            }
        }
        String ascii = sb.toString();
        if (ascii.length() >= 2 && !ascii.contains("_")
                && ascii.equals(normalized.toLowerCase(Locale.ROOT))) {
            return ascii;
        }
        return ConceptNames.sha256Hex(normalized).substring(0, 24);
    }
}
