package com.zifang.z.kb.resource;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.ConfigDiff;
import com.zifang.z.kb.api.resource.ConfigImpact;
import com.zifang.z.kb.api.resource.ConfigIssue;
import com.zifang.z.kb.api.resource.ConfigValidation;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigService;
import com.zifang.z.kb.api.resource.KnowledgeBaseConfigView;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseProfileVersion;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.resource.ProfileVersionStatus;
import com.zifang.z.kb.storage.resource.entity.KnowledgeBaseProfileEntity;
import com.zifang.z.kb.storage.resource.mapper.KnowledgeBaseProfileMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 配置版本集成测试：草稿 → 校验 → 发布，钉住 diff / impact / validation 与服务端保护。
 */
@SpringBootTest(classes = KbResourceTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-config;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/config-zkb.json",
        "spring.main.banner-mode=off"
})
class KnowledgeBaseConfigServiceIntegrationTest {

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private KnowledgeBaseConfigService configService;

    @Autowired
    private KnowledgeBaseProfileMapper profileMapper;

    @Autowired
    private KnowledgeBaseMemberAdminService memberAdminService;

    private KnowledgeBaseView createKb(KbCaller caller) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("配置测试库");
        kb.setCode("cfg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        kb.setType(KnowledgeBaseType.FILE);
        return resourceService.create(kb, caller);
    }

    private KnowledgeBaseProfileVersion draftWithParser(Map<String, Object> parser) {
        KnowledgeBaseProfileVersion draft = new KnowledgeBaseProfileVersion();
        draft.setPresetVersion("default");
        draft.setParserPolicy(parser);
        return draft;
    }

    @Test
    @DisplayName("新库查询：自动补建 v1 当前版本，默认预设与空接入策略，无草稿")
    void queryBootstrapsCurrentVersion() {
        KbCaller caller = KbCaller.of("t-cfg-boot", "u-owner");
        KnowledgeBaseView kb = createKb(caller);

        KnowledgeBaseConfigView view = configService.query(kb.getKbId(), caller);
        assertNotNull(view.getCurrent());
        assertEquals(1, view.getCurrent().getVersionNo());
        assertEquals(ProfileVersionStatus.CURRENT, view.getCurrent().getStatus());
        assertEquals("default", view.getCurrent().getPresetVersion());
        assertTrue(view.getCurrent().getParserPolicy().isEmpty());
        assertEquals(1, view.getCurrent().getSourcePolicy().get("version"));
        assertNull(view.getDraft());
        assertTrue(view.getDiff().isEmpty());
        assertEquals("NONE", view.getImpact().getRebuildMode());
        assertFalse(view.getValidation().isValid());
        assertEquals(1, view.getVersions().size());
    }

    @Test
    @DisplayName("草稿：保存生成 v2 DRAFT，diff/impact 标 FULL，校验通过")
    void saveDraftBuildsDiffAndValidation() {
        KbCaller caller = KbCaller.of("t-cfg-draft", "u-owner");
        KnowledgeBaseView kb = createKb(caller);

        Map<String, Object> parser = new LinkedHashMap<>();
        parser.put("ocr", true);
        KnowledgeBaseProfileVersion saved = configService.saveDraft(
                kb.getKbId(), draftWithParser(parser), caller);

        assertEquals(2, saved.getVersionNo());
        assertEquals(ProfileVersionStatus.DRAFT, saved.getStatus());
        assertEquals(Boolean.TRUE, saved.getParserPolicy().get("ocr"));

        KnowledgeBaseConfigView view = configService.query(kb.getKbId(), caller);
        assertNotNull(view.getDraft());
        assertEquals(1, view.getDiff().size());
        ConfigDiff diff = view.getDiff().get(0);
        assertEquals("parserPolicy", diff.getField());
        assertEquals("解析策略", diff.getLabel());
        assertEquals("FULL", diff.getScope());

        ConfigImpact impact = view.getImpact();
        assertEquals("FULL", impact.getRebuildMode());
        assertTrue(impact.getNotes().stream().anyMatch(note -> note.contains("全量重建")));

        ConfigValidation validation = view.getValidation();
        assertTrue(validation.isValid());
        assertEquals(1, validation.getChangedCount());
        assertTrue(validation.getItems().stream()
                .filter(ConfigIssue::isOk)
                .anyMatch(item -> "policy".equals(item.getCode())));

        ConfigValidation standalone = configService.validateDraft(kb.getKbId(), caller);
        assertTrue(standalone.isValid());
        assertEquals(1, standalone.getChangedCount());
    }

