import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pageOntologyInstanceLinks,
  pageOntologyInstances,
} from '@/services/ontology';
import { useInstanceQuery } from './use-instance-query';

vi.mock('@/services/ontology', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  pageOntologyInstances: vi.fn(),
  pageOntologyInstanceLinks: vi.fn(),
}));

const flush = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  vi.mocked(pageOntologyInstances).mockResolvedValue({
    records: [{ vid: 'Disease:flu', name: '流感' }],
    total: 1,
    current: 1,
    size: 10,
    graphBound: true,
  });
  vi.mocked(pageOntologyInstanceLinks).mockResolvedValue({
    records: [
      { srcVid: 'Disease:flu', dstVid: 'Symptom:fever' },
    ],
    total: 1,
    current: 1,
    size: 10,
    graphBound: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useInstanceQuery', () => {
  it('tag 模式按对象类型分页查询', async () => {
    const { result } = renderHook(() => useInstanceQuery());

    act(() => result.current.open('Disease'));
    await act(async () => flush());

    expect(pageOntologyInstances).toHaveBeenCalledWith({
      tagName: 'Disease',
      keyword: '',
      current: 1,
      size: 10,
    });
    expect(result.current.target).toEqual({ mode: 'tag', tagName: 'Disease' });
    expect(result.current.state.records).toHaveLength(1);
    expect(result.current.state.loading).toBe(false);
  });

  it('link 模式携带端点约束查询关系实例对', async () => {
    const { result } = renderHook(() => useInstanceQuery());

    act(() => result.current.openLink('HAS_SYMPTOM', 'Disease', 'Symptom'));
    await act(async () => flush());

    expect(pageOntologyInstanceLinks).toHaveBeenCalledWith({
      edgeName: 'HAS_SYMPTOM',
      srcTag: 'Disease',
      dstTag: 'Symptom',
      current: 1,
      size: 10,
    });
    expect(result.current.state.linkRecords).toHaveLength(1);
    expect(result.current.state.records).toHaveLength(0);
  });

  it('search 关键词重置到第一页并带关键词', async () => {
    const { result } = renderHook(() => useInstanceQuery());
    act(() => result.current.open('Disease'));
    await act(async () => flush());

    act(() => result.current.turnPage(2));
    await act(async () => flush());
    act(() => result.current.search('流感'));
    await act(async () => flush());

    expect(pageOntologyInstances).toHaveBeenLastCalledWith({
      tagName: 'Disease',
      keyword: '流感',
      current: 1,
      size: 10,
    });
  });

  it('接口失败置 failed，retry 重新发起', async () => {
    vi.mocked(pageOntologyInstances).mockResolvedValue(undefined);
    const { result } = renderHook(() => useInstanceQuery());
    act(() => result.current.open('Disease'));
    await act(async () => flush());

    expect(result.current.state.failed).toBe(true);

    vi.mocked(pageOntologyInstances).mockResolvedValue({
      records: [],
      total: 0,
      current: 1,
      size: 10,
      graphBound: true,
    });
    act(() => result.current.retry());
    await act(async () => flush());

    expect(result.current.state.failed).toBe(false);
    expect(pageOntologyInstances).toHaveBeenCalledTimes(2);
  });

  it('close 清空查询目标', async () => {
    const { result } = renderHook(() => useInstanceQuery());
    act(() => result.current.open('Disease'));
    await act(async () => flush());

    act(() => result.current.close());
    expect(result.current.target).toBeNull();
  });
});
