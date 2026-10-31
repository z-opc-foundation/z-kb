import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { WikiPageRecord } from '@/services/wiki';

vi.mock('@/services/wiki', () => ({
  listWikiByMaterial: vi.fn(),
}));

import { listWikiByMaterial } from '@/services/wiki';
import MaterialWikiTab from './material-wiki-tab';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MaterialWikiTab kbId="kb-1" materialId="mat-1" />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const PAGES: WikiPageRecord[] = [
  {
    wikiId: 'wiki-1',
    kbId: 'kb-1',
    materialId: 'mat-1',
    title: '排班管理制度',
    pointCount: 4,
    charCount: 320,
    versionNo: 2,
    status: 'READY',
  },
  {
    wikiId: 'wiki-2',
    kbId: 'kb-1',
    materialId: 'mat-1',
    title: '交接班规范',
    pointCount: 2,
    versionNo: 1,
    status: 'FAILED',
  },
];

beforeEach(() => {
  vi.mocked(listWikiByMaterial).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('资料 Wiki 页签', () => {
  it('按资料加载 Wiki，展示状态与要点，点击后跳转 Wiki 视图', async () => {
    vi.mocked(listWikiByMaterial).mockResolvedValue(PAGES);
    renderTab();

    expect(screen.getByText('正在加载 Wiki…')).toBeTruthy();
    expect(await screen.findByText('2 篇 Wiki')).toBeTruthy();
    expect(listWikiByMaterial).toHaveBeenCalledWith('mat-1');
    expect(screen.getByText('已生成')).toBeTruthy();
    expect(screen.getByText('生成失败')).toBeTruthy();
    expect(screen.getByText('v2 · 320 字 · 4 个要点')).toBeTruthy();

    fireEvent.click(screen.getByText('排班管理制度'));
    expect(screen.getByTestId('location').textContent).toBe(
      '/knowledge-bases/kb-1/workspace?view=wiki&wikiId=wiki-1',
    );
  });

  it('键盘 Enter 同样可以打开 Wiki', async () => {
    vi.mocked(listWikiByMaterial).mockResolvedValue(PAGES);
    renderTab();

    const row = await screen.findByText('交接班规范');
    fireEvent.keyDown(row.closest('[role="button"]') as HTMLElement, { key: 'Enter' });
    expect(screen.getByTestId('location').textContent).toContain('wikiId=wiki-2');
  });

  it('没有 Wiki 时展示空态说明', async () => {
    vi.mocked(listWikiByMaterial).mockResolvedValue([]);
    renderTab();

    expect(await screen.findByText('该资料还没有生成 Wiki')).toBeTruthy();
    expect(screen.getByText(/到 Wiki 视图选择这份资料生成/)).toBeTruthy();
    expect(screen.queryByText('正在加载 Wiki…')).toBeNull();
  });
});
