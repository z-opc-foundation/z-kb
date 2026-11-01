package com.zifang.z.***REMOVED***.api.material;

import com.zifang.z.***REMOVED***.api.resource.***REMOVED***Caller;

import java.util.List;
import java.util.Map;

/**
 * 库内资料分类。分类树只服务页面组织，不改变物料归属。
 * 接入源同步出来的节点（SOURCE / SOURCE_BOOK / SOURCE_REPO）也挂在同一棵树上，由接入源配置维护，页面只读。
 */
public interface MaterialCategoryService {

    /** 普通分类节点。 */
    String NODE_FOLDER = "FOLDER";

    /** 接入源节点，ext 绑定 sourceId / provider / namespace。 */
    String NODE_SOURCE = "SOURCE";

    /** 来源下的知识库节点，ext 绑定 sourceId / namespace / book。 */
    String NODE_SOURCE_BOOK = "SOURCE_BOOK";

    /** 来源下的代码项目节点（一个仓库一个），ext 绑定 sourceId / repo / branch。 */
    String NODE_SOURCE_REPO = "SOURCE_REPO";

    /**
     * 来源下的本地目录节点（一个目录一个），ext 绑定 sourceId / dir。
     *
     * <p>与 {@link #NODE_SOURCE_REPO} 同构：接入源本身可能只有一个，但本地目录
     * 接入源天然对应一个物理路径，单独一层节点方便在资料树上直接看到「这个库
     * 吸的是哪个文件夹」。
     */
    String NODE_SOURCE_LOCAL_DIR = "SOURCE_LOCAL_DIR";

    /** 返回知识库的分类树（根节点列表，子节点挂在 children 上）。 */
    List<MaterialCategoryNode> tree(String ***REMOVED***Id, ***REMOVED***Caller caller);

    /** 在指定父分类下新增分类，受 3 层深度与同级重名约束。 */
    MaterialCategoryNode add(String ***REMOVED***Id, String parentId, String name, ***REMOVED***Caller caller);

    /** 重命名分类，同级重名时失败。 */
    boolean update(String categoryId, String name, ***REMOVED***Caller caller);

    /** 移动分类到新的父分类（parentId 为空表示移到根层级），受 3 层深度与同级重名约束。 */
    boolean move(String categoryId, String parentId, ***REMOVED***Caller caller);

    /** 删除分类，存在子分类或仍挂有物料时禁止删除。 */
    boolean remove(String categoryId, ***REMOVED***Caller caller);

    /**
     * 幂等确保一个来源节点存在：同一 parentId 下按 nodeKind + bindKey 复用，显示名随来源变化更新。
     * bindKey 写进 ext 的 key 字段，普通分类不参与匹配。
     */
    MaterialCategoryNode ensureBoundNode(String ***REMOVED***Id, String parentId, String nodeKind, String name,
            String bindKey, Map<String, Object> ext, ***REMOVED***Caller caller);
}
