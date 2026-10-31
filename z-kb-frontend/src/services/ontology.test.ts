import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/services/http';
import {
  pageOntologyInstanceLinks,
  pageOntologyInstances,
  queryOntologySubgraph,
} from '@/services/ontology';

vi.mock('@/services/http', () => ({
  request: vi.fn(),
  RequestError: class RequestError extends Error {},
}));
vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const requestMock = vi.mocked(request);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('实例分页接口的分页字段矫正', () => {
  it('后端按 Long 序列化为字符串时转回数字，避免翻页拼接', async () => {
    requestMock.mockResolvedValue({
      records: [{ vid: 'Disease:flu', name: '流感' }],
      total: '406',
      current: '2',
      size: '10',
      graphBound: true,
    });

    const page = await pageOntologyInstances({
      tagName: 'Disease',
      current: 2,
      size: 10,
    });

    expect(page?.current).toBe(2);
    expect(page?.total).toBe(406);
    expect(page?.size).toBe(10);
    // 模拟 Pager 的下一页计算：字符串会得到 "11"
    expect((page?.current ?? 0) + 1).toBe(3);
  });

  it('link 分页同样矫正分页字段', async () => {
    requestMock.mockResolvedValue({
      records: [{ srcVid: 'Drug:a', dstVid: 'Disease:b' }],
      total: '44',
      current: '1',
      size: '10',
      graphBound: true,
    });

    const page = await pageOntologyInstanceLinks({
      edgeName: 'HAS_PARENT',
      srcTag: 'Department',
      dstTag: 'Department',
    });

    expect(page?.current).toBe(1);
    expect(page?.total).toBe(44);
    expect((page?.current ?? 0) + 1).toBe(2);
  });
});

describe('实例子图查询', () => {
  it('请求体透传 tagNames/edgeNames/limit', async () => {
    requestMock.mockResolvedValue({
      nodes: [{ vid: 'Disease:flu', tag: 'Disease' }],
      edges: [],
      truncated: false,
      graphBound: true,
    });

    const view = await queryOntologySubgraph({
      tagNames: ['Drug', 'Disease'],
      edgeNames: ['Treats'],
      limit: 500,
    });

    expect(requestMock).toHaveBeenCalledWith(
      '/future-brain/v1/ontology/schema/instance/subgraph',
      expect.objectContaining({
        method: 'post',
        data: { tagNames: ['Drug', 'Disease'], edgeNames: ['Treats'], limit: 500 },
      }),
    );
    expect(view?.graphBound).toBe(true);
  });
});
