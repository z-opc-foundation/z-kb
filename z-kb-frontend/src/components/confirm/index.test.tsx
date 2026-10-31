import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { confirmAction, ConfirmHost } from './index';

afterEach(() => {
  cleanup();
});

describe('应用内确认框', () => {
  it('取消返回 false 并关闭弹窗', async () => {
    render(<ConfirmHost />);

    let result!: Promise<boolean>;
    act(() => {
      result = confirmAction({ title: '归档知识库', sub: '归档后只读', cancelText: '再想想' });
    });

    const dialog = screen.getByRole('dialog', { name: '归档知识库' });
    expect(dialog).toHaveAccessibleDescription('归档后只读');
    expect(screen.getByText('Esc 取消')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '再想想' }));
      await expect(result).resolves.toBe(false);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('默认按危险操作渲染红色确认按钮并返回 true', async () => {
    render(<ConfirmHost />);

    let result!: Promise<boolean>;
    act(() => {
      result = confirmAction({ title: '删除资料', confirmText: '删除' });
    });

    const confirm = screen.getByRole('button', { name: '删除' });
    expect(confirm).toHaveClass('btn', 'danger');
    expect(document.querySelector('.modal')).toHaveClass('confirm-modal', 'danger');

    await act(async () => {
      fireEvent.click(confirm);
      await expect(result).resolves.toBe(true);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('普通确认使用主按钮且 Esc 取消', async () => {
    render(<ConfirmHost />);

    let result!: Promise<boolean>;
    act(() => {
      result = confirmAction({ title: '保存草稿', danger: false });
    });

    expect(screen.getByRole('button', { name: '确定' })).toHaveClass('primary');

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
      await expect(result).resolves.toBe(false);
    });
  });

  it('重复发起确认时旧的确认按取消处理', async () => {
    render(<ConfirmHost />);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = confirmAction({ title: '第一次' });
    });
    act(() => {
      second = confirmAction({ title: '第二次' });
    });

    expect(screen.getByRole('dialog', { name: '第二次' })).toBeInTheDocument();
    await expect(first).resolves.toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确定' }));
      await expect(second).resolves.toBe(true);
    });
  });
});
