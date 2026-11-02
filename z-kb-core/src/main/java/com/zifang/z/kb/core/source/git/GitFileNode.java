package com.zifang.z.kb.core.source.git;

/** Git 仓库文件树节点：type 为 blob/tree，id 为 blob 版本（文件内容变化即变化）。 */
public class GitFileNode {

    private final String path;
    private final String type;
    private final String id;

    public GitFileNode(String path, String type, String id) {
        this.path = path;
        this.type = type;
        this.id = id;
    }

    public String getPath() {
        return path;
    }

    public String getType() {
        return type;
    }

    public String getId() {
        return id;
    }
}
