package com.zifang.z.kb.api.material;

import java.util.ArrayList;
import java.util.List;

/**
 * 代码仓库物料的项目概览：仓库坐标、当前分支与提交、文件统计和根目录子项。
 */
public class RepoOverview {

    private String materialId;
    private String title;
    private String provider;
    private String repo;
    private String repoUrl;
    private String branch;
    private String commit;
    private Integer fileCount;
    private Integer docCount;
    private Integer codeCount;
    private List<RepoEntry> entries = new ArrayList<>();

    public String getMaterialId() {
        return materialId;
    }

    public void setMaterialId(String materialId) {
        this.materialId = materialId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getRepo() {
        return repo;
    }

    public void setRepo(String repo) {
        this.repo = repo;
    }

    public String getRepoUrl() {
        return repoUrl;
    }

    public void setRepoUrl(String repoUrl) {
        this.repoUrl = repoUrl;
    }

    public String getBranch() {
        return branch;
    }

    public void setBranch(String branch) {
        this.branch = branch;
    }

    public String getCommit() {
        return commit;
    }

    public void setCommit(String commit) {
        this.commit = commit;
    }

    public Integer getFileCount() {
        return fileCount;
    }

    public void setFileCount(Integer fileCount) {
        this.fileCount = fileCount;
    }

    public Integer getDocCount() {
        return docCount;
    }

    public void setDocCount(Integer docCount) {
        this.docCount = docCount;
    }

    public Integer getCodeCount() {
        return codeCount;
    }

    public void setCodeCount(Integer codeCount) {
        this.codeCount = codeCount;
    }

    public List<RepoEntry> getEntries() {
        return entries;
    }

    public void setEntries(List<RepoEntry> entries) {
        this.entries = entries;
    }
}
