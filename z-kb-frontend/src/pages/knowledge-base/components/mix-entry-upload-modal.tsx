import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import {
  uploadMaterials,
  type MaterialUploadItem,
} from '@/services/material';
import { toast } from '@/utils/toast';
import { useEffect, useRef, useState } from 'react';
import { formatFileSize } from '@/utils/format';

interface MixFolderOption {
  id: string;
  label: string;
}

interface MixEntryUploadModalProps {
  kbId: string;
  folders: MixFolderOption[];
  defaultFolderId: string;
  onClose: () => void;
  onUploaded: () => void;
}

export default function MixEntryUploadModal({
  kbId,
  folders,
  defaultFolderId,
  onClose,
  onUploaded,
}: MixEntryUploadModalProps) {
  const [folderId, setFolderId] = useState(defaultFolderId);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<MaterialUploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = dirInputRef.current;
    if (input) {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    }
  }, []);

  const pickFiles = (list: FileList | null) => {
    setFiles(Array.from(list || []));
    setResults([]);
  };

  const submit = async () => {
    if (!files.length) {
      toast('请选择文件', '文档、表格、图片、音视频等都可以进入混合库', 'warn');
      return;
    }
    setUploading(true);
    const result = await uploadMaterials(kbId, folderId || undefined, files);
    setUploading(false);
    if (!result) {
      return;
    }
    setResults(result);
    const ok = result.filter((item) => item.success).length;
    const duplicated = result.filter((item) => item.duplicated).length;
    if (ok > 0) {
      toast(
        '上传完成',
        `成功 ${ok} 个${duplicated ? `，重复 ${duplicated} 个` : ''}`,
        'success',
      );
      setFiles([]);
      onUploaded();
    } else {
      toast(
        '未登记任何文件',
        duplicated ? '内容在本库已存在' : '请检查文件格式或大小限制',
        'warn',
      );
    }
  };

  const folderLabel =
    folders.find((item) => item.id === folderId)?.label || '未分类';

  return (
    <AppModal
      icon="upload"
      title="上传条目"
      sub={`登记到 ${folderLabel}；单文件上限 10MB`}
      width={680}
      onClose={() => {
        if (!uploading) {
          onClose();
        }
      }}
      body={
        <div>
          <div className="field">
            <label>目标目录</label>
            <select
              className="select"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
            >
              <option value="">未分类</option>
              {folders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <span className="help">
              目录就是条目树的分支；不选目录时条目落在树根。
            </span>
          </div>

          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="dz-icon">
              <Icon name="upload" size={20} />
            </div>
            <b>点击选择文件</b>
            <p>
              文档、表格、图片、音视频、网页存档、代码与 JSON
              都可以进来；类型按扩展名与物料类型判定。
            </p>
          </div>
          <div className="row gap-8 mt-12">
            <button
              className="btn sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="file" size={12} />
              选择文件
            </button>
            <button
              className="btn sm"
              type="button"
              onClick={() => dirInputRef.current?.click()}
            >
              <Icon name="folder-open" size={12} />
              选择目录
            </button>
            {files.length ? (
              <button className="btn sm ghost" type="button" onClick={() => setFiles([])}>
                <Icon name="x" size={12} />
                清空
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              pickFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <input
            ref={dirInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              pickFiles(event.target.files);
              event.target.value = '';
            }}
          />

          {files.length ? (
            <div className="upload-list">
              {files.map((file) => (
                <div
                  className="file-row"
                  key={`${file.webkitRelativePath || file.name}-${file.size}`}
                >
                  <Icon name="file" size={13} />
                  <span className="nm">
                    {file.webkitRelativePath || file.name}
                  </span>
                  <span className="sz">{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {results.length ? (
            <div className="upload-list" style={{ marginTop: 14 }}>
              {results.map((item, index) => (
                <div
                  className="file-row"
                  key={`${item.fileName}-${index}`}
                  style={{
                    borderColor: item.success ? 'var(--line)' : '#f6d3d0',
                  }}
                >
                  <Icon
                    name={item.success ? 'check-circle' : 'alert-circle'}
                    size={13}
                  />
                  <span className="nm">{item.fileName}</span>
                  <span className="sz">{item.message}</span>
                </div>
              ))}
            </div>
          ) : null}

        </div>
      }
      footLeft={<span>已选 {files.length} 个文件</span>}
      footRight={
        <>
          <button
            className="btn"
            type="button"
            disabled={uploading}
            onClick={onClose}
          >
            关闭
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={uploading || !files.length}
            onClick={() => void submit()}
          >
            {uploading ? '上传中…' : '开始上传'}
          </button>
        </>
      }
    />
  );
}
