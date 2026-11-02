package com.zifang.z.kb.resource.source;

import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.source.IngestService;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceAccess;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceProvider;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceService;
import com.zifang.z.kb.api.source.KnowledgeBaseSourceSyncView;
import com.zifang.z.kb.core.source.IngestSyncInfo;
import com.zifang.z.kb.resource.KbAuditService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 接入源同步入口：校验库权限（KB_MANAGE）与同步范围后，按供应商分派连接器。
 *
 * <p>z-kb 没有独立任务内核，同步在请求内跑完并返回计数；{@code scopeId} 是本次运行的
 * 标识，{@code reusing} 恒为 false（没有可复用的并发任务）。</p>
 */
public class DefaultIngestService implements IngestService {

    private final KnowledgeBaseSourceService sourceService;

    private final List<IngestConnector> connectors;

    private final KbAuditService auditService;

    public DefaultIngestService(KnowledgeBaseSourceService sourceService,
            List<IngestConnector> connectors, KbAuditService auditService) {
        this.sourceService = sourceService;
        this.connectors = connectors == null ? new ArrayList<>() : connectors;
        this.auditService = auditService;
    }

    @Override
    public KnowledgeBaseSourceSyncView sync(String kbId, String sourceId, KbCaller caller) {
        if (kbId == null || kbId.trim().isEmpty() || sourceId == null
                || sourceId.trim().isEmpty()) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID", "同步需要知识库与接入源标识");
        }
        KnowledgeBaseSourceAccess source = sourceService.requireAccess(kbId, sourceId, caller);
        IngestConnector connector = connectorOf(source);
        connector.checkScope(source);

        String safeKbId = kbId.trim();
        IngestSyncInfo info = connector.sync(safeKbId, source, caller);
        auditService.record(caller, safeKbId, "kb.source.sync", "SOURCE", source.getSourceId(),
                info.getSummary());
        return toView(source, info);
    }

    private KnowledgeBaseSourceSyncView toView(KnowledgeBaseSourceAccess source,
            IngestSyncInfo info) {
        KnowledgeBaseSourceSyncView view = new KnowledgeBaseSourceSyncView();
        view.setScopeId(UUID.randomUUID().toString());
        view.setSourceId(source.getSourceId());
        view.setProvider(source.getProvider());
        view.setReusing(false);
        view.setSummary(info.getSummary());
        view.setCreated(info.getCreated());
        view.setUpdated(info.getUpdated());
        view.setUnchanged(info.getUnchanged());
        view.setSkipped(info.getSkipped());
        view.setRetired(info.getRetired());
        view.setFailed(info.getFailed());
        view.setFailures(info.getFailures());
        return view;
    }

    /** 找到能处理该供应商的连接器；停用或未接入的供应商直接拒绝。 */
    private IngestConnector connectorOf(KnowledgeBaseSourceAccess source) {
        if (source.getEnabled() != null && !source.getEnabled()) {
            throw new KBException("KB_SOURCE_CONFIG_INVALID", "接入源已停用，不能同步");
        }
        KnowledgeBaseSourceProvider provider = KnowledgeBaseSourceProvider.of(
                source.getProvider());
        if (provider != null) {
            for (IngestConnector connector : connectors) {
                if (connector.provider() == provider) {
                    return connector;
                }
            }
        }
        throw new KBException("KB_SOURCE_PROVIDER_UNSUPPORTED",
                "该供应商暂不支持同步：" + source.getProvider());
    }
}
