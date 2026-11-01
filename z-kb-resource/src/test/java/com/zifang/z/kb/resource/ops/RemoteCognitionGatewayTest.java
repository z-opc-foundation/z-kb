package com.zifang.z.kb.resource.ops;

import com.zifang.z.cognition.client.CognitionClient;
import com.zifang.z.cognition.client.CognitionClientException;
import com.zifang.z.cognition.model.Concept;
import com.zifang.z.cognition.model.DiffResult;
import com.zifang.z.cognition.model.Evidence;
import com.zifang.z.cognition.model.ImpactResult;
import com.zifang.z.cognition.model.ResolveHit;
import com.zifang.z.cognition.model.ResolveResult;
import com.zifang.z.cognition.model.RevisionInfo;
import com.zifang.z.cognition.model.Term;
import com.zifang.z.cognition.model.TermDraft;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * TASK-20261101-006：认知域网关的行为契约。
 *
 * <p>十例覆盖：命中取概念键 / 无概念时退回术语键 / 弱匹配（分数低）不认 /
 * 批量一次往返 / 同词缓存不重复调 / 认知域不可达降级不抛 / 降级位被置起 /
 * 新词以 DRAFT 提议 / 同词不重复提议 / 已存在则跳过。</p>
 */
class RemoteCognitionGatewayTest {

    /** 假 client：记录调用，按预设返回结果，可模拟不可达。 */
    private static class FakeClient implements CognitionClient {
        int batchCalls;
        int getTermCalls;
        int createTermCalls;
        final List<String> lastQueries = new ArrayList<>();
        Map<String, ResolveHit> hitsByQuery = new java.util.HashMap<>();
        boolean unreachable;
        boolean termExists;
        Term created;

        @Override
        public Term getTerm(String token, String termKey) {
            getTermCalls++;
            if (unreachable) {
                throw new CognitionClientException("调用认知服务失败: test", new RuntimeException("down"));
            }
            if (termExists) {
                Term t = new Term();
                t.setTermKey(termKey);
                return t;
            }
            throw new CognitionClientException(404, "{\"error\":\"not found\"}");
        }

        @Override
        public List<ResolveResult> resolveBatch(String token, List<String> queries) {
            batchCalls++;
            lastQueries.addAll(queries);
            if (unreachable) {
                throw new CognitionClientException("调用认知服务失败: test", new RuntimeException("down"));
            }
            List<ResolveResult> out = new ArrayList<>();
            for (String q : queries) {
                ResolveResult r = new ResolveResult();
                r.setQuery(q);
                ResolveHit hit = hitsByQuery.get(q);
                if (hit != null) {
                    r.setHits(new ArrayList<>(Arrays.asList(hit)));
                }
                out.add(r);
            }
            return out;
        }

        @Override
        public Term createTerm(String token, TermDraft draft) {
            createTermCalls++;
            if (unreachable) {
                throw new CognitionClientException("调用认知服务失败: test", new RuntimeException("down"));
            }
            created = new Term();
            created.setTermKey(draft.getTermKey());
            return created;
        }

        @Override
        public Concept getConcept(String token, String conceptKey) {
            return null;
        }

        @Override
        public List<Evidence> listConceptEvidence(String token, String conceptKey) {
            return new ArrayList<>();
        }

        @Override
        public List<Evidence> listTermEvidence(String token, String termKey) {
            return new ArrayList<>();
        }

        @Override
        public List<RevisionInfo> listTermRevisions(String token, String termKey) {
            return new ArrayList<>();
        }

        @Override
        public Term getTermRevision(String token, String termKey, int revisionNo) {
            return null;
        }

        @Override
        public DiffResult diffTermRevisions(String token, String termKey, int left, int right) {
            return null;
        }

        @Override
        public Term rollbackTerm(String token, String termKey, int toRevision, String note) {
            return null;
        }

        @Override
        public List<Term> listTerms(String token, String domain, String status, String q) {
            return new ArrayList<>();
        }

        @Override
        public Term updateTerm(String token, String termKey, TermDraft draft) {
            return null;
        }

        @Override
        public Concept updateConcept(String token, String conceptKey,
                                     com.zifang.z.cognition.model.ConceptDraft draft) {
            return null;
        }

        @Override
        public List<Concept> listConcepts(String token, String domain) {
            return new ArrayList<>();
        }

        @Override
        public Concept createConcept(String token, com.zifang.z.cognition.model.ConceptDraft draft) {
            return null;
        }

        @Override
        public ResolveResult resolve(String token, String query) {
            return null;
        }

        @Override
        public ImpactResult impact(String token, String subjectType, String subjectKey) {
            return null;
        }
    }

