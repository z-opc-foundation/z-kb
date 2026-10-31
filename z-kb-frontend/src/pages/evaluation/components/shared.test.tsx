import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  EvalMetricRecord,
  EvalRunDetail,
  EvalStageRecord,
} from '@/services/evaluation';
import {
  availabilityMeta,
  badcaseStatusMeta,
  baselineMetricMap,
  behaviorMeta,
  collectMetrics,
  datasetStatusMeta,
  deltaMeta,
  DrawerShell,
  EmptyState,
  ErrorState,
  EvidenceList,
  evidenceStatusMeta,
  fmtDuration,
  fmtMetricValue,
  fmtNumber,
  fmtShortTime,
  fmtTime,
  layerMeta,
  LoadingState,
  metricsByLayer,
  metricStatusMeta,
  normalizeCitations,
  normalizeKeyValues,
  normalizeNotConnected,
  normalizeRetrieved,
  normalizeStageTrace,
  NotConnectedList,
  runRecordFromBrief,
  runStatusMeta,
  severityMeta,
  StageFlow,
  stageStatusMeta,
  StatusTag,
  Tag,
  toNumber,
  totalBadcases,
} from './shared';

afterEach(() => {
  cleanup();
});

describe('shared 格式化函数', () => {
  it('fmtTime / fmtShortTime 处理空值与非法值', () => {
    expect(fmtTime('2026-10-20T10:05:00')).toBe('2026-10-20 10:05');
    expect(fmtTime(null)).toBe('—');
    expect(fmtTime(undefined, '无')).toBe('无');
    expect(fmtTime('not-a-date')).toBe('not-a-date');
    expect(fmtShortTime('2026-10-20T10:05:00')).toBe('10-20 10:05');
    expect(fmtShortTime('')).toBe('—');
  });

  it('fmtDuration 覆盖毫秒、秒、分钟与小时', () => {
    expect(fmtDuration(null)).toBe('—');
    expect(fmtDuration(Number.NaN)).toBe('—');
    expect(fmtDuration(500)).toBe('500 ms');
    expect(fmtDuration(1500)).toBe('1.5 s');
    expect(fmtDuration(12000)).toBe('12 s');
    expect(fmtDuration(90000)).toBe('1m 30s');
    expect(fmtDuration(120000)).toBe('2m');
    expect(fmtDuration(3900000)).toBe('1h 5m');
  });

  it('toNumber / fmtNumber / fmtMetricValue 处理比率与单位', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber(3)).toBe(3);
    expect(fmtNumber(null)).toBe('—');
    expect(fmtNumber(3)).toBe('3');
    expect(fmtNumber(2.5)).toBe('2.5');
    expect(fmtMetricValue(0.82, 'ratio')).toBe('82%');
    expect(fmtMetricValue(1800, 'ms')).toBe('1800 ms');
    expect(fmtMetricValue(0.5, '%')).toBe('0.5%');
    expect(fmtMetricValue(7)).toBe('7');
    expect(fmtMetricValue(undefined, 'ratio')).toBe('—');
  });

  it('deltaMeta 计算方向并识别不可比较输入', () => {
    expect(deltaMeta(0.85, 0.8, 'ratio')).toEqual({
      text: '+5%',
      direction: 'up',
    });
    expect(deltaMeta(0.7, 0.8, 'ratio')).toEqual({
      text: '-10%',
      direction: 'down',
    });
    expect(deltaMeta(0.8, 0.8, '%')).toEqual({
      text: '0%',
      direction: 'flat',
    });
    expect(deltaMeta(2, 1)).toEqual({ text: '+1', direction: 'up' });
    expect(deltaMeta(null, 1)).toBeNull();
    expect(deltaMeta(1, undefined)).toBeNull();
  });
});

