import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OntologyPage from './index';
import {
  bindOntologyTagCategory,
  createOntology,
  createOntologyTagCategory,
  getOntologyDetail,
  getOntologyGraphView,
  listOntologyTagCategories,
  pageOntologyEdges,
  pageOntologyInstanceLinks,
  pageOntologyInstances,
  pageOntologyTags,
  queryOntologySubgraph,
  type OntologyDetail,
  type OntologyGraphView,
  type OntologyInstanceLinkPage,
  type OntologyInstancePage,
  type OntologySubgraphView,
  type OntologyTagCategory,
  type OntologyTagRecord,
} from '@/services/ontology';

// G6 依赖真实 Canvas/ResizeObserver，jsdom 不具备——统一替换为无操作桩，
// 页面层交互（勾选、层切换、抽屉）与 G6 渲染解耦，测试只覆盖前者。
vi.mock('@/components/ontology-graph', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/components/ontology-graph')
  >();
  return {
    ...actual,
    useG6Graph: () => ({
      containerRef: () => {},
      setData: vi.fn(),
      highlightNode: vi.fn(),
      highlightEdge: vi.fn(),
      clearHighlight: vi.fn(),
      applyPathStyle: vi.fn(),
      resetPathStyle: vi.fn(),
      fitView: vi.fn(),
      hideTooltip: vi.fn(),
      ready: true,
    }),
  };
});

vi.mock('@/services/ontology', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getOntologyDetail: vi.fn(),
  createOntology: vi.fn(),
  createOntologyTagCategory: vi.fn(),
  updateOntology: vi.fn(),
  pageOntologyTags: vi.fn(),
  pageOntologyEdges: vi.fn(),
  getOntologyGraphView: vi.fn(),
  getOntologyTagDetail: vi.fn(),
  getOntologyEdgeDetail: vi.fn(),
  listOntologyTagCategories: vi.fn(),
  bindOntologyTagCategory: vi.fn(),
  pageOntologyInstances: vi.fn(),
  pageOntologyInstanceLinks: vi.fn(),
  queryOntologySubgraph: vi.fn(),
}));

const detail: OntologyDetail = {
  code: 'ont_clinical',
  name: '临床医学本体',
  description: 'dev 种子',
  graphSpace: 'gs_ont_clinical',
  schemaVersion: '3',
  status: 'ACTIVE',
  tagCount: 7,
  edgeCount: 5,
  graphBound: false,
};

const graphView: OntologyGraphView = {
  ontologyCode: 'ont_clinical',
  nodeCount: '6',
  edgeCount: '4',
  truncated: false,
  nodes: [
    {
      code: 'seed-tag-disease',
      tagName: 'Disease',
      displayName: '疾病',
      category: 'seed-cat-diag',
      instanceCount: '860',
    },
    {
      code: 'seed-tag-symptom',
      tagName: 'Symptom',
      displayName: '症状',
      category: 'seed-cat-diag',
      instanceCount: '430',
    },
  ],
  edges: [
    {
      code: 'seed-edge-has-symptom',
      edgeName: 'HAS_SYMPTOM',
      displayName: '疾病症状',
      srcTag: 'Disease',
      dstTag: 'Symptom',
      selfLoop: false,
      endpointName: '疾病→症状',
    },
  ],
};

const tagCategories: OntologyTagCategory[] = [
  { code: 'seed-cat-diag', categoryName: '诊断', sortOrder: 1, tagCount: '1' },
];

const instancePage: OntologyInstancePage = {
  records: [
    { vid: 'Disease:flu', name: '流感', properties: { icd10: 'J11' } },
  ],
  total: 1,
  current: 1,
  size: 10,
  graphBound: true,
};

const linkPage: OntologyInstanceLinkPage = {
  records: [
    {
      srcVid: 'Disease:flu',
      srcName: '流感',
      dstVid: 'Symptom:fever',
      dstName: '发热',
      edgeProperties: { weight: '0.9' },
    },
  ],
  total: 1,
  current: 1,
  size: 10,
  graphBound: true,
};

const subgraphView: OntologySubgraphView = {
  nodes: [
    { vid: 'Disease:flu', name: '流感', tag: 'Disease' },
    { vid: 'Symptom:fever', name: '发热', tag: 'Symptom' },
  ],
  edges: [
    { edgeName: 'HAS_SYMPTOM', srcVid: 'Disease:flu', dstVid: 'Symptom:fever' },
  ],
  truncated: true,
  graphBound: true,
};

