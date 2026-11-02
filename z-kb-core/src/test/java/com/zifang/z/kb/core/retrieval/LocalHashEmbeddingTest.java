package com.zifang.z.kb.core.retrieval;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocalHashEmbeddingTest {

    private final LocalHashEmbedding embedding = new LocalHashEmbedding();

    @Test
    void embedIsDeterministicAndNormalized() {
        double[] first = embedding.embed("护士长负责病区护理质量管理");
        double[] second = embedding.embed("护士长负责病区护理质量管理");
        assertEquals(first.length, second.length);
        double norm = 0.0d;
        for (int i = 0; i < first.length; i++) {
            assertEquals(first[i], second[i], 1.0e-9);
            norm += first[i] * first[i];
        }
        assertEquals(1.0d, Math.sqrt(norm), 1.0e-6);
    }

    @Test
    void relatedTextScoresHigherThanUnrelated() {
        double[] query = embedding.embed("护士长职责");
        double related = embedding.cosine(query,
                embedding.embed("护士长负责病区护理质量与排班管理"));
        double unrelated = embedding.cosine(query,
                embedding.embed("药品采购流程与库存盘点"));
        assertTrue(related > unrelated);
    }

    @Test
    void encodeAndDecodeRoundTrip() {
        double[] vector = embedding.embed("护理质量");
        double[] decoded = embedding.decode(embedding.encode(vector));
        assertNotNull(decoded);
        assertEquals(vector.length, decoded.length);
        assertEquals(1.0d, embedding.cosine(vector, decoded), 1.0e-4);
    }

    @Test
    void queryTermsExtractHanBigrams() {
        List<String> terms = embedding.queryTerms("护士长");
        assertTrue(terms.contains("护士"));
        assertTrue(terms.contains("士长"));
    }

    @Test
    void decodeRejectsInvalidInput() {
        assertNull(embedding.decode(null));
        assertNull(embedding.decode(" "));
        assertNull(embedding.decode("1,abc"));
    }
}
