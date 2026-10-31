package com.zifang.z.kb.resource;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBase;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseActivityPoint;
import com.zifang.z.kb.api.resource.KnowledgeBaseEffective;
import com.zifang.z.kb.api.resource.KnowledgeBaseMember;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.kb.api.resource.KnowledgeBaseQuery;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.api.resource.KnowledgeBaseRole;
import com.zifang.z.kb.api.resource.KnowledgeBaseStatus;
import com.zifang.z.kb.api.resource.KnowledgeBaseType;
import com.zifang.z.kb.api.resource.KnowledgeBaseView;
import com.zifang.z.kb.api.resource.PageResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Collections;
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
 * 知识库资源域集成测试：H2(MySQL 模式) 真跑 SQL，钉住生命周期、可见范围、ACL 与活跃度。
 */
@SpringBootTest(classes = KbResourceTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:zkb-resource;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "zkb.storage.path=target/test-kb/resource-zkb.json",
        "spring.main.banner-mode=off"
})
class KnowledgeBaseResourceServiceIntegrationTest {

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private KnowledgeBaseMemberAdminService memberService;

    private KbCaller owner(String tenant) {
        return KbCaller.of(tenant, "u-owner");
    }

    private KnowledgeBase draft(String code) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setName("测试知识库-" + code);
        kb.setCode(code);
        kb.setType(KnowledgeBaseType.FILE);
        kb.setDescription("集成测试");
        return kb;
    }

    private String uniqueCode() {
        return "kb_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private String uniqueTenant() {
        return "t-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    @DisplayName("创建：默认值、所有者即管理员、动作矩阵与审计活跃度")
    void createAssignsDefaultsAndOwnerAdmin() {
        String tenant = uniqueTenant();
        String code = uniqueCode();
        KnowledgeBaseView view = resourceService.create(draft(code), owner(tenant));

        assertNotNull(view.getKbId());
        assertEquals(KnowledgeBaseStatus.ACTIVE, view.getStatus());
        assertEquals("tfidf", view.getEmbeddingModel());
        assertEquals("u-owner", view.getOwnerId());
        assertEquals(KnowledgeBaseRole.KB_ADMIN.name(), view.getRole());
        assertTrue(view.isCanManage());
        assertTrue(view.isCanManageDoc());
        assertTrue(view.isCanReview());
        assertEquals(9, view.getActions().size());
        assertTrue(view.getActions().contains(KnowledgeBaseAction.MEMBER_MANAGE.getCode()));

        KnowledgeBaseView reloaded = resourceService.detail(view.getKbId(), owner(tenant));
        assertEquals(code, reloaded.getCode());

        Map<String, List<KnowledgeBaseActivityPoint>> activity = resourceService.heatmap(
                Collections.singletonList(view.getKbId()), 7, owner(tenant));
        List<KnowledgeBaseActivityPoint> points = activity.get(view.getKbId());
        assertNotNull(points);
        assertFalse(points.isEmpty());
        assertEquals(1L, points.get(points.size() - 1).getCount());
    }

    @Test
    @DisplayName("创建：编码重复/非法、名称超长按参考实现的错误码拒绝")
    void createValidatesInput() {
        String tenant = uniqueTenant();
        String code = uniqueCode();
        resourceService.create(draft(code), owner(tenant));

        KBException duplicate = assertThrows(KBException.class,
                () -> resourceService.create(draft(code), owner(tenant)));
        assertEquals("KB_CODE_DUPLICATE", duplicate.getCode());

        KBException invalidCode = assertThrows(KBException.class,
                () -> resourceService.create(draft("1bad"), owner(tenant)));
        assertEquals("KB_CODE_INVALID", invalidCode.getCode());

        KnowledgeBase tooLong = draft(uniqueCode());
        tooLong.setName(repeat('名', 101));
        KBException invalidName = assertThrows(KBException.class,
                () -> resourceService.create(tooLong, owner(tenant)));
        assertEquals("KB_NAME_INVALID", invalidName.getCode());

        // 编码唯一性只在租户内成立
        String otherTenant = uniqueTenant();
        assertNotNull(resourceService.create(draft(code), owner(otherTenant)).getKbId());
    }

    @Test
    @DisplayName("可见范围：所有者可见；无 ACL 的同租户用户不可见；授权后按角色可见")
    void pageRespectsAclVisibility() {
        String tenant = uniqueTenant();
        String code = uniqueCode();
        KnowledgeBaseView kb = resourceService.create(draft(code), owner(tenant));
        KbCaller stranger = KbCaller.of(tenant, "u-stranger");

        PageResult<KnowledgeBaseView> ownerPage = resourceService.page(new KnowledgeBaseQuery(), owner(tenant));
        assertEquals(1, ownerPage.getTotal());
        assertEquals(1, ownerPage.getRecords().size());

        PageResult<KnowledgeBaseView> strangerPage = resourceService.page(new KnowledgeBaseQuery(), stranger);
        assertEquals(0, strangerPage.getTotal());
        KBException forbidden = assertThrows(KBException.class,
                () -> resourceService.detail(kb.getKbId(), stranger));
        assertEquals("KB_FORBIDDEN", forbidden.getCode());

        memberService.grant(kb.getKbId(), "u-stranger", "EDITOR", owner(tenant));

        PageResult<KnowledgeBaseView> grantedPage = resourceService.page(new KnowledgeBaseQuery(), stranger);
        assertEquals(1, grantedPage.getTotal());
        KnowledgeBaseView granted = grantedPage.getRecords().get(0);
        assertEquals(KnowledgeBaseRole.EDITOR.name(), granted.getRole());
        assertFalse(granted.isCanManage());
        assertTrue(granted.isCanManageDoc());

        KBException cannotManage = assertThrows(KBException.class,
                () -> resourceService.update(kb.getKbId(), "改名", null, stranger));
        assertEquals("KB_ACTION_FORBIDDEN", cannotManage.getCode());

        // 其他租户即便知道 kbId 也查不到（租户谓词先于 ACL）
        KBException crossTenant = assertThrows(KBException.class,
                () -> resourceService.detail(kb.getKbId(), owner(uniqueTenant())));
        assertEquals("KB_NOT_FOUND", crossTenant.getCode());
    }

    @Test
    @DisplayName("生命周期：更新 → 归档 → 分页隐藏/含归档可见 → 恢复 → 删除前置状态校验")
    void lifecycleFollowsStatusMachine() {
        String tenant = uniqueTenant();
        String code = uniqueCode();
        KnowledgeBaseView kb = resourceService.create(draft(code), owner(tenant));

        KnowledgeBaseView updated = resourceService.update(kb.getKbId(), "新名字", "新描述", owner(tenant));
        assertEquals("新名字", updated.getName());
        assertEquals("新描述", updated.getDescription());

        assertTrue(resourceService.archive(kb.getKbId(), owner(tenant)));
        assertEquals(KnowledgeBaseStatus.ARCHIVED,
                resourceService.detail(kb.getKbId(), owner(tenant)).getStatus());

        assertEquals(0, resourceService.page(new KnowledgeBaseQuery(), owner(tenant)).getTotal());
        KnowledgeBaseQuery includeArchived = new KnowledgeBaseQuery();
        includeArchived.setIncludeArchived(true);
        assertEquals(1, resourceService.page(includeArchived, owner(tenant)).getTotal());

        KBException archivedUpdate = assertThrows(KBException.class,
                () -> resourceService.update(kb.getKbId(), "再改", null, owner(tenant)));
        assertEquals("KB_STATUS_INVALID", archivedUpdate.getCode());

        assertTrue(resourceService.restore(kb.getKbId(), owner(tenant)));
        assertEquals(KnowledgeBaseStatus.ACTIVE,
                resourceService.detail(kb.getKbId(), owner(tenant)).getStatus());
        assertNull(resourceService.detail(kb.getKbId(), owner(tenant)).getArchivedAt());

        KBException activeRemove = assertThrows(KBException.class,
                () -> resourceService.remove(kb.getKbId(), owner(tenant)));
        assertEquals("KB_STATUS_INVALID", activeRemove.getCode());

        resourceService.archive(kb.getKbId(), owner(tenant));
        assertTrue(resourceService.remove(kb.getKbId(), owner(tenant)));
        KBException gone = assertThrows(KBException.class,
                () -> resourceService.detail(kb.getKbId(), owner(tenant)));
        assertEquals("KB_NOT_FOUND", gone.getCode());
    }

    @Test
    @DisplayName("成员：仅管理员可管、创建者不可降级/移除、角色校验、授权后可读")
    void memberAdminProtectsOwnerAndValidatesRole() {
        String tenant = uniqueTenant();
        KnowledgeBaseView kb = resourceService.create(draft(uniqueCode()), owner(tenant));

        KBException stranger = assertThrows(KBException.class,
                () -> memberService.grant(kb.getKbId(), "u-bob", "READER",
                        KbCaller.of(tenant, "u-bob")));
        assertEquals("KB_FORBIDDEN", stranger.getCode());

        memberService.grant(kb.getKbId(), "u-bob", "READER", owner(tenant));
        KBException notManager = assertThrows(KBException.class,
                () -> memberService.grant(kb.getKbId(), "u-carol", "READER",
                        KbCaller.of(tenant, "u-bob")));
        assertEquals("KB_ACTION_FORBIDDEN", notManager.getCode());

        KBException badRole = assertThrows(KBException.class,
                () -> memberService.grant(kb.getKbId(), "u-bob", "SUPERUSER", owner(tenant)));
        assertEquals("KB_MEMBER_ROLE_INVALID", badRole.getCode());

        KBException ownerDowngrade = assertThrows(KBException.class,
                () -> memberService.grant(kb.getKbId(), "u-owner", "READER", owner(tenant)));
        assertEquals("KB_MEMBER_OWNER_PROTECTED", ownerDowngrade.getCode());

        KnowledgeBaseMember granted = memberService.grant(kb.getKbId(), "u-bob", "REVIEWER", owner(tenant));
        assertEquals(KnowledgeBaseRole.REVIEWER, granted.getRole());
        assertFalse(granted.isOwner());

        List<KnowledgeBaseMember> members = memberService.listMembers(kb.getKbId(), owner(tenant));
        assertEquals(2, members.size());
        assertTrue(members.get(0).isOwner());
        assertEquals("u-bob", members.get(1).getPrincipalId());

        // 未接身份目录时候选为空，但授权/移除照常工作
        assertTrue(memberService.searchCandidates(kb.getKbId(), null, owner(tenant)).isEmpty());

        KbCaller reviewer = KbCaller.of(tenant, "u-bob");
        KnowledgeBaseEffective effective = memberService.effective(kb.getKbId(), reviewer);
        assertEquals(KnowledgeBaseRole.REVIEWER.name(), effective.getRole());
        assertTrue(effective.isCanEnter());
        assertFalse(effective.isCanManageKb());
        assertTrue(effective.isCanReview());
        assertTrue(effective.getActions().contains(KnowledgeBaseAction.MATERIAL_REVIEW.getCode()));
        assertFalse(effective.getActions().contains(KnowledgeBaseAction.MATERIAL_WRITE.getCode()));

        KBException ownerRevoke = assertThrows(KBException.class,
                () -> memberService.revoke(kb.getKbId(), "u-owner", owner(tenant)));
        assertEquals("KB_MEMBER_OWNER_PROTECTED", ownerRevoke.getCode());

        KBException notMember = assertThrows(KBException.class,
                () -> memberService.revoke(kb.getKbId(), "u-nobody", owner(tenant)));
        assertEquals("KB_MEMBER_NOT_FOUND", notMember.getCode());

        assertTrue(memberService.revoke(kb.getKbId(), "u-bob", owner(tenant)));
        assertEquals(1, memberService.listMembers(kb.getKbId(), owner(tenant)).size());
    }

    private static String repeat(char ch, int count) {
        StringBuilder builder = new StringBuilder(count);
        for (int i = 0; i < count; i++) {
            builder.append(ch);
        }
        return builder.toString();
    }
}
