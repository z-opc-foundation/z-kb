import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFitPageSize } from './use-fit-page-size';

function Probe({ fallback = 20 }: { fallback?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useFitPageSize(ref, 'probe', fallback);
  return (
    <div ref={ref}>
      <table>
        <thead>
          <tr>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>一行</td>
          </tr>
        </tbody>
      </table>
      <output data-testid="size">{size}</output>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useFitPageSize', () => {
  it('按容器可用高度和实际行高换算每页条数', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(634);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const height = this.tagName === 'THEAD' ? 34 : this.tagName === 'TR' ? 40 : 0;
      return { height } as DOMRect;
    });

    render(<Probe fallback={20} />);

    // (634 - 34) / 40 = 15 行
    expect(screen.getByTestId('size')).toHaveTextContent('15');
  });

  it('量不到行高或容器高度时保留兜底条数', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height: 0 }) as DOMRect,
    );

    render(<Probe fallback={12} />);

    expect(screen.getByTestId('size')).toHaveTextContent('12');
  });

  it('可用高度过小时收敛到最小条数', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const height = this.tagName === 'THEAD' ? 34 : this.tagName === 'TR' ? 40 : 0;
      return { height } as DOMRect;
    });

    render(<Probe fallback={20} />);

    // (200 - 34) / 40 = 4，低于最小值 6
    expect(screen.getByTestId('size')).toHaveTextContent('6');
  });
});
