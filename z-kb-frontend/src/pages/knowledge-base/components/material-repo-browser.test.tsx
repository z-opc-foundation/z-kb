import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialRecord } from '@/services/material';
import {
  getRepoOverview,
  listRepoEntries,
  readRepoFile,
  type RepoOverview,
} from '@/services/materialRepo';
import MaterialRepoBrowser from './material-repo-browser';

vi.mock('@/services/materialRepo', () => ({
  getRepoOverview: vi.fn(),
  listRepoEntries: vi.fn(),
  readRepoFile: vi.fn(),
}));

const overview = vi.mocked(getRepoOverview);
const entries = vi.mocked(listRepoEntries);
const readFile = vi.mocked(readRepoFile);

const MATERIAL: MaterialRecord = {
  materialId: 'mat-repo',
  kbId: 'kb-1',
  materialType: 'CODE',
  title: 'c2f/future-brain',
  sourceType: 'CODE_GIT',
  materialStatus: 'ACTIVE',
  fingerprint: 'fp-1',
  currentVersionId: 'v-1',
  compileStatus: 'NONE',
  governanceStatus: 'NORMAL',
  registeredBy: 1,
};

const OVERVIEW: RepoOverview = {
  materialId: 'mat-repo',
  title: 'c2f/future-brain',
  provider: 'GIT',
  repo: 'c2f/future-brain',
  repoUrl: 'https://git.example.com/c2f/future-brain',
  branch: 'main',
  commit: 'abcdef1234567890',
  fileCount: 12,
  docCount: 3,
  codeCount: 8,
  entries: [
    { name: 'docs', path: 'docs', entryType: 'DIR' },
    { name: 'README.md', path: 'README.md', entryType: 'FILE' },
  ],
};

beforeEach(() => {
  overview.mockReset();
  entries.mockReset();
  readFile.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('MaterialRepoBrowser', () => {
  it('展示仓库坐标与根目录，按目录展开并渲染所选文件', async () => {
    overview.mockResolvedValue(OVERVIEW);
    entries.mockResolvedValue([{ name: 'guide.md', path: 'docs/guide.md', entryType: 'FILE' }]);
    readFile.mockResolvedValue({
      name: 'guide.md',
      path: 'docs/guide.md',
      fileExt: 'md',
      sizeBytes: 1024,
      binary: false,
      truncated: false,
      content: '# 接入指南\n\n说明正文',
    });

    render(<MaterialRepoBrowser material={MATERIAL} />);

    expect(await screen.findByText('c2f/future-brain')).toBeTruthy();
    expect(screen.getByText(/分支 main/)).toBeTruthy();
    expect(screen.getByText('README.md')).toBeTruthy();

    fireEvent.click(screen.getByText('docs'));
    expect(await screen.findByText('guide.md')).toBeTruthy();
    expect(entries).toHaveBeenCalledWith('mat-repo', 'docs');

    fireEvent.click(screen.getByText('guide.md'));
    expect(await screen.findByRole('heading', { name: '接入指南' })).toBeTruthy();
    expect(readFile).toHaveBeenCalledWith('mat-repo', 'docs/guide.md');
  });

  it('二进制文件只提示不可预览，不渲染内容', async () => {
    overview.mockResolvedValue({
      ...OVERVIEW,
      entries: [{ name: 'logo.png', path: 'logo.png', entryType: 'FILE' }],
    });
    readFile.mockResolvedValue({
      name: 'logo.png',
      path: 'logo.png',
      fileExt: 'png',
      sizeBytes: 4096,
      binary: true,
      truncated: false,
      content: null,
    });

    render(<MaterialRepoBrowser material={MATERIAL} />);

    fireEvent.click(await screen.findByText('logo.png'));

    expect(await screen.findByText('二进制文件')).toBeTruthy();
  });

  it('概览读取失败时给出重试入口', async () => {
    overview.mockResolvedValueOnce(undefined).mockResolvedValueOnce(OVERVIEW);

    render(<MaterialRepoBrowser material={MATERIAL} />);

    expect(await screen.findByText('项目读取失败')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(overview).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('README.md')).toBeTruthy();
  });
});
