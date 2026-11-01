package com.zifang.z.***REMOVED***.resource;

import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBase;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseAction;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseActivityPoint;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseEffective;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMember;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberAdminService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseQuery;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseRole;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseStatus;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseType;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseView;
import com.zifang.z.***REMOVED***.api.resource.PageResult;
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
@SpringBootTest(classes = ***REMOVED***ResourceTestApplication.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:***REMOVED***-resource;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "***REMOVED***.storage.path=target/test-***REMOVED***/resource-***REMOVED***.json",
        "spring.main.banner-mode=off"
})
class KnowledgeBaseResourceServiceIntegrationTest {

    @Autowired
    private KnowledgeBaseResourceService resourceService;

    @Autowired
    private KnowledgeBaseMemberAdminService memberService;

    private ***REMOVED***Caller owner(String tenant) {
        return ***REMOVED***Caller.of(tenant, "u-owner");
    }

    private KnowledgeBase draft(String code) {
        KnowledgeBase ***REMOVED*** = new KnowledgeBase();
        ***REMOVED***.setName("测试知识库-" + code);
        ***REMOVED***.setCode(code);
        ***REMOVED***.setType(KnowledgeBaseType.FILE);
        ***REMOVED***.setDescription("集成测试");
        return ***REMOVED***;
    }

    private String uniqueCode() {
        return "***REMOVED***_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
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

        assertNotNull(view.get***REMOVED***Id());
        assertEquals(KnowledgeBaseStatus.ACTIVE, view.getStatus());
        assertEquals("tfidf", view.getEmbeddingModel());
        assertEquals("u-owner", view.getOwnerId());
        assertEquals(KnowledgeBaseRole.***REMOVED***ADMIN.name(), view.getRole());
        assertTrue(view.isCanManage());
        assertTrue(view.isCanManageDoc());
        assertTrue(view.isCanReview());
        assertEquals(9, view.getActions().size());
        assertTrue(view.getActions().contains(KnowledgeBaseAction.MEMBER_MANAGE.getCode()));

        KnowledgeBaseView reloaded = resourceService.detail(view.get***REMOVED***Id(), owner(tenant));
        assertEquals(code, reloaded.getCode());

        Map<String, List<KnowledgeBaseActivityPoint>> activity = resourceService.heatmap(
                Collections.singletonList(view.get***REMOVED***Id()), 7, owner(tenant));
        List<KnowledgeBaseActivityPoint> points = activity.get(view.get***REMOVED***Id());
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

        ***REMOVED***Exception duplicate = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.create(draft(code), owner(tenant)));
        assertEquals("***REMOVED***CODE_DUPLICATE", duplicate.getCode());

