package com.zifang.z.***REMOVED***.resource.ops;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.***REMOVED***.api.***REMOVED***Exception;
import com.zifang.z.***REMOVED***.api.graph.GraphEdgeView;
import com.zifang.z.***REMOVED***.api.graph.GraphNodeView;
import com.zifang.z.***REMOVED***.api.graph.GraphService;
import com.zifang.z.***REMOVED***.api.graph.GraphView;
import com.zifang.z.***REMOVED***.api.material.MaterialCompileSource;
import com.zifang.z.***REMOVED***.api.material.MaterialService;
import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;
import com.zifang.z.***REMOVED***.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.***REMOVED***.core.extraction.ExtractionEngine;
import com.zifang.z.***REMOVED***.storage.extraction.entity.GraphEdgeEntity;
import com.zifang.z.***REMOVED***.storage.extraction.entity.GraphNodeEntity;
import com.zifang.z.***REMOVED***.storage.extraction.mapper.GraphEdgeMapper;
import com.zifang.z.***REMOVED***.storage.extraction.mapper.GraphNodeMapper;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;

/**
 * 本地规则图谱查询默认实现：按知识库或物料返回节点与边，去重后稳定排序并截断。
 */
public class DefaultGraphService implements GraphService {

    private static final int MAX_ITEMS = 200;

    private static final int MAX_SCAN = 2000;

    private final GraphNodeMapper nodeMapper;

    private final GraphEdgeMapper edgeMapper;

    private final KnowledgeBaseResourceService resourceService;

    private final MaterialService materialService;

    public DefaultGraphService(GraphNodeMapper nodeMapper, GraphEdgeMapper edgeMapper,
                               KnowledgeBaseResourceService resourceService,
                               MaterialService materialService) {
        this.nodeMapper = nodeMapper;
        this.edgeMapper = edgeMapper;
        this.resourceService = resourceService;
        this.materialService = materialService;
    }

    @Override
    public GraphView queryBy***REMOVED***(String ***REMOVED***Id, String materialId, ***REMOVED***Caller caller) {
        if (***REMOVED***Id == null || ***REMOVED***Id.trim().isEmpty()) {
            throw new ***REMOVED***Exception("***REMOVED***PARAM_INVALID", "知识库参数不合法");
        }
        String ***REMOVED*** = resourceService.requireReadable(***REMOVED***Id.trim(), caller).get***REMOVED***Id();
        String material = materialId == null || materialId.trim().isEmpty()
                ? null : materialId.trim();

        List<GraphNodeEntity> nodes = nodeMapper.selectList(nodeQuery(caller.getTenantCode(), ***REMOVED***,
                material, MAX_SCAN));
        List<GraphEdgeEntity> edges = edgeMapper.selectList(edgeQuery(caller.getTenantCode(), ***REMOVED***,
                material, MAX_SCAN));
        List<GraphNodeEntity> uniqueNodes = dedupeNodes(nodes);
        List<GraphEdgeEntity> uniqueEdges = dedupeEdges(edges);

        GraphView view = new GraphView();
        view.set***REMOVED***Id(***REMOVED***);
        view.setGraphSpaceKey(ExtractionEngine.graphSpaceKey(***REMOVED***));
        view.setNodeCount(uniqueNodes.size());
        view.setEdgeCount(uniqueEdges.size());
        view.setTruncated(uniqueNodes.size() > MAX_ITEMS || uniqueEdges.size() > MAX_ITEMS
                || nodes.size() >= MAX_SCAN || edges.size() >= MAX_SCAN);
        view.setNodes(toNodeViews(uniqueNodes));
        view.setEdges(toEdgeViews(uniqueEdges));
        return view;
    }

    @Override
    public GraphView queryByMaterial(String materialId, ***REMOVED***Caller caller) {
        if (materialId == null || materialId.trim().isEmpty()) {
            throw new ***REMOVED***Exception("MATERIAL_PARAM_INVALID", "物料参数不合法");
        }
        MaterialCompileSource source = materialService.loadCompileSource(materialId.trim(), null,
                caller);
        String tenant = caller.getTenantCode();
        Long nodeCount = nodeMapper.selectCount(new QueryWrapper<GraphNodeEntity>()
                .eq("tenant_code", tenant)
                .eq("***REMOVED***_id", source.get***REMOVED***Id())
                .eq("material_id", source.getMaterialId())
                .eq("is_deleted", 0));
        Long edgeCount = edgeMapper.selectCount(new QueryWrapper<GraphEdgeEntity>()
                .eq("tenant_code", tenant)
                .eq("***REMOVED***_id", source.get***REMOVED***Id())
                .eq("material_id", source.getMaterialId())
                .eq("is_deleted", 0));

        GraphView view = new GraphView();
        view.set***REMOVED***Id(source.get***REMOVED***Id());
        view.setGraphSpaceKey(ExtractionEngine.graphSpaceKey(source.get***REMOVED***Id()));
        view.setNodeCount(nodeCount == null ? 0L : nodeCount);
        view.setEdgeCount(edgeCount == null ? 0L : edgeCount);
        view.setTruncated(view.getNodeCount() > MAX_ITEMS || view.getEdgeCount() > MAX_ITEMS);
        view.setNodes(toNodeViews(nodeMapper.selectList(nodeQuery(tenant, source.get***REMOVED***Id(),
                source.getMaterialId(), MAX_ITEMS))));
        view.setEdges(toEdgeViews(edgeMapper.selectList(edgeQuery(tenant, source.get***REMOVED***Id(),
                source.getMaterialId(), MAX_ITEMS))));
        return view;
    }

