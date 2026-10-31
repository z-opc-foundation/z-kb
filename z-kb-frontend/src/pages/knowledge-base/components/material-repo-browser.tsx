import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/icon';
import type { MaterialRecord } from '@/services/material';
import {
  getRepoOverview,
  listRepoEntries,
  readRepoFile,
  type RepoEntry,
  type RepoFile,
  type RepoOverview,
} from '@/services/materialRepo';
import { formatFileSize } from '@/utils/format';
import MaterialDraftMarkdown from './material-draft-markdown';

interface MaterialRepoBrowserProps {
  material: MaterialRecord;
}

interface DirState {
  open: boolean;
  loading: boolean;
  entries: RepoEntry[];
  error?: string;
}

const MARKDOWN_EXT = new Set(['md', 'markdown', 'mdx']);

/** 代码仓库资料的「原文」：左侧按目录展开工程，右侧只读渲染文件内容。 */
export default function MaterialRepoBrowser({ material }: MaterialRepoBrowserProps) {
  const [overview, setOverview] = useState<RepoOverview | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [dirs, setDirs] = useState<Record<string, DirState>>({});
  const [selectedPath, setSelectedPath] = useState('');
  const [file, setFile] = useState<RepoFile | null>(null);
  const [fileStatus, setFileStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [fileError, setFileError] = useState('');
  const [reload, setReload] = useState(0);
  const fileRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');
    setOverview(null);
    setDirs({});
    setSelectedPath('');
    setFile(null);
    setFileStatus('idle');
    void (async () => {
      const result = await getRepoOverview(material.materialId);
      if (cancelled) {
        return;
      }
      if (!result) {
        setStatus('error');
        setError('项目信息读取失败');
        return;
      }
      setOverview(result);
      setDirs({ '': { open: true, loading: false, entries: result.entries || [] } });
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [material.materialId, reload]);

  const toggleDir = (path: string) => {
    const current = dirs[path];
    if (current?.open) {
      setDirs((prev) => ({ ...prev, [path]: { ...current, open: false } }));
      return;
    }
    if (current && current.entries.length) {
      setDirs((prev) => ({ ...prev, [path]: { ...current, open: true, error: undefined } }));
      return;
    }
    setDirs((prev) => ({
      ...prev,
      [path]: { open: true, loading: true, entries: current?.entries || [] },
    }));
    void (async () => {
      const result = await listRepoEntries(material.materialId, path);
      setDirs((prev) => ({
        ...prev,
        [path]: result
          ? { open: true, loading: false, entries: result }
          : { open: true, loading: false, entries: [], error: '目录读取失败' },
      }));
    })();
  };

  const openFile = (path: string) => {
    const token = fileRequest.current + 1;
    fileRequest.current = token;
    setSelectedPath(path);
    setFile(null);
    setFileError('');
    setFileStatus('loading');
    void (async () => {
      const result = await readRepoFile(material.materialId, path);
      if (fileRequest.current !== token) {
        return;
      }
      if (!result) {
        setFileStatus('error');
        setFileError('文件读取失败');
        return;
      }
      setFile(result);
      setFileStatus('ready');
    })();
  };

  const renderEntries = (path: string, depth: number): ReactNode => {
    const dir = dirs[path];
    if (!dir) {
      return null;
    }
    return dir.entries.map((entry) => {
      const child = dirs[entry.path];
      const isDir = entry.entryType === 'DIR';
      return (
        <div key={entry.path}>
          <div
            className={`repo-row ${isDir ? 'is-dir' : ''} ${
              selectedPath === entry.path ? 'active' : ''
            }`}
            style={{ paddingLeft: 8 + depth * 12 }}
            title={entry.path}
            onClick={() => (isDir ? toggleDir(entry.path) : openFile(entry.path))}
          >
            <Icon name={isDir ? (child?.open ? 'folder-open' : 'folder') : 'file'} size={12} />
            <span className="repo-row-name">{entry.name}</span>
            {child?.loading ? <span className="hint">…</span> : null}
          </div>
          {isDir && child?.open
            ? child.entries.length
              ? renderEntries(entry.path, depth + 1)
              : (
                  <div
                    className="repo-row-empty"
                    style={{ paddingLeft: 22 + depth * 12 }}
                  >
                    {child.loading ? '正在读取…' : child.error || '空目录'}
                  </div>
                )
            : null}
        </div>
      );
    });
  };

  let fileBody: ReactNode;
  if (fileStatus === 'loading') {
    fileBody = <div className="preview-state">正在读取文件…</div>;
  } else if (fileStatus === 'error') {
    fileBody = (
      <div className="preview-state">
        <b>文件读取失败</b>
        <p>{fileError || '请稍后重试'}</p>
        <button className="btn xs" type="button" onClick={() => openFile(selectedPath)}>
          <Icon name="refresh" size={11} />
          重试
        </button>
      </div>
    );
  } else if (!file) {
    fileBody = (
      <div className="preview-state">
        <Icon name="code" size={24} />
        <p>从左侧选择文件，查看工程里的内容</p>
      </div>
    );
  } else if (file.binary) {
    fileBody = (
      <div className="preview-state">
        <Icon name="file" size={24} />
        <b>二进制文件</b>
        <p>这类文件不提供在线预览，可到仓库里下载查看</p>
      </div>
    );
  } else if (MARKDOWN_EXT.has((file.fileExt || '').toLowerCase())) {
    fileBody = (
      <div className="preview-scroll">
        <div className="draft-doc">
          <MaterialDraftMarkdown content={file.content || ''} />
        </div>
      </div>
    );
  } else {
    fileBody = (
      <div className="preview-scroll">
        <pre className="preview-text repo-code">{file.content || ''}</pre>
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="preview-state">正在读取项目…</div>;
  }
  if (status === 'error' || !overview) {
    return (
      <div className="preview-state">
        <b>项目读取失败</b>
        <p>{error || '请稍后重试'}</p>
        <button className="btn xs" type="button" onClick={() => setReload((value) => value + 1)}>
          <Icon name="refresh" size={11} />
          重试
        </button>
      </div>
    );
  }

  const counts = [
    overview.fileCount != null ? `${overview.fileCount} 个文件` : '',
    overview.docCount != null ? `文档 ${overview.docCount}` : '',
    overview.codeCount != null ? `代码 ${overview.codeCount}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="original-preview repo-browser">
      <div className="original-preview-bar">
        <span className="tag blue sm">代码仓库</span>
        <span className="original-preview-name" title={overview.repoUrl}>
          {overview.repo}
        </span>
        <span className="hint">
          分支 {overview.branch}
          {overview.commit ? ` · ${overview.commit.slice(0, 8)}` : ''}
          {counts ? ` · ${counts}` : ''}
        </span>
      </div>
      <div className="original-preview-body repo-browser-body">
        <div className="repo-browser-tree">
          <div className="repo-browser-tree-head">
            <Icon name="git-branch" size={12} />
            <span>项目文件</span>
          </div>
          <div className="repo-browser-tree-scroll">{renderEntries('', 0)}</div>
        </div>
        <div className="repo-browser-file">
          {file ? (
            <div className="repo-file-bar">
              <Icon name="file" size={12} />
              <span className="repo-file-path" title={file.path}>
                {file.path}
              </span>
              <span className="hint">
                {file.sizeBytes != null ? formatFileSize(file.sizeBytes) : ''}
                {file.truncated ? ' · 仅展示前 20 万字符' : ''}
              </span>
            </div>
          ) : null}
          <div className="repo-file-body">{fileBody}</div>
        </div>
      </div>
    </div>
  );
}
