package com.zifang.z.kb.api.material;

import com.zifang.z.kb.api.resource.KbCaller;

import java.util.List;

/**
 * 代码仓库物料的只读浏览：按物料登记的仓库坐标读取本地检出副本，文件内容不落库。
 * 一个仓库在物料侧只有一条记录，项目内的目录与文件都从这里看。
 */
public interface MaterialRepoBrowseService {

    /** 项目概览：仓库坐标、分支与提交、文件统计与根目录子项。 */
    RepoOverview overview(String materialId, KbCaller caller);

    /** 列出目录下的直接子项，目录在前；path 为空表示根目录。 */
    List<RepoEntry> listEntries(String materialId, String path, KbCaller caller);

    /** 读取单个文件正文；二进制文件只标记，超长文本截断后返回。 */
    RepoFile readFile(String materialId, String path, KbCaller caller);
}
