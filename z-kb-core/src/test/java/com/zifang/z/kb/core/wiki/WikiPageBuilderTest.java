package com.zifang.z.kb.core.wiki;

import com.zifang.z.kb.api.wiki.WikiPointView;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Wiki 页面构建口径：标题切分、正文拼装/回解、摘要与指纹。
 */
class WikiPageBuilderTest {

    @Test
    void splitPointsByHeadings() {
        List<WikiPointView> points = WikiPageBuilder.splitPoints(
                "# 概述\n\n第一段。\n\n## 细节\n\n第二段。", "文档");
        assertEquals(2, points.size());
        assertEquals("概述", points.get(0).getHeading());
        assertEquals("第一段。", points.get(0).getText());
        assertEquals("细节", points.get(1).getHeading());
        assertEquals("第二段。", points.get(1).getText());
    }

    @Test
    void splitPointsFallsBackToTitleWithoutHeading() {
        List<WikiPointView> points = WikiPageBuilder.splitPoints("没有任何标题的正文。", "文档");
        assertEquals(1, points.size());
        assertEquals("文档", points.get(0).getHeading());
        assertEquals("没有任何标题的正文。", points.get(0).getText());
        assertTrue(WikiPageBuilder.splitPoints("   ", "文档").isEmpty());
        assertTrue(WikiPageBuilder.splitPoints(null, "文档").isEmpty());
    }

    @Test
    void splitPointsCapsAtFifty() {
        StringBuilder text = new StringBuilder();
        for (int i = 1; i <= 60; i++) {
            text.append("# 标题").append(i).append("\n\n段落").append(i).append("。\n\n");
        }
        List<WikiPointView> points = WikiPageBuilder.splitPoints(text.toString(), "文档");
        assertEquals(WikiPageBuilder.MAX_POINTS, points.size());
        assertEquals("标题1", points.get(0).getHeading());
        assertEquals("段落50。", points.get(49).getText());
    }

    @Test
    void buildThenParseRoundTrip() {
        List<WikiPointView> points = WikiPageBuilder.splitPoints(
                "# 概述\n\n第一段。\n\n## 细节\n\n第二段。", "文档");
        String content = WikiPageBuilder.buildContent(points);
        assertTrue(content.startsWith("## 概述\n\n第一段。"));
        List<WikiPointView> parsed = WikiPageBuilder.parsePoints(content);
        assertEquals(points.size(), parsed.size());
        for (int i = 0; i < points.size(); i++) {
            assertEquals(points.get(i).getHeading(), parsed.get(i).getHeading());
            assertEquals(points.get(i).getText(), parsed.get(i).getText());
        }
        List<WikiPointView> plain = WikiPageBuilder.parsePoints("只有正文");
        assertEquals(1, plain.size());
        assertEquals("正文", plain.get(0).getHeading());
        assertTrue(WikiPageBuilder.parsePoints(null).isEmpty());

        List<WikiPointView> single = new ArrayList<>();
        WikiPointView only = new WikiPointView();
        only.setHeading("简介");
        only.setText("简介正文。");
        single.add(only);
        List<WikiPointView> singleParsed = WikiPageBuilder.parsePoints(
                WikiPageBuilder.buildContent(single));
        assertEquals(1, singleParsed.size());
        assertEquals("简介", singleParsed.get(0).getHeading());
        assertEquals("简介正文。", singleParsed.get(0).getText());
    }

    @Test
    void summaryRules() {
        List<WikiPointView> points = new ArrayList<>();
        WikiPointView point = new WikiPointView();
        point.setHeading("概述");
        point.setText(repeat('字', 200));
        points.add(point);
        assertEquals(WikiPageBuilder.MAX_SUMMARY_CHARS,
                WikiPageBuilder.summaryOf(points, "兜底").length());
        assertTrue(WikiPageBuilder.summaryOf(new ArrayList<>(), "兜底").equals("兜底"));
        assertEquals("摘要正文", WikiPageBuilder.summaryFromContent("SUMMARY: 摘要正文\n\n后文"));
        assertTrue(WikiPageBuilder.summaryFromContent("  多   空白  ").equals("多 空白"));
        assertNull(WikiPageBuilder.summaryFromContent(null));
    }

    @Test
    void titleAndHash() {
        assertEquals("指南", WikiPageBuilder.stripExtension("指南.md"));
        assertEquals("未命名 Wiki", WikiPageBuilder.stripExtension("  "));
        assertEquals("未命名 Wiki", WikiPageBuilder.stripExtension(null));
        String first = WikiPageBuilder.sha256("v1|内容");
        assertEquals(64, first.length());
        assertEquals(first, WikiPageBuilder.sha256("v1|内容"));
        assertNotEquals(first, WikiPageBuilder.sha256("v2|内容"));
        assertNull(WikiPageBuilder.truncate(null, 10));
    }

    @Test
    void chunkIdJoinSplitAndPointCount() {
        assertEquals("c1,c2", WikiPageBuilder.joinChunkIds(
                Arrays.asList(" c1 ", "c2", "c1", " ")));
        assertEquals(Arrays.asList("c1", "c2"), WikiPageBuilder.splitChunkIds("c1, c2"));
        assertTrue(WikiPageBuilder.splitChunkIds(null).isEmpty());
        List<String> many = new ArrayList<>();
        for (int i = 0; i < 60; i++) {
            many.add("c" + i);
        }
        assertEquals(WikiPageBuilder.MAX_POINTS, WikiPageBuilder.pointCount(many));
        assertEquals(0, WikiPageBuilder.pointCount(null));
    }

    private static String repeat(char c, int times) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < times; i++) {
            builder.append(c);
        }
        return builder.toString();
    }
}
