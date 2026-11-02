package com.zifang.z.kb.api.material;

/**
 * 原件下载内容。服务层不依赖 Web 类型，由控制器负责响应头与流。
 */
public class MaterialDownload {

    private final String fileName;
    private final byte[] content;

    public MaterialDownload(String fileName, byte[] content) {
        this.fileName = fileName;
        this.content = content;
    }

    public String getFileName() {
        return fileName;
    }

    public byte[] getContent() {
        return content;
    }
}
