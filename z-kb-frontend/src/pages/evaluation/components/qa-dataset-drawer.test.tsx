import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvalDatasetDetail } from '@/services/evaluation';
import {
  publishEvalDataset,
  queryEvalDataset,
  saveEvalDatasetDraft,
} from '@/services/evaluation';
import { toast } from '@/utils/toast';
import { renderAt } from '@/test/render';
import QaDatasetDrawer from './qa-dataset-drawer';

vi.mock('@/services/evaluation', () => ({
  queryEvalDataset: vi.fn(),
  saveEvalDatasetDraft: vi.fn(),
  publishEvalDataset: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const queryMock = vi.mocked(queryEvalDataset);
const saveMock = vi.mocked(saveEvalDatasetDraft);
const publishMock = vi.mocked(publishEvalDataset);
const toastMock = vi.mocked(toast);

const DATASET: EvalDatasetDetail = {
  dataset: {
    versionNo: 'v3',
    status: 'PUBLISHED',
    caseCount: 2,
    publishedAt: '2026-10-19T09:00:00',
  },
  cases: [
    {
      caseId: 'case-1',
      caseNo: 1,
      question: '发热患者如何分级？',
      expectedAnswer: '按体温分级',
      expectedBehavior: 'ANSWER',
      expectedEvidence: { materialId: 'mat-1' },
      tags: ['分级'],
    },
    {
      caseId: 'case-2',
      caseNo: 2,
      question: '无关问题如何拒答？',
      expectedAnswer: '',
      expectedBehavior: 'REFUSE',
      expectedEvidence: null,
      tags: [],
    },
  ],
};

function renderDrawer() {
  const props = {
    kbId: 'kb-1',
    kbName: '护理知识库',
    onClose: vi.fn(),
    onChanged: vi.fn(),
  };
  return { ...renderAt(<QaDatasetDrawer {...props} />), props };
}

function firstCard(container: HTMLElement): HTMLElement {
  return container.querySelectorAll('.eval-draft-card')[0] as HTMLElement;
}

beforeEach(() => {
  queryMock.mockReset();
  saveMock.mockReset();
  publishMock.mockReset();
  toastMock.mockClear();
  queryMock.mockResolvedValue(DATASET);
  saveMock.mockResolvedValue({});
  publishMock.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

describe('QaDatasetDrawer', () => {
  it('加载后展示当前版本与题目列表', async () => {
    renderDrawer();
    expect(await screen.findByText('发热患者如何分级？')).toBeInTheDocument();
    expect(screen.getAllByText('v3').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('已发布').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2026-10-19 09:00')).toBeInTheDocument();
    expect(screen.getByText('按体温分级')).toBeInTheDocument();
    expect(screen.getByText('作答')).toBeInTheDocument();
    expect(screen.getByText('拒答')).toBeInTheDocument();
    expect(screen.getByText('分级')).toBeInTheDocument();
    expect(queryMock).toHaveBeenCalledWith('kb-1');
  });

  it('尚无题目时从空态创建草稿', async () => {
    queryMock.mockResolvedValue({ dataset: null, cases: [] });
    const { container } = renderDrawer();
    expect(await screen.findByText('尚无 QA 集合')).toBeInTheDocument();
    expect(screen.getAllByText('未配置').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /发布冻结/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /创建草稿/ }));
    expect(screen.getAllByText('草稿编辑').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('还没有题目')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('护理知识库 QA 集合')).toHaveValue(
      '护理知识库 QA 集合',
    );
    fireEvent.click(screen.getByRole('button', { name: /添加第一道题/ }));
    expect(container.querySelectorAll('.eval-draft-card')).toHaveLength(1);
  });

  it('加载失败可重试', async () => {
    queryMock.mockResolvedValue(undefined);
    renderDrawer();
    expect(await screen.findByText('QA 集合加载失败')).toBeInTheDocument();
    const before = queryMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    await waitFor(() =>
      expect(queryMock.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('编辑草稿并保存转换后的题目载荷', async () => {
    const { container, props } = renderDrawer();
    await screen.findByText('发热患者如何分级？');
    fireEvent.click(screen.getByRole('button', { name: /编辑草稿/ }));

    fireEvent.change(screen.getByPlaceholderText('护理知识库 QA 集合'), {
      target: { value: '护理评测集' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('可选，说明覆盖范围与维护人'),
      { target: { value: '季度回归用' } },
    );

    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith({
      kbId: 'kb-1',
      name: '护理评测集',
      description: '季度回归用',
      cases: [
        {
          caseNo: '1',
          question: '发热患者如何分级？',
          expectedAnswer: '按体温分级',
          expectedBehavior: 'ANSWER',
          expectedEvidence: { materialId: 'mat-1' },
          tags: ['分级'],
        },
        {
          caseNo: '2',
          question: '无关问题如何拒答？',
          expectedAnswer: '',
          expectedBehavior: 'REFUSE',
          expectedEvidence: null,
          tags: [],
        },
      ],
    });
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith(
      'QA 草稿已保存',
      '2 道题 · 尚未冻结',
      'success',
    );
    expect(await screen.findByText('题目列表')).toBeInTheDocument();
    expect(container.querySelectorAll('.eval-draft-card')).toHaveLength(0);
  });

  it('新增题目缺少问题时不提交', async () => {
    const { container } = renderDrawer();
    await screen.findByText('发热患者如何分级？');
    fireEvent.click(screen.getByRole('button', { name: /编辑草稿/ }));
    fireEvent.click(screen.getByRole('button', { name: /添加题目/ }));
    expect(container.querySelectorAll('.eval-draft-card')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));
    expect(screen.getByText('第 3 题缺少问题。')).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('题号重复或期望证据非法时给出校验提示', async () => {
    const { container } = renderDrawer();
    await screen.findByText('发热患者如何分级？');
    fireEvent.click(screen.getByRole('button', { name: /编辑草稿/ }));

    const card = firstCard(container);
    const areas = card.querySelectorAll('textarea');
    fireEvent.change(areas[2], { target: { value: '{bad json' } });
    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));
    expect(screen.getByText('第 1 题期望证据不是合法 JSON。')).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();

    fireEvent.change(areas[2], { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /添加题目/ }));
    const cards = container.querySelectorAll('.eval-draft-card');
    const newCard = cards[2] as HTMLElement;
    const newInputs = newCard.querySelectorAll('input');
    fireEvent.change(newInputs[0], { target: { value: '1' } });
    fireEvent.change(newCard.querySelectorAll('textarea')[0], {
      target: { value: '重复题号问题' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));
    expect(screen.getByText('题号 1 重复。')).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('删除全部题目后提示至少一道题', async () => {
    renderDrawer();
    await screen.findByText('发热患者如何分级？');
    fireEvent.click(screen.getByRole('button', { name: /编辑草稿/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /删除/ })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /删除/ })[0]);
    expect(screen.getByText('还没有题目')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));
    expect(screen.getByText('至少需要一道题。')).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('发布冻结需二次确认并携带期望版本', async () => {
    const { props } = renderDrawer();
    await screen.findByText('发热患者如何分级？');
    fireEvent.click(screen.getByRole('button', { name: /发布冻结/ }));
    expect(screen.getByText('发布并冻结 QA 集合')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
    await waitFor(() => expect(publishMock).toHaveBeenCalledTimes(1));
    expect(publishMock).toHaveBeenCalledWith({
      kbId: 'kb-1',
      expectedVersionNo: 'v3',
    });
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith(
      'QA 集合已发布冻结',
      'v3 · 发布后不可变',
      'success',
    );
    expect(screen.queryByText('发布并冻结 QA 集合')).not.toBeInTheDocument();
  });

  it('保存或发布失败时提示错误', async () => {
    saveMock.mockResolvedValue(undefined);
    publishMock.mockResolvedValue(undefined);
    const { props } = renderDrawer();
    await screen.findByText('发热患者如何分级？');

    fireEvent.click(screen.getByRole('button', { name: /编辑草稿/ }));
    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        '草稿保存失败',
        'saveDatasetDraft 返回异常，未切换页面状态。',
        'error',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /查看当前版本/ }));
    fireEvent.click(screen.getByRole('button', { name: /发布冻结/ }));
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        '发布失败',
        'publishDataset 返回异常，版本未变更。',
        'error',
      ),
    );
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it('queryDataset 返回数组时按题目列表展示', async () => {
    queryMock.mockResolvedValue([
      {
        caseId: 'case-1',
        caseNo: 1,
        question: '数组返回的问题',
        expectedBehavior: 'ANSWER',
        tags: ['数组'],
      },
    ]);
    renderDrawer();
    expect(await screen.findByText('数组返回的问题')).toBeInTheDocument();
    expect(screen.getByText('数组')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /发布冻结/ })).toBeDisabled();
  });
});
