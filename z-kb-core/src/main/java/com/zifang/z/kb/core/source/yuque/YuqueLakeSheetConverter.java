package com.zifang.z.kb.core.source.yuque;

import com.zifang.util.json.JsonCursor;
import com.zifang.util.json.JsonUtil;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;

/**
 * 语雀表格类文档 body（lakesheet 电子表格 / laketable 数据表）→ markdown 表格。
 *
 * <p>lakesheet 的 {@code sheet} 字段是 zlib deflate 压缩流（每个字符 charCode 低 8 位即一个字节），
 * 直接透传是乱码；laketable（多维表格）body 未压缩，结构为 columns + records。
 * 行列数各有上限，超限截断并在文末显式标注，防止超长表格撑爆下游上下文。</p>
 */
public final class YuqueLakeSheetConverter {

    static final int MAX_ROWS = 200;

    static final int MAX_COLS = 60;

    private YuqueLakeSheetConverter() {
    }

    /** 判断 body 是否为语雀表格类文档（lakesheet / laketable）。 */
    public static boolean isSheetBody(String body) {
        if (body == null) {
            return false;
        }
        String trimmed = body.trim();
        if (!trimmed.startsWith("{\"format\":\"lake")) {
            return false;
        }
        try {
            JsonCursor parsed = JsonCursor.of(JsonUtil.parse(trimmed));
            String format = text(parsed, "format");
            return "lakesheet".equals(format) || "laketable".equals(format);
        } catch (RuntimeException e) {
            return false;
        }
    }

    /**
     * 语雀表格类 body → markdown 表格文本。
     *
     * @throws IllegalArgumentException body 非法 JSON、sheet 解压失败或结构不符合预期
     */
    public static String convertToMarkdown(String body) {
        JsonCursor parsed;
        try {
            parsed = JsonCursor.of(JsonUtil.parse(body.trim()));
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("body 不是合法 JSON: " + e.getMessage(), e);
        }
        String format = text(parsed, "format");
        if ("laketable".equals(format) || "Table".equals(text(parsed, "type"))) {
            return dataTableToMarkdown(parsed);
        }
        return lakeSheetToMarkdown(parsed);
    }

    private static String lakeSheetToMarkdown(JsonCursor parsed) {
        JsonCursor sheetNode = parsed.path("sheet");
        if (sheetNode.isMissing() || sheetNode.isNull()) {
            throw new IllegalArgumentException("lakesheet 缺少 sheet 数据");
        }
        if (sheetNode.value() instanceof String) {
            sheetNode = inflateSheet(sheetNode.asText());
        }
        List<JsonCursor> sheets = new ArrayList<>();
        if (sheetNode.isArray()) {
            sheets.addAll(sheetNode.elements());
        } else {
            sheets.add(sheetNode);
        }
        if (sheets.isEmpty()) {
            throw new IllegalArgumentException("lakesheet 的 sheet 数据为空");
        }
        String text = sheets.size() == 1 ? sheetToMarkdown(sheets.get(0)) : joinMultiSheets(sheets);
        return text + chartNotes(parsed);
    }

