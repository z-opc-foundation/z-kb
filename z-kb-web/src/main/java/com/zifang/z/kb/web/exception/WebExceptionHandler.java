package com.zifang.z.kb.web.exception;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.protocol.response.ErrorResponse;
import com.zifang.z.kb.protocol.response.KbResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.HandlerMethod;

/**
 * 统一异常处理。
 *
 * <p>两套响应形状并存，按控制器所在包区分：</p>
 * <ul>
 *   <li>{@code com.zifang.z.kb.web.api.v1} 下的资源域接口用 {@link KbResult} 信封
 *       （参考实现口径：success/code/message/data，成功码 0）；</li>
 *   <li>既有 {@code /api/kb/*} 接口沿用 {@link ErrorResponse}（status/code/message 三键），
 *       维持既有契约测试与前端调用不变。</li>
 * </ul>
 */
@RestControllerAdvice
public class WebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(WebExceptionHandler.class);
    private static final String RESOURCE_API_PACKAGE = "com.zifang.z.kb.web.api.v1";

    @ExceptionHandler(KBException.class)
    public ResponseEntity<?> handleKB(KBException e, HandlerMethod method) {
        if (isResourceApi(method)) {
            int status = statusOf(e.getCode());
            return ResponseEntity.status(status).body(KbResult.fail(status, e.getMessage()));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(400, e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleOther(Exception e, HandlerMethod method) {
        log.error("Unhandled exception", e);
        if (isResourceApi(method)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(KbResult.fail(500, e.getMessage()));
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(500, e.getMessage()));
    }

    private boolean isResourceApi(HandlerMethod method) {
        if (method == null) {
            return false;
        }
        return method.getBeanType().getPackageName().startsWith(RESOURCE_API_PACKAGE);
    }

    /** 业务错误码 → HTTP 状态。未列出的按参数错误 400 处理。 */
    private int statusOf(String code) {
        if (code == null) {
            return 400;
        }
        switch (code) {
            case "KB_NOT_FOUND":
            case "KB_MEMBER_NOT_FOUND":
            case "KB_CONFIG_DRAFT_NOT_FOUND":
            case "MATERIAL_NOT_FOUND":
            case "CATEGORY_NOT_FOUND":
            case "MATERIAL_REPO_UNSUPPORTED":
            case "COMPILATION_JOB_NOT_FOUND":
            case "COMPILATION_BATCH_NOT_FOUND":
            case "KB_CONCEPT_NOT_FOUND":
            case "WIKI_PAGE_NOT_FOUND":
            case "EVAL_DATASET_NOT_FOUND":
            case "EVAL_RUN_NOT_FOUND":
            case "EVAL_BADCASE_NOT_FOUND":
                return 404;
            case "KB_FORBIDDEN":
            case "KB_ACTION_FORBIDDEN":
                return 403;
            case "KB_CONFLICT":
            case "KB_ALREADY_EXISTS":
            case "KB_CODE_DUPLICATE":
            case "KB_STATUS_INVALID":
            case "KB_MEMBER_LAST_ADMIN":
            case "KB_MEMBER_OWNER_PROTECTED":
            case "MATERIAL_STATUS_INVALID":
            case "MATERIAL_FILE_TOO_LARGE":
            case "CATEGORY_HAS_CHILDREN":
            case "CATEGORY_HAS_MATERIALS":
            case "CATEGORY_BOUND_NODE_LOCKED":
            case "COMPILATION_STATUS_INVALID":
            case "COMPILATION_BATCH_RUNNING":
            case "COMPILATION_SOURCE_NOT_READY":
            case "WIKI_SOURCE_NOT_READY":
            case "EVAL_DATASET_STATUS_INVALID":
            case "EVAL_DATASET_VERSION_MISMATCH":
            case "EVAL_RUN_BUSY":
            case "EVAL_RUN_NOT_REUSABLE":
            case "EVAL_SNAPSHOT_EMPTY":
            case "EVAL_SNAPSHOT_BUILD_FAILED":
            case "EVAL_BADCASE_STATUS_INVALID":
            case "KB_SOURCE_LIMIT":
                return 409;
            case "COMPILATION_PARAM_INVALID":
            case "COMPILATION_SCOPE_TYPE_INVALID":
            case "TASK_CONFIG_PARAM_INVALID":
            case "TASK_CONFIG_NATURE_MISSING":
            case "TASK_CONFIG_VERSION_INVALID":
            case "KB_PARAM_INVALID":
            case "AUDIT_LOG_NOT_FOUND":
            case "EVAL_PARAM_INVALID":
            case "EVAL_DATASET_EMPTY":
            case "EVAL_DATASET_TOO_MANY":
            case "EVAL_STAGE_INVALID":
            case "KB_SOURCE_CONFIG_INVALID":
            case "KB_SOURCE_PROVIDER_UNSUPPORTED":
                return 400;
            default:
                return 400;
        }
    }
}
