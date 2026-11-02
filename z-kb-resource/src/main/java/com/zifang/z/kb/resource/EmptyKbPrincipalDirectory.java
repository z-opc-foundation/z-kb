package com.zifang.z.kb.resource;

import com.zifang.z.kb.api.resource.KbPrincipalDirectory;
import com.zifang.z.kb.api.resource.KnowledgeBaseMemberCandidate;

import java.util.Collections;
import java.util.List;

/**
 * 默认主体目录：不接入身份系统时返回空结果，成员功能降级但不报错。
 */
public class EmptyKbPrincipalDirectory implements KbPrincipalDirectory {

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public List<KnowledgeBaseMemberCandidate> search(String tenantCode, String keyword, int limit) {
        return Collections.emptyList();
    }

    @Override
    public KnowledgeBaseMemberCandidate findById(String tenantCode, String principalId) {
        return null;
    }
}
