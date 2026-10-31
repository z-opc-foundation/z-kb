import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvalOverview } from '@/services/evaluation';
import { createEvalRun } from '@/services/evaluation';
import { toast } from '@/utils/toast';
import RunCreateModal from './run-create-modal';

vi.mock('@/services/evaluation', () => ({
  createEvalRun: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const createMock = vi.mocked(createEvalRun);
const toastMock = vi.mocked(toast);

const OVERVIEW: EvalOverview = {
  kbId: 'kb-1',
  kbName: '护理知识库',
  dataset: {
    versionNo: 'v3',
    status: 'PUBLISHED',
    caseCount: 12,
    publishedAt: '2026-10-19T09:00:00',
  },
  lastRun: {
    runId: 'run-1',
    status: 'COMPLETED',
    resultUsable: true,
    finishedAt: '2026-10-20T10:00:00',
  },
};

const KNOWN_RUNS = [
  {
    runId: 'run-0',
    datasetVersionNo: 'v2',
    finishedAt: '2026-10-18T10:00:00',
  },
  { runId: 'run-1', datasetVersionNo: 'v3', finishedAt: '2026-10-20T10:00:00' },
];

function renderModal(
  overrides: Partial<ComponentProps<typeof RunCreateModal>> = {},
) {
  const props = {
    kbId: 'kb-1',
    overview: OVERVIEW,
    knownRuns: KNOWN_RUNS,
    defaultBaselineRunId: undefined,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    ...overrides,
  };
  return { ...render(<RunCreateModal {...props} />), props };
}

beforeEach(() => {
  createMock.mockReset();
  toastMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('RunCreateModal', () => {
  it('冻结版本可发起，提交携带版本与基线', async () => {
    createMock.mockResolvedValue({
      runId: 'run-2',
      status: 'COMPLETED',
      reused: false,
    });
    const { props } = renderModal();
    expect(screen.getByText('QA 版本已冻结')).toBeInTheDocument();
    expect(screen.getByText('v3 · 已发布 · 12 题')).toBeInTheDocument();
    expect(screen.getByText('allowReuse = true')).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toBeDisabled();
    fireEvent.change(selects[1], { target: { value: 'run-0' } });
    expect(screen.getByText('run-0', { selector: 'dd.mono' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      kbId: 'kb-1',
      datasetVersionNo: 'v3',
      baselineRunId: 'run-0',
      allowReuse: true,
    });
    await waitFor(() =>
      expect(props.onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-2' }),
      ),
    );
    expect(toastMock).toHaveBeenCalledWith('跑批已发起', 'run-2', 'success');
  });

  it('后端复用结果时提示 reused', async () => {
    createMock.mockResolvedValue({
      runId: 'run-2',
      status: 'COMPLETED',
      reused: true,
    });
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));
    await waitFor(() => expect(props.onCreated).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(
      '已复用同口径跑批',
      'run-2 · reused=true',
      'info',
    );
  });

  it('发起失败时提示且不回调', async () => {
    createMock.mockResolvedValue(undefined);
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /发起跑批/ }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        '发起跑批失败',
        'createRun 返回异常；未跳转，也未写入本地结果。',
        'error',
      ),
    );
    expect(props.onCreated).not.toHaveBeenCalled();
  });

  it('无 QA 版本时禁止发起', () => {
    renderModal({ overview: null });
    expect(screen.getByText('尚无可用 QA 版本')).toBeInTheDocument();
    expect(screen.getByText('无可用版本')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /发起跑批/ });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('草稿版本未冻结时禁止发起', () => {
    renderModal({
      overview: {
        ...OVERVIEW,
        dataset: { versionNo: 'v4', status: 'DRAFT', caseCount: 3 },
      },
    });
    expect(screen.getByText('当前 QA 版本尚未冻结')).toBeInTheDocument();
    expect(screen.getByText(/数据集状态为「草稿」/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /发起跑批/ })).toBeDisabled();
  });

  it('使用默认基线并允许取消弹窗', () => {
    const { props } = renderModal({ defaultBaselineRunId: 'run-0' });
    expect(screen.getAllByRole('combobox')[1]).toHaveValue('run-0');
    expect(screen.getByText('run-0', { selector: 'dd.mono' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
