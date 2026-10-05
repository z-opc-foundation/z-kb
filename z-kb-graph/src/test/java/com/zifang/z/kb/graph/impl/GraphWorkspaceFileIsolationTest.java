package com.zifang.z.kb.graph.impl;

import com.zifang.z.kb.api.Entity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 图谱持久化的 <b>workspace 文件隔离</b>。
 *
 * <p>{@code JsonFileKnowledgeGraphStore} 是一 workspace 一份 JSON，文件名由
 * {@code safeName(workspace)} 生成，而它是 {@code s.replaceAll("[^a-zA-Z0-9_-]", "_")}——
 * <b>把所有非 ASCII 字母数字的字符一律压成同一个下划线</b>。于是两个只有字符种类不同、
 * 长度相同的中文工作台名（"默认空间" / "生产环境"）会算出<b>同一个文件名</b>：
 * 后写的覆盖先写的，重启后其中一个工作台的图谱数据整体消失，而且没有任何报错。</p>
 *
 * <p>{@code Entity.workspace} 是个裸 {@code String}，全仓没有任何格式校验兜底，
 * 所以这不是"理论上的非法输入"，而是中文部署下的常规路径。</p>
 */
class GraphWorkspaceFileIsolationTest {

    private static Entity entity(String workspace, String canonicalName) {
        return Entity.builder()
                .workspace(workspace)
                .canonicalName(canonicalName)
                .displayName(canonicalName)
                .description("test")
                .build();
    }

    private static List<Path> jsonFiles(Path dir) throws IOException {
        List<Path> out = new ArrayList<>();
        try (DirectoryStream<Path> s = Files.newDirectoryStream(dir, "*.json")) {
            for (Path p : s) {
                out.add(p);
            }
        }
        return out;
    }

    /** 对照组：名字本身就是合法文件名字符的，隔离与重启恢复都成立。 */
    @Test
    @DisplayName("对照组：workspace 名本身合法时，各写各的文件、重启后都在")
    void legalNamesAreIsolatedAcrossRestart() throws IOException {
        Path dir = Files.createTempDirectory("zkb-graph-legal");
        JsonFileKnowledgeGraphStore store = new JsonFileKnowledgeGraphStore(dir.toString());
        store.upsertEntity(entity("team_a", "alpha"));
        store.upsertEntity(entity("team-b", "beta"));
        store.close();

        assertEquals(2, jsonFiles(dir).size(), "两个工作台应当各自一份 JSON");

        JsonFileKnowledgeGraphStore reopened = new JsonFileKnowledgeGraphStore(dir.toString());
        try {
            assertNotNull(reopened.findEntity("team_a", "alpha"), "team_a 的实体应当还在");
            assertNotNull(reopened.findEntity("team-b", "beta"), "team-b 的实体应当还在");
        } finally {
            reopened.close();
        }
    }

    /**
     * 主测：两个**不同的**中文工作台名，字符长度相同（因此规范化后前缀下划线个数也相同），
     * 必须落到两个不同的文件，且重启后两个都还在。
     */
    @Test
    @DisplayName("两个不同的中文工作台名不得算出同一个文件名")
    void distinctCjkWorkspacesMustNotCollideOnDisk() throws IOException {
        Path dir = Files.createTempDirectory("zkb-graph-cjk");
        // 两个名字长度相同、每个字符都被 safeName 压成一个下划线 ⇒ 规范化结果完全一样
        JsonFileKnowledgeGraphStore store = new JsonFileKnowledgeGraphStore(dir.toString());
        store.upsertEntity(entity("默认空间", "alpha"));
        store.upsertEntity(entity("生产环境", "beta"));
        store.close();

        int files = jsonFiles(dir).size();
        assertEquals(2, files,
                "\"默认空间\" 与 \"生产环境\" 被 safeName 压成了同一个文件名，写入互相覆盖，"
                        + "重启后必有一个工作台的图谱整体消失");

        JsonFileKnowledgeGraphStore reopened = new JsonFileKnowledgeGraphStore(dir.toString());
        try {
            assertNotNull(reopened.findEntity("默认空间", "alpha"), "默认空间的实体应当还在");
            assertNotNull(reopened.findEntity("生产环境", "beta"),
                    "生产环境的实体应当还在——被同一个文件名吃掉了");
        } finally {
            reopened.close();
        }
    }

    /** 同一现象的最小形态：ASCII 里只需一个分隔符就能撞。 */
    @Test
    @DisplayName("ASCII 下一个分隔符就足以撞车")
    void asciiSeparatorCollision() throws IOException {
        Path dir = Files.createTempDirectory("zkb-graph-ascii");
        JsonFileKnowledgeGraphStore store = new JsonFileKnowledgeGraphStore(dir.toString());
        store.upsertEntity(entity("a.b", "alpha"));
        store.upsertEntity(entity("a:b", "beta"));
        store.close();

        assertEquals(2, jsonFiles(dir).size(), "a.b 与 a:b 不得共用一个文件");

        JsonFileKnowledgeGraphStore reopened = new JsonFileKnowledgeGraphStore(dir.toString());
        try {
            assertTrue(reopened.findEntity("a:b", "beta") != null, "a:b 的实体应当还在");
        } finally {
            reopened.close();
        }
    }

    /**
     * 向后兼容护栏：本来就能当文件名的 workspace，编码后必须<b>一字不变</b>。
     * 这条不是走过场——修法若换成"一律加哈希后缀"，存量用户的
     * {@code ~/.zkb/graph/team_a.json} 就会变成没人再更新的孤儿文件，
     * 而 {@code load()} 按文件内容里的 workspace 字段建 key，新旧两份会被同时加载，
     * 后读到的赢 ⇒ 可能读回陈旧数据。
     */
    @Test
    @DisplayName("合法 workspace 名编码后必须一字不变（存量文件继续原地读写）")
    void legalNamesSurviveEncodingUnchanged() throws IOException {
        Path dir = Files.createTempDirectory("zkb-graph-compat");
        // 先用旧规则写一份存量文件
        Files.write(dir.resolve("team_a.json"),
                ("{\"workspace\":\"team_a\",\"entities\":{\"legacy\":"
                        + "{\"id\":\"1\",\"canonicalName\":\"legacy\",\"workspace\":\"team_a\"}}}")
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8));

        JsonFileKnowledgeGraphStore store = new JsonFileKnowledgeGraphStore(dir.toString());
        try {
            assertNotNull(store.findEntity("team_a", "legacy"),
                    "前提：存量文件应当照常被 load 读进来");
            store.upsertEntity(entity("team_a", "fresh"));
        } finally {
            store.close();
        }

        assertTrue(Files.exists(dir.resolve("team_a.json")),
                "合法名必须继续写回 team_a.json，而不是另起一个带哈希的新文件");
        assertEquals(1, jsonFiles(dir).size(), "不应多出第二份文件");

        JsonFileKnowledgeGraphStore reopened = new JsonFileKnowledgeGraphStore(dir.toString());
        try {
            assertNotNull(reopened.findEntity("team_a", "legacy"),
                    "存量实体不应在重写时丢掉——写的是同一个文件");
            assertNotNull(reopened.findEntity("team_a", "fresh"), "新实体应当也在");
        } finally {
            reopened.close();
        }
    }
}
