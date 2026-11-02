import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompilationJobRecord, RetrievalChunkRecord } from '@/services/compilation';
import type { MaterialDetailRecord } from '@/services/material';
import MaterialCompilationSection from './material-compilation-section';

const DETAIL: MaterialDetailRecord = {
  material: {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '排班管理制度',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp',
    compileStatus: 'COMPLETED',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
  },
  versions: [],
  currentDraft: {
    draftId: 'd-1',
    status: 'READY',
    parserName: 'MinerU',
    parserVersion: '2.1',
    textContent: '正文',
    textLength: 2,
  },
};

const JOB: CompilationJobRecord = {
  jobId: 'job-1',
  kbId: 'kb-1',
  materialId: 'mat-1',
  materialVersionId: 'v-1',
  pipelineType: 'DOCUMENT',
  configVersion: 'cfg-1',
  compilerVersion: 'local-chunker-v2',
  runStatus: 'COMPLETED',
  milestone: 'M1',
  chunkCount: 2,
  reused: false,
  taskStatus: 'SUCCEEDED',
  startedAt: '2026-10-01T10:00:00',
  finishedAt: '2026-10-01T10:05:00',
  stages: [
    { stage: 'REGISTER', status: 'SUCCEEDED', detail: '登记完成', finishedAt: '2026-10-01T10:01:00' },
    { stage: 'EXTRACT', status: 'FAILED', detail: '规则抽取失败' },
  ],
  ledger: {
    ledgerId: 'l-1',
    expectedCount: 2,
    settledCount: 1,
    failedCount: 1,
    deadCount: 0,
    status: 'OPEN',
  },
  artifact: {
    artifactId: 'a-1',
    artifactType: 'WIKI',
    title: '排班制度 Wiki',
    lifecycleStatus: 'ACTIVE',
    retrievalState: 'INDEXED',
    versionNo: 3,
    contentHash: 'abcdef0123456789xyz',
    evidenceRef: 'evidence://chunk-1',
  },
};

const CHUNKS: RetrievalChunkRecord[] = [
  {
    chunkId: 'c-1',
    materialId: 'mat-1',
    materialVersionId: 'v-1',
    artifactId: 'a-1',
    ordinal: 1,
    heading: '总则',
    content: '第一条 为规范门诊排班。',
    charCount: 12,
    indexState: 'INDEXED',
  },
];

function renderSection(overrides: Partial<Parameters<typeof MaterialCompilationSection>[0]> = {}) {
  return render(
    <MaterialCompilationSection
      detail={DETAIL}
      compilation={null}
      compilationLoading={false}
      chunks={[]}
      canManage
      compileBusy={false}
      onCompile={vi.fn()}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('资料编译区块', () => {
  it('加载中展示占位', () => {
    renderSection({ compilationLoading: true });
    expect(screen.getByText('正在加载编译任务…')).toBeTruthy();
  });

  it('未编译时按权限与解析状态给出操作或提示', () => {
    const onCompile = vi.fn();
    const view = renderSection({ onCompile });
    expect(screen.getByText('尚未编译')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '开始编译' }));
    expect(onCompile).toHaveBeenCalledTimes(1);

    view.unmount();
    renderSection({ canManage: false });
    expect(screen.getByText('当前账号无管理权限，不能触发编译。')).toBeTruthy();

    view.unmount();
    renderSection({ detail: { ...DETAIL, currentDraft: null } });
    expect(screen.getByText('解析稿就绪后才能编译。')).toBeTruthy();
  });

  it('展示任务状态、阶段表、产物账本、产物与检索块', () => {
    renderSection({ compilation: JOB, chunks: CHUNKS });

    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText('M1 已达成')).toBeTruthy();
    expect(screen.getByText('2 个检索块')).toBeTruthy();
    expect(screen.getByText('local-chunker-v2 / cfg-1')).toBeTruthy();
    expect(screen.getByText('调度 SUCCEEDED')).toBeTruthy();
    expect(screen.getByText('10-01 10:05')).toBeTruthy();

    expect(screen.getByText('P0 登记')).toBeTruthy();
    expect(screen.getByText('P4 萃取')).toBeTruthy();
    expect(screen.getByText('成功')).toBeTruthy();
    expect(screen.getByText('失败')).toBeTruthy();
    expect(screen.getByText('登记完成')).toBeTruthy();
    expect(screen.getByText('规则抽取失败')).toBeTruthy();

    expect(screen.getByText('产物账本')).toBeTruthy();
    expect(screen.getByText('2 / 1')).toBeTruthy();
    expect(screen.getByText('1 / 0')).toBeTruthy();
    expect(screen.getByText('未平账')).toBeTruthy();

    expect(screen.getByText('排班制度 Wiki')).toBeTruthy();
    expect(screen.getByText('v3')).toBeTruthy();
    expect(screen.getByText('evidence://chunk-1')).toBeTruthy();
    expect(screen.getByText('abcdef0123456789…')).toBeTruthy();

    expect(screen.getByText('总则')).toBeTruthy();
    expect(screen.getByText('第一条 为规范门诊排班。')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('失败摘要、M1 告警与空检索块', () => {
    renderSection({
      compilation: {
        ...JOB,
        runStatus: 'FAILED',
        failureSummary: 'P2 切块失败',
        ledger: { ...JOB.ledger!, settledCount: 2, failedCount: 0 },
      },
      chunks: [],
    });

    expect(screen.getByText('编译未完成')).toBeTruthy();
    expect(screen.getByText('P2 切块失败')).toBeTruthy();
    expect(screen.getByText('M2 未达成')).toBeTruthy();
    expect(screen.getByText('已平账')).toBeTruthy();
    expect(screen.getByText('暂无检索块')).toBeTruthy();
  });
});