    private QueryWrapper<GraphNodeEntity> nodeQuery(String tenant, String ***REMOVED***Id, String materialId,
                                                    int limit) {
        QueryWrapper<GraphNodeEntity> query = new QueryWrapper<GraphNodeEntity>()
                .eq("tenant_code", tenant)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("is_deleted", 0);
        if (materialId != null) {
            query.eq("material_id", materialId);
        }
        query.orderByAsc("name").orderByAsc("node_id");
        if (limit > 0) {
            query.last("LIMIT " + limit);
        }
        return query;
    }

    private QueryWrapper<GraphEdgeEntity> edgeQuery(String tenant, String ***REMOVED***Id, String materialId,
                                                    int limit) {
        QueryWrapper<GraphEdgeEntity> query = new QueryWrapper<GraphEdgeEntity>()
                .eq("tenant_code", tenant)
                .eq("***REMOVED***_id", ***REMOVED***Id)
                .eq("is_deleted", 0);
        if (materialId != null) {
            query.eq("material_id", materialId);
        }
        query.orderByAsc("edge_id");
        if (limit > 0) {
            query.last("LIMIT " + limit);
        }
        return query;
    }

    /** 按节点 ID 去重并保持首次出现的顺序。 */
    private static List<GraphNodeEntity> dedupeNodes(List<GraphNodeEntity> nodes) {
        LinkedHashMap<String, GraphNodeEntity> unique = new LinkedHashMap<>();
        for (GraphNodeEntity node : nodes) {
            unique.putIfAbsent(node.getNodeId(), node);
        }
        return new ArrayList<>(unique.values());
    }

    /** 按边 ID 去重并保持首次出现的顺序。 */
    private static List<GraphEdgeEntity> dedupeEdges(List<GraphEdgeEntity> edges) {
        LinkedHashMap<String, GraphEdgeEntity> unique = new LinkedHashMap<>();
        for (GraphEdgeEntity edge : edges) {
            unique.putIfAbsent(edge.getEdgeId(), edge);
        }
        return new ArrayList<>(unique.values());
    }

    /** 节点按名称与 ID 排序、截断至上限后转为视图。 */
    private List<GraphNodeView> toNodeViews(List<GraphNodeEntity> nodes) {
        List<GraphNodeEntity> sorted = new ArrayList<>(nodes);
        sorted.sort(Comparator.comparing(GraphNodeEntity::getName,
                        Comparator.nullsLast(String::compareTo))
                .thenComparing(GraphNodeEntity::getNodeId, Comparator.nullsLast(String::compareTo)));
        if (sorted.size() > MAX_ITEMS) {
            sorted = new ArrayList<>(sorted.subList(0, MAX_ITEMS));
        }
        List<GraphNodeView> result = new ArrayList<>();
        for (GraphNodeEntity node : sorted) {
            GraphNodeView view = new GraphNodeView();
            view.setNodeId(node.getNodeId());
            view.setNodeType(node.getNodeType());
            view.setConceptId(node.getConceptId());
            view.setName(node.getName());
            view.setMaterialId(node.getMaterialId());
            view.setEvidence(node.getEvidenceJson());
            result.add(view);
        }
        return result;
    }

    /** 边按边 ID 排序、截断至上限后转为视图。 */
    private List<GraphEdgeView> toEdgeViews(List<GraphEdgeEntity> edges) {
        List<GraphEdgeEntity> sorted = new ArrayList<>(edges);
        sorted.sort(Comparator.comparing(GraphEdgeEntity::getEdgeId,
                Comparator.nullsLast(String::compareTo)));
        if (sorted.size() > MAX_ITEMS) {
            sorted = new ArrayList<>(sorted.subList(0, MAX_ITEMS));
        }
        List<GraphEdgeView> result = new ArrayList<>();
        for (GraphEdgeEntity edge : sorted) {
            GraphEdgeView view = new GraphEdgeView();
            view.setEdgeId(edge.getEdgeId());
            view.setEdgeType(edge.getEdgeType());
            view.setSourceNodeId(edge.getSourceNodeId());
            view.setTargetNodeId(edge.getTargetNodeId());
            view.setEvidence(edge.getEvidenceJson());
            result.add(view);
        }
        return result;
    }
}
