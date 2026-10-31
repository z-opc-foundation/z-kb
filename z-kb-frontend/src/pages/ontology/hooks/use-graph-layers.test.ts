import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryOntologySubgraph } from '@/services/ontology';
import { useGraphLayers } from './use-graph-layers';

vi.mock('@/services/ontology', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  queryOntologySubgraph: vi.fn(),
}));

const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  vi.mocked(queryOntologySubgraph).mockResolvedValue({
    nodes: [{ vid: 'Disease:flu', tag: 'Disease' }],
    edges: [],
    truncated: false,
    graphBound: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useGraphLayers', () => {
  it('初始为结构层且不发起子图查询', async () => {
    const { result } = renderHook(() => useGraphLayers());
    await act(async () => flush());

    expect(result.current.layer).toBe('structure');
    expect(result.current.selectedTags).toEqual([]);
    expect(queryOntologySubgraph).not.toHaveBeenCalled();
  });

  it('toggleTag 维护多选集合并限制 5 个上限', () => {
    const { result } = renderHook(() => useGraphLayers());
    const tags = ['A', 'B', 'C', 'D', 'E', 'F'];

    act(() => tags.forEach((t) => result.current.toggleTag(t)));
    expect(result.current.selectedTags).toEqual(['A', 'B', 'C', 'D', 'E']);

    act(() => result.current.toggleTag('A'));
    expect(result.current.selectedTags).toEqual(['B', 'C', 'D', 'E']);
  });

  it('进入实例层后按所选集合查询子图', async () => {
    const { result } = renderHook(() => useGraphLayers());

    act(() => result.current.toggleTag('Disease'));
    act(() => result.current.enterInstanceLayer());
    await act(async () => flush());

    expect(queryOntologySubgraph).toHaveBeenCalledWith({
      tagNames: ['Disease'],
      limit: 500,
    });
    expect(result.current.subgraph.view?.nodes).toHaveLength(1);
    expect(result.current.subgraph.loading).toBe(false);
  });

  it('enterInstanceWith 补选目标 tag 并保留既有多选', () => {
    const { result } = renderHook(() => useGraphLayers());

    act(() => result.current.toggleTag('A'));
    act(() => result.current.enterInstanceWith('B'));

    expect(result.current.layer).toBe('instance');
    expect(result.current.selectedTags).toEqual(['A', 'B']);
  });

  it('toggleEdge 自动补选端点类型并在查询中传 edgeNames', async () => {
    const { result } = renderHook(() => useGraphLayers());

    act(() => result.current.toggleEdge('Treats', ['Drug', 'Disease']));
    expect(result.current.selectedEdges).toEqual(['Treats']);
    expect(result.current.selectedTags).toEqual(['Drug', 'Disease']);

    act(() => result.current.enterInstanceLayer());
    await act(async () => flush());

    expect(queryOntologySubgraph).toHaveBeenCalledWith({
      tagNames: ['Drug', 'Disease'],
      edgeNames: ['Treats'],
      limit: 500,
    });
  });

  it('toggleEdge 超出 5 类型上限返回 null 且不改变状态', () => {
    const { result } = renderHook(() => useGraphLayers());

    act(() => ['A', 'B', 'C', 'D'].forEach((t) => result.current.toggleTag(t)));

    const r = result.current.toggleEdge('Treats', ['Drug', 'Disease']);
    expect(r).toBeNull();
    expect(result.current.selectedEdges).toEqual([]);
    expect(result.current.selectedTags).toEqual(['A', 'B', 'C', 'D']);
  });

  it('取消类型联动取消端点涉及该类型的边', async () => {
    const { result } = renderHook(() => useGraphLayers());

    act(() => result.current.toggleEdge('Treats', ['Drug', 'Disease']));
    act(() => result.current.toggleTag('Drug'));

    expect(result.current.selectedTags).toEqual(['Disease']);
    expect(result.current.selectedEdges).toEqual([]);

    act(() => result.current.enterInstanceLayer());
    await act(async () => flush());

    expect(queryOntologySubgraph).toHaveBeenCalledWith({
      tagNames: ['Disease'],
      limit: 500,
    });
  });

  it('实例层重选集合会重新查询', async () => {
    const { result } = renderHook(() => useGraphLayers());
    act(() => result.current.toggleTag('A'));
    act(() => result.current.enterInstanceLayer());
    await act(async () => flush());

    act(() => result.current.toggleTag('B'));
    await act(async () => flush());

    expect(queryOntologySubgraph).toHaveBeenLastCalledWith({
      tagNames: ['A', 'B'],
      limit: 500,
    });
  });

  it('查询失败置 failed，reloadSubgraph 重试', async () => {
    vi.mocked(queryOntologySubgraph).mockResolvedValue(undefined);
    const { result } = renderHook(() => useGraphLayers());
    act(() => result.current.toggleTag('A'));
    act(() => result.current.enterInstanceLayer());
    await act(async () => flush());

    expect(result.current.subgraph.failed).toBe(true);

    vi.mocked(queryOntologySubgraph).mockResolvedValue({
      nodes: [],
      edges: [],
      truncated: false,
      graphBound: true,
    });
    act(() => result.current.reloadSubgraph());
    await act(async () => flush());

    expect(result.current.subgraph.failed).toBe(false);
    expect(queryOntologySubgraph).toHaveBeenCalledTimes(2);
  });

  it('返回结构层清空选择与子图状态', async () => {
    const { result } = renderHook(() => useGraphLayers());
    act(() => result.current.toggleTag('A'));
    act(() => result.current.enterInstanceLayer());
    await act(async () => flush());

    act(() => result.current.backToStructureLayer());

    expect(result.current.layer).toBe('structure');
    expect(result.current.selectedTags).toEqual([]);
    expect(result.current.subgraph.view).toBeNull();
  });
});
