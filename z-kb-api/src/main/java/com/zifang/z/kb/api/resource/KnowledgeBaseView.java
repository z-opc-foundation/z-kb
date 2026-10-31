package com.zifang.z.kb.api.resource;

import java.util.ArrayList;
import java.util.List;

/**
 * 知识库视图：在基础字段上叠加当前调用者的角色与能力位（对齐参考实现 KnowledgeBaseResponse）。
 */
public class KnowledgeBaseView extends KnowledgeBase {

    /** 当前调用者在本库的角色 */
    private String role;
    private boolean canManage;
    private boolean canManageDoc;
    private boolean canReview;
    /** 当前角色可执行的动作码，供前端渲染可用操作 */
    private List<String> actions = new ArrayList<>();

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isCanManage() {
        return canManage;
    }

    public void setCanManage(boolean canManage) {
        this.canManage = canManage;
    }

    public boolean isCanManageDoc() {
        return canManageDoc;
    }

    public void setCanManageDoc(boolean canManageDoc) {
        this.canManageDoc = canManageDoc;
    }

    public boolean isCanReview() {
        return canReview;
    }

    public void setCanReview(boolean canReview) {
        this.canReview = canReview;
    }

    public List<String> getActions() {
        return actions;
    }

    public void setActions(List<String> actions) {
        this.actions = actions;
    }
}
