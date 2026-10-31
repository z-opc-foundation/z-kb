/**
 * 本体图谱工作台页面。
 * 数据源：本体详情的 graphSpace 字段（meta 图空间名），经 galaxy-meta-admin
 * 代理查询空间元数据 / Tag 关系 / 实例统计，渲染对象层图谱与路径选择交互。
 * 路径确认后进入实例数据详情（FulldataView），可下钻查看实例数据图谱。
 */
import Icon from '@/components/icon';
import { useOntologyDetail } from '@/pages/ontology/hooks/use-ontology-detail';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FulldataGraphView } from './components/fulldata/fulldata-graph-view';
import { FulldataView } from './components/fulldata/fulldata-view';
import { GraphOverview } from './components/graph-overview';
import { GraphTabBar } from './components/graph-tab-bar';
import { useSpaceGraphData } from './hooks/use-space-graph-data';
import type {
  ChainEdge,
  FulldataGraphSnapshot,
  GraphTabItem,
  PathStep,
  TableRow,
} from './types';
import { getPathNodeKey } from './utils/path-search';
import './ontology-graph.less';

const OVERVIEW_TAB_KEY = '__overview__';

/** 图空间未就绪（未开通本体 / 未绑定图空间）的引导态 */
function GraphUnavailable(props: { title: string; desc: string }) {
  return (
    <section className="panel og-page-state">
      <Icon name="network" size={22} />
      <h3>{props.title}</h3>
      <p>{props.desc}</p>
    </section>
  );
}

