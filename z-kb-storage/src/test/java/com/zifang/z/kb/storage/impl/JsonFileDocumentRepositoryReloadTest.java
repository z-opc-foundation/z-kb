package com.zifang.z.kb.storage.impl;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.DocumentStatus;
import com.zifang.z.kb.api.Workspace;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 重启后仍能读回 —— 这个类以前的持久化/加载两端各零覆盖，去 Jackson 时正是这个洞
 * 藏住了「枚举字段被写成 {"name":null,...}、重载即炸」的问题。
 */
class JsonFileDocumentRepositoryReloadTest {

    @Test
    void 重启后枚举时间戳与嵌套Map都完整回来() throws Exception {
        Path store = Files.createTempDirectory("zkb-reload").resolve("zkb.json");

        JsonFileDocumentRepository first = new JsonFileDocumentRepository(store.toString());
        Workspace ws = first.getWorkspaceByName("default");
        assertNotNull(ws);

        Document doc = new Document();
        doc.setWorkspace(ws.getId());
        doc.setTitle("架构笔记");
        doc.setPath("notes/arch.md");
        doc.setStatus(DocumentStatus.INDEXED);
        doc.setTags(List.of("架构", "存储"));
        doc.setCreatedAt(Instant.parse("2026-10-15T08:30:00Z"));
        Map<String, Object> nested = new LinkedHashMap<>();
        nested.put("depth", 3);
        nested.put("tags", List.of("a", "b"));
        doc.setFrontmatter(nested);
        first.save(doc);

        Chunk chunk = new Chunk();
        chunk.setWorkspace(ws.getId());
        chunk.setDocumentId(doc.getId());
        chunk.setOrdinal(0);
        chunk.setContent("正文段落");
        chunk.setCreatedAt(Instant.parse("2026-10-15T08:31:00Z"));
        Map<String, Object> chunkMeta = new LinkedHashMap<>();
        chunkMeta.put("startOffset", 0L);
        chunkMeta.put("headingPath", List.of("架构", "存储"));
        chunk.setMeta(chunkMeta);
        first.saveChunk(chunk);

        waitForDump(store, doc.getId());
        String onDisk = Files.readString(store, StandardCharsets.UTF_8);
        assertTrue(onDisk.contains("INDEXED"), "枚举必须落成 name 字符串：\n" + onDisk);

        JsonFileDocumentRepository second = new JsonFileDocumentRepository(store.toString());
        Document back = second.findById(ws.getId(), doc.getId());
        assertNotNull(back, "重启后文档丢了");
        assertEquals(DocumentStatus.INDEXED, back.getStatus());
        assertEquals("notes/arch.md", back.getPath());
        assertEquals(Instant.parse("2026-10-15T08:30:00Z"), back.getCreatedAt());
        assertEquals(List.of("架构", "存储"), back.getTags());
        assertEquals(3, ((Number) back.getFrontmatter().get("depth")).intValue());

        Chunk chunkBack = second.findChunksByDocument(ws.getId(), doc.getId()).get(0);
        assertEquals("正文段落", chunkBack.getContent());
        assertEquals(Instant.parse("2026-10-15T08:31:00Z"), chunkBack.getCreatedAt());
        assertEquals(0L, ((Number) chunkBack.getMeta().get("startOffset")).longValue());
        assertEquals(List.of("架构", "存储"), chunkBack.getMeta().get("headingPath"));

        // pathIndex 也在 load() 里重建，去重导入不能因为重启而失效
        assertEquals(doc.getId(), second.findByPath(ws.getId(), "notes/arch.md").getId());
    }

    /** 落盘是异步合写的（200ms 扫描 dirty），这里有界等它落盘而不是 sleep 猜时间。 */
    private static void waitForDump(Path store, String marker) throws Exception {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            if (Files.exists(store)) {
                String text = Files.readString(store, StandardCharsets.UTF_8);
                if (text.contains(marker)) return;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("5s 内没等到落盘：" + store);
    }
}
