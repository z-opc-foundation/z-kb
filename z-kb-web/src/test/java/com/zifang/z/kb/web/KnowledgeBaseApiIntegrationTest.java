package com.zifang.z.***REMOVED***.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 资源域 v1 REST 集成测试：真起 Spring 容器 + H2，按参考实现的路径与信封钉契约。
 */
@SpringBootTest(classes = ***REMOVED***ApiTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:z***REMOVED***-api;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "z***REMOVED***.vector.storage-type=in-memory",
        "z***REMOVED***.graph.engine=json",
        "z***REMOVED***.graph.path=target/test-***REMOVED***/graph",
        "z***REMOVED***.storage.path=target/test-***REMOVED***/api-z***REMOVED***.json",
        "spring.main.banner-mode=off"
})
@AutoConfigureMockMvc
class KnowledgeBaseApiIntegrationTest {

    private static final String TENANT = "t-api";
    private static final String OWNER_ID = "u-owner";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String uniqueCode() {
        return "api_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private Map<String, Object> create(String code) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "接口测试库");
        body.put("code", code);
        body.put("type", "FILE");
        body.put("description", "集成测试");
        MvcResult result = mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/add")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("ok"))
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
    }

    @Test
    @DisplayName("创建/分页/详情：请求头解析租户与操作人，信封带 data")
    @SuppressWarnings("unchecked")
    void createPageAndDetailFollowEnvelope() throws Exception {
        String code = uniqueCode();
        Map<String, Object> created = create(code);
        Map<String, Object> data = (Map<String, Object>) created.get("data");
        assertEquals("***REMOVED***ADMIN", data.get("role"));
        assertEquals("ACTIVE", data.get("status"));
        assertEquals(Boolean.TRUE, data.get("canManage"));

        String ***REMOVED***Id = (String) data.get("***REMOVED***Id");

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/page")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].code").value(code));

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/page")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0));

        mvc.perform(get("/api/***REMOVED***/v1/knowledgeBase/queryDetailById")
                        .param("***REMOVED***Id", ***REMOVED***Id)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.***REMOVED***Id").value(***REMOVED***Id));
    }

    @Test
    @DisplayName("错误：未知库 404，信封 success=false、code=404 且 data 键仍在")
    void notFoundUsesErrorEnvelope() throws Exception {
        mvc.perform(get("/api/***REMOVED***/v1/knowledgeBase/queryDetailById")
                        .param("***REMOVED***Id", "not-exists")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.data").exists());
    }

    @Test
    @DisplayName("配置：草稿 → 校验 → 发布（confirm 必填）")
    @SuppressWarnings("unchecked")
    void configDraftPublishFlow() throws Exception {
        String code = uniqueCode();
        Map<String, Object> created = create(code);
        String ***REMOVED***Id = (String) ((Map<String, Object>) created.get("data")).get("***REMOVED***Id");

        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("***REMOVED***Id", ***REMOVED***Id);
        draft.put("presetVersion", "default");
        draft.put("parserPolicy", Map.of("ocr", true));
        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/saveConfigDraft")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(draft)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.versionNo").value(2))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/validateConfigDraft")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"***REMOVED***Id\":\"" + ***REMOVED***Id + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(true))
                .andExpect(jsonPath("$.data.changedCount").value(1));

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/publishConfig")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"***REMOVED***Id\":\"" + ***REMOVED***Id + "\",\"confirm\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/publishConfig")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"***REMOVED***Id\":\"" + ***REMOVED***Id + "\",\"confirm\":true,\"remark\":\"上线\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CURRENT"))
                .andExpect(jsonPath("$.data.versionNo").value(2));

        mvc.perform(get("/api/***REMOVED***/v1/knowledgeBase/queryConfig")
                        .param("***REMOVED***Id", ***REMOVED***Id)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.current.versionNo").value(2))
                .andExpect(jsonPath("$.data.draft").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @DisplayName("成员：授权后对方可见并拿到有效权限，未授权方 403")
    void memberGrantAndEffective() throws Exception {
        String code = uniqueCode();
        Map<String, Object> created = create(code);
        String ***REMOVED***Id = (String) ((Map<String, Object>) created.get("data")).get("***REMOVED***Id");

        mvc.perform(post("/api/***REMOVED***/v1/knowledgeBase/member/grant")
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"***REMOVED***Id\":\"" + ***REMOVED***Id + "\",\"principalId\":\"u-reader\",\"role\":\"READER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("READER"));

        mvc.perform(get("/api/***REMOVED***/v1/knowledgeBase/member/list")
                        .param("***REMOVED***Id", ***REMOVED***Id)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", OWNER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].owner").value(true));

        mvc.perform(get("/api/***REMOVED***/v1/knowledgeBase/member/effective")
                        .param("***REMOVED***Id", ***REMOVED***Id)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", "u-reader"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("READER"))
                .andExpect(jsonPath("$.data.canManage***REMOVED***").value(false));

        mvc.perform(get("/api/***REMOVED***/v1/knowledgeBase/member/effective")
                        .param("***REMOVED***Id", ***REMOVED***Id)
                        .header("X-Tenant-Code", TENANT)
                        .header("X-Actor-Id", "u-nobody"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }
}
