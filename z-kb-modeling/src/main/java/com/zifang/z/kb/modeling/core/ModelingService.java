package com.zifang.z.kb.modeling.core;

import com.zifang.z.kb.api.Chunk;
import com.zifang.z.kb.api.Document;
import com.zifang.z.kb.api.Entity;
import com.zifang.z.kb.api.KnowledgeBaseService;
import com.zifang.z.kb.api.Relation;
import com.zifang.z.kb.modeling.extractor.CausalChainExtractor;
import com.zifang.z.kb.modeling.extractor.ProductDecomposer;
import com.zifang.z.kb.modeling.generator.CheatSheetGenerator;
import com.zifang.z.kb.modeling.model.CheatSheet;
import com.zifang.z.kb.modeling.model.ProductModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * 建模服务 — 知识库 → 产品模型 → 小抄 的主流程。
 *
 * <p>用法：
 * <pre>
 *   ProductModel pm = modelingService.decompose(workspace);
 *   CheatSheet cs = modelingService.generateCheatSheet(pm);
 * </pre>
 */
public class ModelingService {

    private static final Logger log = LoggerFactory.getLogger(ModelingService.class);

    private final KnowledgeBaseService kbService;
    private final ProductDecomposer decomposer = new ProductDecomposer();
    private final CausalChainExtractor causalExtractor = new CausalChainExtractor();
    private final CheatSheetGenerator cheatsheetGenerator = new CheatSheetGenerator();

    public ModelingService(KnowledgeBaseService kbService) {
        this.kbService = kbService;
    }

    /** 拆解一个工作台下的全部文档为一个产品模型 */
    public ProductModel decompose(String workspace) {
        List<Document> docs = kbService.listDocuments(workspace, 0, 200);
        if (docs.isEmpty()) {
            log.warn("工作台 {} 下没有文档，无法建模", workspace);
            ProductModel empty = new ProductModel();
            empty.setProductName("空工作台");
            empty.setTagline("该工作台还没有文档，先去接入一些文档吧");
            return empty;
        }

        // 收集所有 chunk / entity / relation
        List<Chunk> allChunks = new ArrayList<>();
        for (Document d : docs) {
            try {
                List<Chunk> chunks = kbService.getChunks(d.getWorkspace(), d.getId());
                if (chunks != null) allChunks.addAll(chunks);
            } catch (Exception e) {
                log.warn("读取文档 {} 的 chunk 失败: {}", d.getId(), e.getMessage());
            }
        }

        // 工作台级实体 / 关系
        List<Entity> allEntities = new ArrayList<>();
        try {
            allEntities = kbService.listEntities(workspace, 1000);
        } catch (Exception e) {
            log.warn("读取实体失败: {}", e.getMessage());
        }

        // 关系通过子图方式间接获取
        List<Relation> allRelations = new ArrayList<>();
        try {
            List<String> entNames = new ArrayList<>();
            for (Entity e : allEntities) entNames.add(e.getCanonicalName());
            if (!entNames.isEmpty()) {
                var sg = kbService.getSubgraph(workspace, entNames, 1);
                if (sg != null && sg.getEdges() != null) allRelations.addAll(sg.getEdges());
            }
        } catch (Exception e) {
            log.warn("读取关系失败: {}", e.getMessage());
        }

        // 拆解
        ProductModel model = decomposer.decompose(docs, allChunks, allEntities, allRelations);

        // 因果链
        List<ProductModel.CausalLink> links = causalExtractor.extract(docs, allChunks);
        model.setCausalChain(links);

        model.getMetadata().put("documentCount", docs.size());
        model.getMetadata().put("chunkCount", allChunks.size());
        model.getMetadata().put("entityCount", allEntities.size());
        model.getMetadata().put("relationCount", allRelations.size());
        model.getMetadata().put("causalLinkCount", links.size());

        log.info("建模完成：工作台 {} → 产品「{}」，{} 文档 / {} chunk / {} 实体 / {} 因果链",
                workspace, model.getProductName(), docs.size(), allChunks.size(), allEntities.size(), links.size());
        return model;
    }

    /** 把 ProductModel 渲染成 Markdown 小抄 */
    public CheatSheet generateCheatSheet(ProductModel model) {
        return cheatsheetGenerator.generate(model);
    }

    /** 一站式：拆解 + 渲染 */
    public CheatSheet generateCheatSheet(String workspace) {
        return cheatsheetGenerator.generate(decompose(workspace));
    }
}