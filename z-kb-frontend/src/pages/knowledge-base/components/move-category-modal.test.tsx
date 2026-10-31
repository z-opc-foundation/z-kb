import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CategoryNode } from '@/services/category';
import MoveCategoryModal from './move-category-modal';

const TREE: CategoryNode[] = [
  {
    categoryId: 'cat-1',
    name: '临床指南',
    sortNo: 1,
    children: [{ categoryId: 'cat-2', parentId: 'cat-1', name: '心血管', sortNo: 1 }],
  },
];

afterEach(() => {
  cleanup();
});

describe('移动分类弹窗', () => {
  it('按层级展开分类，选中后把目标分类 ID 交给确认回调', () => {
    const onConfirm = vi.fn();
    render(
      <MoveCategoryModal tree={TREE} count={3} onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    expect(screen.getByText('将 3 个资料移动到目标分类')).toBeTruthy();
    expect(screen.getByText('临床指南')).toBeTruthy();
    expect(screen.getByText('心血管')).toBeTruthy();

    const confirm = screen.getByRole('button', { name: '移动到所选分类' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByText('心血管'));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('cat-2');
  });

  it('选择未分类时把空目标转换为 undefined', () => {
    const onConfirm = vi.fn();
    render(
      <MoveCategoryModal tree={TREE} count={1} onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByText('未分类'));
    fireEvent.click(screen.getByRole('button', { name: '移动到所选分类' }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('没有分类时给出提示，busy 时禁用提交', () => {
    render(
      <MoveCategoryModal tree={[]} count={1} busy onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(
      screen.getByText(/这个库还没有分类，只能移动到未分类/),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('未分类'));
    expect(screen.getByRole('button', { name: '移动到所选分类' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
  });
});
