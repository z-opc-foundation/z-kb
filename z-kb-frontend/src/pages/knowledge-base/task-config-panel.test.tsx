import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAt } from '@/test/render';
import { getKbTaskConfig, publishKbTaskConfig } from '@/services/taskConfig';
import { toast } from '@/utils/toast';
import TaskConfigPanel from './task-config-panel';

vi.mock('@/services/taskConfig', () => ({
  getKbTaskConfig: vi.fn(),
  publishKbTaskConfig: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

const PANEL = {
  version: '2026.10-r2',
  publishedAt: '2026-03-01T09:30:00',
  publishedBy: 42,
  items: [
    {
      taskNature: 'COMPILE',
      taskLabel: '文档编译',
      taskGroup: 'CHAIN',
      executionMode: 'LOCAL_PIPELINE',
      executor: 'compile-worker',
      agentCode: 'agent-compile',
      model: 'deepseek-v3',
      skills: 'parse,chunk',
      tools: 'ocr',
      promptVersion: 'p7',
      outputContract: 'chunk.v1',
      timeoutSeconds: 600,
      retryLimit: 2,
      boundaryNote: '仅处理库内资料',
    },
    {
      taskNature: 'EVALUATION',
      taskLabel: '效果测评',
      taskGroup: 'QA',
      executionMode: 'AGENT',
      executor: 'qa-worker',
      timeoutSeconds: 120,
      retryLimit: 0,
    },
  ],
};

function renderPanel(canManage = true) {
  return renderAt(<TaskConfigPanel kbId="kb-1" canManage={canManage} />, { route: '/settings' });
}

describe('库级任务配置面板', () => {
  beforeEach(() => {
    vi.mocked(getKbTaskConfig).mockResolvedValue(PANEL);
    vi.mocked(publishKbTaskConfig).mockResolvedValue({
      ...PANEL,
      version: '2026.10-r3',
      items: PANEL.items,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('加载后展示版本、分组与任务行', async () => {
    renderPanel();

    expect(screen.getByText('正在加载任务配置…')).toBeTruthy();

    expect(await screen.findByText('版本 2026.10-r2')).toBeTruthy();
    expect(getKbTaskConfig).toHaveBeenCalledWith('kb-1');
    expect(screen.getByText(/操作者 42/)).toBeTruthy();
    expect(screen.getByText(/可编辑并发布新版本/)).toBeTruthy();
    expect(screen.getByText(/只对本库生效/)).toBeTruthy();
    expect(screen.getByText('处理链路')).toBeTruthy();
    expect(screen.getByText('最终 QA')).toBeTruthy();
    expect(screen.getByText('文档编译')).toBeTruthy();
    expect(screen.getByText('COMPILE')).toBeTruthy();
    expect(screen.getByText('本地流水线')).toBeTruthy();
    expect(screen.getByText('compile-worker')).toBeTruthy();
    expect(screen.getByText('agent-compile / deepseek-v3')).toBeTruthy();
    expect(screen.getByText('600s / 2')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /编辑/ })).toHaveLength(2);
  });

  it('只读身份隐藏编辑入口', async () => {
    renderPanel(false);
    await screen.findByText('文档编译');

    expect(screen.getByText(/^只读/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /编辑/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /查看/ })).toHaveLength(2);
  });

  it('加载失败显示错误并可重试恢复', async () => {
    vi.mocked(getKbTaskConfig).mockResolvedValueOnce(undefined);

    renderPanel();

    expect(await screen.findByText('任务配置加载失败')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));

    expect(await screen.findByText('文档编译')).toBeTruthy();
    expect(getKbTaskConfig).toHaveBeenCalledTimes(2);
  });

  it('查看抽屉展示完整配置并可关闭', async () => {
    renderPanel();
    await screen.findByText('文档编译');

    fireEvent.click(screen.getAllByRole('button', { name: /查看/ })[0]);

    expect(await screen.findByText('COMPILE · 处理链路')).toBeTruthy();
    expect(screen.getByText('技能')).toBeTruthy();
    expect(screen.getByText('parse,chunk')).toBeTruthy();
    expect(screen.getByText('提示词版本')).toBeTruthy();
    expect(screen.getByText('p7')).toBeTruthy();
    expect(screen.getByText('600 秒 / 2 次')).toBeTruthy();
    expect(screen.getByText('仅处理库内资料')).toBeTruthy();

    const drawer = screen.getByRole('dialog');
    fireEvent.click(within(drawer).getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(screen.queryByText('COMPILE · 处理链路')).toBeNull());
  });

  it('编辑任务并发布整版新版本', async () => {
    renderPanel();
    await screen.findByText('文档编译');

    fireEvent.click(screen.getAllByRole('button', { name: /编辑/ })[0]);

    expect(await screen.findByText('编辑 · 文档编译')).toBeTruthy();
    expect(screen.getByText('保存即发布 2026.10-r3')).toBeTruthy();

    const executor = screen.getByDisplayValue('compile-worker');
    fireEvent.change(executor, { target: { value: 'compile-worker-v2' } });
    fireEvent.change(screen.getByDisplayValue('600'), { target: { value: '900' } });
    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '3' } });
    fireEvent.change(screen.getByDisplayValue('仅处理库内资料'), {
      target: { value: '只处理已解析资料' },
    });

    fireEvent.click(screen.getByRole('button', { name: /保存并发布/ }));

    await waitFor(() => expect(publishKbTaskConfig).toHaveBeenCalledTimes(1));
    const [kbId, items] = vi.mocked(publishKbTaskConfig).mock.calls[0];
    expect(kbId).toBe('kb-1');
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      taskNature: 'COMPILE',
      executionMode: 'LOCAL_PIPELINE',
      executor: 'compile-worker-v2',
      agentCode: 'agent-compile',
      model: 'deepseek-v3',
      skills: 'parse,chunk',
      tools: 'ocr',
      promptVersion: 'p7',
      outputContract: 'chunk.v1',
      timeoutSeconds: 900,
      retryLimit: 3,
      boundaryNote: '只处理已解析资料',
    });
    expect(items[1]).toEqual(
      expect.objectContaining({ taskNature: 'EVALUATION', executor: 'qa-worker' }),
    );
    expect(items[1]).not.toHaveProperty('taskLabel');

    expect(toast).toHaveBeenCalledWith(
      '已发布新版本',
      '2026.10-r3 只影响本库之后创建的任务',
      'success',
    );
    await waitFor(() => expect(screen.queryByText('编辑 · 文档编译')).toBeNull());
    expect(screen.getByText('版本 2026.10-r3')).toBeTruthy();
  });

  it('发布前校验执行器、超时与重试范围', async () => {
    renderPanel();
    await screen.findByText('文档编译');
    fireEvent.click(screen.getAllByRole('button', { name: /编辑/ })[0]);
    await screen.findByText('编辑 · 文档编译');

    const executor = screen.getByDisplayValue('compile-worker');
    fireEvent.change(executor, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /保存并发布/ }));
    expect(toast).toHaveBeenCalledWith('不能发布', '执行器不能为空', 'warn');
    expect(publishKbTaskConfig).not.toHaveBeenCalled();

    fireEvent.change(executor, { target: { value: 'compile-worker' } });
    fireEvent.change(screen.getByDisplayValue('600'), { target: { value: '90000' } });
    fireEvent.click(screen.getByRole('button', { name: /保存并发布/ }));
    expect(toast).toHaveBeenCalledWith('不能发布', '超时需在 1–86400 秒之间', 'warn');

    fireEvent.change(screen.getByDisplayValue('90000'), { target: { value: '600' } });
    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /保存并发布/ }));
    expect(toast).toHaveBeenCalledWith('不能发布', '重试次数需在 0–5 之间', 'warn');
    expect(publishKbTaskConfig).not.toHaveBeenCalled();
  });

  it('取消编辑不提交', async () => {
    renderPanel();
    await screen.findByText('文档编译');
    fireEvent.click(screen.getAllByRole('button', { name: /编辑/ })[1]);
    await screen.findByText('编辑 · 效果测评');

    fireEvent.change(screen.getByDisplayValue('qa-worker'), { target: { value: 'qa-v2' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => expect(screen.queryByText('编辑 · 效果测评')).toBeNull());
    expect(publishKbTaskConfig).not.toHaveBeenCalled();
    expect(screen.getByText('qa-worker')).toBeTruthy();
  });
});
