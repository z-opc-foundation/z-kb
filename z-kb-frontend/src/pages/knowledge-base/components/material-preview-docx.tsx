import { useEffect, useRef, useState } from 'react';

interface MaterialPreviewDocxProps {
  blob: Blob;
}

/** Word 原件预览：docx-preview 按分页排版成 HTML，样式尽量贴近 Word。 */
export default function MaterialPreviewDocx({ blob }: MaterialPreviewDocxProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'rendering' | 'ready' | 'error'>('rendering');
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let cancelled = false;
    setStatus('rendering');
    setError('');
    void (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !hostRef.current) {
          return;
        }
        await renderAsync(blob, hostRef.current, undefined, {
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
        if (!cancelled) {
          setStatus('ready');
        }
      } catch (cause) {
        if (!cancelled) {
          setStatus('error');
          setError(cause instanceof Error ? cause.message : '无法解析该 Word 文档');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (status === 'error') {
    return (
      <div className="preview-state">
        <b>Word 打开失败</b>
        <p>{error || '文件可能已损坏；只支持 .docx，老格式 .doc 请下载查看'}</p>
      </div>
    );
  }

  return (
    <div className="docx-viewer">
      {status === 'rendering' ? <div className="preview-state slim">正在排版 Word…</div> : null}
      <div className="docx-scroll" ref={hostRef} />
    </div>
  );
}
