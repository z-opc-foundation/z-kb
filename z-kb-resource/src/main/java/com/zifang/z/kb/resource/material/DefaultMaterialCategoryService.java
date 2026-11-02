package com.zifang.z.kb.resource.material;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.zifang.z.kb.api.KBException;
import com.zifang.z.kb.api.material.MaterialCategoryNode;
import com.zifang.z.kb.api.material.MaterialCategoryService;
import com.zifang.z.kb.api.resource.KbCaller;
import com.zifang.z.kb.api.resource.KnowledgeBaseAction;
import com.zifang.z.kb.api.resource.KnowledgeBaseResourceService;
import com.zifang.z.kb.storage.material.entity.MaterialCategoryEntity;
import com.zifang.z.kb.storage.material.entity.MaterialEntity;
import com.zifang.z.kb.storage.material.mapper.MaterialCategoryMapper;
import com.zifang.z.kb.storage.material.mapper.MaterialMapper;
import com.zifang.util.json.JsonUtil;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 分类树默认实现：普通分类可增改移删，接入源同步出来的节点只读。
 */
public class DefaultMaterialCategoryService implements MaterialCategoryService {

    private static final int MAX_NAME_LENGTH = 50;
    private static final int MAX_DEPTH = 3;
    private static final int SORT_STEP = 10;

    private final MaterialCategoryMapper categoryMapper;
    private final MaterialMapper materialMapper;
    private final KnowledgeBaseResourceService resourceService;

    public DefaultMaterialCategoryService(MaterialCategoryMapper categoryMapper,
                                          MaterialMapper materialMapper,
                                          KnowledgeBaseResourceService resourceService) {
        this.categoryMapper = categoryMapper;
        this.materialMapper = materialMapper;
        this.resourceService = resourceService;
    }

