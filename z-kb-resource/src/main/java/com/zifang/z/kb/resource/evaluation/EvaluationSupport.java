package com.zifang.z.kb.resource.evaluation;

import com.zifang.util.json.JsonUtil;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.compilation.RetrievalState;
import com.zifang.z.kb.api.evaluation.EvalBadcaseStatus;
import com.zifang.z.kb.api.evaluation.EvalExpectedBehavior;
import com.zifang.z.kb.api.evaluation.EvalMetricStatus;
import com.zifang.z.kb.api.evaluation.EvalScopeType;
import com.zifang.z.kb.api.evaluation.EvaluationStage;
import com.zifang.z.kb.api.evaluation.EvaluationStatusCode;
import com.zifang.z.kb.storage.compilation.entity.RetrievalChunkEntity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 评测内核的共享工具：文本截断与序列化、数值规整、阶段解析与异常消息提取。
 *
 * <p>JSON 读写走 z-util {@link JsonUtil}，与 z-kb 其余域保持一致，不引入 Jackson。</p>
 */
final class EvaluationSupport {

    private EvaluationSupport() {
    }

    /** 按评测状态码构造业务异常。 */
    static KBException error(EvaluationStatusCode code) {
        return new KBException(code.code(), code.message());
    }

    /** 校验文本非空并去除首尾空白，为空时抛出指定业务状态码异常。 */
    static String requireText(String value, EvaluationStatusCode code) {
        if (!hasText(value)) {
            throw error(code);
        }
        return value.trim();
    }

    /** 文本非空时返回去空白结果，否则返回默认值。 */
    static String defaultText(String value, String defaultValue) {
        return hasText(value) ? value.trim() : defaultValue;
    }

    /** 将 null 转为空串，避免拼接与匹配时出现空指针。 */
    static String text(String value) {
        return value == null ? "" : value;
    }

