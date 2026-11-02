package com.zifang.z.kb.api.wiki;

/**
 * Wiki 要点：标题 + 正文，由 Markdown 标题切分而来。
 */
public class WikiPointView {

    private String heading;
    private String text;

    public String getHeading() {
        return heading;
    }

    public void setHeading(String heading) {
        this.heading = heading;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}
