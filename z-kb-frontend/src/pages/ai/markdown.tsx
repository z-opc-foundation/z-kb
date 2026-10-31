import type { ReactNode } from 'react';

/**
 * 轻量 Markdown 渲染：只覆盖模型回答里常见的标题、列表、加粗、行内代码与 [n] 引用。
 *
 * <p>不引入第三方解析器；未识别的语法按纯文本保留，避免把模型输出误渲染成 HTML。
 */
export function MarkdownLite({ content }: { content: string }) {
  return <div className="ai-md">{renderBlocks(content)}</div>;
}

function renderBlocks(content: string): ReactNode[] {
  const lines = (content || '').split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) {
      return;
    }
    const items = list.items.map((item, index) => (
      <li key={`li-${index}`}>{renderInline(item)}</li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`ol-${blocks.length}`}>{items}</ol>
      ) : (
        <ul key={`ul-${blocks.length}`}>{items}</ul>
      ),
    );
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      return;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      return;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const text = renderInline(heading[2]);
      blocks.push(
        level <= 2 ? (
          <h3 key={`h-${blocks.length}`}>{text}</h3>
        ) : (
          <h4 key={`h-${blocks.length}`}>{text}</h4>
        ),
      );
      return;
    }
    const ordered = /^\s*\d+[.、)]\s+(.*)$/.exec(line);
    if (ordered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
      return;
    }
    const unordered = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (unordered) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(unordered[1]);
      return;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushList();
      blocks.push(
        <blockquote key={`q-${blocks.length}`}>{renderInline(quote[1])}</blockquote>,
      );
      return;
    }
    flushList();
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line)}</p>);
  });
  flushList();
  return blocks;
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\]|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(INLINE_PATTERN.source, 'g');
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    const key = `i-${match.index}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (/^\[\d+\]$/.test(token)) {
      nodes.push(
        <span className="cite" key={key} title={`引用 ${token.slice(1, -1)}`}>
          {token.slice(1, -1)}
        </span>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}
