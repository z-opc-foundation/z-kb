import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PermissionCatalogItem } from '@/services/identity';
import { renderAt } from '@/test/render';
import PermissionCatalogPanel from './permission-catalog';

vi.mock('@/services/identity', () => ({
  fetchAuthContext: vi.fn().mockResolvedValue(null),
}));

const catalog: PermissionCatalogItem[] = [
  {
    code: 'menu.space',
    name: '知识空间',
    type: 'MENU',
    typeCode: 1,
    path: '/knowledge-bases',
    order: 40,
  },
  {
    code: 'menu.kb',
    name: '知识库',
    type: 'MENU',
    typeCode: 1,
    parentCode: 'menu.space',
    path: '/knowledge-bases',
    order: 41,
  },
  {
    code: 'kb.create',
    name: '新建知识库',
    type: 'BUTTON',
    typeCode: 2,
    parentCode: 'menu.kb',
    order: 101,
  },
  {
    code: 'kb.delete',
    name: '删除知识库',
    type: 'BUTTON',
    typeCode: 2,
    parentCode: 'menu.kb',
    order: 103,
  },
];

async function renderPanel(
  props: Partial<Parameters<typeof PermissionCatalogPanel>[0]> = {},
) {
  const onReload = vi.fn();
  const onPublish = vi.fn();
  const result = renderAt(
    <PermissionCatalogPanel
      catalog={catalog}
      loading={false}
      error=""
      publishing={false}
      onReload={onReload}
      onPublish={onPublish}
      {...props}
    />,
    { withAuth: true },
  );
  // 等待 AuthProvider 的权限视图请求落地，避免测试结束后异步更新。
  await act(async () => {});
  return { ...result, onReload, onPublish };
}

afterEach(() => {
  cleanup();
});

describe('PermissionCatalogPanel', () => {
  it('加载中只展示状态，不渲染目录树', async () => {
    await renderPanel({ loading: true });

    expect(screen.getByText('正在读取权限目录…')).toBeInTheDocument();
    expect(screen.queryByText('发布权限目录')).not.toBeInTheDocument();
  });

  it('成功态展示菜单与按钮计数、目录路径和编码', async () => {
    await renderPanel();

    expect(screen.getByText(/菜单/)).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(screen.getByText(/共 4 项/)).toBeInTheDocument();
    expect(screen.getByText('知识空间')).toBeInTheDocument();
    expect(screen.getByText('新建知识库')).toBeInTheDocument();
    expect(screen.getByText('删除知识库')).toBeInTheDocument();
    expect(screen.getAllByText('/knowledge-bases').length).toBe(2);
    expect(screen.getAllByText('kb.create').length).toBeGreaterThan(0);
  });

  it('刷新与发布按钮分别触发父级回调', async () => {
    const { onReload, onPublish } = await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /刷新/ }));
    expect(onReload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /发布权限目录/ }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('发布中禁用发布按钮并展示进行中文案', async () => {
    await renderPanel({ publishing: true });

    const publish = screen.getByRole('button', { name: /发布中…/ });
    expect(publish).toBeDisabled();
  });

  it('加载失败展示错误与重试入口，同时保留发布按钮', async () => {
    const { onReload } = await renderPanel({ error: '目录接口异常' });

    expect(screen.getByText('权限目录加载失败')).toBeInTheDocument();
    expect(screen.getByText('目录接口异常')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /发布权限目录/ })).toBeInTheDocument();
  });

  it('空目录展示零计数且不渲染树', async () => {
    await renderPanel({ catalog: [] });

    expect(screen.getAllByText('0')).toHaveLength(2);
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });
});