    private static String joinMultiSheets(List<JsonCursor> sheets) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < sheets.size(); i++) {
            if (i > 0) {
                sb.append("\n\n");
            }
            sb.append("## ").append(sheetName(sheets.get(i), i)).append("\n\n")
                    .append(sheetToMarkdown(sheets.get(i)));
        }
        return sb.toString();
    }

    private static JsonCursor inflateSheet(String compressed) {
        byte[] data = new byte[compressed.length()];
        for (int i = 0; i < compressed.length(); i++) {
            data[i] = (byte) compressed.charAt(i);
        }
        byte[] plain = inflate(data, false);
        if (plain == null) {
            plain = inflate(data, true);
        }
        if (plain == null) {
            throw new IllegalArgumentException("sheet 数据 zlib 解压失败（非 zlib/raw-deflate 流）");
        }
        try {
            return JsonCursor.of(JsonUtil.parse(new String(plain, StandardCharsets.UTF_8)));
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("sheet 解压结果不是合法 JSON", e);
        }
    }

    private static byte[] inflate(byte[] data, boolean raw) {
        Inflater inflater = new Inflater(raw);
        try {
            inflater.setInput(data);
            ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(64, data.length * 4));
            byte[] buffer = new byte[8192];
            while (!inflater.finished()) {
                int n = inflater.inflate(buffer);
                if (n == 0) {
                    if (inflater.needsInput() || inflater.needsDictionary()) {
                        break;
                    }
                } else {
                    out.write(buffer, 0, n);
                }
            }
            return out.size() == 0 ? null : out.toByteArray();
        } catch (DataFormatException e) {
            return null;
        } finally {
            inflater.end();
        }
    }

    private static String sheetToMarkdown(JsonCursor sheet) {
        JsonCursor data = sheet.path("data");
        if (!data.isObject() || data.size() == 0) {
            return "（空表格）";
        }
        int maxRow = -1;
        int maxCol = -1;
        for (String rowKey : data.fieldNames()) {
            JsonCursor row = data.path(rowKey);
            if (!row.isObject()) {
                continue;
            }
            int r = parseIntSafe(rowKey);
            for (String cellKey : row.fieldNames()) {
                if (hasValue(row.path(cellKey))) {
                    maxRow = Math.max(maxRow, r);
                    maxCol = Math.max(maxCol, parseIntSafe(cellKey));
                }
            }
        }
        if (maxRow < 0 || maxCol < 0) {
            return "（空表格）";
        }
        boolean rowTruncated = maxRow + 1 > MAX_ROWS;
        boolean colTruncated = maxCol + 1 > MAX_COLS;
        int rows = Math.min(maxRow + 1, MAX_ROWS);
        int cols = Math.min(maxCol + 1, MAX_COLS);

        StringBuilder md = new StringBuilder();
        for (int r = 0; r < rows; r++) {
            md.append('|');
            for (int c = 0; c < cols; c++) {
                md.append(' ').append(escapeCell(cellValue(cellAt(data, r, c)))).append(" |");
            }
            md.append('\n');
            if (r == 0) {
                md.append('|');
                for (int c = 0; c < cols; c++) {
                    md.append(" --- |");
                }
                md.append('\n');
            }
        }
        if (rowTruncated) {
            md.append("\n> （表格共 ").append(maxRow + 1).append(" 行，超出 ").append(MAX_ROWS)
                    .append(" 行上限，仅展示前 ").append(MAX_ROWS).append(" 行）\n");
        }
        if (colTruncated) {
            md.append("\n> （表格共 ").append(maxCol + 1).append(" 列，超出 ").append(MAX_COLS)
                    .append(" 列上限，仅展示前 ").append(MAX_COLS).append(" 列）\n");
        }
        return md.toString();
    }

    /** 单元格取值：{@code data[row][col].v}；对象取 text / url / select.value，其余序列化兜底。 */
    private static String cellValue(JsonCursor cell) {
        if (cell == null || !cell.isObject()) {
            return "";
        }
        JsonCursor value = cell.path("v");
        if (value.isMissing() || value.isNull() || isEmptyText(value)) {
            return "";
        }
        if (value.isArray()) {
            return richText(value);
        }
        if (value.isObject()) {
            if ("select".equals(text(value, "class")) && value.path("value").isArray()) {
                StringBuilder selected = new StringBuilder();
                for (JsonCursor item : value.path("value").elements()) {
                    if (selected.length() > 0) {
                        selected.append(", ");
                    }
                    selected.append(richText(item));
                }
                return selected.toString();
            }
            if (value.has("text")) {
                return richText(value.path("text"));
            }
            if (value.has("url")) {
                return value.path("url").asText();
            }
            return serialize(value);
        }
        return value.asText();
    }

    /** 富文本取值：数组按分段递归拼接，节点取 text / insert 字段。 */
    private static String richText(JsonCursor node) {
        if (node == null || node.isMissing() || node.isNull()) {
            return "";
        }
        if (node.isArray()) {
            StringBuilder sb = new StringBuilder();
            for (JsonCursor item : node.elements()) {
                sb.append(richText(item));
            }
            return sb.toString();
        }
        if (node.isObject()) {
            if (node.has("text")) {
                return richText(node.path("text"));
            }
            if (node.has("insert")) {
                return richText(node.path("insert"));
            }
            return serialize(node);
        }
        return node.asText();
    }

    private static String dataTableToMarkdown(JsonCursor parsed) {
        JsonCursor sheetArr = parsed.path("sheet");
        if (!sheetArr.isArray() || sheetArr.size() == 0
                || !sheetArr.at(0).isObject()) {
            throw new IllegalArgumentException("laketable 缺少 sheet[0] 数据");
        }
        JsonCursor sheet = sheetArr.at(0);
        JsonCursor columns = sheet.path("columns");
        if (!columns.isArray() || columns.size() == 0) {
            return "（空表格）";
        }
        JsonCursor records = sheet.path("records");
        int recordCount = records.isArray() ? records.size() : 0;
        boolean rowTruncated = recordCount > MAX_ROWS;
        int rows = Math.min(recordCount, MAX_ROWS);

        StringBuilder md = new StringBuilder();
        md.append('|');
        for (JsonCursor column : columns.elements()) {
            String name = text(column, "name");
            md.append(' ').append(escapeCell(name != null ? name : text(column, "id"))).append(" |");
        }
        md.append('\n').append('|');
        for (JsonCursor ignored : columns.elements()) {
            md.append(" --- |");
        }
        md.append('\n');
        List<JsonCursor> columnList = columns.elements();
        for (int r = 0; r < rows; r++) {
            JsonCursor record = records.at(r);
            JsonCursor data = parseRecordData(record);
            md.append('|');
            for (JsonCursor column : columnList) {
                String value = "";
                String columnId = text(column, "id");
                if (data != null && columnId != null && data.has(columnId)
                        && data.path(columnId).isObject()) {
                    value = dataTableCellValue(data.path(columnId).path("value"), column);
                }
                md.append(' ').append(escapeCell(value)).append(" |");
            }
            md.append('\n');
        }
        if (rowTruncated) {
            md.append("\n> （数据表共 ").append(recordCount).append(" 行，超出 ").append(MAX_ROWS)
                    .append(" 行上限，仅展示前 ").append(MAX_ROWS).append(" 行）\n");
        }
        return md.toString();
    }

    private static JsonCursor parseRecordData(JsonCursor record) {
        if (record == null || !record.isObject()) {
            return null;
        }
        JsonCursor data = record.path("data");
        if (data.isMissing() || data.isNull()) {
            return null;
        }
        if (data.value() instanceof String) {
            try {
                return JsonCursor.of(JsonUtil.parse(data.asText()));
            } catch (RuntimeException e) {
                return null;
            }
        }
        return data.isObject() ? data : null;
    }

    /** 数据表单元格：select/multiSelect 选项 id → 文本，date/progress/mention 等规整。 */
    private static String dataTableCellValue(JsonCursor value, JsonCursor column) {
        if (value == null || value.isMissing() || value.isNull()) {
            return "";
        }
        String type = text(column, "type");
        if ("select".equals(type)) {
            return optionLabel(column, value);
        }
        if ("multiSelect".equals(type)) {
            if (!value.isArray()) {
                return value.asText();
            }
            StringBuilder sb = new StringBuilder();
            for (JsonCursor id : value.elements()) {
                if (sb.length() > 0) {
                    sb.append(", ");
                }
                sb.append(optionLabel(column, id));
            }
            return sb.toString();
        }
        if ("date".equals(type)) {
            if (value.isObject()) {
                String text = text(value, "text");
                if (text != null) {
                    return text;
                }
                String time = text(value, "time");
                if (time != null) {
                    return time.split("T")[0];
                }
            }
            return value.asText();
        }
        if ("checkbox".equals(type)) {
            return value.asBoolean(false) ? "✓" : "";
        }
        if ("progress".equals(type)) {
            try {
                return Math.round(Double.parseDouble(value.asText())) + "%";
            } catch (NumberFormatException e) {
                return "";
            }
        }
        if ("mention".equals(type)) {
            if (value.isObject()) {
                String name = text(value, "name");
                if (name != null) {
                    return name;
                }
                String login = text(value, "login");
                return login != null ? login : "";
            }
            return value.asText();
        }
        return value.isObject() ? serialize(value) : value.asText();
    }

    private static String optionLabel(JsonCursor column, JsonCursor id) {
        String idText = id == null || id.isMissing() || id.isNull() ? "" : id.asText();
        JsonCursor options = column.path("options");
        if (options.isArray()) {
            for (JsonCursor option : options.elements()) {
                if (idText.equals(text(option, "id"))) {
                    String label = text(option, "value");
                    if (label != null) {
                        return label;
                    }
                }
            }
        }
        return idText;
    }

    private static String chartNotes(JsonCursor parsed) {
        JsonCursor vessels = parsed.path("vessels");
        if (!vessels.isObject() || vessels.size() == 0) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (String key : vessels.fieldNames()) {
            JsonCursor vessel = vessels.path(key);
            if (!vessel.isObject() || !"chart".equals(text(vessel, "type"))) {
                continue;
            }
            String title = "未命名图表";
            JsonCursor configs = vessel.path("chartConfigs");
            if (configs.isObject()) {
                JsonCursor titles = configs.path("titles");
                if (titles.isObject() && text(titles, "title") != null) {
                    title = text(titles, "title");
                }
            }
            sb.append("> - 图表「").append(title).append("」（数据已包含在上方表格中）\n");
        }
        return sb.length() == 0 ? "" : "\n\n---\n\n> **图表信息**\n" + sb;
    }

    private static String sheetName(JsonCursor sheet, int index) {
        String name = text(sheet, "name");
        return name == null || name.isEmpty() ? "Sheet" + (index + 1) : name;
    }

    private static JsonCursor cellAt(JsonCursor data, int row, int col) {
        JsonCursor rowNode = data.path(String.valueOf(row));
        return rowNode.isObject() ? rowNode.path(String.valueOf(col)) : null;
    }

    private static boolean hasValue(JsonCursor cell) {
        if (cell == null || !cell.isObject()) {
            return false;
        }
        JsonCursor value = cell.path("v");
        return !value.isMissing() && !value.isNull() && !isEmptyText(value);
    }

    private static boolean isEmptyText(JsonCursor node) {
        return node.value() instanceof String && ((String) node.value()).isEmpty();
    }

    private static String escapeCell(String value) {
        return value == null ? "" : value.replace("|", "\\|").replace("\r", "").replace("\n", " ");
    }

    private static int parseIntSafe(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static String text(JsonCursor node, String field) {
        if (node == null || !node.isObject()) {
            return null;
        }
        JsonCursor value = node.path(field);
        return value.isMissing() || value.isNull() ? null : value.asText();
    }

    private static String serialize(JsonCursor node) {
        try {
            return JsonUtil.toJson(node.value());
        } catch (RuntimeException e) {
            return String.valueOf(node.value());
        }
    }
}
