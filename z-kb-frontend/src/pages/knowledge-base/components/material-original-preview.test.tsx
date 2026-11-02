import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadMaterial, type MaterialRecord } from '@/services/material';
import MaterialOriginalPreview from './material-original-preview';

vi.mock('@/services/material', () => ({
  downloadMaterial: vi.fn(),
}));

const download = vi.mocked(downloadMaterial);

function material(patch: Partial<MaterialRecord> = {}): MaterialRecord {
  return {
    materialId: 'mat-1',
    kbId: 'kb-1',
    materialType: 'DOCUMENT',
    title: '排班管理制度',
    sourceType: 'UPLOAD',
    materialStatus: 'ACTIVE',
    fingerprint: 'fp-1',
    currentVersionId: 'v-1',
    fileName: '排班管理制度.md',
    fileExt: 'md',
    sizeBytes: 2048,
    compileStatus: 'NONE',
    governanceStatus: 'NORMAL',
    registeredBy: 1,
    ...patch,
  };
}

/** jsdom 的 Blob 没有 arrayBuffer/text，这里补上读取能力。 */
function textBlob(text: string): Blob {
  const blob = new Blob([text]);
  Object.defineProperty(blob, 'arrayBuffer', {
    value: async () => new TextEncoder().encode(text).buffer,
  });
  Object.defineProperty(blob, 'text', { value: async () => text });
  return blob;
}

beforeEach(() => {
  download.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('MaterialOriginalPreview', () => {
  it('未知格式不下载原件，直接提示下载查看', () => {
    render(<MaterialOriginalPreview material={material({ fileExt: 'zip', fileName: 'a.zip' })} />);

    expect(screen.getByText('这类文件暂不支持在线预览，可在下方下载原件查看')).toBeTruthy();
    expect(download).not.toHaveBeenCalled();
  });

  it('旧版 .doc 不取原件，直接展示解析文本并说明版式差异', () => {
    render(
      <MaterialOriginalPreview
        material={material({ fileExt: 'doc', fileName: '旧制度.doc' })}
        draft={{ draftId: 'd-1', status: 'READY', parserName: 'poi', parserVersion: '1', textContent: '第一条 护理交接班制度。', textLength: 12 }}
      />,
    );

    expect(screen.getByText('第一条 护理交接班制度。')).toBeTruthy();
    expect(screen.getByText(/旧版 Word（\.doc）无法原版式预览/)).toBeTruthy();
    expect(download).not.toHaveBeenCalled();
  });

  it('旧版 .doc 没有解析稿时提示下载原件', () => {
    render(<MaterialOriginalPreview material={material({ fileExt: 'doc', fileName: '旧制度.doc' })} />);

    expect(
      screen.getByText('旧版 Word 无法原版式预览，当前版本还没有解析稿，可在下方下载原件查看'),
    ).toBeTruthy();
    expect(download).not.toHaveBeenCalled();
  });

  it('文本与 Markdown 原件解码后直接展示', async () => {
    download.mockResolvedValue(textBlob('# 排班制度\n\n护士按班次轮转。'));

    render(<MaterialOriginalPreview material={material()} />);

    expect(await screen.findByRole('heading', { name: '排班制度' })).toBeTruthy();
    expect(download).toHaveBeenCalledWith('mat-1');
  });

  it('图片原件包成对应 MIME 后用对象地址展示', async () => {
    download.mockResolvedValue(textBlob('png'));
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mat-1');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const view = render(
      <MaterialOriginalPreview material={material({ fileExt: 'png', fileName: '图.png' })} />,
    );

    const image = await screen.findByRole('img', { name: '图.png' });
    expect(image.getAttribute('src')).toBe('blob:mat-1');
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('image/png');

    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mat-1');
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('读取失败给出原因并可重试', async () => {
    download.mockRejectedValueOnce(new Error('网络异常')).mockResolvedValueOnce(textBlob('ok'));

    render(<MaterialOriginalPreview material={material({ fileExt: 'txt', fileName: 'a.txt' })} />);

    expect(await screen.findByText('原件读取失败')).toBeTruthy();
    expect(screen.getByText('网络异常')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('ok')).toBeTruthy();
  });
});