    private static ResolveHit hit(String termKey, String conceptKey, int score) {
        ResolveHit h = new ResolveHit();
        Term t = new Term();
        t.setTermKey(termKey);
        h.setTerm(t);
        if (conceptKey != null) {
            Concept c = new Concept();
            c.setConceptKey(conceptKey);
            h.setConcept(c);
        }
        h.setScore(score);
        return h;
    }

    @Test
    @DisplayName("命中时优先取公司级概念键")
    void 命中取概念键() {
        FakeClient client = new FakeClient();
        client.hitsByQuery.put("订单", hit("order", "biz.order", 90));
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        Map<String, String> result = gateway.resolveAll(Arrays.asList("订单"));

        assertEquals(1, result.size());
        assertEquals("biz.order", result.get("订单"));
        assertFalse(gateway.isDegraded());
    }

    @Test
    @DisplayName("术语没挂概念时退回术语键（术语键同样是公司级稳定键）")
    void 无概念退回术语键() {
        FakeClient client = new FakeClient();
        client.hitsByQuery.put("订单", hit("order", null, 90));
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        Map<String, String> result = gateway.resolveAll(Arrays.asList("订单"));

        assertEquals("order", result.get("订单"));
    }

    @Test
    @DisplayName("分数低于阈值的弱匹配不算命中")
    void 弱匹配不算命中() {
        FakeClient client = new FakeClient();
        client.hitsByQuery.put("订单", hit("order.big", null, 10));
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        Map<String, String> result = gateway.resolveAll(Arrays.asList("订单"));

        assertTrue(result.isEmpty(), "低分命中不应被采信");
    }

    @Test
    @DisplayName("批量消歧只发一次往返")
    void 批量一次往返() {
        FakeClient client = new FakeClient();
        client.hitsByQuery.put("订单", hit("order", "biz.order", 90));
        client.hitsByQuery.put("对账", hit("recon", "biz.recon", 90));
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        Map<String, String> result = gateway.resolveAll(Arrays.asList("订单", "对账"));

        assertEquals(2, result.size());
        assertEquals(1, client.batchCalls, "两个词应合并成一次往返");
    }

    @Test
    @DisplayName("同词重复消歧不重复调用")
    void 同词缓存() {
        FakeClient client = new FakeClient();
        client.hitsByQuery.put("订单", hit("order", "biz.order", 90));
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        gateway.resolveAll(Arrays.asList("订单"));
        Map<String, String> second = gateway.resolveAll(Arrays.asList("订单"));

        assertEquals(1, client.batchCalls, "同词第二次应走缓存");
        assertEquals("biz.order", second.get("订单"), "缓存命中仍要给出结果");
    }

    @Test
    @DisplayName("认知域不可达时降级：不抛异常、返回空结果、置降级位")
    void 不可达降级() {
        FakeClient client = new FakeClient();
        client.unreachable = true;
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        Map<String, String> result = gateway.resolveAll(Arrays.asList("订单"));

        assertTrue(result.isEmpty());
        assertTrue(gateway.isDegraded(), "降级位必须被置起，供上层告警");
    }

    @Test
    @DisplayName("新词以 DRAFT 态提议")
    void 新词提议() {
        FakeClient client = new FakeClient();
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        String key = gateway.proposeTerm("对账单", "对账用的单据", "kb-1", "ver-1", "3");

        assertNotNull(key);
        assertEquals(1, client.createTermCalls);
        assertEquals("kb.extracted." + RemoteCognitionGateway.toKeySegment("对账单"), key);
    }

    @Test
    @DisplayName("同词不重复提议（幂等）")
    void 同词不重复提议() {
        FakeClient client = new FakeClient();
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        gateway.proposeTerm("对账单", "释义", "kb-1", "ver-1", "3");
        gateway.proposeTerm("对账单", "释义", "kb-1", "ver-1", "4");

        assertEquals(1, client.createTermCalls, "同词只登记一次");
    }

    @Test
    @DisplayName("术语已存在时跳过登记")
    void 已存在则跳过() {
        FakeClient client = new FakeClient();
        client.termExists = true;
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        String key = gateway.proposeTerm("对账单", "释义", "kb-1", "ver-1", "3");

        assertNull(key, "已存在不该重复登记");
        assertEquals(0, client.createTermCalls);
    }

    @Test
    @DisplayName("认知域不可达时提议不抛异常")
    void 不可达提议不抛() {
        FakeClient client = new FakeClient();
        client.unreachable = true;
        RemoteCognitionGateway gateway = new RemoteCognitionGateway(client, "token");

        String key = gateway.proposeTerm("对账单", "释义", "kb-1", "ver-1", "3");

        assertNull(key);
        assertTrue(gateway.isDegraded());
    }
}
