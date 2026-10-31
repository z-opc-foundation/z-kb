package com.zifang.z.***REMOVED***.api.source;

import java.util.ArrayList;
import java.util.List;

/**
 * 全量覆盖保存接入源列表；传空列表表示清空。
 */
public class KnowledgeBaseSourceSaveParam {

    private String ***REMOVED***Id;
    private List<KnowledgeBaseSourceParam> sources = new ArrayList<>();

    public String get***REMOVED***Id() {
        return ***REMOVED***Id;
    }

    public void set***REMOVED***Id(String ***REMOVED***Id) {
        this.***REMOVED***Id = ***REMOVED***Id;
    }

    public List<KnowledgeBaseSourceParam> getSources() {
        return sources;
    }

    public void setSources(List<KnowledgeBaseSourceParam> sources) {
        this.sources = sources == null ? new ArrayList<>() : sources;
    }
}
