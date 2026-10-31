import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import QuotaAdminPage from './index';

afterEach(cleanup);

describe('全局管理 · 配额管理', () => {
  it('展示存储、问答、编译与成员概览', () => {
    render(<QuotaAdminPage />);

    expect(screen.getByText('未来医院')).toBeInTheDocument();
    expect(screen.getByText('存储空间')).toBeInTheDocument();
    expect(screen.getByText(/^69\.9/)).toBeInTheDocument();
    expect(screen.getByText('本月问答')).toBeInTheDocument();
    expect(screen.getAllByText(/^42,180/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('编译任务').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^1,284/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('租户成员').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^86/).length).toBeGreaterThan(0);
  });

  it('默认展示全部配额项与使用率状态', () => {
    render(<QuotaAdminPage />);

    expect(screen.getByText('共 11 项 · 使用率 ≥ 90% 标记为接近上限')).toBeInTheDocument();
    expect(screen.getByText('资料原件存储')).toBeInTheDocument();
    expect(screen.getByText('并发编译')).toBeInTheDocument();
    expect(screen.getByText('知识库数量')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getAllByText('正常').length).toBeGreaterThan(0);
    expect(screen.getByText('偏高')).toBeInTheDocument();
  });

  it('按分类筛选配额项', () => {
    render(<QuotaAdminPage />);

    fireEvent.click(screen.getByRole('button', { name: '存储' }));
    expect(screen.getByText('共 3 项 · 使用率 ≥ 90% 标记为接近上限')).toBeInTheDocument();
    expect(screen.getByText('资料原件存储')).toBeInTheDocument();
    expect(screen.queryByText('并发编译')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '成员' }));
    expect(screen.getAllByText('租户成员').length).toBeGreaterThan(0);
    expect(screen.getByText('知识库数量')).toBeInTheDocument();
    expect(screen.queryByText('资料原件存储')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '全部配额' }));
    expect(screen.getByText('资料原件存储')).toBeInTheDocument();
  });

  it('使用率达到阈值的配额项标记为偏高', () => {
    render(<QuotaAdminPage />);

    fireEvent.click(screen.getByRole('button', { name: '计算' }));
    expect(screen.getByText('并发编译')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getAllByText('偏高').length).toBeGreaterThan(0);
  });
});