describe('shared 状态映射', () => {
  it('runStatusMeta / availabilityMeta', () => {
    expect(runStatusMeta('running')).toEqual({ label: '运行中', tone: 'blue' });
    expect(runStatusMeta('completed')).toEqual({ label: '已完成', tone: 'green' });
    expect(runStatusMeta('weird')).toEqual({ label: 'weird', tone: 'gray' });
    expect(runStatusMeta(undefined)).toEqual({ label: '未知', tone: 'gray' });

    expect(availabilityMeta(null)).toEqual({ label: '未跑批', tone: 'gray' });
    expect(availabilityMeta({ runId: 'r1', status: 'RUNNING' })).toEqual({
      label: '运行中',
      tone: 'blue',
    });
    expect(
      availabilityMeta({ runId: 'r1', status: 'COMPLETED', resultUsable: true }),
    ).toEqual({ label: '可用', tone: 'green' });
    expect(
      availabilityMeta({ runId: 'r1', status: 'COMPLETED', resultUsable: false }),
    ).toEqual({ label: '不可用', tone: 'amber' });
    expect(availabilityMeta({ runId: 'r1', status: 'COMPLETED' })).toEqual({
      label: '未标注',
      tone: 'gray',
    });
  });

  it('数据集 / 指标 / 坏例 / 证据 / 分层状态映射', () => {
    expect(datasetStatusMeta('frozen')).toEqual({ label: '已冻结', tone: 'blue' });
    expect(datasetStatusMeta('unknown')).toEqual({
      label: 'unknown',
      tone: 'gray',
    });
    expect(datasetStatusMeta(null)).toEqual({ label: '未配置', tone: 'gray' });

    expect(metricStatusMeta('pass')).toEqual({ label: '达标', tone: 'green' });
    expect(metricStatusMeta('partial')).toEqual({
      label: '部分达标',
      tone: 'amber',
    });
    expect(metricStatusMeta(undefined, true)).toEqual({
      label: '未标注',
      tone: 'gray',
    });
    expect(metricStatusMeta(undefined)).toEqual({ label: '—', tone: 'gray' });

    expect(badcaseStatusMeta('OPEN')).toEqual({ label: '待修复', tone: 'amber' });
    expect(badcaseStatusMeta('regressed')).toEqual({
      label: '回归',
      tone: 'red',
    });
    expect(severityMeta('high')).toEqual({ label: '高', tone: 'red' });
    expect(severityMeta('中')).toEqual({ label: '中', tone: 'amber' });
    expect(severityMeta(undefined)).toEqual({
      label: '未标注',
      tone: 'gray',
    });
    expect(behaviorMeta('REFUSE')).toEqual({ label: '拒答', tone: 'amber' });
    expect(behaviorMeta('answer')).toEqual({ label: '作答', tone: 'blue' });
    expect(evidenceStatusMeta('MISSING')).toEqual({
      label: '缺失',
      tone: 'red',
    });
    expect(layerMeta('CORE')).toEqual({ label: '核心结果', tone: 'violet' });
    expect(layerMeta(null)).toEqual({ label: '未分层', tone: 'gray' });
    expect(stageStatusMeta('WARN')).toEqual({ label: '需关注', tone: 'amber' });
  });
});

