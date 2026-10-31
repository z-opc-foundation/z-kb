import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Icon from './index';

afterEach(cleanup);

describe('Icon', () => {
  it('按名称渲染图标路径与默认尺寸', () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.querySelector('circle')).toBeTruthy();
    expect(svg?.querySelector('path')).toBeTruthy();
  });

  it('支持自定义尺寸、类名与样式', () => {
    const { container } = render(
      <Icon name="trash" size={24} className="danger" style={{ color: 'red' }} />,
    );
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('class', 'ic danger');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('未知图标使用圆形兜底', () => {
    const { container } = render(<Icon name="unknown-icon" />);
    expect(container.querySelector('svg > circle')).toHaveAttribute('r', '9');
  });
});
