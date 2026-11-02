package com.zifang.z.kb.api.material;

/**
 * 代码仓库项目里的一个条目：目录或文件。路径是仓库内相对路径。
 */
public class RepoEntry {

    public static final String TYPE_DIR = "DIR";
    public static final String TYPE_FILE = "FILE";

    private String name;
    private String path;
    private String entryType;

    public boolean isDirectory() {
        return TYPE_DIR.equals(entryType);
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getEntryType() {
        return entryType;
    }

    public void setEntryType(String entryType) {
        this.entryType = entryType;
    }
}
