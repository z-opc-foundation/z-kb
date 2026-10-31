import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

interface MaterialPreviewPdfProps {
  url: string;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

/** PDF 原件预览：按容器宽度铺满，滚动到附近才真正渲染页面，避免大文档一次性占满内存。 */
export default function MaterialPreviewPdf({ url }: MaterialPreviewPdfProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let loading: PDFDocumentLoadingTask | null = null;
    let loaded: PDFDocumentProxy | null = null;
    let worker: Worker | null = null;
    docRef.current = null;
    void (async () => {
      setStatus('loading');
      setPages(0);
      setError('');
      try {
        const pdfjs = await import('pdfjs-dist');
        worker = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' });
        pdfjs.GlobalWorkerOptions.workerPort = worker;
        loading = pdfjs.getDocument({ url });
        loaded = await loading.promise;
        if (cancelled) {
          return;
        }
        docRef.current = loaded;
        setPages(loaded.numPages);
        setStatus('ready');
      } catch (cause) {
        if (!cancelled) {
          setStatus('error');
          setError(cause instanceof Error ? cause.message : '无法解析该 PDF');
        }
      }
    })();
    return () => {
      cancelled = true;
      docRef.current = null;
      void loading?.destroy();
      worker?.terminate();
    };
  }, [url]);

  useEffect(() => {
    const host = hostRef.current;
    const doc = docRef.current;
    if (status !== 'ready' || !host || !doc) {
      return;
    }
    let cancelled = false;
    host.textContent = '';
    const contentWidth = Math.max(320, host.clientWidth - 28);
    const pageWidth = Math.floor(contentWidth * zoom);

    const renderPage = async (pageNo: number, holder: HTMLElement) => {
      try {
        const page = await doc.getPage(pageNo);
        if (cancelled) {
          return;
        }
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: pageWidth / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        holder.textContent = '';
        holder.appendChild(canvas);
        await page.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        }).promise;
        page.cleanup();
      } catch {
        // 单页失败不阻断其他页
      }
    };

    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                const holder = entry.target as HTMLElement;
                if (!entry.isIntersecting || holder.dataset.rendered === '1') {
                  return;
                }
                holder.dataset.rendered = '1';
                void renderPage(Number(holder.dataset.page), holder);
              });
            },
            { root: null, rootMargin: '800px 0px' },
          )
        : null;

    void (async () => {
      for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
        if (cancelled) {
          return;
        }
        const page = await doc.getPage(pageNo);
        if (cancelled) {
          return;
        }
        const base = page.getViewport({ scale: 1 });
        const holder = document.createElement('div');
        holder.className = 'pdf-page';
        holder.dataset.page = String(pageNo);
        holder.style.width = `${pageWidth}px`;
        holder.style.aspectRatio = `${base.width} / ${base.height}`;
        host.appendChild(holder);
        if (observer) {
          observer.observe(holder);
        } else {
          holder.dataset.rendered = '1';
          void renderPage(pageNo, holder);
        }
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [status, zoom]);

  if (status === 'error') {
    return (
      <div className="preview-state">
        <b>PDF 打开失败</b>
        <p>{error || '文件可能已损坏，或不是有效的 PDF'}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <span className="hint">{pages ? `${pages} 页` : '正在读取…'}</span>
        <button
          className="btn xs"
          type="button"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => setZoom((value) => Math.max(ZOOM_MIN, Number((value - ZOOM_STEP).toFixed(2))))}
        >
          缩小
        </button>
        <span className="mono-sm">{Math.round(zoom * 100)}%</span>
        <button
          className="btn xs"
          type="button"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => setZoom((value) => Math.min(ZOOM_MAX, Number((value + ZOOM_STEP).toFixed(2))))}
        >
          放大
        </button>
        <button className="btn xs" type="button" disabled={zoom === 1} onClick={() => setZoom(1)}>
          适应宽度
        </button>
      </div>
      <div className="pdf-scroll" ref={hostRef}>
        {status === 'loading' ? <div className="preview-state">正在打开 PDF…</div> : null}
      </div>
    </div>
  );
}
