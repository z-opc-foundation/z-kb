import { useEffect, useRef, useState } from 'react';

interface MaterialPreviewPptxProps {
  blob: Blob;
}

/** PPT 原件预览：pptx-preview 逐页渲染幻灯片，按容器宽度等比缩放。 */
export default function MaterialPreviewPptx({ blob }: MaterialPreviewPptxProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'rendering' | 'ready' | 'error'>('rendering');
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let disposed = false;
    let viewer: { preview: (file: ArrayBuffer) => Promise<unknown>; destroy: () => void } | null =
      null;
    setStatus('rendering');
    setError('');
    void (async () => {
      try {
        const buffer = await blob.arrayBuffer();
        const { init } = await import('pptx-preview');
        if (disposed || !hostRef.current) {
          return;
        }
        const width = Math.min(Math.max(hostRef.current.clientWidth - 28, 560), 1180);
        viewer = init(hostRef.current, {
          width,
          height: Math.round(width * 0.5625),
          mode: 'slide',
        });
        await viewer.preview(buffer);
        if (!disposed) {
          setStatus('ready');
        }
      } catch (cause) {
        if (!disposed) {
          setStatus('error');
          setError(cause instanceof Error ? cause.message : '无法解析该演示文稿');
        }
      }
    })();
    return () => {
      disposed = true;
      viewer?.destroy();
    };
  }, [blob]);

  if (status === 'error') {
    return (
      <div className="preview-state">
        <b>PPT 打开失败</b>
        <p>{error || '文件可能已损坏；只支持 .pptx，老格式 .ppt 请下载查看'}</p>
      </div>
    );
  }

  return (
    <div className="pptx-viewer">
      {status === 'rendering' ? <div className="preview-state slim">正在渲染幻灯片…</div> : null}
      <div className="pptx-scroll" ref={hostRef} />
    </div>
  );
}
