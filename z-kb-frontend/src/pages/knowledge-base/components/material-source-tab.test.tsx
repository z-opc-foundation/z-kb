import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaterialRecord, ParsedDraftRecord } from '@/services/material';
import MaterialSourceTab from './material-source-tab';

vi.mock('./material-original-preview', () => ({
  default: ({ material }: { material: MaterialRecord }) => (
    <div data-testid="original-preview">{material.fileName}</div>
  ),
}));

vi.mock('./material-repo-browser', () => ({
  default: ({ material }: { material: MaterialRecord }) => (
    <div data-testid="repo-browser">{material.title}</div>
  ),
}));

const MATERIAL: MaterialRecord = {
  materialId: 'mat-1',
  kbId: 'kb-1',
  materialType: 'DOCUMENT',
  title: '排班管理制度',
  sourceType: 'UPLOAD',
  materialStatus: 'ACTIVE',
  fingerprint: 'fp-1',
  currentVersionId: 'v-1',
  fileName: '排班管理制度.pdf',
  fileExt: 'pdf',
  sizeBytes: 2048,
  compileStatus: 'NONE',
  governanceStatus: 'NORMAL',
  registeredBy: 1,
};

const DRAFT: ParsedDraftRecord = {
  draftId: 'd-1',
  status: 'READY',
  parserName: 'mineru',
  parserVersion: '1.0',
  textContent: '# 排班制度\n\n护士按班次轮转。',
  textLength: 18,
};

afterEach(() => {
  cleanup();
});

describe('MaterialSourceTab', () => {
  it('默认展示原件，可切到解析稿', () => {
    render(
      <MaterialSourceTab
        material={MATERIAL}
        draft={DRAFT}
        canEdit={false}
        saving={false}
        onSave={vi.fn()}
        onOpenCompare={vi.fn()}
      />,
    );

    expect(screen.getByTestId('original-preview')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '排班制度' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '解析稿' }));
    expect(screen.queryByTestId('original-preview')).toBeNull();
    expect(screen.getByRole('heading', { name: '排班制度' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '原件' }));
    expect(screen.getByTestId('original-preview')).toBeTruthy();
  });

  it('没有解析稿时切到解析稿给出空态', () => {
    render(
      <MaterialSourceTab
        material={MATERIAL}
        draft={null}
        canEdit={false}
        saving={false}
        onSave={vi.fn()}
        onOpenCompare={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '解析稿' }));
    expect(screen.getByText('没有解析稿')).toBeTruthy();
  });

  it('代码仓库资料的原文走项目浏览，而不是单文件原件', () => {
    render(
      <MaterialSourceTab
        material={{ ...MATERIAL, sourceType: 'CODE_GIT', title: 'c2f/future-brain' }}
        draft={DRAFT}
        canEdit={false}
        saving={false}
        onSave={vi.fn()}
        onOpenCompare={vi.fn()}
      />,
    );

    expect(screen.getByTestId('repo-browser')).toBeTruthy();
    expect(screen.queryByTestId('original-preview')).toBeNull();
  });
});
