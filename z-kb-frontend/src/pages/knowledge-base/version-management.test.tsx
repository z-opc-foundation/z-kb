import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import type {
  KnowledgeBaseConfigRecord,
  ProfileVersionRecord,
} from '@/services/configVersion';
import { renderAt } from '@/test/render';

vi.mock('@/services/configVersion', () => ({
  CONFIG_FIELDS: [
    { key: 'presetVersion', label: '预设版本', hint: '模板基线', scope: 'FULL' },
    {
      key: 'parserPolicy',
      label: '解析策略',
      hint: '解析器与 OCR 参数',
      scope: 'FULL',
      multiline: true,
    },
    {
      key: 'retrievalPolicy',
      label: '检索策略',
      hint: '发布后线上立即生效',
      scope: 'NONE',
      multiline: true,
    },
  ],
  getKnowledgeBaseConfig: vi.fn(),
  saveConfigDraft: vi.fn(),
  discardConfigDraft: vi.fn(),
  validateConfigDraft: vi.fn(),
  publishConfig: vi.fn(),
  submitFullRebuild: vi.fn(),
}));

import {
  discardConfigDraft,
  getKnowledgeBaseConfig,
  publishConfig,
  saveConfigDraft,
  submitFullRebuild,
  validateConfigDraft,
} from '@/services/configVersion';
import VersionManagementPage from './version-management';

function version(
  versionNo: number,
  status: ProfileVersionRecord['status'],
  overrides: Partial<ProfileVersionRecord> = {},
): ProfileVersionRecord {
  return {
    versionNo,
    configVersion: `cfg-${versionNo}`,
    status,
    presetVersion: 'default',
    parserPolicy: '{"ocr":false}',
    chunkingPolicy: '{}',
    extractionPolicy: '{}',
    wikiPolicy: '{}',
    graphPolicy: '{}',
    reviewPolicy: '{}',
    freshnessPolicy: '{}',
    retrievalPolicy: '{}',
    publishedBy: 7,
    publisherName: '张三',
    publishedAt: '2026-09-30T10:00:00',
    createTime: '2026-09-30T09:00:00',
    ...overrides,
  };
}

const CURRENT = version(2, 'CURRENT');
const DRAFT = version(3, 'DRAFT', {
  parserPolicy: '{"ocr":true}',
  remark: '开启 OCR',
  updateBy: 8,
  publisherName: null,
  publishedAt: null,
  updateTime: '2026-10-01T10:00:00',
});

const CONFIG: KnowledgeBaseConfigRecord = {
  kbId: 'kb-1',
  kbName: '护理知识库',
  type: 'FILE',
  embeddingModel: 'bge-m3',
  canManage: true,
  current: CURRENT,
  draft: DRAFT,
  versions: [CURRENT, version(1, 'SUPERSEDED')],
  diff: [
    {
      field: 'parserPolicy',
      label: '解析策略',
      currentValue: '{"ocr":false}',
      draftValue: '{"ocr":true}',
      impactScope: 'FULL',
      impactLabel: '全量重建',
    },
  ],
  impact: {
    rebuildMode: 'FULL',
    fullRebuildCount: 2,
    incrementalCount: 1,
    unaffectedCount: 3,
    totalMaterials: 6,
    parsedMaterials: 5,
    notParsedCount: 1,
    notes: ['解析策略变化需全量重建'],
  },
  validation: {
    valid: true,
    changedCount: 1,
    items: [{ key: 'preset', label: '预设可用', ok: true, message: '模板与解析器匹配' }],
  },
};

function renderVersions(route = '/knowledge-bases/kb-1/versions') {
  return renderAt(
    <Routes>
      <Route path="/knowledge-bases/:kbId/versions" element={<VersionManagementPage />} />
      <Route path="/knowledge-bases/:kbId" element={<div>知识库详情页</div>} />
      <Route path="/knowledge-bases/:kbId/settings" element={<div>设置页</div>} />
      <Route path="/knowledge-bases/:kbId/governance" element={<div>任务管理页</div>} />
    </Routes>,
    { route },
  );
}