export default function OntologyGraphPage() {
  const { detail, state } = useOntologyDetail();
  const spaceName = detail?.graphSpace || '';

  const graph = useSpaceGraphData(state === 'open' ? spaceName : '');

  // ─── 标签页系统 ───
  const [graphTabs, setGraphTabs] = useState<GraphTabItem[]>([
    { key: OVERVIEW_TAB_KEY, label: '对象层图谱', type: 'overview', closable: false },
  ]);
  const [activeTabKey, setActiveTabKey] = useState(OVERVIEW_TAB_KEY);
  /** fulldata-graph 标签页的数据快照（以 tab key 为键，避免大数组入 state） */
  const fulldataGraphDataRef = useRef<Map<string, FulldataGraphSnapshot>>(new Map());

  const closeGraphTab = useCallback((tabKey: string) => {
    setGraphTabs((prev) => {
      const idx = prev.findIndex((t) => t.key === tabKey);
      if (idx < 0 || !prev[idx].closable) return prev;
      // 实例图谱的行数据快照随标签页一同释放，避免反复开关堆积
      if (prev[idx].type === 'fulldata-graph') {
        fulldataGraphDataRef.current.delete(prev[idx].graphDataKey || prev[idx].key);
      }
      const next = prev.filter((t) => t.key !== tabKey);
      setActiveTabKey((curKey) =>
        curKey === tabKey
          ? next[Math.min(idx, next.length - 1)]?.key || OVERVIEW_TAB_KEY
          : curKey,
      );
      return next;
    });
  }, []);

  /** 路径确认（查看详情）：新建「实例数据详情」标签页 */
  const openLogicChainTab = useCallback((pathData: PathStep[]) => {
    const tabKey = `logic-chain-${Date.now()}`;
    setGraphTabs((prev) => [
      ...prev,
      {
        key: tabKey,
        label: '实例数据详情',
        type: 'logic-chain',
        closable: true,
        pathData,
      },
    ]);
    setActiveTabKey(tabKey);
  }, []);

  /** 实例数据详情的「查看图谱」：同一来源标签页复用一个实例图谱标签页 */
  const openFulldataGraphTab = useCallback(
    (data: {
      rowData: TableRow[];
      chainNodes: string[];
      chainEdges: ChainEdge[];
    }) => {
      // 快照键绑定来源标签页：同一链路反复查看图谱时覆盖更新，标签页不堆积
      const snapshotKey = `fg-${activeTabKey}`;
      fulldataGraphDataRef.current.set(snapshotKey, {
        rowData: data.rowData,
        chainNodes: data.chainNodes,
        chainEdges: data.chainEdges,
        objects: graph.objects,
        metadata: graph.metadata,
      });
      const existed = graphTabs.find(
        (t) => t.type === 'fulldata-graph' && t.graphDataKey === snapshotKey,
      );
      if (existed) {
        setActiveTabKey(existed.key);
        return;
      }
      const tabKey = `fulldata-graph-${Date.now()}`;
      setGraphTabs((prev) => [
        ...prev,
        {
          key: tabKey,
          label: '实例图谱丨链路',
          type: 'fulldata-graph',
          closable: true,
          graphDataKey: snapshotKey,
        },
      ]);
      setActiveTabKey(tabKey);
    },
    [activeTabKey, graph.objects, graph.metadata, graphTabs],
  );

  /** 右键「查看实例图谱」：单对象实例数据图谱标签页（数据快照由查询任务注入） */
  const openInstanceGraphTab = useCallback(
    (objectCode: string) => {
      const obj = graph.objects.find((o) => o.objectCode === objectCode);
      const existed = graphTabs.find(
        (t) => t.type === 'fulldata-graph' && t.targetCode === objectCode,
      );
      if (existed) {
        setActiveTabKey(existed.key);
        return;
      }
      const tabKey = `fulldata-graph-${Date.now()}`;
      fulldataGraphDataRef.current.set(tabKey, {
        rowData: [],
        chainNodes: [objectCode],
        chainEdges: [],
        objects: graph.objects,
        metadata: graph.metadata,
      });
      setGraphTabs((prev) => [
        ...prev,
        {
          key: tabKey,
          label: `实例图谱丨${obj?.objectName || objectCode}`,
          type: 'fulldata-graph',
          closable: true,
          targetCode: objectCode,
          graphDataKey: tabKey,
        },
      ]);
      setActiveTabKey(tabKey);
    },
    [graph.objects, graph.metadata, graphTabs],
  );

  /** 右键「查看对象详情」：单对象直接进入实例数据详情（同一对象去重复用） */
  const openNodeChain = useCallback(
    (objectCode: string) => {
      const nodeData = graph.graphData.data.find(
        (n) => getPathNodeKey(n) === objectCode,
      );
      if (!nodeData) {
        openInstanceGraphTab(objectCode);
        return;
      }
      const existed = graphTabs.find(
        (t) =>
          t.type === 'logic-chain' &&
          Array.isArray(t.pathData) &&
          t.pathData.length === 1 &&
          t.pathData[0].type === 'node' &&
          getPathNodeKey(t.pathData[0].data) === objectCode,
      );
      if (existed) {
        setActiveTabKey(existed.key);
        return;
      }
      const tabKey = `logic-chain-${Date.now()}`;
      setGraphTabs((prev) => [
        ...prev,
        {
          key: tabKey,
          label: '实例数据详情',
          type: 'logic-chain',
          closable: true,
          pathData: [{ type: 'node', data: nodeData }],
        },
      ]);
      setActiveTabKey(tabKey);
    },
    [graph.graphData, graphTabs, openInstanceGraphTab],
  );

  const activeTab = useMemo(
    () => graphTabs.find((t) => t.key === activeTabKey),
    [graphTabs, activeTabKey],
  );

  /** 标签栏右侧统计区 */
  const tabBarExtra = useMemo(() => {
    if (!activeTab) return null;
    if (activeTab.type === 'logic-chain') {
      const steps = activeTab.pathData || [];
      const nodeCount = steps.filter((s) => s.type === 'node').length;
      const edgeCount = steps.filter((s) => s.type === 'edge').length;
      return <span>节点 {nodeCount}丨关系 {edgeCount}</span>;
    }
    if (activeTab.type === 'fulldata-graph') {
      return <span>实例数据图谱</span>;
    }
    return (
      <>
        <span>
          节点 {graph.graphData.data.length}丨边 {graph.graphData.links.length}
        </span>
        <button
          type="button"
          className={`og-stats-refresh${graph.statsRefreshing ? ' is-spinning' : ''}`}
          title={
            graph.statsTime
              ? `上次刷新: ${graph.statsTime}，点击重新统计`
              : '尚未统计，点击刷新实例统计'
          }
          onClick={graph.refreshStats}
          disabled={graph.statsRefreshing}
        >
          <Icon name="refresh" size={13} />
        </button>
      </>
    );
  }, [activeTab, graph.graphData, graph.statsTime, graph.statsRefreshing, graph.refreshStats]);

  if (state === 'loading') {
    return (
      <div className="view og-page">
        <div className="page-head">
          <div>
            <h1>图谱工作台</h1>
            <p className="sub">正在加载本体信息…</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="view og-page">
        <div className="page-head">
          <div>
            <h1>图谱工作台</h1>
            <p className="sub">本体信息加载失败，请刷新重试。</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'notOpen') {
    return (
      <div className="view og-page">
        <div className="page-head">
          <div>
            <h1>图谱工作台</h1>
          </div>
        </div>
        <GraphUnavailable
          title="尚未开通本体"
          desc="请先前往「本体图谱」开通本体并绑定图空间，再使用图谱工作台。"
        />
      </div>
    );
  }

  if (!spaceName) {
    return (
      <div className="view og-page">
        <div className="page-head">
          <div>
            <h1>图谱工作台</h1>
          </div>
        </div>
        <GraphUnavailable
          title="本体未绑定图空间"
          desc="当前本体未配置图空间，请在「本体图谱 · 设置」中绑定后重试。"
        />
      </div>
    );
  }

  return (
    <div className="view og-page">
      <div className="page-head">
        <div>
          <h1>本体图谱</h1>
          <p className="sub">
            对象层图谱与逻辑链路构建：点选节点自动搜索路径，支持候选路径切换与单对象下钻。
          </p>
        </div>
      </div>

      <div className="panel og-workspace">
        <GraphTabBar
          tabs={graphTabs}
          activeKey={activeTabKey}
          onSelect={setActiveTabKey}
          onClose={closeGraphTab}
          extra={tabBarExtra}
        />

        {activeTab?.type === 'overview' ? (
          <GraphOverview
            loading={graph.loading}
            failed={graph.failed}
            graphData={graph.graphData}
            categoryColorMap={graph.categoryColorMap}
            tagInstanceCountRef={graph.tagInstanceCountRef}
            edgeInstanceCountRef={graph.edgeInstanceCountRef}
            onRetryReload={graph.reload}
            onConfirmChain={openLogicChainTab}
            onOpenNodeChain={openNodeChain}
            onOpenInstanceGraph={openInstanceGraphTab}
          />
        ) : activeTab?.type === 'logic-chain' ? (
          <FulldataView
            pathData={activeTab.pathData || []}
            spaceName={spaceName}
            objects={graph.objects}
            metadata={graph.metadata}
            onOpenGraph={openFulldataGraphTab}
          />
        ) : activeTab?.graphDataKey ? (
          (() => {
            const snapshot = fulldataGraphDataRef.current.get(activeTab.graphDataKey);
            if (!snapshot) {
              return (
                <div className="og-tab-placeholder">
                  <Icon name="share" size={26} />
                  实例图谱数据已失效，请关闭本标签页后重新进入
                </div>
              );
            }
            return <FulldataGraphView snapshot={snapshot} />;
          })()
        ) : (
          <div className="og-tab-placeholder">
            <Icon name="share" size={26} />
            暂无可展示的标签页内容
          </div>
        )}
      </div>
    </div>
  );
}
