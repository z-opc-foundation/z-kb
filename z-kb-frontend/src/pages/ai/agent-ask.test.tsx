import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentAskButton } from '@/pages/ai/agent-ask';
import type {
  AiAgentRecord,
  AiRuntimeStatus,
  AiSkillRecord,
  AiToolRecord,
} from '@/services/ai';
import {
  getAiRuntimeStatus,
  listAiAgents,
  listAiSkills,
  listAiTools,
} from '@/services/ai';
import { toast } from '@/utils/toast';

vi.mock('@/services/ai', () => ({
  listAiAgents: vi.fn(),
  listAiSkills: vi.fn(),
  listAiTools: vi.fn(),
  getAiRuntimeStatus: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/pages/ai/agent-run-drawer', async () => {
  const React = await import('react');
  const h = React.createElement;
  return {
    AI_QA_AGENT_CODE: 'kb_qa_assistant',
    AgentRunDrawer: ({
      agent,
      skills,
      tools,
      runtime,
      initialKbId,
      initialQuestion,
      title,
      onClose,
    }: {
      agent: AiAgentRecord;
      skills: AiSkillRecord[];
      tools: AiToolRecord[];
      runtime?: AiRuntimeStatus;
      initialKbId?: string;
      initialQuestion?: string;
      title?: string;
      onClose: () => void;
    }) =>
      h(
        'div',
        { 'data-testid': 'run-drawer' },
        h('span', { 'data-testid': 'drawer-title' }, title),
        h('span', { 'data-testid': 'drawer-agent' }, agent.name),
        h('span', { 'data-testid': 'drawer-skills' }, String(skills.length)),
        h('span', { 'data-testid': 'drawer-tools' }, String(tools.length)),
        h(
          'span',
          { 'data-testid': 'drawer-runtime' },
          runtime?.model ?? 'none',
        ),
        h('span', { 'data-testid': 'drawer-kb' }, initialKbId ?? ''),
        h(
          'span',
          { 'data-testid': 'drawer-question' },
          initialQuestion ?? '',
        ),
        h('button', { type: 'button', onClick: onClose }, '关闭抽屉'),
      ),
  };
});

const agent: AiAgentRecord = {
  code: 'kb_qa_assistant',
  name: '知识库问答助手',
  status: 'published',
  statusLabel: '已发布',
  skillCodes: ['citation_answer'],
  toolCodes: ['knowledge_search'],
};

const skill: AiSkillRecord = {
  code: 'citation_answer',
  name: '带引用回答',
  status: 'published',
  statusLabel: '已发布',
  toolCodes: [],
};

const tool: AiToolRecord = {
  code: 'knowledge_search',
  name: '知识库检索',
  status: 'published',
  statusLabel: '已发布',
  parameters: [],
};

const runtime: AiRuntimeStatus = {
  runtime: 'galaxy',
  model: 'qwen3.6-flash',
  realModel: true,
};

describe('AgentAskButton', () => {
  beforeEach(() => {
    vi.mocked(listAiAgents).mockReset();
    vi.mocked(listAiSkills).mockReset();
    vi.mocked(listAiTools).mockReset();
    vi.mocked(getAiRuntimeStatus).mockReset();
    vi.mocked(toast).mockReset();

    vi.mocked(listAiAgents).mockResolvedValue([agent]);
    vi.mocked(listAiSkills).mockResolvedValue([skill]);
    vi.mocked(listAiTools).mockResolvedValue([tool]);
    vi.mocked(getAiRuntimeStatus).mockResolvedValue(runtime);
  });

  it('点击后加载注册表并打开抽屉，关闭后卸载', async () => {
    let resolveAgents: (value: AiAgentRecord[]) => void = () => {};
    vi.mocked(listAiAgents).mockReturnValue(
      new Promise((resolve) => {
        resolveAgents = resolve;
      }),
    );
    render(<AgentAskButton kbId="kb_1" question="怎么排班" />);

    const button = screen.getByRole('button', { name: /问 AI/ });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(listAiAgents).toHaveBeenCalledTimes(1);
    expect(listAiSkills).toHaveBeenCalledTimes(1);
    expect(listAiTools).toHaveBeenCalledTimes(1);
    expect(getAiRuntimeStatus).toHaveBeenCalledTimes(1);

    await act(async () => resolveAgents([agent]));

    const drawer = await screen.findByTestId('run-drawer');
    expect(withinDrawer('drawer-title')).toHaveTextContent('AI 问答');
    expect(withinDrawer('drawer-agent')).toHaveTextContent('知识库问答助手');
    expect(withinDrawer('drawer-skills')).toHaveTextContent('1');
    expect(withinDrawer('drawer-tools')).toHaveTextContent('1');
    expect(withinDrawer('drawer-runtime')).toHaveTextContent('qwen3.6-flash');
    expect(withinDrawer('drawer-kb')).toHaveTextContent('kb_1');
    expect(withinDrawer('drawer-question')).toHaveTextContent('怎么排班');
    expect(drawer).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭抽屉' }));
    expect(screen.queryByTestId('run-drawer')).not.toBeInTheDocument();
  });

  it('注册表读取失败时提示运行时不可用', async () => {
    vi.mocked(listAiAgents).mockResolvedValue(undefined);
    render(<AgentAskButton />);

    fireEvent.click(screen.getByRole('button', { name: /问 AI/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        'AI 运行时不可用',
        '智能体注册表读取失败，请确认后端已启动。',
        'error',
      ),
    );
    expect(screen.queryByTestId('run-drawer')).not.toBeInTheDocument();
  });

  it('没有目标智能体时提示编码', async () => {
    render(<AgentAskButton agentCode="missing_agent" label="问一问" />);

    fireEvent.click(screen.getByRole('button', { name: /问一问/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        '未找到问答智能体',
        'AI 注册表里没有 missing_agent，请先在基础设施创建并发布。',
        'info',
      ),
    );
    expect(screen.queryByTestId('run-drawer')).not.toBeInTheDocument();
  });

  it('运行时下发的编码优先于逻辑编码', async () => {
    vi.mocked(getAiRuntimeStatus).mockResolvedValue({
      ...runtime,
      qaAgentCode: 'agent_fb_qa_assistant',
    });
    vi.mocked(listAiAgents).mockResolvedValue([
      { ...agent, code: 'agent_fb_qa_assistant', name: '远端问答助手' },
    ]);
    render(<AgentAskButton kbId="kb_1" />);

    fireEvent.click(screen.getByRole('button', { name: /问 AI/ }));

    const drawer = await screen.findByTestId('run-drawer');
    expect(withinDrawer('drawer-agent')).toHaveTextContent('远端问答助手');
    expect(drawer).toBeInTheDocument();
  });

  it('运行时没有下发编码时仍按逻辑编码查找', async () => {
    vi.mocked(getAiRuntimeStatus).mockResolvedValue(runtime);
    render(<AgentAskButton kbId="kb_1" />);

    fireEvent.click(screen.getByRole('button', { name: /问 AI/ }));

    const drawer = await screen.findByTestId('run-drawer');
    expect(withinDrawer('drawer-agent')).toHaveTextContent('知识库问答助手');
    expect(drawer).toBeInTheDocument();
  });

  it('智能体暂停时不打开抽屉', async () => {    vi.mocked(listAiAgents).mockResolvedValue([
      { ...agent, status: 'paused', statusLabel: '已暂停' },
    ]);
    render(<AgentAskButton />);

    fireEvent.click(screen.getByRole('button', { name: /问 AI/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        '智能体已暂停',
        '恢复后才能发起问答。',
        'info',
      ),
    );
    expect(screen.queryByTestId('run-drawer')).not.toBeInTheDocument();
  });

  it('disabled 时按钮不可点击且不请求接口', () => {
    render(<AgentAskButton disabled />);
    const button = screen.getByRole('button', { name: /问 AI/ });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(listAiAgents).not.toHaveBeenCalled();
  });
});

function withinDrawer(testId: string): HTMLElement {
  return screen.getByTestId(testId);
}
