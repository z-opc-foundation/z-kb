import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiSkillsPage from '@/pages/ai/skills/index';
import type { AiSkillRecord } from '@/services/ai';
import {
  createAiSkill,
  getAiSkillUsage,
  listAiSkills,
  listAiTools,
  publishAiSkill,
  removeAiSkill,
  updateAiSkill,
} from '@/services/ai';
import { confirmAction } from '@/components/confirm';
import { toast } from '@/utils/toast';

vi.mock('@/services/ai', () => ({
  listAiSkills: vi.fn(),
  listAiTools: vi.fn(),
  createAiSkill: vi.fn(),
  updateAiSkill: vi.fn(),
  publishAiSkill: vi.fn(),
  removeAiSkill: vi.fn(),
  getAiSkillUsage: vi.fn(),
}));

vi.mock('@/components/confirm', () => ({
  confirmAction: vi.fn(),
}));

vi.mock('@/components/auth', async () => {
  const React = await import('react');
  return {
    Can: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/utils/toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/pages/ai/shared', async () => {
  const React = await import('react');
  const h = React.createElement;
  const AI_CODE_HINT = '字母开头，仅字母、数字、下划线，2–64 位';
  const AI_STATUS_OPTIONS = [
    { value: 'all', label: '全部' },
    { value: 'published', label: '已发布' },
    { value: 'draft', label: '草稿' },
    { value: 'paused', label: '已暂停' },
  ] as const;
  return {
    AI_CODE_HINT,
    AI_STATUS_OPTIONS,
    aiCodeError: (code: string) =>
      /^[a-zA-Z][a-zA-Z0-9_]{1,63}$/.test(code)
        ? ''
        : `编码格式不对：${AI_CODE_HINT}；中文请放在名称里`,
    fmtAiTime: (value?: string | null) =>
      value ? String(value).replace('T', ' ').slice(0, 16) : '—',
    AiLoading: ({ text }: { text: string }) => h('div', null, text),
    AiEmpty: ({
      title,
      action,
    }: {
      title: string;
      action?: ReactNode;
    }) => h('div', null, h('b', null, title), action),
    AiFailed: ({ title, onRetry }: { title: string; onRetry: () => void }) =>
      h(
        'div',
        null,
        h('b', null, title),
        h('button', { type: 'button', onClick: onRetry }, '重试'),
      ),
    AiStatusTag: ({ status, label }: { status: string; label?: string }) =>
      h('span', { 'data-status': status }, label || status),
    AiRuntimeTag: () => h('span', null, 'runtime:qwen'),
    useAiRuntimeStatus: () => ({
      runtime: 'local',
      model: 'qwen',
      realModel: false,
    }),
    MultiPick: ({
      options,
      value,
      onChange,
      emptyText,
    }: {
      options: { code: string; name: string }[];
      value: string[];
      onChange: (next: string[]) => void;
      emptyText: string;
    }) =>
      options.length
        ? h(
            'div',
            null,
            options.map((option) =>
              h(
                'label',
                { key: option.code },
                h('input', {
                  type: 'checkbox',
                  checked: value.includes(option.code),
                  onChange: () =>
                    onChange(
                      value.includes(option.code)
                        ? value.filter((item) => item !== option.code)
                        : [...value, option.code],
                    ),
                }),
                option.name,
              ),
            ),
          )
        : h('span', null, emptyText),
  };
});

const published: AiSkillRecord = {
  code: 'citation_answer',
  name: '带引用回答',
  description: '回答中标注引用来源',
  status: 'published',
  statusLabel: '已发布',
  version: 2,
  publishedVersion: 2,
  prompt: '使用 [1] 标注引用',
  toolCodes: ['knowledge_search'],
  updateTime: '2026-10-01T10:20:30',
};

const draft: AiSkillRecord = {
  code: 'draft_skill',
  name: '草稿技能',
  status: 'draft',
  statusLabel: '草稿',
  version: 1,
  publishedVersion: null,
  prompt: '',
  toolCodes: [],
  updateTime: '2026-10-02T09:00:00',
};

const paused: AiSkillRecord = {
  code: 'paused_skill',
  name: '暂停技能',
  status: 'paused',
  statusLabel: '已暂停',
  version: 1,
  publishedVersion: null,
  prompt: '旧提示词',
  toolCodes: [],
  updateTime: '',
};

const tool = {
  code: 'knowledge_search',
  name: '知识库检索',
  status: 'published' as const,
  statusLabel: '已发布',
  executable: true,
  parameters: [],
};

function rowOf(name: string): HTMLElement {
  const cell = screen.getByText(name);
  return cell.closest('tr') as HTMLElement;
}

describe('AiSkillsPage', () => {
  beforeEach(() => {
    vi.mocked(listAiSkills).mockReset();
    vi.mocked(listAiTools).mockReset();
    vi.mocked(createAiSkill).mockReset();
    vi.mocked(updateAiSkill).mockReset();
    vi.mocked(publishAiSkill).mockReset();
    vi.mocked(removeAiSkill).mockReset();
    vi.mocked(getAiSkillUsage).mockReset();
    vi.mocked(confirmAction).mockReset();
    vi.mocked(toast).mockReset();

    vi.mocked(listAiSkills).mockResolvedValue([published, draft, paused]);
    vi.mocked(listAiTools).mockResolvedValue([tool]);
    vi.mocked(confirmAction).mockResolvedValue(true);
  });

  it('加载中展示加载提示，完成后渲染技能表格', async () => {
    let resolveSkills: (value: AiSkillRecord[]) => void = () => {};
    vi.mocked(listAiSkills).mockReturnValue(
      new Promise((resolve) => {
        resolveSkills = resolve;
      }),
    );
    render(<AiSkillsPage />);

    expect(screen.getByText('正在加载技能定义…')).toBeInTheDocument();

    await act(async () => resolveSkills([published]));

    expect(await screen.findByText('带引用回答')).toBeInTheDocument();
    expect(screen.getByText('citation_answer')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '状态' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '版本' })).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('知识库检索')).toBeInTheDocument();
    expect(screen.getByText('使用 [1] 标注引用')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('加载失败展示错误并可重试', async () => {
    vi.mocked(listAiSkills).mockResolvedValue(undefined);
    render(<AiSkillsPage />);

    expect(await screen.findByText('技能列表加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(listAiSkills).toHaveBeenCalledTimes(2));
  });

  it('没有任何技能时展示空态与新建入口', async () => {
    vi.mocked(listAiSkills).mockResolvedValue([]);
    vi.mocked(listAiTools).mockResolvedValue([]);
    render(<AiSkillsPage />);

    expect(await screen.findByText('还没有技能')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /新建技能/ })).toHaveLength(2);
  });

  it('展示状态、工具、提示词占位与统计口径', async () => {
    render(<AiSkillsPage />);
    await screen.findByText('带引用回答');

    expect(screen.getByText('已发布 1 · 草稿 1')).toBeInTheDocument();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('提示词为空，暂不可发布')).toBeInTheDocument();
    expect(screen.getByText('2026-10-01 10:20')).toBeInTheDocument();
    expect(screen.getByText('已暂停')).toBeInTheDocument();
    // 暂停状态不参与筛选页签
    expect(
      screen.queryByRole('button', { name: /^已暂停/ }),
    ).not.toBeInTheDocument();
  });

  it('支持关键字与状态筛选，并清空筛选', async () => {
    render(<AiSkillsPage />);
    await screen.findByText('带引用回答');
    const search = screen.getByPlaceholderText('搜索编码、名称、描述或提示词');

    fireEvent.change(search, { target: { value: '引用' } });
    expect(screen.getByText('带引用回答')).toBeInTheDocument();
    expect(screen.queryByText('草稿技能')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^草稿/ }));
    expect(screen.getByText('草稿技能')).toBeInTheDocument();
    expect(screen.queryByText('带引用回答')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '不存在' } });
    expect(screen.getByText('没有匹配的技能')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));

    expect(screen.getByText('带引用回答')).toBeInTheDocument();
    expect(search).toHaveValue('');
  });

  it('新建技能校验必填与编码格式，成功后提交并刷新', async () => {
    vi.mocked(createAiSkill).mockResolvedValue({
      ...published,
      code: 'new_skill',
      name: '新技能',
      version: 1,
      publishedVersion: null,
    });
    render(<AiSkillsPage />);
    await screen.findByText('带引用回答');

    fireEvent.click(screen.getByRole('button', { name: /新建技能/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('新建技能')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /创建草稿/ }));
    expect(screen.getByText('编码与名称必填')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('如 citation_answer'), {
      target: { value: '1bad' },
    });
    fireEvent.change(screen.getByPlaceholderText('如 带引用回答'), {
      target: { value: '新技能' },
    });
    fireEvent.click(screen.getByRole('button', { name: /创建草稿/ }));
    expect(screen.getByText(/编码格式不对/)).toBeInTheDocument();
    expect(createAiSkill).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('如 citation_answer'), {
      target: { value: 'new_skill' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('一句话说明这个技能解决什么'),
      { target: { value: '用于验证新建' } },
    );
    fireEvent.change(
      screen.getByPlaceholderText(/回答中的结论使用/),
      { target: { value: '请引用来源' } },
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: /知识库检索/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: /创建草稿/ }));

    await waitFor(() =>
      expect(createAiSkill).toHaveBeenCalledWith({
        code: 'new_skill',
        name: '新技能',
        description: '用于验证新建',
        prompt: '请引用来源',
        toolCodes: ['knowledge_search'],
      }),
    );
    await waitFor(() => expect(listAiSkills).toHaveBeenCalledTimes(2));
    expect(toast).toHaveBeenCalledWith(
      '已新建技能',
      '新技能 · v1',
      'success',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('编辑技能提交更新参数并刷新', async () => {
    vi.mocked(updateAiSkill).mockResolvedValue({
      ...published,
      name: '更新后的技能',
    });
    render(<AiSkillsPage />);
    await screen.findByText('带引用回答');

    fireEvent.click(within(rowOf('带引用回答')).getByTitle('编辑'));
    expect(screen.getByText('编辑 · 带引用回答')).toBeInTheDocument();
    const codeInput = screen.getByDisplayValue('citation_answer');
    expect(codeInput).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue('带引用回答'), {
      target: { value: '更新后的技能' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^保存/ }));

    await waitFor(() =>
      expect(updateAiSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'citation_answer',
          name: '更新后的技能',
          description: '回答中标注引用来源',
          prompt: '使用 [1] 标注引用',
          toolCodes: ['knowledge_search'],
        }),
      ),
    );
    await waitFor(() => expect(listAiSkills).toHaveBeenCalledTimes(2));
    expect(toast).toHaveBeenCalledWith(
      '已保存技能',
      '更新后的技能 · v2',
      'success',
    );
  });

  it('发布与删除技能调用对应服务', async () => {
    vi.mocked(publishAiSkill).mockResolvedValue({
      ...draft,
      status: 'published',
      statusLabel: '已发布',
      publishedVersion: 1,
    });
    vi.mocked(removeAiSkill).mockResolvedValue(true);
    render(<AiSkillsPage />);
    await screen.findByText('草稿技能');

    fireEvent.click(within(rowOf('草稿技能')).getByTitle('发布'));
    await waitFor(() =>
      expect(publishAiSkill).toHaveBeenCalledWith('draft_skill'),
    );

    fireEvent.click(within(rowOf('带引用回答')).getByTitle('删除'));
    await waitFor(() =>
      expect(confirmAction).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '删除技能「带引用回答」？',
        }),
      ),
    );
    await waitFor(() =>
      expect(removeAiSkill).toHaveBeenCalledWith('citation_answer'),
    );
    expect(toast).toHaveBeenCalledWith(
      '已删除技能',
      '带引用回答',
      'success',
    );
  });

  it('引用关系弹窗展示智能体编码', async () => {
    vi.mocked(getAiSkillUsage).mockResolvedValue({
      agentCodes: ['agent_a', 'agent_b'],
      skillCodes: [],
      empty: false,
    });
    render(<AiSkillsPage />);
    await screen.findByText('带引用回答');

    fireEvent.click(within(rowOf('带引用回答')).getByRole('button', { name: /引用/ }));

    expect(
      await screen.findByText('引用关系 · 带引用回答'),
    ).toBeInTheDocument();
    expect(screen.getByText('引用该技能的智能体（2）')).toBeInTheDocument();
    expect(screen.getByText('agent_a')).toBeInTheDocument();
    expect(screen.getByText('agent_b')).toBeInTheDocument();
    expect(getAiSkillUsage).toHaveBeenCalledWith('citation_answer');
  });
});
