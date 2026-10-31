import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParsedDraftRecord } from '@/services/material';
import MaterialDraftSection from './material-draft-section';

const CONTENT = '# 排班制度\n\n护士按班次轮转。';

const DRAFT: ParsedDraftRecord = {
  draftId: 'd-1',
  status: 'READY',
  parserName: 'mineru',
  parserVersion: '2.1',
  parsedAt: '2026-10-30T09:30:00',
  textContent: CONTENT,
  textLength: CONTENT.length,
};

function setup(overrides: Partial<Parameters<typeof MaterialDraftSection>[0]> = {}) {
  const props = {
    draft: DRAFT,
    canEdit: true,
    saving: false,
    onSave: vi.fn().mockResolvedValue(true),
    onOpenCompare: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<MaterialDraftSection {...props} />) };
}

afterEach(() => {
  cleanup();
});

describe('原文页签', () => {
  it('渲染态展示 Markdown 结果，可进入编辑态并保存新正文', async () => {
    const { props } = setup();

    expect(screen.getByRole('heading', { name: '排班制度' })).toBeTruthy();
    expect(screen.getByText('护士按班次轮转。')).toBeTruthy();
    expect(screen.getByText('已解析')).toBeTruthy();
    expect(screen.getByText('mineru@2.1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(editor.value).toBe(CONTENT);

    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    fireEvent.change(editor, { target: { value: `${CONTENT}\n新增一段。` } });
    expect(saveButton.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(saveButton);
    });
    expect(props.onSave).toHaveBeenCalledWith(`${CONTENT}\n新增一段。`);
  });

  it('编辑态可取消且不触发保存', () => {
    const { props } = setup();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '改写正文' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('heading', { name: '排班制度' })).toBeTruthy();
  });

  it('正文为空时拒绝保存并提示', async () => {
    const { props } = setup();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '保存' }));
    });

    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('解析稿正文不能为空')).toBeTruthy();
  });

  it('无写权限时不出现编辑入口', () => {
    setup({ canEdit: false });

    expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
    expect(screen.getByRole('button', { name: '对比解析稿' })).toBeTruthy();
  });

  it('超出预览上限时只读并提示', () => {
    setup({ draft: { ...DRAFT, textLength: 300_000 } });

    expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
    expect(screen.getByText(/暂不支持在线编辑/)).toBeTruthy();
  });

  it('解析失败时展示失败原因', () => {
    setup({ draft: { ...DRAFT, status: 'FAILED', failureReason: 'MinerU 超时' } });

    expect(screen.getByText('解析未完成')).toBeTruthy();
    expect(screen.getByText('MinerU 超时')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
  });
});