    /** 将字符串截断到指定长度，null 原样返回。 */
    static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** 将标签去重、去空白后以逗号拼接并截断到 255 字符，空集合返回 null。 */
    static String joinTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (String tag : tags) {
            if (hasText(tag)) {
                values.add(tag.trim());
            }
        }
        if (values.isEmpty()) {
            return null;
        }
        return truncate(String.join(",", values), 255);
    }

    /** 将逗号分隔的标签串拆分为去空白列表。 */
    static List<String> splitTags(String tags) {
        List<String> values = new ArrayList<>();
        if (!hasText(tags)) {
            return values;
        }
        for (String tag : tags.split(",")) {
            if (hasText(tag)) {
                values.add(tag.trim());
            }
        }
        return values;
    }

    /** 将对象序列化为 JSON 文本，字符串原样返回，空值或失败返回 null。 */
    static String toJson(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String) {
            String text = (String) value;
            return hasText(text) ? text : null;
        }
        try {
            return JsonUtil.toJson(value);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    /** 将 JSON 文本解析为普通对象树，非 JSON 文本原样返回，空值返回 null。 */
    static Object parseJson(String value) {
        if (!hasText(value)) {
            return null;
        }
        Object plain = parsePlain(value);
        return plain == null ? value : plain;
    }

    /** 将逐题阶段追踪 JSON 解析为有序映射，坏数据返回空映射以免阻塞列表查询。 */
    static Map<String, String> parseStageTrace(String value) {
        Map<String, String> trace = new LinkedHashMap<>();
        Object plain = parsePlain(value);
        if (!(plain instanceof Map)) {
            return trace;
        }
        for (Map.Entry<?, ?> entry : ((Map<?, ?>) plain).entrySet()) {
            if (entry.getKey() != null) {
                trace.put(String.valueOf(entry.getKey()),
                        entry.getValue() == null ? null : String.valueOf(entry.getValue()));
            }
        }
        return trace;
    }

    /** 取异常消息，消息为空时退化为异常类名。 */
    static String messageOf(Throwable throwable) {
        String message = throwable.getMessage();
        return hasText(message) ? message : throwable.getClass().getSimpleName();
    }

    /** 解析 JSON 文本为普通对象树；空值或非法 JSON 返回 null，由调用方决定回落逻辑。 */
    static Object parsePlain(String value) {
        if (!hasText(value)) {
            return null;
        }
        try {
            return JsonUtil.toPlainValue(JsonUtil.parse(value));
        } catch (RuntimeException exception) {
            return null;
        }
    }

    /** 计算字符串的 SHA-256 十六进制摘要，算法不可用时抛快照构建失败异常。 */
    static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(text(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(bytes.length * 2);
            for (byte each : bytes) {
                builder.append(String.format(Locale.ROOT, "%02x", each & 0xff));
            }
            return builder.toString();
        } catch (Exception exception) {
            throw new KBException(EvaluationStatusCode.EVAL_SNAPSHOT_BUILD_FAILED.code(),
                    EvaluationStatusCode.EVAL_SNAPSHOT_BUILD_FAILED.message());
        }
    }

    /** 按最近秩法计算给定分位数（0–1），空列表返回 0。 */
    static double percentile(List<Long> values, double percentile) {
        if (values.isEmpty()) {
            return 0.0d;
        }
        List<Long> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int index = (int) Math.ceil(percentile * sorted.size()) - 1;
        if (index < 0) {
            index = 0;
        }
        if (index >= sorted.size()) {
            index = sorted.size() - 1;
        }
        return sorted.get(index).doubleValue();
    }

    /** 将数值保留 6 位小数并四舍五入。 */
    static double round(double value) {
        return BigDecimal.valueOf(value).setScale(6, RoundingMode.HALF_UP).doubleValue();
    }

    /** 将数值转为保留 6 位小数的 BigDecimal，供指标落库。 */
    static BigDecimal decimal(double value) {
        return BigDecimal.valueOf(value).setScale(6, RoundingMode.HALF_UP);
    }

    /** 将数值限制在 [0,1] 区间。 */
    static double clamp01(double value) {
        if (value < 0.0d) {
            return 0.0d;
        }
        return value > 1.0d ? 1.0d : value;
    }

    /** 返回分块字符数，优先取 charCount，缺省按正文长度计算。 */
    static int chunkLength(RetrievalChunkEntity chunk) {
        if (chunk.getCharCount() != null && chunk.getCharCount() > 0) {
            return chunk.getCharCount();
        }
        return chunk.getContent() == null ? 0 : chunk.getContent().length();
    }

    /** 判断分块是否已索引；z-kb 的索引态在编译期翻转为 INDEXED，向量按需惰性计算。 */
    static boolean isIndexed(RetrievalChunkEntity chunk) {
        return RetrievalState.INDEXED.name().equals(chunk.getIndexState());
    }

    /** 返回可运行的 S1–S8 阶段列表。 */
    static List<EvaluationStage> runnableStages() {
        return Collections.unmodifiableList(Arrays.asList(EvaluationStage.S1, EvaluationStage.S2,
                EvaluationStage.S3, EvaluationStage.S4, EvaluationStage.S5, EvaluationStage.S6,
                EvaluationStage.S7, EvaluationStage.S8));
    }

    /** 从阶段追踪中筛出状态为失败的阶段编码。 */
    static List<String> failingStages(Map<String, String> trace) {
        List<String> codes = new ArrayList<>();
        for (EvaluationStage stage : runnableStages()) {
            if (EvalMetricStatus.FAIL.name().equals(trace.get(stage.name()))) {
                codes.add(stage.name());
            }
        }
        return codes;
    }

    /** 解析评测范围，缺省为全量，非法值抛参数异常。 */
    static EvalScopeType parseScope(String value) {
        if (!hasText(value)) {
            return EvalScopeType.FULL;
        }
        try {
            return EvalScopeType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new KBException(EvaluationStatusCode.EVAL_PARAM_INVALID.code(),
                    EvaluationStatusCode.EVAL_PARAM_INVALID.message());
        }
    }

    /** 解析用例期望行为，缺省为作答，非法值抛参数异常。 */
    static EvalExpectedBehavior parseBehavior(String value) {
        if (!hasText(value)) {
            return EvalExpectedBehavior.ANSWER;
        }
        try {
            return EvalExpectedBehavior.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new KBException(EvaluationStatusCode.EVAL_PARAM_INVALID.code(),
                    EvaluationStatusCode.EVAL_PARAM_INVALID.message());
        }
    }

    /** 解析坏例处理状态，非法值抛坏例状态异常。 */
    static EvalBadcaseStatus parseBadcaseStatus(String value) {
        try {
            return EvalBadcaseStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new KBException(EvaluationStatusCode.EVAL_BADCASE_STATUS_INVALID.code(),
                    EvaluationStatusCode.EVAL_BADCASE_STATUS_INVALID.message());
        }
    }

    static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
