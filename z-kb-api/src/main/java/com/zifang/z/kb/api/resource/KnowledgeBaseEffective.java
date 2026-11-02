package com.zifang.z.kb.api.resource;

import java.util.ArrayList;
import java.util.List;

/**
 * 当前调用者在某个知识库中的有效权限快照。
 */
public class KnowledgeBaseEffective {

    private String kbId;
    private String actorId;
    private String role;
    private boolean owner;
    private boolean canEnter;
    private boolean canManageKb;
    private boolean canManageDoc;
    private boolean canReview;
    private List<String> actions = new ArrayList<>();

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getActorId() {
        return actorId;
    }

    public void setActorId(String actorId) {
        this.actorId = actorId;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isOwner() {
        return owner;
    }

    public void setOwner(boolean owner) {
        this.owner = owner;
    }

    public boolean isCanEnter() {
        return canEnter;
    }

    public void setCanEnter(boolean canEnter) {
        this.canEnter = canEnter;
    }

    public boolean isCanManageKb() {
        return canManageKb;
    }

    public void setCanManageKb(boolean canManageKb) {
        this.canManageKb = canManageKb;
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