describe('配置版本管理页', () => {
  beforeEach(() => {
    vi.mocked(getKnowledgeBaseConfig).mockResolvedValue(CONFIG);
    vi.mocked(saveConfigDraft).mockResolvedValue(DRAFT);
    vi.mocked(validateConfigDraft).mockResolvedValue(CONFIG.validation);
    vi.mocked(publishConfig).mockResolvedValue({ ...DRAFT, status: 'CURRENT' });
    vi.mocked(submitFullRebuild).mockResolvedValue('batch-1234567890');
    vi.mocked(discardConfigDraft).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('加载后展示版本时间线、差异与影响分析', async () => {
    renderVersions();
    expect(screen.getByText('正在加载版本管理…')).toBeTruthy();
    expect(await screen.findByText(/版本管理/)).toBeTruthy();

    expect(getKnowledgeBaseConfig).toHaveBeenCalledWith('kb-1');
    expect(screen.getByText(/护理知识库/)).toBeTruthy();
    expect(screen.getByText('v2')).toBeTruthy();
    expect(screen.getByText(/草稿 · v3/)).toBeTruthy();
    expect(screen.getByText('待发布')).toBeTruthy();
    expect(screen.getAllByText('解析策略').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{"ocr":true}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('全量重建').length).toBeGreaterThan(0);
    expect(screen.getByText('解析策略变化需全量重建')).toBeTruthy();
    expect(screen.getByText('模板与解析器匹配')).toBeTruthy();
  });

  it('编辑草稿并保存，提交完整配置负载', async () => {
    renderVersions();
    await screen.findByText(/护理知识库/);

    fireEvent.change(screen.getByDisplayValue('{"ocr":true}'), {
      target: { value: '{"ocr":"auto"}' },
    });
    fireEvent.change(screen.getByPlaceholderText('可选；发布后显示在版本时间线上'), {
      target: { value: '切换 OCR 模式' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存草稿/ }));

    await waitFor(() =>
      expect(saveConfigDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          kbId: 'kb-1',
          presetVersion: 'default',
          parserPolicy: '{"ocr":"auto"}',
          remark: '切换 OCR 模式',
        }),
      ),
    );
    await waitFor(() => expect(getKnowledgeBaseConfig).toHaveBeenCalledTimes(2));
  });

  it('校验草稿调用校验接口并展示结果', async () => {
    renderVersions();
    await screen.findByText(/护理知识库/);

    fireEvent.click(screen.getByRole('button', { name: /校验草稿/ }));
    await waitFor(() => expect(validateConfigDraft).toHaveBeenCalledWith('kb-1'));
    expect(await screen.findByText('校验通过')).toBeTruthy();
  });

  it('发布配置需勾选确认，提交后刷新版本', async () => {
    renderVersions();
    await screen.findByText(/护理知识库/);

    fireEvent.click(screen.getByRole('button', { name: '发布配置' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('发布只切换配置，不触发重建');

    const confirm = screen.getByRole('button', { name: '确认发布' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: '确认发布' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));

    await waitFor(() =>
      expect(publishConfig).toHaveBeenCalledWith('kb-1', '开启 OCR'),
    );
    await waitFor(() => expect(getKnowledgeBaseConfig).toHaveBeenCalledTimes(2));
  });

  it('申请全量重建需二次确认，成功后展示组别并可跳转任务管理', async () => {
    renderVersions();
    await screen.findByText(/护理知识库/);

    fireEvent.click(screen.getByRole('button', { name: /申请全量重建/ }));
    await screen.findByRole('dialog');
    const confirm = screen.getByRole('button', { name: '确认提交' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '确认提交' }));

    await waitFor(() => expect(submitFullRebuild).toHaveBeenCalledWith('kb-1'));
    expect(await screen.findByText('已提交全量重建')).toBeTruthy();
    expect(screen.getByText('batch-1234567890')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '任务管理' }));
    expect(await screen.findByText('任务管理页')).toBeTruthy();
  });

  it('丢弃草稿调用丢弃接口', async () => {
    renderVersions();
    await screen.findByText(/护理知识库/);

    fireEvent.click(screen.getByRole('button', { name: /丢弃草稿/ }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: '确认丢弃' }));

    await waitFor(() => expect(discardConfigDraft).toHaveBeenCalledWith('kb-1'));
  });

  it('配置不可用时展示无法打开提示', async () => {
    vi.mocked(getKnowledgeBaseConfig).mockResolvedValue(undefined);
    renderVersions('/knowledge-bases/kb-missing/versions');
    expect(await screen.findByText('无法打开版本管理')).toBeTruthy();
  });
});
