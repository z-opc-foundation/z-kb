package com.zifang.z.kb.api.material;

/**
 * 待登记的物料文件。web 层负责把 MultipartFile 转成该值对象，服务层不依赖 Web 类型。
 */
public class MaterialUploadFile {

    private final String fileName;
    private final long size;
    private final byte[] content;

    public MaterialUploadFile(String fileName, long size, byte[] content) {
        this.fileName = fileName;
        this.size = size;
        this.content = content;
    }

    public String getFileName() {
        return fileName;
    }

    public long getSize() {
        return size;
    }

    public byte[] getContent() {
        return content;
    }
}