    @Test
    @DisplayName("发布：未确认拒绝；确认后当前版本更替、旧版本 SUPERSEDED、档案主表同步")
    void publishSupersedesAndSyncsProfile() {
        KbCaller caller = KbCaller.of("t-cfg-publish", "u-owner");
        KnowledgeBaseView kb = createKb(caller);

        Map<String, Object> parser = new LinkedHashMap<>();
        parser.put("ocr", true);
        configService.saveDraft(kb.getKbId(), draftWithParser(parser), caller);

        KBException noConfirm = assertThrows(KBException.class,
                () -> configService.publish(kb.getKbId(), null, false, caller));
        assertEquals("KB_CONFIG_CONFIRM_REQUIRED", noConfirm.getCode());

        KnowledgeBaseProfileVersion published = configService.publish(
                kb.getKbId(), "上线新解析策略", true, caller);
        assertEquals(ProfileVersionStatus.CURRENT, published.getStatus());
        assertEquals(2, published.getVersionNo());
        assertEquals("u-owner", published.getPublishedBy());
        assertEquals("上线新解析策略", published.getRemark());

        KnowledgeBaseConfigView view = configService.query(kb.getKbId(), caller);
        assertEquals(2, view.getCurrent().getVersionNo());
        assertEquals(Boolean.TRUE, view.getCurrent().getParserPolicy().get("ocr"));
        assertNull(view.getDraft());
        assertEquals(2, view.getVersions().size());
        assertTrue(view.getVersions().stream()
                .anyMatch(version -> version.getStatus() == ProfileVersionStatus.SUPERSEDED));

        QueryWrapper<KnowledgeBaseProfileEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", kb.getTenantCode()).eq("kb_id", kb.getKbId());
        KnowledgeBaseProfileEntity profile = profileMapper.selectOne(query);
        assertNotNull(profile);
        assertEquals(2, profile.getConfigVersion());
        assertTrue(profile.getParserPolicy().contains("ocr"));
    }

    @Test
    @DisplayName("发布：没有草稿/草稿无变更时拒绝")
    void publishRequiresDraftAndChanges() {
        KbCaller caller = KbCaller.of("t-cfg-guard", "u-owner");
        KnowledgeBaseView kb = createKb(caller);

        KBException noDraft = assertThrows(KBException.class,
                () -> configService.publish(kb.getKbId(), null, true, caller));
        assertEquals("KB_CONFIG_DRAFT_NOT_FOUND", noDraft.getCode());

        configService.saveDraft(kb.getKbId(), draftWithParser(new LinkedHashMap<>()), caller);
        KBException noChange = assertThrows(KBException.class,
                () -> configService.publish(kb.getKbId(), null, true, caller));
        assertEquals("KB_CONFIG_DRAFT_INVALID", noChange.getCode());
    }

    @Test
    @DisplayName("草稿：丢弃后查询回到无草稿；非法预设/超大策略拒绝")
    void discardAndValidationLimits() {
        KbCaller caller = KbCaller.of("t-cfg-discard", "u-owner");
        KnowledgeBaseView kb = createKb(caller);

        configService.saveDraft(kb.getKbId(), draftWithParser(new LinkedHashMap<>()), caller);
        assertNotNull(configService.query(kb.getKbId(), caller).getDraft());

        assertTrue(configService.discardDraft(kb.getKbId(), caller));
        assertNull(configService.query(kb.getKbId(), caller).getDraft());

        KnowledgeBaseProfileVersion longPreset = new KnowledgeBaseProfileVersion();
        longPreset.setPresetVersion(repeat('p', 33));
        KBException presetTooLong = assertThrows(KBException.class,
                () -> configService.saveDraft(kb.getKbId(), longPreset, caller));
        assertEquals("KB_CONFIG_DRAFT_INVALID", presetTooLong.getCode());

        Map<String, Object> huge = new LinkedHashMap<>();
        huge.put("blob", repeat('x', 2100));
        KBException policyTooLarge = assertThrows(KBException.class,
                () -> configService.saveDraft(kb.getKbId(), draftWithParser(huge), caller));
        assertEquals("KB_CONFIG_DRAFT_INVALID", policyTooLarge.getCode());
    }

    @Test
    @DisplayName("权限：只读成员可查/可校验，但保存草稿与发布被动作矩阵拦住")
    void readOnlyMemberCannotManageConfig() {
        KbCaller owner = KbCaller.of("t-cfg-acl", "u-owner");
        KnowledgeBaseView kb = createKb(owner);
        KbCaller reader = KbCaller.of("t-cfg-acl", "u-reader");

        KBException invisible = assertThrows(KBException.class,
                () -> configService.query(kb.getKbId(), reader));
        assertEquals("KB_FORBIDDEN", invisible.getCode());

        memberAdminService.grant(kb.getKbId(), "u-reader", "READER", owner);

        assertNotNull(configService.query(kb.getKbId(), reader).getCurrent());
        assertFalse(configService.validateDraft(kb.getKbId(), reader).isValid());

        Map<String, Object> parser = new LinkedHashMap<>();
        parser.put("ocr", true);
        KBException saveForbidden = assertThrows(KBException.class,
                () -> configService.saveDraft(kb.getKbId(), draftWithParser(parser), reader));
        assertEquals("KB_ACTION_FORBIDDEN", saveForbidden.getCode());

        KBException publishForbidden = assertThrows(KBException.class,
                () -> configService.publish(kb.getKbId(), null, true, reader));
        assertEquals("KB_ACTION_FORBIDDEN", publishForbidden.getCode());
    }

    private static String repeat(char ch, int count) {
        StringBuilder builder = new StringBuilder(count);
        for (int i = 0; i < count; i++) {
            builder.append(ch);
        }
        return builder.toString();
    }
}
