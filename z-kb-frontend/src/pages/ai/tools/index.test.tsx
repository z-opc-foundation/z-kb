import type { ChangeEvent, ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiToolsPage from '@/pages/ai/tools/index';
import type { AiToolRecord } from '@/services/ai';
import {
  changeAiToolStatus,
  getAiToolUsage,
  invokeAiTool,
  listAiTools,
  registerAiTool,
  removeAiTool,
} from '@/services/ai';
import { confirmAction } from '@/components/confirm';
import { toast } from '@/utils/toast';

vi.mock('@/services/ai', () => ({
  listAiTools: vi.fn(),
  registerAiTool: vi.fn(),
  changeAiToolStatus: vi.fn(),
  removeAiTool: vi.fn(),
  getAiToolUsage: vi.fn(),
  invokeAiTool: vi.fn(),
}));

vi.mock('@/components/confirm', () => ({
  confirmAction: vi.fn(),
}));

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
    asRecord: (value: unknown) =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null,
    textOf: (value: unknown) =>
      typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '',
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
    useKnowledgeBaseOptions: () => ({
      kbs: [{ kbId: 'kb_1', code: 'kb_1', name: '测试知识库' }],
      loading: false,
      reload: vi.fn(),
    }),
    KbSelect: ({
      value,
      onChange,
      options,
      loading,
    }: {
      value: string;
      onChange: (next: string) => void;
      options: { kbId: string; code: string; name: string }[];
      loading?: boolean;
    }) =>
      h(
        'select',
        {
          value,
          disabled: loading,
          onChange: (event: ChangeEvent<HTMLSelectElement>) =>
            onChange(event.target.value),
        },
        h(
          'option',
          { value: '' },
          loading ? '正在加载知识库…' : '未选择知识库',
        ),
        options.map((kb) =>
          h(
            'option',
            { key: kb.kbId, value: kb.kbId },
            `${kb.name}（${kb.code}）`,
          ),
        ),
      ),
  };
});

const searchTool: AiToolRecord = {
  code: 'knowledge_search',
  name: '知识库检索',
  description: '在指定知识库内检索片段',
  status: 'published',
  statusLabel: '已发布',
  executable: true,
  provider: 'builtin',
  risk: 'low',
  riskLabel: '低 · 只读',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '检索问题',
      required: true,
    },
    {
      name: 'topK',
      type: 'integer',
      description: '返回条数',
      required: false,
    },
  ],
  updateTime: '2026-10-01T08:00:00',
};

const clockTool: AiToolRecord = {
  code: 'current_time',
  name: '当前时间',
  description: '返回当前时间',
  status: 'published',
  statusLabel: '已发布',
  executable: true,
  provider: '',
  risk: 'low',
  parameters: [],
  updateTime: '2026-10-02T09:30:00',
} as AiToolRecord;

const draftTool: AiToolRecord = {
  code: 'order_lookup',
  name: '订单查询',
  status: 'draft',
  statusLabel: '草稿',
  executable: false,
  risk: 'high',
  parameters: [],
};

const pausedTool: AiToolRecord = {
  code: 'paused_tool',
  name: '暂停工具',
  status: 'paused',
  statusLabel: '已暂停',
  executable: true,
  parameters: [],
};

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

