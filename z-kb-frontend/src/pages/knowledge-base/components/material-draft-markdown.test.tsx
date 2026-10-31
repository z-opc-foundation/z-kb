import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import MaterialDraftMarkdown from './material-draft-markdown';

const MARKDOWN = `# 知识库

第一段 **加粗** 与 \`代码\`，[链接](https://example.com)。

![](https://cdn.nlark.com/a.png)

## 二级

- 项目一
- 项目二

1. 步骤一
2. 步骤二

> 引用内容

\`\`\`sql
select 1;
\`\`\`

| 列A | 列B |
| --- | ---: |
| 1 | 2 |

---
`;

afterEach(() => {
  cleanup();
});

describe('原文 Markdown 渲染', () => {
  it('渲染标题、图片、链接、列表、引用、代码块与表格', () => {
    const { container } = render(<MaterialDraftMarkdown content={MARKDOWN} />);

    expect(container.querySelector('h1')?.textContent).toBe('知识库');
    expect(container.querySelector('h2')?.textContent).toBe('二级');
    expect(container.querySelector('strong')?.textContent).toBe('加粗');
    expect(container.querySelector('p code')?.textContent).toBe('代码');

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noreferrer');

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://cdn.nlark.com/a.png');
    expect(image?.getAttribute('loading')).toBe('lazy');

    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(container.querySelector('blockquote')?.textContent).toContain('引用内容');
    expect(container.querySelector('pre code')?.textContent).toBe('select 1;');
    expect(container.querySelectorAll('table th')).toHaveLength(2);
    expect(container.querySelectorAll('table tbody tr')).toHaveLength(1);
    expect(container.querySelector('hr')).toBeTruthy();
  });

  it('段落中的换行保留为软换行', () => {
    const { container } = render(
      <MaterialDraftMarkdown content={'第一行\n第二行\n\n下一段'} />,
    );

    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelectorAll('p br')).toHaveLength(1);
  });

  it('不安全的链接与图片协议按纯文本保留', () => {
    const { container } = render(
      <MaterialDraftMarkdown content={'[x](javascript:alert(1))\n\n![y](javascript:alert(1))'} />,
    );

    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('javascript:alert(1)');
  });
});
