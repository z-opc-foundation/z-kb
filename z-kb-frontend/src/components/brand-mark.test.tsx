import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BrandMark from './brand-mark';

afterEach(cleanup);

describe('BrandMark', () => {
  it('渲染品牌图形并保持装饰性', () => {
    const { container } = render(<BrandMark />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('rect')).toHaveAttribute('fill', '#F5FAFF');

    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.map((path) => path.getAttribute('fill'))).toEqual(['#1F8BFF', '#FFDC29']);
  });
});