describe('AiToolsPage', () => {
  beforeEach(() => {
    vi.mocked(listAiTools).mockReset();
    vi.mocked(registerAiTool).mockReset();
    vi.mocked(changeAiToolStatus).mockReset();
    vi.mocked(removeAiTool).mockReset();
    vi.mocked(getAiToolUsage).mockReset();
    vi.mocked(invokeAiTool).mockReset();
    vi.mocked(confirmAction).mockReset();
    vi.mocked(toast).mockReset();

    vi.mocked(listAiTools).mockResolvedValue([
      searchTool,
      clockTool,
      draftTool,
      pausedTool,
    ]);
    vi.mocked(confirmAction).mockResolvedValue(true);
  });

  it('加载中展示提示，完成后渲染工具表格', async () => {
    let resolveTools: (value: AiToolRecord[]) => void = () => {};
    vi.mocked(listAiTools).mockReturnValue(
      new Promise((resolve) => {
        resolveTools = resolve;
      }),
    );
    render(<AiToolsPage />);
    expect(screen.getByText('正在加载工具定义…')).toBeInTheDocument();

    await act(async () => resolveTools([searchTool, draftTool]));

    expect(await screen.findByText('知识库检索')).toBeInTheDocument();
    expect(screen.getByText('knowledge_search')).toBeInTheDocument();
    expect(screen.getByText('builtin')).toBeInTheDocument();
    expect(screen.getByText('低 · 只读')).toBeInTheDocument();
    expect(screen.getByText('query*')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('加载失败展示错误并可重试', async () => {
    vi.mocked(listAiTools).mockResolvedValue(undefined);
    render(<AiToolsPage />);

    expect(await screen.findByText('工具列表加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(listAiTools).toHaveBeenCalledTimes(2));
  });

  it('没有任何工具时展示空态', async () => {
    vi.mocked(listAiTools).mockResolvedValue([]);
    render(<AiToolsPage />);

    expect(await screen.findByText('还没有工具')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登记工具/ })).toBeInTheDocument();
  });

  it('展示实现来源、无参数与状态统计', async () => {
    render(<AiToolsPage />);
    await screen.findByText('当前时间');

    expect(screen.getByText('已发布 2 · 草稿 1 · 暂停 1')).toBeInTheDocument();
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
    expect(screen.getAllByText('未接入实现')).toHaveLength(1);
    // 三个工具没有声明参数
    expect(screen.getAllByText('无参数')).toHaveLength(3);
    // 未发布的工具不能试调用
    expect(
      within(rowOf('订单查询')).getByRole('button', { name: /试调用/ }),
    ).toBeDisabled();
  });

  it('支持关键字与状态筛选，并清空筛选', async () => {
    render(<AiToolsPage />);
    await screen.findByText('知识库检索');
    const search = screen.getByPlaceholderText('搜索编码、名称或描述');

    fireEvent.change(search, { target: { value: '时间' } });
    expect(screen.getByText('当前时间')).toBeInTheDocument();
    expect(screen.queryByText('知识库检索')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^草稿/ }));
    expect(screen.getByText('订单查询')).toBeInTheDocument();
    expect(screen.queryByText('知识库检索')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '不存在' } });
    expect(screen.getByText('没有匹配的工具')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清空筛选' }));
    expect(screen.getByText('知识库检索')).toBeInTheDocument();
  });

  it('登记工具：校验、参数编辑与提交', async () => {
    vi.mocked(registerAiTool).mockResolvedValue({
      ...searchTool,
      code: 'order_lookup',
      name: '订单查询',
      status: 'draft',
      statusLabel: '草稿',
    });
    render(<AiToolsPage />);
    await screen.findByText('知识库检索');

    fireEvent.click(screen.getByRole('button', { name: /登记工具/ }));
    expect(screen.getByText('登记工具', { selector: 'h2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /登记为草稿/ }));
    expect(screen.getByText('编码与名称必填')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('如 order_lookup'), {
      target: { value: '1bad' },
    });
    fireEvent.change(screen.getByPlaceholderText('如 订单查询'), {
      target: { value: '订单查询' },
    });
    fireEvent.click(screen.getByRole('button', { name: /登记为草稿/ }));
    expect(screen.getByText(/编码格式不对/)).toBeInTheDocument();
    expect(registerAiTool).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('如 order_lookup'), {
      target: { value: 'order_lookup' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('给模型看的工具说明：什么时候该调用、返回什么'),
      { target: { value: '按订单号查询' } },
    );
    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[0], { target: { value: 'high' } });

    fireEvent.change(screen.getAllByPlaceholderText('参数名，如 query')[0], {
      target: { value: 'orderId' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('参数说明')[0], {
      target: { value: '订单号' },
    });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    fireEvent.click(screen.getByRole('button', { name: /添加参数/ }));
    fireEvent.change(screen.getAllByPlaceholderText('参数名，如 query')[1], {
      target: { value: 'limit' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[2], {
      target: { value: 'integer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /登记为草稿/ }));

    await waitFor(() =>
      expect(registerAiTool).toHaveBeenCalledWith({
        code: 'order_lookup',
        name: '订单查询',
        description: '按订单号查询',
        risk: 'high',
        parameters: [
          {
            name: 'orderId',
            type: 'string',
            description: '订单号',
            required: true,
          },
          {
            name: 'limit',
            type: 'integer',
            description: '',
            required: false,
          },
        ],
      }),
    );
    await waitFor(() => expect(listAiTools).toHaveBeenCalledTimes(2));
    expect(toast).toHaveBeenCalledWith('已登记工具', '订单查询 · 草稿', 'success');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('登记工具时参数名重复会拦截提交', async () => {
    render(<AiToolsPage />);
    await screen.findByText('知识库检索');

    fireEvent.click(screen.getByRole('button', { name: /登记工具/ }));
    fireEvent.change(screen.getByPlaceholderText('如 order_lookup'), {
      target: { value: 'dup_tool' },
    });
    fireEvent.change(screen.getByPlaceholderText('如 订单查询'), {
      target: { value: '重复参数' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('参数名，如 query')[0], {
      target: { value: 'query' },
    });
    fireEvent.click(screen.getByRole('button', { name: /添加参数/ }));
    fireEvent.change(screen.getAllByPlaceholderText('参数名，如 query')[1], {
      target: { value: 'query' },
    });
    fireEvent.click(screen.getByRole('button', { name: /登记为草稿/ }));

    expect(screen.getByText('参数名不能重复')).toBeInTheDocument();
    expect(registerAiTool).not.toHaveBeenCalled();
  });

  it('知识库检索引擎试调用：校验、传参并渲染命中结果', async () => {
    vi.mocked(invokeAiTool).mockResolvedValue({
      success: true,
      content: JSON.stringify({
        hits: [
          {
            title: '排班制度',
            wikiTitle: '护理管理',
            content: '排班规则说明',
            score: 0.9123,
          },
        ],
        total: 2,
        scanned: 12,
        tookMs: 34,
      }),
      details: { code: 'ok' },
    });
    render(<AiToolsPage />);
    await screen.findByText('知识库检索');

    fireEvent.click(
      within(rowOf('知识库检索')).getByRole('button', { name: /试调用/ }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('试调用 · 知识库检索')).toBeInTheDocument();
    expect(
      within(dialog).getByText('在指定知识库内检索片段'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /执行调用/ }));
    expect(
      within(dialog).getByText('知识库检索必须在指定库范围内执行'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('combobox'), {
      target: { value: 'kb_1' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /执行调用/ }));
    expect(within(dialog).getByText('参数 query 必填')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText('检索问题'), {
      target: { value: '排班' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('返回条数'), {
      target: { value: '5' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /执行调用/ }));

    await waitFor(() =>
      expect(invokeAiTool).toHaveBeenCalledWith({
        code: 'knowledge_search',
        kbId: 'kb_1',
        arguments: { query: '排班', topK: 5 },
      }),
    );
    expect(await within(dialog).findByText('成功')).toBeInTheDocument();
    expect(
      within(dialog).getByText('命中 2 条 · 扫描 12 个片段 · 34 ms'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('排班制度')).toBeInTheDocument();
    expect(within(dialog).getByText('score 0.9123')).toBeInTheDocument();
    expect(
      within(dialog).getByText('原始 details（1 个字段）'),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('布尔与对象参数按类型转换，并校验 JSON 合法性', async () => {
    const richTool: AiToolRecord = {
      code: 'custom_op',
      name: '自定义操作',
      description: '复杂参数工具',
      status: 'published',
      statusLabel: '已发布',
      executable: true,
      parameters: [
        { name: 'dryRun', type: 'boolean', description: '是否演练' },
        { name: 'payload', type: 'object', description: '请求体' },
      ],
    };
    vi.mocked(listAiTools).mockResolvedValue([richTool]);
    vi.mocked(invokeAiTool).mockResolvedValue({
      success: true,
      content: 'done',
      details: {},
    });
    render(<AiToolsPage />);
    await screen.findByText('自定义操作');

    fireEvent.click(
      within(rowOf('自定义操作')).getByRole('button', { name: /试调用/ }),
    );
    const dialog = screen.getByRole('dialog');

    // 可选参数留空时不进入 arguments
    fireEvent.click(within(dialog).getByRole('button', { name: /执行调用/ }));
    await waitFor(() =>
      expect(invokeAiTool).toHaveBeenLastCalledWith({
        code: 'custom_op',
        kbId: undefined,
        arguments: {},
      }),
    );

    fireEvent.change(within(dialog).getByPlaceholderText('JSON 对象'), {
      target: { value: '{bad json' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /执行调用/ }));
    expect(
      within(dialog).getByText('参数 payload 不是合法 JSON'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText('JSON 对象'), {
      target: { value: '{"a":1}' },
    });
    fireEvent.change(within(dialog).getByRole('combobox'), {
      target: { value: 'true' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /执行调用/ }));

    await waitFor(() =>
      expect(invokeAiTool).toHaveBeenLastCalledWith({
        code: 'custom_op',
        kbId: undefined,
        arguments: { dryRun: true, payload: { a: 1 } },
      }),
    );
    expect(await within(dialog).findByText('done')).toBeInTheDocument();
  });

  it('无参工具试调用直接展示返回内容与失败标记', async () => {
    vi.mocked(invokeAiTool).mockResolvedValue({
      success: false,
      content: '时间服务不可用',
      details: {},
    });
    render(<AiToolsPage />);
    await screen.findByText('当前时间');

    fireEvent.click(
      within(rowOf('当前时间')).getByRole('button', { name: /试调用/ }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('该工具没有参数。')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /执行调用/ }));

    expect(await within(dialog).findByText('失败')).toBeInTheDocument();
    expect(within(dialog).getByText('时间服务不可用')).toBeInTheDocument();
    expect(invokeAiTool).toHaveBeenCalledWith({
      code: 'current_time',
      kbId: undefined,
      arguments: {},
    });
  });

  it('查看引用关系', async () => {
    vi.mocked(getAiToolUsage).mockResolvedValue({
      agentCodes: [],
      skillCodes: ['citation_answer'],
      empty: false,
    });
    render(<AiToolsPage />);
    await screen.findByText('知识库检索');

    fireEvent.click(
      within(rowOf('知识库检索')).getByRole('button', { name: /引用/ }),
    );

    expect(
      await screen.findByText('引用关系 · 知识库检索'),
    ).toBeInTheDocument();
    expect(screen.getByText('引用该工具的智能体（0）')).toBeInTheDocument();
    expect(screen.getByText('没有智能体绑定该工具。')).toBeInTheDocument();
    expect(screen.getByText('关联该工具的技能（1）')).toBeInTheDocument();
    expect(screen.getByText('citation_answer')).toBeInTheDocument();
  });

  it('启停工具与未接入实现的拦截', async () => {
    vi.mocked(changeAiToolStatus).mockResolvedValue({
      ...searchTool,
      status: 'paused',
      statusLabel: '已暂停',
    });
    render(<AiToolsPage />);
    await screen.findByText('知识库检索');

    fireEvent.click(within(rowOf('知识库检索')).getByTitle('停用'));
    await waitFor(() =>
      expect(changeAiToolStatus).toHaveBeenCalledWith(
        'knowledge_search',
        'paused',
      ),
    );

    await screen.findByText('暂停工具');
    fireEvent.click(within(rowOf('暂停工具')).getByTitle('启用'));
    await waitFor(() =>
      expect(changeAiToolStatus).toHaveBeenCalledWith(
        'paused_tool',
        'published',
      ),
    );

    await screen.findByText('订单查询');
    fireEvent.click(within(rowOf('订单查询')).getByTitle('需接入实现后才能启用'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        '无法启用',
        '该工具没有实现接入，启用会被后端拒绝。',
        'warn',
      ),
    );
    expect(changeAiToolStatus).toHaveBeenCalledTimes(2);
  });

  it('删除工具需确认后调用服务', async () => {
    vi.mocked(removeAiTool).mockResolvedValue(true);
    render(<AiToolsPage />);
    await screen.findByText('知识库检索');

    fireEvent.click(within(rowOf('知识库检索')).getByTitle('删除'));

    await waitFor(() =>
      expect(confirmAction).toHaveBeenCalledWith(
        expect.objectContaining({ title: '删除工具「知识库检索」？' }),
      ),
    );
    await waitFor(() =>
      expect(removeAiTool).toHaveBeenCalledWith('knowledge_search'),
    );
    expect(toast).toHaveBeenCalledWith('已删除工具', '知识库检索', 'success');
  });
});