const tagPage = {
  records: [
    {
      code: 'seed-tag-disease',
      tagName: 'Disease',
      displayName: '疾病',
      category: 'seed-cat-diag',
      bizDomain: '临床',
      levelCode: 'L1',
      extractable: 1,
      status: 'ACTIVE',
      sourceType: 'MANUAL',
      description: '疾病对象类型',
      instanceCount: '860',
    } satisfies OntologyTagRecord,
  ],
  total: 1,
  size: 50,
  current: 1,
};

const edgePage = {
  records: [
    {
      code: 'seed-edge-has-symptom',
      edgeName: 'HAS_SYMPTOM',
      displayName: '疾病症状',
      constraintMode: 'STRICT',
      status: 'ACTIVE' as const,
      edgeCount: '120',
      endpoints: [
        {
          code: 'seed-endpoint-1',
          edgeCode: 'seed-edge-has-symptom',
          srcTag: 'Disease',
          dstTag: 'Symptom',
          status: 'ACTIVE' as const,
          selfLoop: false,
        },
      ],
    },
  ],
  total: 1,
  size: 50,
  current: 1,
};

// React 19 下 RTL 的 waitFor/act 与本页异步副作用链存在死锁，
// 统一用裸定时器 flush 等待加载完成后直接查询 DOM。
const flush = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// 详情与图谱是两段串行请求，固定等待在并发跑时不够；按条件轮询保证确定性
const flushUntil = async (predicate: () => boolean, timeout = 5000) => {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeout) {
    await flush(50);
  }
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/ontology']}>
      <OntologyPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(getOntologyDetail).mockResolvedValue(detail);
  vi.mocked(getOntologyGraphView).mockResolvedValue(graphView);
  vi.mocked(pageOntologyTags).mockResolvedValue(tagPage);
  vi.mocked(pageOntologyEdges).mockResolvedValue(edgePage);
  vi.mocked(listOntologyTagCategories).mockResolvedValue(tagCategories);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('本体图谱页', () => {
  it('未开通租户展示空态与开通入口', async () => {
    vi.mocked(getOntologyDetail).mockResolvedValue(null);
    const { container } = renderPage();
    await flush();

    expect(container.textContent).toContain('当前租户尚未开通本体');
    expect(
      screen.getByRole('button', { name: /开通本体/ }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('临床医学本体');
    expect(getOntologyGraphView).not.toHaveBeenCalled();
  });

  it('已开通租户渲染信息栏、类型清单与图谱画布工具条', async () => {
    const { container } = renderPage();
    await flush(300);
    await flushUntil(() => document.querySelectorAll('.ont-node').length === 2);

    expect(container.textContent).toContain('临床医学本体');
    expect(container.textContent).toContain('编码 ont_clinical');
    expect(container.textContent).toContain('图空间 gs_ont_clinical');
    expect(container.textContent).toContain('图库未接入');

    const statLabels = [...container.querySelectorAll('.ont-info-stat .label')].map(
      (el) => el.textContent,
    );
    expect(statLabels).toEqual([
      '对象类型',
      '关系类型',
      '实例合计',
      '结构版本',
    ]);
    expect(container.textContent).toContain('1,290');

    expect(screen.getByRole('button', { name: '结构层' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '实例层' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /视图重置/ })).toBeInTheDocument();

    expect(container.textContent).toContain('Disease');
    expect(container.textContent).toContain('按分组');
    expect(container.textContent).toContain('诊断');
    expect(container.textContent).toContain('分组管理');
    expect(container.textContent).toContain('860');
    expect(container.textContent).not.toContain('mock');
    expect(pageOntologyTags).toHaveBeenCalledWith(
      expect.objectContaining({ current: 1, size: 50 }),
    );
    expect(pageOntologyEdges).toHaveBeenCalled();
  });

  it('对象类型行点击在抽屉中加载图库真实实例', async () => {
    vi.mocked(pageOntologyInstances).mockResolvedValue(instancePage);
    const { container } = renderPage();
    await flush(300);

    fireEvent.click(container.querySelector('.ont-type-row') as HTMLElement);
    await flush(200);

    expect(pageOntologyInstances).toHaveBeenCalledWith({
      tagName: 'Disease',
      keyword: '',
      current: 1,
      size: 10,
    });
    expect(container.textContent).toContain('Disease 实例');
    expect(container.textContent).toContain('图库数据');
    expect(container.textContent).toContain('流感');
    expect(container.textContent).toContain('J11');
  });

  it('关系类型行点击在抽屉中加载真实关系实例对', async () => {
    vi.mocked(pageOntologyInstanceLinks).mockResolvedValue(linkPage);
    const { container } = renderPage();
    await flush(300);

    fireEvent.click(screen.getByRole('button', { name: /关系类型/ }));
    await flush(200);
    fireEvent.click(container.querySelector('.ont-type-row') as HTMLElement);
    await flush(200);

    expect(pageOntologyInstanceLinks).toHaveBeenCalledWith({
      edgeName: 'HAS_SYMPTOM',
      srcTag: 'Disease',
      dstTag: 'Symptom',
      current: 1,
      size: 10,
    });
    expect(container.textContent).toContain('HAS_SYMPTOM 关系实例');
    expect(container.textContent).toContain('流感');
    expect(container.textContent).toContain('发热');
    expect(container.textContent).toContain('weight');
  });

  it('勾选对象类型并切到实例层触发实例子图查询', async () => {
    vi.mocked(queryOntologySubgraph).mockResolvedValue(subgraphView);
    const { container } = renderPage();
    await flush(300);

    fireEvent.click(screen.getByRole('checkbox'));
    await flush(50);
    expect(screen.getByRole('button', { name: '实例层' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '实例层' }));
    await flush(200);

    expect(queryOntologySubgraph).toHaveBeenCalledWith({
      tagNames: ['Disease'],
      limit: 500,
    });
    expect(container.textContent).toContain('实例子图');
    expect(container.textContent).toContain('已截断');
    expect(container.textContent).toContain('Disease');
  });

  it('图库未接入时抽屉展示降级提示', async () => {
    vi.mocked(pageOntologyInstances).mockResolvedValue({
      records: [],
      total: 0,
      current: 1,
      size: 10,
      graphBound: false,
    });
    const { container } = renderPage();
    await flush(300);

    fireEvent.click(container.querySelector('.ont-type-row') as HTMLElement);
    await flush(200);

    expect(container.textContent).toContain('图库未接入');
    expect(container.textContent).toContain('图库配置下发后此处自动展示真实实例');
  });

  it('空态点击开通提交后调用开通接口', async () => {
    vi.mocked(getOntologyDetail).mockResolvedValue(null);
    vi.mocked(createOntology).mockResolvedValue(detail);
    renderPage();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: /开通本体/ }));
    await flush(50);
    const nameInput = screen.getByPlaceholderText('如 临床医学本体');
    fireEvent.change(nameInput, { target: { value: '临床医学本体' } });
    fireEvent.click(screen.getByRole('button', { name: /开通$/ }));
    await flush();

    expect(createOntology).toHaveBeenCalledWith({
      name: '临床医学本体',
      description: undefined,
    });
  });

  it('分组管理弹窗展示分类字典并支持新建', async () => {
    vi.mocked(createOntologyTagCategory).mockResolvedValue(tagCategories[0]);
    const { container } = renderPage();
    await flush(300);

    fireEvent.click(screen.getByRole('button', { name: /分组管理/ }));
    await flush(50);
    expect(container.textContent).toContain('分组管理');
    expect(container.textContent).toContain('诊断');

    const newInput = screen.getByPlaceholderText('新分组名称');
    fireEvent.change(newInput, { target: { value: '耗材' } });
    fireEvent.click(screen.getByRole('button', { name: /添加/ }));
    await flush(50);

    expect(createOntologyTagCategory).toHaveBeenCalledWith({ categoryName: '耗材' });
  });

  it('对象类型行内展开归类条并调用归类接口', async () => {
    vi.mocked(bindOntologyTagCategory).mockResolvedValue(undefined);
    renderPage();
    await flush(300);

    fireEvent.click(screen.getByTitle('选择分组'));
    await flush(50);
    const chip = screen.getByRole('button', { name: '未分类' });
    fireEvent.click(chip);
    await flush(50);

    expect(bindOntologyTagCategory).toHaveBeenCalledWith({
      tagCode: 'seed-tag-disease',
      categoryCode: undefined,
    });
  });
});
