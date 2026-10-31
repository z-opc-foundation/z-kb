import type { ReactNode } from 'react';

/**
 * 原文页签的 Markdown 渲染：覆盖标题、段落、图片、链接、列表、引用、代码块与表格。
 *
 * <p>不使用 innerHTML；图片与链接只放行 http(s)、站内绝对路径与锚点，其余按纯文本保留。
 */
export default function MaterialDraftMarkdown({ content }: { content: string }) {
  return <div className="draft-doc">{renderBlocks(content || '')}</div>;
}

const FENCE_OPEN = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/;
const FENCE_CLOSE = /^\s*(```|~~~)\s*$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const ORDERED = /^(\s*)\d+[.、)]\s+(.*)$/;
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function renderBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE_CLOSE.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="draft-code" key={`code-${blocks.length}`}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={`h-${blocks.length}`}>{renderInline(heading[2])}</Tag>);
      index += 1;
      continue;
    }

    if (HR.test(line)) {
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index])) {
        quoted.push((QUOTE.exec(lines[index]) as RegExpExecArray)[1]);
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${blocks.length}`}>{renderParagraph(quoted)}</blockquote>,
      );
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length
      && TABLE_SEPARATOR.test(lines[index + 1])) {
      const headers = splitRow(line);
      const aligns = splitRow(lines[index + 1]).map(cellAlign);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="draft-table-wrap" key={`table-${blocks.length}`}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th key={`th-${cellIndex}`} style={{ textAlign: aligns[cellIndex] }}>
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`td-${cellIndex}`} style={{ textAlign: aligns[cellIndex] }}>
                      {renderInline(row[cellIndex] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const ordered = ORDERED.exec(line);
    const bullet = ordered ? null : BULLET.exec(line);
    if (ordered || bullet) {
      const isOrdered = Boolean(ordered);
      const items: { depth: number; text: string }[] = [];
      while (index < lines.length) {
        const current = isOrdered ? ORDERED.exec(lines[index]) : BULLET.exec(lines[index]);
        if (!current) {
          break;
        }
        items.push({ depth: Math.min(3, Math.floor(current[1].length / 2)), text: current[2] });
        index += 1;
      }
      const entries = items.map((item, itemIndex) => (
        <li
          key={`li-${itemIndex}`}
          style={item.depth ? { marginLeft: item.depth * 14 } : undefined}
        >
          {renderInline(item.text)}
        </li>
      ));
      blocks.push(
        isOrdered ? (
          <ol key={`ol-${blocks.length}`}>{entries}</ol>
        ) : (
          <ul key={`ul-${blocks.length}`}>{entries}</ul>
        ),
      );
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !startsBlock(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`p-${blocks.length}`}>{renderParagraph(paragraph)}</p>,
    );
  }

  return blocks;
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index];
  if (HEADING.test(line) || HR.test(line) || QUOTE.test(line)
    || FENCE_OPEN.test(line) || ORDERED.test(line) || BULLET.test(line)) {
    return true;
  }
  return line.includes('|') && index + 1 < lines.length
    && TABLE_SEPARATOR.test(lines[index + 1]);
}

function splitRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith('|')) {
    value = value.slice(1);
  }
  if (value.endsWith('|')) {
    value = value.slice(0, -1);
  }
  return value.split('|').map((cell) => cell.trim());
}

function cellAlign(cell: string): 'left' | 'center' | 'right' | undefined {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) {
    return 'center';
  }
  if (right) {
    return 'right';
  }
  return undefined;
}

function renderParagraph(lines: string[]): ReactNode[] {
  const text = lines.join('\n');
  return text.includes('\n') ? wrapBreaks(renderInline(text)) : renderInline(text);
}

function wrapBreaks(nodes: ReactNode[]): ReactNode[] {
  const result: ReactNode[] = [];
  nodes.forEach((node, index) => {
    if (typeof node !== 'string') {
      result.push(node);
      return;
    }
    node.split('\n').forEach((part, partIndex) => {
      if (partIndex > 0) {
        result.push(<br key={`br-${index}-${partIndex}`} />);
      }
      if (part) {
        result.push(part);
      }
    });
  });
  return result;
}

const INLINE_PATTERN =
  /!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)|\[([^\]]+)\]\(\s*([^)\s]+)\s*\)|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*\n]+)\*/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(INLINE_PATTERN.source, 'g');
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const key = `i-${match.index}`;
    if (match[1] !== undefined) {
      const src = safeHref(match[2]);
      nodes.push(
        src ? (
          <img
            key={key}
            className="draft-img"
            src={src}
            alt={match[1]}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          match[0]
        ),
      );
    } else if (match[3] !== undefined) {
      const href = safeHref(match[4]);
      nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {match[3]}
          </a>
        ) : (
          match[0]
        ),
      );
    } else if (match[5] !== undefined) {
      nodes.push(<strong key={key}>{match[5]}</strong>);
    } else if (match[6] !== undefined) {
      nodes.push(<strong key={key}>{match[6]}</strong>);
    } else if (match[7] !== undefined) {
      nodes.push(<del key={key}>{match[7]}</del>);
    } else if (match[8] !== undefined) {
      nodes.push(<code key={key}>{match[8]}</code>);
    } else if (match[9] !== undefined) {
      nodes.push(<em key={key}>{match[9]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (/^https?:\/\//i.test(value) || value.startsWith('/') || value.startsWith('#')) {
    return value;
  }
  return null;
}
