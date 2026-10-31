import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppModal from './index';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AppModal', () => {
  it('渲染标题、说明、内容与页脚', () => {
    render(
      <AppModal
        title="删除资料"
        sub="删除后不可恢复"
        body={<p>弹窗内容</p>}
        footLeft="Esc 取消"
        footRight={<button type="button">确定</button>}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: '删除资料' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('删除后不可恢复');
    expect(screen.getByText('弹窗内容')).toBeInTheDocument();
    expect(screen.getByText('Esc 取消')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument();
  });

  it('宽高与自定义类名生效，且挂载到 body', () => {
    const { container } = render(
      <AppModal title="设置" body={null} width={420} className="danger" onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: '设置' });
    expect(dialog).toHaveClass('modal', 'danger');
    expect(dialog).toHaveStyle({ '--w': '420px' });
    expect(container).toBeEmptyDOMElement();
    expect(dialog.closest('.overlay')?.parentElement).toBe(document.body);
  });

  it('关闭按钮与遮罩触发 onClose，点击内容不触发', () => {
    const onClose = vi.fn();
    render(<AppModal title="提示" body="内容" onClose={onClose} />);

    fireEvent.mouseDown(screen.getByRole('dialog', { name: '提示' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.mouseDown(document.querySelector('.overlay') as Element);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Esc 关闭，卸载后移除监听', () => {
    const onClose = vi.fn();
    const { unmount } = render(<AppModal title="提示" body={null} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
