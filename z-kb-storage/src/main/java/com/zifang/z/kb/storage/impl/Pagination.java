package com.zifang.z.kb.storage.impl;

import java.util.Collections;
import java.util.List;

/**
 * 分页区间换算。
 *
 * <p>抽成独立工具是因为 {@code InMemoryDocumentRepository} 与
 * {@code JsonFileDocumentRepository} 原本各自抄了一份**逐字相同**的
 * {@code paginate}，下面这个缺陷也因此被复制了两份、修了要改两处。</p>
 */
final class Pagination {

    private Pagination() {
    }

    /**
     * 取 {@code [offset, offset+limit)} 区间。
     *
     * <p>三条边界，按可达性排序：</p>
     * <ul>
     *   <li><b>溢出</b>：原实现写的是 {@code Math.min(size, from + Math.max(1, limit))}，
     *       右边是 int 运算。{@code offset=2} 且 {@code limit=Integer.MAX_VALUE} 时和溢出成
     *       -2147483647，{@code Math.min} 取到负的 {@code to}，
     *       {@code subList(2, -2147483647)} 抛 {@code IllegalArgumentException}。
     *       HTTP 上 {@code GET /api/kb/documents/{ws}?offset=2&limit=2147483647}
     *       （"给我第 2 条起的全部"）即可触发，控制器对 limit 无任何上界校验。
     *       这里先升到 long 再相加。</li>
     *   <li><b>{@code limit <= 0}</b>：原实现用 {@code Math.max(1, limit)} 把 0 和负数
     *       一律兜成 1，于是"要 0 条"会**静默返回 1 条**。全仓无任何调用方依赖这个兜底
     *       （内部调用要么是 {@code limit=Integer.MAX_VALUE}，要么走控制器默认 20），
     *       故按字面语义返回空。</li>
     *   <li><b>{@code offset} 为负</b>：按 0 处理，不抛。</li>
     * </ul>
     *
     * @param list   已排好序的完整列表
     * @param offset 起始下标，负数按 0 处理
     * @param limit  取多少条，非正数返回空
     * @return 区间切片；区间为空时返回空列表
     */
    static <T> List<T> slice(List<T> list, int offset, int limit) {
        int from = Math.max(0, offset);
        if (from >= list.size() || limit <= 0) {
            return Collections.emptyList();
        }
        // 关键：先升到 long 再相加，int 的和会溢出
        long toLong = (long) from + (long) limit;
        int to = toLong >= list.size() ? list.size() : (int) toLong;
        return list.subList(from, to);
    }
}
