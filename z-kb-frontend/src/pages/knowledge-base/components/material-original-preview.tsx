import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import Icon from '@/components/icon';
import { downloadMaterial, type MaterialRecord, type ParsedDraftRecord } from '@/services/material';
import { formatFileSize } from '@/utils/format';
import { materialFileIcon } from '../material-workspace-model';
import MaterialDraftMarkdown from './material-draft-markdown';
import { PREVIEW_KIND_LABEL, resolvePreviewKind } from './material-preview-kind';

const PdfPreview = lazy(() => import('./material-preview-pdf'));
const DocxPreview = lazy(() => import('./material-preview-docx'));
const SheetPreview = lazy(() => import('./material-preview-sheet'));
const PptxPreview = lazy(() => import('./material-preview-pptx'));

interface MaterialOriginalPreviewProps {
  material: MaterialRecord;
  /** 旧版 .doc 没有浏览器渲染器，原件页签退化为展示当前版本的解析文本。 */
  draft?: ParsedDraftRecord | null;
}

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
};

/** 优先按 UTF-8 解码，遇到非法字节再按 GBK 兜底，避免中文老文本乱码。 */
async function decodeText(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('gbk').decode(buffer);
  }
}

/** 原始文件预览：按扩展名取回原件后交给对应渲染器，未知类型走下载兜底。 */
export default function MaterialOriginalPreview({ material, draft }: MaterialOriginalPreviewProps) {
  const ext = (material.fileExt || material.fileName?.split('.').pop() || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  const kind = resolvePreviewKind(ext);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    kind === 'unsupported' || kind === 'doc' ? 'ready' : 'loading',
  );
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    void (async () => {
      // .doc 是 OLE2 二进制，预览走解析文本，不需要取原件
      if (kind === 'unsupported' || kind === 'doc') {
        setStatus('ready');
        return;
      }
      setStatus('loading');
      setError('');
      setBlob(null);
      setUrl('');
      setText('');
      try {
        const raw = await downloadMaterial(material.materialId);
        if (cancelled) {
          return;
        }
        if (kind === 'text' || kind === 'markdown') {
          const value = await decodeText(raw);
          if (!cancelled) {
            setText(value);
            setStatus('ready');
          }
          return;
        }
        const typed =
          kind === 'image' ? new Blob([raw], { type: IMAGE_MIME[ext] || 'image/png' }) : raw;
        objectUrl = URL.createObjectURL(typed);
        setBlob(typed);
        setUrl(objectUrl);
        setStatus('ready');
      } catch (cause) {
        if (!cancelled) {
          setStatus('error');
          setError(cause instanceof Error ? cause.message : '原件读取失败');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [kind, ext, material.materialId, material.currentVersionId, reload]);

  const name = material.fileName || material.title;
  const icon = materialFileIcon(material).icon;
  const draftText = (draft?.textContent || '').trim();
  const draftTruncated = !!draft && draft.textLength > (draft.textContent || '').length;

  let body: ReactNode = null;
  if (kind === 'unsupported') {
    body = (
      <div className="preview-state">
        <Icon name={icon} size={28} />
        <b>{name}</b>
        <p>这类文件暂不支持在线预览，可在下方下载原件查看</p>
      </div>
    );
  } else if (kind === 'doc') {
    body = draftText ? (
      <div className="preview-scroll">
        <pre className="preview-text">{draftText}</pre>
      </div>
    ) : (
      <div className="preview-state">
        <Icon name={icon} size={28} />
        <b>{name}</b>
        <p>旧版 Word 无法原版式预览，当前版本还没有解析稿，可在下方下载原件查看</p>
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div className="preview-state">
        <b>原件读取失败</b>
        <p>{error || '请稍后重试，或直接下载原件'}</p>
        <button className="btn xs" type="button" onClick={() => setReload((value) => value + 1)}>
          <Icon name="refresh" size={11} />
          重试
        </button>
      </div>
    );
  } else if (status === 'loading') {
    body = <div className="preview-state">正在读取原件…</div>;
  } else if (kind === 'image') {
    body = (
      <div className="preview-scroll preview-image">
        <img src={url} alt={name} />
      </div>
    );
  } else if (kind === 'markdown') {
    body = (
      <div className="preview-scroll">
        <div className="draft-doc">
          <MaterialDraftMarkdown content={text} />
        </div>
      </div>
    );
  } else if (kind === 'text') {
    body = (
      <div className="preview-scroll">
        <pre className="preview-text">{text}</pre>
      </div>
    );
  } else if (kind === 'pdf') {
    body = (
      <Suspense fallback={<div className="preview-state">正在加载 PDF 阅读器…</div>}>
        <PdfPreview url={url} />
      </Suspense>
    );
  } else if (kind === 'docx' && blob) {
    body = (
      <Suspense fallback={<div className="preview-state">正在加载 Word 渲染器…</div>}>
        <DocxPreview blob={blob} />
      </Suspense>
    );
  } else if (kind === 'sheet' && blob) {
    body = (
      <Suspense fallback={<div className="preview-state">正在加载表格渲染器…</div>}>
        <SheetPreview blob={blob} csv={ext === 'csv'} />
      </Suspense>
    );
  } else if (kind === 'pptx' && blob) {
    body = (
      <Suspense fallback={<div className="preview-state">正在加载幻灯片渲染器…</div>}>
        <PptxPreview blob={blob} />
      </Suspense>
    );
  }

  return (
    <div className="original-preview">
      <div className="original-preview-bar">
        <span className="tag blue sm">{PREVIEW_KIND_LABEL[kind]}</span>
        <span className="original-preview-name" title={name}>
          {name}
        </span>
        <span className="hint">{formatFileSize(material.sizeBytes)}</span>
      </div>
      <div className="original-preview-body">
        {kind === 'doc' && draftText ? (
          <div className="preview-note">
            旧版 Word（.doc）无法原版式预览，以下为解析文本
            {draftTruncated ? '（较长，仅显示已解析部分）' : ''}
          </div>
        ) : null}
        {body}
      </div>
    </div>
  );
}