describe('shared 数据归一化', () => {
  it('normalizeNotConnected 统一字符串、对象与缺失字段', () => {
    expect(normalizeNotConnected(undefined)).toEqual([]);
    expect(
      normalizeNotConnected([
        'LLM_JUDGE',
        'COST',
        'CUSTOM_THING',
        { code: 'S8', label: 'S8 反馈闭环' },
        { name: '手工项' },
        {},
      ]),
    ).toEqual([
      { code: 'LLM_JUDGE', label: 'LLM Judge' },
      { code: 'COST', label: '成本' },
      { code: 'CUSTOM_THING', label: 'CUSTOM_THING' },
      { code: 'S8', label: 'S8 反馈闭环' },
      { code: '手工项', label: '手工项' },
      { code: 'item-5', label: 'item-5' },
    ]);
  });

  it('collectMetrics 合并 run.metrics 与 stage.metrics 并按 stage::code 去重', () => {
    const run = {
      metrics: [
        { metricCode: 'a', stageCode: 'S1' },
        { metricCode: 'a', stageCode: 'S1' },
        { metricCode: 'b' },
      ],
      stages: [
        {
          stageCode: 'S1',
          metrics: [{ metricCode: 'a' }, { metricCode: 'c' }],
        },
      ],
    } satisfies Pick<EvalRunDetail, 'metrics' | 'stages'>;
    const collected = collectMetrics(run);
    expect(collected.map((item) => `${item.stageCode || ''}::${item.metricCode}`))
      .toEqual(['S1::a', '::b', 'S1::c']);
    expect(collectMetrics(null)).toEqual([]);
  });

  it('metricsByLayer / baselineMetricMap / totalBadcases', () => {
    const metrics: EvalMetricRecord[] = [
      { metricCode: 'a', metricLayer: 'core' },
      { metricCode: 'b', metricLayer: 'RUNTIME' },
    ];
    expect(metricsByLayer(metrics, 'CORE').map((item) => item.metricCode)).toEqual([
      'a',
    ]);
    expect(metricsByLayer(metrics, 'DIAGNOSTIC')).toEqual([]);

    const map = baselineMetricMap({
      runId: 'base',
      metrics: [
        { metricCode: 'a', value: 1, status: 'PASS' },
        { metricCode: 'b', value: 2 },
      ],
    });
    expect(map.get('a')).toEqual({ value: 1, status: 'PASS' });
    expect(map.get('b')).toEqual({ value: 2, status: undefined });
    expect(baselineMetricMap(null).size).toBe(0);

    expect(totalBadcases(undefined)).toBe(0);
    expect(totalBadcases({ open: 2, fixed: 3, regressed: 1 })).toBe(6);
    expect(totalBadcases({ open: null, fixed: null, regressed: 1 })).toBe(1);
  });

  it('normalizeKeyValues 支持指标数组、基础值与对象映射', () => {
    expect(normalizeKeyValues(null)).toEqual([]);
    expect(
      normalizeKeyValues([
        { metricName: '准确率', value: 0.8, unit: 'ratio' },
        { name: '状态', value: 'ok', status: 'PASS' },
        { label: '空值' },
        '原始值',
      ]),
    ).toEqual([
      { label: '准确率', value: '80%' },
      { label: '状态', value: 'ok · PASS' },
      { label: '空值', value: '—' },
      { label: '#4', value: '原始值' },
    ]);
    expect(normalizeKeyValues({ a: 1, b: true, c: { x: 1 } })).toEqual([
      { label: 'a', value: '1' },
      { label: 'b', value: '是' },
      { label: 'c', value: '{"x":1}' },
    ]);
  });

  it('normalizeRetrieved 兼容 hits / records / 原始数组', () => {
    expect(normalizeRetrieved(null)).toEqual([]);
    expect(
      normalizeRetrieved({
        hits: [
          {
            materialId: 'm1',
            chunkId: 'c1',
            materialTitle: '分级制度',
            snippet: '体温分级',
            score: 0.9,
          },
        ],
      }),
    ).toEqual([
      {
        materialId: 'm1',
        chunkId: 'c1',
        title: '分级制度',
        content: '体温分级',
        score: 0.9,
        rank: 1,
      },
    ]);
    expect(
      normalizeRetrieved({
        records: [{ title: '标题', content: '内容', rank: 5 }],
      }),
    ).toEqual([
      { title: '标题', content: '内容', rank: 5 },
    ]);
    expect(normalizeRetrieved(['纯文本'])).toEqual([
      { title: '纯文本', rank: 1 },
    ]);
  });

  it('normalizeCitations 兼容字符串、对象与标量', () => {
    expect(normalizeCitations(null)).toEqual([]);
    expect(
      normalizeCitations([
        '引用一',
        { title: '引用二' },
        { text: '引用三' },
        { foo: 'bar' },
      ]),
    ).toEqual(['引用一', '引用二', '引用三', '{"foo":"bar"}']);
    expect(normalizeCitations('单值')).toEqual(['单值']);
  });

  it('normalizeStageTrace 兼容数组与对象映射', () => {
    expect(normalizeStageTrace(null)).toEqual([]);
    expect(
      normalizeStageTrace([
        { stageCode: 'S1', stageName: '召回', status: 'PASS', detail: '命中' },
        { code: 'S2', note: '备注' },
        '异常项',
      ]),
    ).toEqual([
      { stageCode: 'S1', stageName: '召回', status: 'PASS', detail: '命中' },
      { stageCode: 'S2', stageName: undefined, status: undefined, detail: '备注' },
      { stageCode: '#3', detail: '异常项' },
    ]);
    expect(
      normalizeStageTrace({
        S1: { status: 'PASS', detail: '细节' },
        S2: 'FAIL',
      }),
    ).toEqual([
      { stageCode: 'S1', status: 'PASS', detail: '细节' },
      { stageCode: 'S2', status: 'FAIL', detail: undefined },
    ]);
  });

  it('runRecordFromBrief 补齐可空字段', () => {
    expect(
      runRecordFromBrief(
        {
          runId: 'run-1',
          status: 'COMPLETED',
          resultUsable: true,
          finishedAt: '2026-10-20T10:00:00',
          durationMs: 1000,
        },
        'kb-1',
      ),
    ).toEqual({
      runId: 'run-1',
      kbId: 'kb-1',
      status: 'COMPLETED',
      resultUsable: true,
      finishedAt: '2026-10-20T10:00:00',
      durationMs: 1000,
      startedAt: '2026-10-20T10:00:00',
    });
    expect(runRecordFromBrief({ runId: 'run-2' })).toMatchObject({
      runId: 'run-2',
      status: null,
      resultUsable: null,
      kbId: undefined,
    });
  });
});

