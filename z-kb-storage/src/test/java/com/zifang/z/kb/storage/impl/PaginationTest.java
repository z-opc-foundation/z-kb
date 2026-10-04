package com.zifang.z.kb.storage.impl;

import com.zifang.z.kb.api.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 分页区间换算，以及它在两个 DocumentRepository 实现上的落地。
 *
 * <p>{@code Pagination} 是这次从两个实现里抽出来的——原先它们各抄了一份逐字相同的
 * {@code paginate}，缺陷也被复制了两份。</p>
 */
class PaginationTest {

    private static List<String> of(int n) {
        List<String> list = new ArrayList<>();
        for (int i = 0; i < n; i++) list.add("d" + i);
        return list;
    }

    // ==================== Pagination.slice ====================

    @Test
    void normalWindow() {
        assertEquals(Arrays.asList("d0", "d1"), Pagination.slice(of(5), 0, 2));
        assertEquals(Arrays.asList("d2", "d3"), Pagination.slice(of(5), 2, 2));
    }

    @Test
    void windowLargerThanListClampsToEnd() {
        assertEquals(5, Pagination.slice(of(5), 0, 999).size());
        assertEquals(3, Pagination.slice(of(5), 2, 999).size());
    }

    /**
     * 本次修复的主缺陷。
     * <p>原实现 {@code Math.min(size, from + Math.max(1, limit))} 是 int 运算，
     * {@code offset=2, limit=Integer.MAX_VALUE} 时和溢出成 -2147483647，
     * {@code subList(2, -2147483647)} 抛 IllegalArgumentException。</p>
     */
    @Test
    void offsetPlusMaxLimitDoesNotOverflow() {
        List<String> r = Pagination.slice(of(5), 2, Integer.MAX_VALUE);
        assertEquals(Arrays.asList("d2", "d3", "d4"), r);
    }

    @Test
    void offsetPlusMaxLimitOnLargeOffsetDoesNotOverflow() {
        List<String> r = Pagination.slice(of(5), 1, 2147483647);
        assertEquals(4, r.size());
        assertEquals("d1", r.get(0));
    }

    /**
     * 修前 {@code Math.max(1, limit)} 把 0 兜成 1，"要 0 条"会静默返回 1 条。
     */
    @Test
    void nonPositiveLimitReturnsEmpty() {
        assertTrue(Pagination.slice(of(5), 0, 0).isEmpty());
        assertTrue(Pagination.slice(of(5), 2, 0).isEmpty());
        assertTrue(Pagination.slice(of(5), 0, -5).isEmpty());
        assertTrue(Pagination.slice(of(5), 2, Integer.MIN_VALUE).isEmpty());
    }

    @Test
    void negativeOffsetTreatedAsZero() {
        assertEquals(Arrays.asList("d0", "d1"), Pagination.slice(of(5), -5, 2));
    }

    @Test
    void offsetBeyondEndReturnsEmpty() {
        assertTrue(Pagination.slice(of(5), 5, 10).isEmpty());
        assertTrue(Pagination.slice(of(5), 99, 10).isEmpty());
    }

    @Test
    void emptyListIsSafe() {
        assertTrue(Pagination.slice(of(0), 0, 10).isEmpty());
        assertTrue(Pagination.slice(of(0), 0, Integer.MAX_VALUE).isEmpty());
    }

    // ==================== 两个实现都走到了同一处 ====================

    private static Document doc(String id) {
        Document d = new Document();
        d.setId(id);
        d.setWorkspace("default");
        d.setTitle("t-" + id);
        return d;
    }

    @Test
    void inMemoryRepositoryHonoursPagination() {
        InMemoryDocumentRepository repo = new InMemoryDocumentRepository();
        for (int i = 0; i < 5; i++) repo.save(doc("d" + i));

        assertEquals(5, repo.countByWorkspace("default"));
        // "从第 2 条起给我全部" —— 修复前这条直接抛 IllegalArgumentException
        assertEquals(3, repo.listByWorkspace("default", 2, Integer.MAX_VALUE).size());
        // "给我 0 条" —— 修复前会返回 1 条
        assertTrue(repo.listByWorkspace("default", 0, 0).isEmpty());
        assertEquals(2, repo.listByWorkspace("default", 0, 2).size());
    }

    @Test
    void jsonFileRepositoryHonoursPagination(@TempDir java.nio.file.Path tmpDir) {
        // 构造时会立刻 persist() 落盘，故给一个独立的临时路径；
        // 其 persistExecutor 是 daemon 线程，不需要也不能手动关闭（类上没有该方法）。
        JsonFileDocumentRepository repo = new JsonFileDocumentRepository(
                tmpDir.resolve("kb-store.json").toString());
        for (int i = 0; i < 5; i++) repo.save(doc("d" + i));

        assertEquals(5, repo.countByWorkspace("default"));
        assertEquals(3, repo.listByWorkspace("default", 2, Integer.MAX_VALUE).size());
        assertTrue(repo.listByWorkspace("default", 0, 0).isEmpty());
        assertEquals(2, repo.listByWorkspace("default", 0, 2).size());
    }
}