    @Override
    public List<MaterialCategoryNode> tree(String kbId, KbCaller caller) {
        resourceService.requireReadable(kbId, caller);
        List<MaterialCategoryEntity> all = listByKb(caller.getTenantCode(), kbId.trim());
        Map<String, MaterialCategoryNode> nodes = new HashMap<>();
        for (MaterialCategoryEntity item : all) {
            nodes.put(item.getCategoryId(), toNode(item));
        }
        List<MaterialCategoryNode> roots = new ArrayList<>();
        for (MaterialCategoryEntity item : all) {
            MaterialCategoryNode node = nodes.get(item.getCategoryId());
            MaterialCategoryNode parent = hasText(item.getParentId())
                    ? nodes.get(item.getParentId()) : null;
            if (parent == null) {
                roots.add(node);
            } else {
                parent.getChildren().add(node);
            }
        }
        return roots;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaterialCategoryNode add(String kbId, String parentId, String name, KbCaller caller) {
        String tenant = caller.getTenantCode();
        resourceService.requireActionable(kbId, KnowledgeBaseAction.MATERIAL_WRITE, caller);
        String normalizedName = requireName(name);
        String normalizedParentId = hasText(parentId) ? parentId.trim() : null;

        List<MaterialCategoryEntity> all = listByKb(tenant, kbId.trim());
        if (normalizedParentId != null) {
            MaterialCategoryEntity parent = findById(all, normalizedParentId);
            if (parent == null) {
                throw new KBException("CATEGORY_NOT_FOUND", "分类不存在：" + normalizedParentId);
            }
            requireFolder(parent);
            if (depthOf(all, parent) >= MAX_DEPTH) {
                throw new KBException("CATEGORY_LEVEL_INVALID", "分类层级不能超过 " + MAX_DEPTH + " 级");
            }
        }
        if (countByParentAndName(all, normalizedParentId, normalizedName) > 0) {
            throw new KBException("CATEGORY_NAME_INVALID", "同级已存在同名分类：" + normalizedName);
        }

        MaterialCategoryEntity entity = new MaterialCategoryEntity();
        Instant now = Instant.now();
        entity.setId(UUID.randomUUID().toString());
        entity.setCategoryId(UUID.randomUUID().toString());
        entity.setTenantCode(tenant);
        entity.setKbId(kbId.trim());
        entity.setParentId(normalizedParentId);
        entity.setName(normalizedName);
        entity.setSortNo(nextSortNo(all, normalizedParentId));
        entity.setNodeKind(NODE_FOLDER);
        entity.setIsDeleted(0);
        entity.setCreateBy(caller.getActorId());
        entity.setUpdateBy(caller.getActorId());
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        categoryMapper.insert(entity);
        return toNode(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean update(String categoryId, String name, KbCaller caller) {
        String tenant = caller.getTenantCode();
        MaterialCategoryEntity entity = requireCategory(tenant, categoryId);
        resourceService.requireActionable(entity.getKbId(), KnowledgeBaseAction.MATERIAL_WRITE, caller);
        requireFolder(entity);
        String normalizedName = requireName(name);
        if (normalizedName.equals(entity.getName())) {
            return true;
        }
        List<MaterialCategoryEntity> all = listByKb(tenant, entity.getKbId());
        if (countByParentAndName(all, entity.getParentId(), normalizedName) > 0) {
            throw new KBException("CATEGORY_NAME_INVALID", "同级已存在同名分类：" + normalizedName);
        }
        entity.setName(normalizedName);
        entity.setUpdateBy(caller.getActorId());
        entity.setUpdateTime(Instant.now());
        return categoryMapper.updateById(entity) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean move(String categoryId, String parentId, KbCaller caller) {
        String tenant = caller.getTenantCode();
        MaterialCategoryEntity entity = requireCategory(tenant, categoryId);
        resourceService.requireActionable(entity.getKbId(), KnowledgeBaseAction.MATERIAL_WRITE, caller);
        requireFolder(entity);
        String normalizedParentId = hasText(parentId) ? parentId.trim() : null;
        List<MaterialCategoryEntity> all = listByKb(tenant, entity.getKbId());

        int parentDepth = 0;
        if (normalizedParentId != null) {
            MaterialCategoryEntity parent = findById(all, normalizedParentId);
            if (parent == null) {
                throw new KBException("CATEGORY_NOT_FOUND", "分类不存在：" + normalizedParentId);
            }
            requireFolder(parent);
            if (isAncestor(all, entity.getCategoryId(), normalizedParentId)) {
                throw new KBException("CATEGORY_LEVEL_INVALID", "不能移动到自身或其子孙分类下");
            }
            parentDepth = depthOf(all, parent);
        }
        if (parentDepth + subtreeHeight(all, entity.getCategoryId()) - 1 > MAX_DEPTH) {
            throw new KBException("CATEGORY_LEVEL_INVALID", "移动后分类层级超过 " + MAX_DEPTH + " 级");
        }
        if (sameParent(entity.getParentId(), normalizedParentId)) {
            return true;
        }
        if (countByParentAndName(all, normalizedParentId, entity.getName()) > 0) {
            throw new KBException("CATEGORY_NAME_INVALID", "同级已存在同名分类：" + entity.getName());
        }
        entity.setParentId(normalizedParentId);
        entity.setSortNo(nextSortNo(all, normalizedParentId));
        entity.setUpdateBy(caller.getActorId());
        entity.setUpdateTime(Instant.now());
        return categoryMapper.updateById(entity) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean remove(String categoryId, KbCaller caller) {
        String tenant = caller.getTenantCode();
        MaterialCategoryEntity entity = requireCategory(tenant, categoryId);
        resourceService.requireActionable(entity.getKbId(), KnowledgeBaseAction.MATERIAL_WRITE, caller);
        requireFolder(entity);
        QueryWrapper<MaterialCategoryEntity> children = new QueryWrapper<>();
        children.eq("tenant_code", tenant).eq("kb_id", entity.getKbId())
                .eq("parent_id", entity.getCategoryId()).eq("is_deleted", 0);
        Long childCount = categoryMapper.selectCount(children);
        if (childCount != null && childCount > 0) {
            throw new KBException("CATEGORY_HAS_CHILDREN", "分类下存在子分类，不能删除");
        }
        QueryWrapper<MaterialEntity> materials = new QueryWrapper<>();
        materials.eq("tenant_code", tenant).eq("kb_id", entity.getKbId())
                .eq("category_id", entity.getCategoryId()).eq("is_deleted", 0);
        Long materialCount = materialMapper.selectCount(materials);
        if (materialCount != null && materialCount > 0) {
            throw new KBException("CATEGORY_HAS_MATERIALS", "分类下仍有资料，不能删除");
        }
        QueryWrapper<MaterialCategoryEntity> delete = new QueryWrapper<>();
        delete.eq("tenant_code", tenant).eq("category_id", entity.getCategoryId());
        return categoryMapper.delete(delete) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MaterialCategoryNode ensureBoundNode(String kbId, String parentId, String nodeKind,
                                                String name, String bindKey,
                                                Map<String, Object> ext, KbCaller caller) {
        if (!hasText(kbId) || !hasText(nodeKind) || !hasText(bindKey)) {
            throw new KBException("CATEGORY_NAME_INVALID", "来源节点缺少知识库、节点性质或绑定键");
        }
        String tenant = caller.getTenantCode();
        resourceService.requireActionable(kbId.trim(), KnowledgeBaseAction.MATERIAL_WRITE, caller);
        String normalizedParentId = hasText(parentId) ? parentId.trim() : null;
        List<MaterialCategoryEntity> all = listByKb(tenant, kbId.trim());
        if (normalizedParentId != null) {
            MaterialCategoryEntity parent = findById(all, normalizedParentId);
            if (parent == null) {
                throw new KBException("CATEGORY_NOT_FOUND", "分类不存在：" + normalizedParentId);
            }
            if (depthOf(all, parent) >= MAX_DEPTH) {
                throw new KBException("CATEGORY_LEVEL_INVALID", "分类层级不能超过 " + MAX_DEPTH + " 级");
            }
        }
        String displayName = truncateName(name);
        String extJson = writeExt(bindKey, ext);

        MaterialCategoryEntity bound = findBound(all, normalizedParentId, nodeKind, bindKey);
        if (bound != null) {
            boolean changed = false;
            if (!displayName.equals(bound.getName())) {
                bound.setName(displayName);
                changed = true;
            }
            if (!extJson.equals(bound.getExtJson())) {
                bound.setExtJson(extJson);
                changed = true;
            }
            if (changed) {
                bound.setUpdateBy(caller.getActorId());
                bound.setUpdateTime(Instant.now());
                categoryMapper.updateById(bound);
            }
            return toNode(bound);
        }

        MaterialCategoryEntity entity = new MaterialCategoryEntity();
        Instant now = Instant.now();
        entity.setId(UUID.randomUUID().toString());
        entity.setCategoryId(UUID.randomUUID().toString());
        entity.setTenantCode(tenant);
        entity.setKbId(kbId.trim());
        entity.setParentId(normalizedParentId);
        entity.setName(displayName);
        entity.setSortNo(nextSortNo(all, normalizedParentId));
        entity.setNodeKind(nodeKind);
        entity.setExtJson(extJson);
        entity.setIsDeleted(0);
        entity.setCreateBy(caller.getActorId());
        entity.setUpdateBy(caller.getActorId());
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        categoryMapper.insert(entity);
        return toNode(entity);
    }

    private List<MaterialCategoryEntity> listByKb(String tenant, String kbId) {
        QueryWrapper<MaterialCategoryEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("kb_id", kbId).eq("is_deleted", 0)
                .orderByAsc("sort_no").orderByAsc("id");
        return categoryMapper.selectList(query);
    }

    private MaterialCategoryEntity requireCategory(String tenant, String categoryId) {
        if (!hasText(categoryId)) {
            throw new KBException("CATEGORY_NOT_FOUND", "分类不存在");
        }
        QueryWrapper<MaterialCategoryEntity> query = new QueryWrapper<>();
        query.eq("tenant_code", tenant).eq("category_id", categoryId.trim()).eq("is_deleted", 0);
        MaterialCategoryEntity entity = categoryMapper.selectOne(query);
        if (entity == null) {
            throw new KBException("CATEGORY_NOT_FOUND", "分类不存在：" + categoryId);
        }
        return entity;
    }

    private MaterialCategoryEntity findBound(List<MaterialCategoryEntity> all, String parentId,
                                             String nodeKind, String bindKey) {
        for (MaterialCategoryEntity item : all) {
            if (!sameParent(item.getParentId(), parentId)) {
                continue;
            }
            if (!nodeKind.equals(item.getNodeKind())) {
                continue;
            }
            Map<String, Object> ext = readExt(item.getExtJson());
            Object key = ext.get("key");
            if (key != null && bindKey.equals(String.valueOf(key))) {
                return item;
            }
        }
        return null;
    }

    private void requireFolder(MaterialCategoryEntity entity) {
        if (entity.getNodeKind() != null && !NODE_FOLDER.equals(entity.getNodeKind())) {
            throw new KBException("CATEGORY_BOUND_NODE_LOCKED", "来源节点由接入源配置维护，页面不可修改");
        }
    }

    private String requireName(String value) {
        if (!hasText(value)) {
            throw new KBException("CATEGORY_NAME_INVALID", "分类名称不能为空");
        }
        String name = value.trim();
        if (name.length() > MAX_NAME_LENGTH) {
            throw new KBException("CATEGORY_NAME_INVALID", "分类名称不超过 " + MAX_NAME_LENGTH + " 个字符");
        }
        return name;
    }

    /** 来源侧标题按列宽截断，避免超长标题把整次同步打挂。 */
    private String truncateName(String value) {
        String name = hasText(value) ? value.trim() : "";
        if (name.isEmpty()) {
            throw new KBException("CATEGORY_NAME_INVALID", "分类名称不能为空");
        }
        return name.length() > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
    }

    private String writeExt(String bindKey, Map<String, Object> ext) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("key", bindKey);
        if (ext != null) {
            payload.putAll(ext);
            payload.put("key", bindKey);
        }
        return JsonUtil.toJson(payload);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readExt(String json) {
        if (!hasText(json)) {
            return new HashMap<>();
        }
        try {
            Object plain = JsonUtil.toPlainValue(JsonUtil.parse(json));
            if (plain instanceof Map) {
                return (Map<String, Object>) plain;
            }
        } catch (RuntimeException ignored) {
            // 绑定信息损坏按无绑定处理，不影响普通分类展示
        }
        return new HashMap<>();
    }

    private MaterialCategoryEntity findById(List<MaterialCategoryEntity> all, String categoryId) {
        for (MaterialCategoryEntity item : all) {
            if (item.getCategoryId().equals(categoryId)) {
                return item;
            }
        }
        return null;
    }

    private int depthOf(List<MaterialCategoryEntity> all, MaterialCategoryEntity node) {
        int depth = 1;
        MaterialCategoryEntity cursor = node;
        while (hasText(cursor.getParentId()) && depth < 100) {
            cursor = findById(all, cursor.getParentId());
            if (cursor == null) {
                break;
            }
            depth++;
        }
        return depth;
    }

    private boolean isAncestor(List<MaterialCategoryEntity> all, String ancestorId, String candidateId) {
        String cursorId = candidateId;
        int guard = 0;
        while (hasText(cursorId) && guard++ < 100) {
            if (cursorId.equals(ancestorId)) {
                return true;
            }
            MaterialCategoryEntity cursor = findById(all, cursorId);
            if (cursor == null) {
                return false;
            }
            cursorId = cursor.getParentId();
        }
        return false;
    }

    private int subtreeHeight(List<MaterialCategoryEntity> all, String categoryId) {
        int height = 1;
        for (MaterialCategoryEntity item : all) {
            if (categoryId.equals(item.getParentId())) {
                height = Math.max(height, 1 + subtreeHeight(all, item.getCategoryId()));
            }
        }
        return height;
    }

    private int nextSortNo(List<MaterialCategoryEntity> all, String parentId) {
        int max = 0;
        for (MaterialCategoryEntity item : all) {
            if (sameParent(item.getParentId(), parentId) && item.getSortNo() != null
                    && item.getSortNo() > max) {
                max = item.getSortNo();
            }
        }
        return max + SORT_STEP;
    }

    private long countByParentAndName(List<MaterialCategoryEntity> all, String parentId, String name) {
        long count = 0;
        for (MaterialCategoryEntity item : all) {
            if (sameParent(item.getParentId(), parentId) && name.equals(item.getName())) {
                count++;
            }
        }
        return count;
    }

    private boolean sameParent(String left, String right) {
        if (!hasText(left)) {
            return !hasText(right);
        }
        return left.equals(right);
    }

    private MaterialCategoryNode toNode(MaterialCategoryEntity entity) {
        MaterialCategoryNode node = new MaterialCategoryNode();
        node.setCategoryId(entity.getCategoryId());
        node.setParentId(entity.getParentId());
        node.setName(entity.getName());
        node.setSortNo(entity.getSortNo());
        node.setNodeKind(hasText(entity.getNodeKind())
                ? entity.getNodeKind().toUpperCase(Locale.ROOT) : NODE_FOLDER);
        node.setExt(readExt(entity.getExtJson()));
        return node;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
