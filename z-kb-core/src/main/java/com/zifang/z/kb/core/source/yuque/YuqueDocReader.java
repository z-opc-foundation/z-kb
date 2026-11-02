package com.zifang.z.kb.core.source.yuque;

/**
 * 语雀文档读取：链接或 namespace+slug → 拉详情 → 表格类 body 转 markdown。
 * 正文可以直接作为物料登记与编译的输入。
 */
public class YuqueDocReader {

    private final YuqueApiClient client;

    public YuqueDocReader(YuqueApiClient client) {
        this.client = client;
    }

    /** 只接受 doc 级链接（group/book/doc 三段）。 */
    public YuqueDocContent read(String url, String token) {
        YuqueUrls.Link link = YuqueUrls.parse(url);
        if (link == null || link.getType() != YuqueUrls.LinkType.DOC) {
            throw new YuqueApiException(YuqueApiException.Kind.INVALID_RESPONSE,
                    "不是语雀文档链接（需 group/book/doc 三段）：" + url);
        }
        return read(link.namespace(), link.getDocSlug(), token);
    }

    public YuqueDocContent read(String namespace, String docSlug, String token) {
        return read(client, namespace, docSlug, token);
    }

    /** 用指定客户端读取：同步场景下接入源可能指向租户独立域名。 */
    public YuqueDocContent read(YuqueApiClient apiClient, String namespace, String docSlug,
            String token) {
        YuqueDocDetail detail = apiClient.fetchDocDetail(namespace, docSlug, token);
        String body = detail.getBody() == null ? "" : detail.getBody();
        boolean sheetConverted = false;
        if (YuqueLakeSheetConverter.isSheetBody(body)) {
            try {
                body = YuqueLakeSheetConverter.convertToMarkdown(body);
            } catch (IllegalArgumentException e) {
                throw new YuqueApiException(YuqueApiException.Kind.INVALID_RESPONSE,
                        "语雀表格文档转换失败（" + docSlug + "）：" + e.getMessage(), e);
            }
            sheetConverted = true;
        }
        return new YuqueDocContent(detail.getDocId(), detail.getSlug(), detail.getTitle(),
                detail.getBookId(), detail.getContentUpdatedAt(), body, sheetConverted);
    }
}
