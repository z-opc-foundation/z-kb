package com.zifang.z.***REMOVED***.resource;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***PrincipalDirectory;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseMemberCandidate;

import java.util.Collections;
import java.util.List;

/**
 * 默认主体目录：不接入身份系统时返回空结果，成员功能降级但不报错。
 */
public class Empty***REMOVED***PrincipalDirectory implements ***REMOVED***PrincipalDirectory {

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
