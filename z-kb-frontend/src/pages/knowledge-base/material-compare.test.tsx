import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAt } from '@/test/render';
import { listDrafts } from '@/services/material';
import MaterialCompare from './material-compare';

vi.mock('@/services/material', () => ({ listDrafts: vi.fn() }));

const VERSIONS = [
  {
    versionId: 'ver-1',
    versionNo: 1,
    fileName: 'old.txt',
    versionStatus: 'SUPERSEDED',
    sizeBytes: 120,
    fingerprint: 'fp-1',
    registeredAt: '2026-03-01T08:00:00',
  },
  {
    versionId: 'ver-2',
    versionNo: 2,
    fileName: 'new.txt',
    versionStatus: 'CURRENT',
    sizeBytes: 140,
    fingerprint: 'fp-2',
    registeredAt: '2026-03-02T09:00:00',
  },
];

const DRAFT_OLD = {
  draftId: 'draft-1',
  status: 'READY',
  parserName: 'pdf',
  parserVersion: '1.0',
  parsedAt: '2026-03-01T09:00:00',
  textLength: 30,
  textContent: '甲\n乙\n丙',
};

const DRAFT_NEW = {
  draftId: 'draft-2',
  status: 'READY',
  parserName: 'pdf',
  parserVersion: '1.1',
  parsedAt: '2026-03-01T10:00:00',
  textLength: 25,
  textContent: '甲\n丙',
};

const DRAFTS = [DRAFT_NEW, DRAFT_OLD];

function versionDrafts(_materialId: string, versionId?: string) {
  if (versionId === 'ver-1') {
    return Promise.resolve([{ ...DRAFT_OLD, textContent: '甲\n乙\n丙' }]);
  }
  return Promise.resolve([{ ...DRAFT_NEW, textContent: '甲\n丁\n丙' }]);
}

function renderCompare(overrides: Partial<Parameters<typeof MaterialCompare>[0]> = {}) {
  const onClose = vi.fn();
  const props = {
    materialId: 'mat-1',
    mode: 'version' as const,
    versions: VERSIONS,
    currentVersionId: 'ver-2',
    versionId: 'ver-2',
    onClose,
    ...overrides,
  };
  renderAt(<MaterialCompare {...props} />, { route: '/knowledge-bases/kb-1' });
  return { onClose, props };
}

describe('物料对比弹窗', () => {
  beforeEach(() => {
    vi.mocked(listDrafts).mockImplementation(versionDrafts as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('版本模式默认左旧右新并逐行标注差异', async () => {
    renderCompare();

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('对比物料版本');
    expect(dialog.textContent).toContain('左：v1 · SUPERSEDED');
    expect(dialog.textContent).toContain('右：v2 · CURRENT');
    expect(listDrafts).toHaveBeenCalledWith('mat-1', 'ver-1');
    expect(listDrafts).toHaveBeenCalledWith('mat-1', 'ver-2');

    expect(await screen.findByText('2 行相同')).toBeTruthy();
    expect(screen.getByText('+1 行')).toBeTruthy();
    expect(screen.getByText('-1 行')).toBeTruthy();
    expect(screen.queryByText('左右选择相同')).toBeNull();

    expect(screen.getAllByText('甲')).toHaveLength(2);
    expect(screen.getByText('乙')).toBeTruthy();
    expect(screen.getByText('丁')).toBeTruthy();
    expect(screen.getAllByText('丙')).toHaveLength(2);

    expect(screen.getByText('mat-1 · 2 个版本')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('版本不足两个时提示暂无可对比对象', async () => {
    renderCompare({ versions: [VERSIONS[1]], currentVersionId: 'ver-2' });

    expect(await screen.findByText('暂无可对比对象')).toBeTruthy();
    expect(screen.getByText('至少需要两个版本才能对比，请先上传新版本。')).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('mat-1 · 1 个版本')).toBeTruthy();
    expect(listDrafts).not.toHaveBeenCalled();
  });

  it('解析稿模式加载后对比同版本两份稿件', async () => {
    let resolveDrafts: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveDrafts = resolve as (value: unknown) => void;
    });
    vi.mocked(listDrafts).mockImplementation(() => pending as never);

    renderCompare({ mode: 'draft', versionId: 'ver-2' });

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('对比解析稿');
    expect(listDrafts).toHaveBeenCalledWith('mat-1', 'ver-2');

    resolveDrafts(DRAFTS);

    expect(await screen.findByText(/2 份解析稿/)).toBeTruthy();
    expect(await screen.findByText('-1 行')).toBeTruthy();
    expect(await screen.findByText('+0 行')).toBeTruthy();
    expect(await screen.findByText('2 行相同')).toBeTruthy();
    expect(screen.getByText('乙')).toBeTruthy();
    expect(screen.getAllByText('甲')).toHaveLength(2);
    expect(screen.queryByText('丁')).toBeNull();

    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
    expect((selects[0] as HTMLSelectElement).value).toBe('draft-1');
    expect((selects[1] as HTMLSelectElement).value).toBe('draft-2');
  });

  it('单份解析稿时提示无法对比', async () => {
    vi.mocked(listDrafts).mockResolvedValue([DRAFT_OLD] as never);

    renderCompare({ mode: 'draft', versionId: 'ver-2' });

    expect(await screen.findByText('暂无可对比对象')).toBeTruthy();
    expect(
      screen.getByText('当前版本只有一份解析稿，重新解析后可对比新旧稿。'),
    ).toBeTruthy();
    expect(screen.getByText('mat-1 · 1 份解析稿')).toBeTruthy();
  });

  it('超过 1500 行时降级为并排全文展示', async () => {
    const huge = `${'行内容\n'.repeat(1600)}末尾`;
    vi.mocked(listDrafts).mockImplementation(((_materialId: string, versionId?: string) =>
      Promise.resolve([
        { ...DRAFT_OLD, textContent: versionId === 'ver-1' ? huge : `${huge}补充` },
      ])) as never);

    renderCompare();

    expect(await screen.findByText('文本过长')).toBeTruthy();
    expect(screen.getByText(/超过 1500 行，未做逐行比对/)).toBeTruthy();
    expect(screen.getByText('+0 行')).toBeTruthy();
    expect(screen.getByText('-0 行')).toBeTruthy();
    expect(screen.getByText('0 行相同')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(document.querySelectorAll('pre')).toHaveLength(2);
    expect(document.querySelectorAll('pre')[1].textContent).toContain('补充');
  });

  it('左右选择相同时给出提示并可关闭弹窗', async () => {
    const { onClose } = renderCompare();
    await screen.findByText('2 行相同');

    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'ver-2' } });

    expect(await screen.findByText('左右选择相同')).toBeTruthy();
    expect(await screen.findByText('3 行相同')).toBeTruthy();
    expect(await screen.findByText('+0 行')).toBeTruthy();
    expect(await screen.findByText('-0 行')).toBeTruthy();

    const dialog = screen.getByRole('dialog');
    const closeButtons = within(dialog).getAllByRole('button', { name: '关闭' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