describe('shared 展示组件', () => {
  it('Tag / StatusTag 输出语义化样式', () => {
    render(
      <div>
        <Tag tone="green" className="sm">
          已具备
        </Tag>
        <StatusTag meta={{ label: '可用', tone: 'green' }} />
      </div>,
    );
    expect(screen.getByText('已具备')).toHaveClass('tag', 'green', 'sm');
    expect(screen.getByText('可用')).toHaveClass('tag', 'green');
  });

  it('EmptyState / LoadingState 渲染标题、说明与操作', () => {
    render(
      <div>
        <EmptyState
          title="尚无数据"
          description="接口为空"
          action={<button type="button">新建</button>}
        />
        <LoadingState />
      </div>,
    );
    expect(screen.getByText('尚无数据')).toBeInTheDocument();
    expect(screen.getByText('接口为空')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建' })).toBeInTheDocument();
    expect(screen.getByText('正在加载评测数据…')).toBeInTheDocument();
  });

  it('ErrorState 触发重试与额外操作', () => {
    const onRetry = vi.fn();
    const onAction = vi.fn();
    render(
      <ErrorState
        title="加载失败"
        description="接口异常"
        onRetry={onRetry}
        action={
          <button type="button" onClick={onAction}>
            返回
          </button>
        }
      />,
    );
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('StageFlow 空态与阶段选择', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<StageFlow stages={[]} />);
    expect(screen.getByText('本次跑批未返回阶段诊断数据。')).toBeInTheDocument();

    const stages: EvalStageRecord[] = [
      {
        stageCode: 'RETRIEVAL',
        stageName: '召回',
        status: 'PASS',
        failingCaseCount: 2,
        metrics: [
          {
            metricCode: 'recall',
            metricName: '召回@5',
            value: 0.72,
            unit: 'ratio',
          },
        ],
      },
      {
        stageCode: 'GENERATION',
        stageName: '生成',
        status: 'WARN',
      },
    ];
    rerender(<StageFlow stages={stages} active="RETRIEVAL" onSelect={onSelect} />);
    expect(screen.getByText('召回@5')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('2 条失败坏例')).toBeInTheDocument();
    expect(screen.getByText('未返回坏例数')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('生成'));
    expect(onSelect).toHaveBeenCalledWith('GENERATION');
  });

  it('EvidenceList 空态与证据明细', () => {
    const { rerender } = render(<EvidenceList items={[]} />);
    expect(
      screen.getByText('接口未返回证据项；不以页面硬编码状态补齐。'),
    ).toBeInTheDocument();

    rerender(
      <EvidenceList
        items={[
          {
            code: 'VERSION',
            label: '版本钉住',
            status: 'AVAILABLE',
            detail: '已固定 v3',
          },
          { code: 'COVERAGE', status: 'PARTIAL' },
        ]}
      />,
    );
    expect(screen.getByText('版本钉住')).toBeInTheDocument();
    expect(screen.getByText('已固定 v3')).toBeInTheDocument();
    expect(screen.getByText('已具备')).toBeInTheDocument();
    expect(screen.getByText('部分具备')).toBeInTheDocument();
    expect(screen.getByText('未返回说明')).toBeInTheDocument();
  });

  it('NotConnectedList 空态与归一化标签', () => {
    const { rerender } = render(<NotConnectedList items={null} />);
    expect(screen.getByText('暂无未接入能力记录。')).toBeInTheDocument();

    rerender(<NotConnectedList items={['LLM_JUDGE', 'COST']} />);
    expect(screen.getByText('LLM Judge · 未接入')).toBeInTheDocument();
    expect(screen.getByText('成本 · 未接入')).toBeInTheDocument();
  });

  it('DrawerShell 支持关闭按钮、遮罩与 Escape', () => {
    const onClose = vi.fn();
    render(
      <DrawerShell
        title="抽屉标题"
        sub="副标题"
        body={<div>抽屉内容</div>}
        footLeft="左侧说明"
        footRight={<button type="button">确认</button>}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(screen.getByText('抽屉标题')).toBeInTheDocument();
    expect(screen.getByText('抽屉内容')).toBeInTheDocument();
    expect(screen.getByText('左侧说明')).toBeInTheDocument();

    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(document.querySelector('.overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
