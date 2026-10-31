import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EvidenceTag, formatEvidence, nodeTypeLabel } from './graph-meta';

afterEach(() => {
  cleanup();
});

describe('图谱节点元信息', () => {
  it('已知节点类型翻译成中文，未知值原样回退', () => {
    expect(nodeTypeLabel('DISEASE')).toBe('疾病');
    expect(nodeTypeLabel('WIKI')).toBe('Wiki');
    expect(nodeTypeLabel('UNKNOWN_KIND')).toBe('UNKNOWN_KIND');
    expect(nodeTypeLabel('')).toBe('图谱节点');
  });

  it('证据优先解析 chunk，非 JSON 按长度截断', () => {
    expect(formatEvidence(undefined)).toBe('—');
    expect(formatEvidence('{"chunk":7,"start":1}')).toBe('块 7');
    expect(formatEvidence('不是 JSON 的证据原文')).toBe('不是 JSON 的证据原文');
    expect(formatEvidence('x'.repeat(30))).toBe(`${'x'.repeat(24)}…`);
  });

  it('EvidenceTag 渲染证据文本并保留原始 title', () => {
    render(<EvidenceTag evidence={'{"chunk":2}'} />);
    const tag = screen.getByText('证据 块 2');
    expect(tag.getAttribute('title')).toBe('{"chunk":2}');
  });
});
