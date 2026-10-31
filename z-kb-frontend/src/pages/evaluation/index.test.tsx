import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { EvalPageResult, EvalKbListRecord } from '@/services/evaluation';
import { pageEvaluationKnowledgeBases } from '@/services/evaluation';
import EvaluationListPage from './index';

vi.mock('@/services/evaluation', () => ({
  pageEvaluationKnowledgeBases: vi.fn(),
}));

const pageMock = vi.mocked(pageEvaluationKnowledgeBases);

const KB: EvalKbListRecord = {
  kbId: 'kb-1',
  kbName: '护理知识库',
  datasetVersion: 'v3',
  datasetStatus: 'PUBLISHED',
  caseCount: 12,
  lastRunId: 'run-1',
  lastRunAt: '2026-10-20T10:00:00',
  resultUsable: true,
  corePassCount: 5,
  coreTotal: 6,
  openBadcaseCount: 2,
  notConnected: ['LLM_JUDGE'],
};

function pageResult(
  records: EvalKbListRecord[],
  total = records.length,
): EvalPageResult<EvalKbListRecord> {
  return { records, total, current: 1, size: 10 };
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/evaluations']}>
      <Routes>
        <Route path="/evaluations" element={<EvaluationListPage />} />
        <Route
          path="/knowledge-bases/:kbId/evaluation"
          element={<div>WORKBENCH PAGE</div>}
        />
        <Route path="/knowledge-bases" element={<div>KB LIST PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  pageMock.mockReset();
  pageMock.mockResolvedValue(pageResult([KB], 25));
});

afterEach(() => {
  cleanup();
});

describe('EvaluationListPage', () => {
  it('先展示加载态，再展示评测库行', async () => {
    renderList();
    expect(screen.getByText('正在加载评测库…')).toBeInTheDocument();
    expect(await screen.findByText('护理知识库')).toBeInTheDocument();
    expect(screen.getByText('1 / 25 个知识库')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getAllByText('已发布').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('run-1')).toBeInTheDocument();
    expect(screen.getByText('2026-10-20 10:00')).toBeInTheDocument();
    expect(screen.getByText('可用')).toBeInTheDocument();
    expect(screen.getByText('5 / 6')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('LLM Judge · 未接入')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /进入评测/ })).toBeInTheDocument();
    expect(pageMock).toHaveBeenCalledWith({ current: 1, size: 10 });
  });

  it('点击行或进入评测跳转工作台', async () => {
    renderList();
    fireEvent.click(await screen.findByText('护理知识库'));
    expect(await screen.findByText('WORKBENCH PAGE')).toBeInTheDocument();
  });

  it('进入评测按钮跳转工作台', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /进入评测/ }));
    expect(await screen.findByText('WORKBENCH PAGE')).toBeInTheDocument();
  });

  it('按关键词搜索并在空结果时清空搜索', async () => {
    pageMock
      .mockResolvedValueOnce(pageResult([KB], 25))
      .mockResolvedValueOnce(pageResult([], 0))
      .mockResolvedValueOnce(pageResult([KB], 25));
    renderList();
    await screen.findByText('护理知识库');

    const input = screen.getByPlaceholderText('搜索知识库名称或 kbId');
    fireEvent.change(input, { target: { value: ' 护理 ' } });
    fireEvent.click(screen.getByRole('button', { name: /搜索/ }));

    expect(await screen.findByText('没有匹配的评测库')).toBeInTheDocument();
    expect(pageMock).toHaveBeenLastCalledWith({
      current: 1,
      size: 10,
      keyword: '护理',
    });
    expect(
      screen.getByText('没有知识库匹配“护理”。清空关键词后可查看全部真实记录。'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清空搜索' }));
    expect(await screen.findByText('护理知识库')).toBeInTheDocument();
    expect(pageMock).toHaveBeenLastCalledWith({ current: 1, size: 10 });
    expect(input).toHaveValue('');
  });

  it('回车提交搜索', async () => {
    renderList();
    await screen.findByText('护理知识库');
    const input = screen.getByPlaceholderText('搜索知识库名称或 kbId');
    fireEvent.change(input, { target: { value: '护理' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(pageMock).toHaveBeenLastCalledWith({
        current: 1,
        size: 10,
        keyword: '护理',
      }),
    );
  });

  it('空列表展示空态并可前往知识库列表', async () => {
    pageMock.mockResolvedValue(pageResult([], 0));
    renderList();
    expect(await screen.findByText('尚无 QA 集合')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /去知识库列表/ }));
    expect(await screen.findByText('KB LIST PAGE')).toBeInTheDocument();
  });

  it('加载失败展示错误态，重试后恢复', async () => {
    pageMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(pageResult([KB], 1));
    renderList();
    expect(await screen.findByText('评测库加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(await screen.findByText('护理知识库')).toBeInTheDocument();
    expect(pageMock).toHaveBeenCalledTimes(2);
  });

  it('分页参数随页码变化', async () => {
    const { container } = renderList();
    await screen.findByText('护理知识库');
    expect(screen.getByText('第 1 / 3 页 · 共 25 个知识库')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() =>
      expect(pageMock).toHaveBeenLastCalledWith({ current: 2, size: 10 }),
    );
    expect(screen.getByText('第 2 / 3 页 · 共 25 个知识库')).toBeInTheDocument();

    let pagerButtons = container.querySelectorAll('.pagination button');
    fireEvent.click(pagerButtons[pagerButtons.length - 1]);
    await waitFor(() =>
      expect(pageMock).toHaveBeenLastCalledWith({ current: 3, size: 10 }),
    );
    pagerButtons = container.querySelectorAll('.pagination button');
    expect(pagerButtons[pagerButtons.length - 1]).toBeDisabled();

    fireEvent.click(pagerButtons[0]);
    await waitFor(() =>
      expect(pageMock).toHaveBeenLastCalledWith({ current: 2, size: 10 }),
    );
  });

  it('刷新重新拉取列表', async () => {
    renderList();
    await screen.findByText('护理知识库');
    const before = pageMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));
    await waitFor(() =>
      expect(pageMock.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('未跑批的知识库展示占位', async () => {
    pageMock.mockResolvedValue(
      pageResult([
        {
          kbId: 'kb-2',
          kbName: '门诊知识库',
          datasetVersion: null,
          datasetStatus: null,
          caseCount: null,
          lastRunId: null,
          resultUsable: null,
          coreTotal: null,
          openBadcaseCount: null,
          notConnected: null,
        },
      ]),
    );
    renderList();
    expect(await screen.findByText('门诊知识库')).toBeInTheDocument();
    expect(screen.getAllByText('未跑批').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('未配置')).toBeInTheDocument();
    expect(screen.getByText('QA 状态未返回')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
