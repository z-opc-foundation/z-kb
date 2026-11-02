import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/material', () => ({
  uploadMaterials: vi.fn(),
}));

vi.mock('@/utils/toast', () => ({ toast: vi.fn() }));

import { uploadMaterials } from '@/services/material';
import { toast } from '@/utils/toast';
import MixEntryUploadModal from './mix-entry-upload-modal';

const FOLDERS = [
  { id: 'f1', label: '院级制度' },
  { id: 'f2', label: '心血管' },
];

function renderModal(overrides: Partial<Parameters<typeof MixEntryUploadModal>[0]> = {}) {
  return render(
    <MixEntryUploadModal
      kbId="kb-1"
      folders={FOLDERS}
      defaultFolderId="f1"
      onClose={vi.fn()}
      onUploaded={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.mocked(uploadMaterials).mockReset();
  vi.mocked(toast).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('混合库上传弹窗', () => {
  it('默认目录展示、选择文件后按目录提交并回传结果', async () => {
    const onUploaded = vi.fn();
    vi.mocked(uploadMaterials).mockResolvedValue([
      { fileName: 'a.png', success: true, duplicated: false, message: '已登记' },
    ]);
    renderModal({ onUploaded });

    expect(screen.getByText('登记到 院级制度；单文件上限 10MB')).toBeTruthy();
    expect(screen.getByDisplayValue('院级制度')).toBeTruthy();

    const file = new File(['png'], 'a.png', { type: 'image/png' });
    const input = document.querySelector('.modal input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('a.png')).toBeTruthy();
    expect(screen.getByText('已选 1 个文件')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '开始上传' }));
    await waitFor(() =>
      expect(uploadMaterials).toHaveBeenCalledWith('kb-1', 'f1', [file]),
    );
    expect(await screen.findByText('已登记')).toBeTruthy();
    expect(toast).toHaveBeenCalledWith('上传完成', '成功 1 个', 'success');
    expect(onUploaded).toHaveBeenCalled();
    expect(screen.getByText('已选 0 个文件')).toBeTruthy();
  });

  it('切换目标目录后未分类以 undefined 提交，失败结果不触发刷新', async () => {
    const onUploaded = vi.fn();
    vi.mocked(uploadMaterials).mockResolvedValue([
      { fileName: 'a.png', success: false, duplicated: true, message: '内容在本库已存在' },
    ]);
    renderModal({ onUploaded });

    fireEvent.change(screen.getByDisplayValue('院级制度'), {
      target: { value: '' },
    });
    expect(screen.getByText('登记到 未分类；单文件上限 10MB')).toBeTruthy();

    const file = new File(['png'], 'a.png', { type: 'image/png' });
    const input = document.querySelector('.modal input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '开始上传' }));

    await waitFor(() =>
      expect(uploadMaterials).toHaveBeenCalledWith('kb-1', undefined, [file]),
    );
    expect(await screen.findByText('内容在本库已存在')).toBeTruthy();
    expect(toast).toHaveBeenCalledWith(
      '未登记任何文件',
      '内容在本库已存在',
      'warn',
    );
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('清空已选文件后上传按钮禁用，取消关闭弹窗', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const input = document.querySelector('.modal input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('a.txt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    expect(screen.queryByText('a.txt')).toBeNull();
    expect(screen.getByRole('button', { name: '开始上传' })).toBeDisabled();

    fireEvent.click(screen.getByText('关闭').closest('button') as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });
});