        ***REMOVED***Exception invalidCode = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.create(draft("1bad"), owner(tenant)));
        assertEquals("***REMOVED***CODE_INVALID", invalidCode.getCode());

        KnowledgeBase tooLong = draft(uniqueCode());
        tooLong.setName(repeat('名', 101));
        ***REMOVED***Exception invalidName = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.create(tooLong, owner(tenant)));
        assertEquals("***REMOVED***NAME_INVALID", invalidName.getCode());

        // 编码唯一性只在租户内成立
        String otherTenant = uniqueTenant();
        assertNotNull(resourceService.create(draft(code), owner(otherTenant)).get***REMOVED***Id());
    }

    @Test
    @DisplayName("可见范围：所有者可见；无 ACL 的同租户用户不可见；授权后按角色可见")
    void pageRespectsAclVisibility() {
        String tenant = uniqueTenant();
        String code = uniqueCode();
        KnowledgeBaseView ***REMOVED*** = resourceService.create(draft(code), owner(tenant));
        ***REMOVED***Caller stranger = ***REMOVED***Caller.of(tenant, "u-stranger");

        PageResult<KnowledgeBaseView> ownerPage = resourceService.page(new KnowledgeBaseQuery(), owner(tenant));
        assertEquals(1, ownerPage.getTotal());
        assertEquals(1, ownerPage.getRecords().size());

        PageResult<KnowledgeBaseView> strangerPage = resourceService.page(new KnowledgeBaseQuery(), stranger);
        assertEquals(0, strangerPage.getTotal());
        ***REMOVED***Exception forbidden = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.detail(***REMOVED***.get***REMOVED***Id(), stranger));
        assertEquals("***REMOVED***FORBIDDEN", forbidden.getCode());

        memberService.grant(***REMOVED***.get***REMOVED***Id(), "u-stranger", "EDITOR", owner(tenant));

        PageResult<KnowledgeBaseView> grantedPage = resourceService.page(new KnowledgeBaseQuery(), stranger);
        assertEquals(1, grantedPage.getTotal());
        KnowledgeBaseView granted = grantedPage.getRecords().get(0);
        assertEquals(KnowledgeBaseRole.EDITOR.name(), granted.getRole());
        assertFalse(granted.isCanManage());
        assertTrue(granted.isCanManageDoc());

        ***REMOVED***Exception cannotManage = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.update(***REMOVED***.get***REMOVED***Id(), "改名", null, stranger));
        assertEquals("***REMOVED***ACTION_FORBIDDEN", cannotManage.getCode());

        // 其他租户即便知道 ***REMOVED***Id 也查不到（租户谓词先于 ACL）
        ***REMOVED***Exception crossTenant = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.detail(***REMOVED***.get***REMOVED***Id(), owner(uniqueTenant())));
        assertEquals("***REMOVED***NOT_FOUND", crossTenant.getCode());
    }

    @Test
    @DisplayName("生命周期：更新 → 归档 → 分页隐藏/含归档可见 → 恢复 → 删除前置状态校验")
    void lifecycleFollowsStatusMachine() {
        String tenant = uniqueTenant();
        String code = uniqueCode();
        KnowledgeBaseView ***REMOVED*** = resourceService.create(draft(code), owner(tenant));

        KnowledgeBaseView updated = resourceService.update(***REMOVED***.get***REMOVED***Id(), "新名字", "新描述", owner(tenant));
        assertEquals("新名字", updated.getName());
        assertEquals("新描述", updated.getDescription());

        assertTrue(resourceService.archive(***REMOVED***.get***REMOVED***Id(), owner(tenant)));
        assertEquals(KnowledgeBaseStatus.ARCHIVED,
                resourceService.detail(***REMOVED***.get***REMOVED***Id(), owner(tenant)).getStatus());

        assertEquals(0, resourceService.page(new KnowledgeBaseQuery(), owner(tenant)).getTotal());
        KnowledgeBaseQuery includeArchived = new KnowledgeBaseQuery();
        includeArchived.setIncludeArchived(true);
        assertEquals(1, resourceService.page(includeArchived, owner(tenant)).getTotal());

        ***REMOVED***Exception archivedUpdate = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.update(***REMOVED***.get***REMOVED***Id(), "再改", null, owner(tenant)));
        assertEquals("***REMOVED***STATUS_INVALID", archivedUpdate.getCode());

        assertTrue(resourceService.restore(***REMOVED***.get***REMOVED***Id(), owner(tenant)));
        assertEquals(KnowledgeBaseStatus.ACTIVE,
                resourceService.detail(***REMOVED***.get***REMOVED***Id(), owner(tenant)).getStatus());
        assertNull(resourceService.detail(***REMOVED***.get***REMOVED***Id(), owner(tenant)).getArchivedAt());

        ***REMOVED***Exception activeRemove = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.remove(***REMOVED***.get***REMOVED***Id(), owner(tenant)));
        assertEquals("***REMOVED***STATUS_INVALID", activeRemove.getCode());

        resourceService.archive(***REMOVED***.get***REMOVED***Id(), owner(tenant));
        assertTrue(resourceService.remove(***REMOVED***.get***REMOVED***Id(), owner(tenant)));
        ***REMOVED***Exception gone = assertThrows(***REMOVED***Exception.class,
                () -> resourceService.detail(***REMOVED***.get***REMOVED***Id(), owner(tenant)));
        assertEquals("***REMOVED***NOT_FOUND", gone.getCode());
    }

    @Test
    @DisplayName("成员：仅管理员可管、创建者不可降级/移除、角色校验、授权后可读")
    void memberAdminProtectsOwnerAndValidatesRole() {
        String tenant = uniqueTenant();
        KnowledgeBaseView ***REMOVED*** = resourceService.create(draft(uniqueCode()), owner(tenant));

        ***REMOVED***Exception stranger = assertThrows(***REMOVED***Exception.class,
                () -> memberService.grant(***REMOVED***.get***REMOVED***Id(), "u-bob", "READER",
                        ***REMOVED***Caller.of(tenant, "u-bob")));
        assertEquals("***REMOVED***FORBIDDEN", stranger.getCode());

        memberService.grant(***REMOVED***.get***REMOVED***Id(), "u-bob", "READER", owner(tenant));
        ***REMOVED***Exception notManager = assertThrows(***REMOVED***Exception.class,
                () -> memberService.grant(***REMOVED***.get***REMOVED***Id(), "u-carol", "READER",
                        ***REMOVED***Caller.of(tenant, "u-bob")));
        assertEquals("***REMOVED***ACTION_FORBIDDEN", notManager.getCode());

        ***REMOVED***Exception badRole = assertThrows(***REMOVED***Exception.class,
                () -> memberService.grant(***REMOVED***.get***REMOVED***Id(), "u-bob", "SUPERUSER", owner(tenant)));
        assertEquals("***REMOVED***MEMBER_ROLE_INVALID", badRole.getCode());

        ***REMOVED***Exception ownerDowngrade = assertThrows(***REMOVED***Exception.class,
                () -> memberService.grant(***REMOVED***.get***REMOVED***Id(), "u-owner", "READER", owner(tenant)));
        assertEquals("***REMOVED***MEMBER_OWNER_PROTECTED", ownerDowngrade.getCode());

        KnowledgeBaseMember granted = memberService.grant(***REMOVED***.get***REMOVED***Id(), "u-bob", "REVIEWER", owner(tenant));
        assertEquals(KnowledgeBaseRole.REVIEWER, granted.getRole());
        assertFalse(granted.isOwner());

        List<KnowledgeBaseMember> members = memberService.listMembers(***REMOVED***.get***REMOVED***Id(), owner(tenant));
        assertEquals(2, members.size());
        assertTrue(members.get(0).isOwner());
        assertEquals("u-bob", members.get(1).getPrincipalId());

        // 未接身份目录时候选为空，但授权/移除照常工作
        assertTrue(memberService.searchCandidates(***REMOVED***.get***REMOVED***Id(), null, owner(tenant)).isEmpty());

        ***REMOVED***Caller reviewer = ***REMOVED***Caller.of(tenant, "u-bob");
        KnowledgeBaseEffective effective = memberService.effective(***REMOVED***.get***REMOVED***Id(), reviewer);
        assertEquals(KnowledgeBaseRole.REVIEWER.name(), effective.getRole());
        assertTrue(effective.isCanEnter());
        assertFalse(effective.isCanManage***REMOVED***());
        assertTrue(effective.isCanReview());
        assertTrue(effective.getActions().contains(KnowledgeBaseAction.MATERIAL_REVIEW.getCode()));
        assertFalse(effective.getActions().contains(KnowledgeBaseAction.MATERIAL_WRITE.getCode()));

        ***REMOVED***Exception ownerRevoke = assertThrows(***REMOVED***Exception.class,
                () -> memberService.revoke(***REMOVED***.get***REMOVED***Id(), "u-owner", owner(tenant)));
        assertEquals("***REMOVED***MEMBER_OWNER_PROTECTED", ownerRevoke.getCode());

        ***REMOVED***Exception notMember = assertThrows(***REMOVED***Exception.class,
                () -> memberService.revoke(***REMOVED***.get***REMOVED***Id(), "u-nobody", owner(tenant)));
        assertEquals("***REMOVED***MEMBER_NOT_FOUND", notMember.getCode());

        assertTrue(memberService.revoke(***REMOVED***.get***REMOVED***Id(), "u-bob", owner(tenant)));
        assertEquals(1, memberService.listMembers(***REMOVED***.get***REMOVED***Id(), owner(tenant)).size());
    }

    private static String repeat(char ch, int count) {
        StringBuilder builder = new StringBuilder(count);
        for (int i = 0; i < count; i++) {
            builder.append(ch);
        }
        return builder.toString();
    }
}
