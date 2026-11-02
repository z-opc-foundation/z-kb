import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { createCompilationBatch } from '@/services/compilation';
import {
  removeMaterials,
  updateMaterialCategory,
  uploadMaterials,
  type MaterialUploadItem,
} from '@/services/material';
import type { CategoryNode } from '@/services/category';
import { syncKnowledgeBaseSource } from '@/services/knowledgeBaseSource';
import { toast } from '@/utils/toast';
import {
  downloadMaterialFile,
  findCategory,
  type MaterialTypeKey,
  type MaterialWorkspaceProps,
} from '../material-workspace-model';
import { useMaterialList } from './use-material-list';
import { useMaterialRecycle } from './use-material-recycle';
import { useMaterialTree } from './use-material-tree';
import { useMaterialDetail } from './use-material-detail';

export function useMaterialWorkspace({
  kbId,
  canManage,
  canWrite = canManage,
  canCompile = canManage,
  materialType = 'DOCUMENT',
  initialMaterialId,
  initialDetailTab,
  uploadSignal,
  onBatchCreated,
  onDetailClosed,
  onOpenConcept,
}: MaterialWorkspaceProps) {
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<MaterialUploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [nodeBatch, setNodeBatch] = useState<CategoryNode | null>(null);
  const [nodeBatchName, setNodeBatchName] = useState('');
  const [nodeBatchBusy, setNodeBatchBusy] = useState(false);

  const list = useMaterialList({
    kbId,
    materialType,
    categoryId,
    onCategoryChange: setCategoryId,
  });

  // 树与详情都会改动列表/树数据，用 ref 打破三个 hook 之间的构造顺序依赖。
  const refreshRef = useRef<() => void>(() => {});
  const tree = useMaterialTree({
    kbId,
    canWrite,
    categoryId,
    setBusy,
    onCategoryCleared: (targetId) => {
      if (targetId === categoryId) {
        setCategoryId('');
      }
      refreshRef.current();
    },
    onMaterialsChanged: () => refreshRef.current(),
  });
  const detail = useMaterialDetail({
    kbId,
    initialMaterialId,
    initialDetailTab,
    onDetailClosed,
    onMaterialsChanged: () => refreshRef.current(),
  });
  const recycle = useMaterialRecycle({
    kbId,
    canWrite,
    materialType,
    onChanged: () => refreshRef.current(),
  });

  useEffect(() => {
    refreshRef.current = () => {
      void list.loadMaterials();
      void tree.loadTreeMaterials();
    };
  }, [list.loadMaterials, tree.loadTreeMaterials]);

  useEffect(() => {
    if (uploadSignal && canWrite) {
      setUploadOpen(true);
    }
  }, [uploadSignal, canWrite]);

  const refreshAll = () => {
    list.resetToFirstPage();
    void tree.loadTree();
    void tree.loadTreeMaterials();
    void recycle.loadCount();
  };

  /** 资料树上的接入源节点直接发起同步；语雀走勾选范围抽屉，Git 一次同步整个仓库。 */
  const syncSource = async (sourceId: string) => {
    setBusy(true);
    const result = await syncKnowledgeBaseSource(kbId, sourceId);
    setBusy(false);
    if (!result) {
      return;
    }
    toast(
      result.reusing ? '已在同步中' : '已发起同步',
      result.reusing
        ? '该接入源已有运行中的同步任务，本次未重复发起'
        : '正在拉取仓库内容，进度可在任务管理查看',
      'success',
    );
    refreshAll();
  };

  const openUpload = () => {
    setUploadOpen(true);
    setUploadResults([]);
  };

  const submitUpload = async () => {
    if (!uploadFiles.length) {
      toast('请选择文件', '支持 txt / md / csv / json 等文本格式', 'warn');
      return;
    }
    setUploading(true);
    const result = await uploadMaterials(kbId, categoryId || undefined, uploadFiles);
    setUploading(false);
    if (!result) {
      return;
    }
    setUploadResults(result);
    const ok = result.filter((item) => item.success).length;
    const duplicated = result.filter((item) => item.duplicated).length;
    if (ok > 0) {
      toast(
        '上传完成',
        `成功 ${ok} 个${duplicated ? `，重复 ${duplicated} 个` : ''}，解析任务已提交`,
        'success',
      );
      setUploadFiles([]);
      refreshAll();
    } else {
      toast('未登记任何文件', duplicated ? '内容在本库已存在' : '请检查文件格式', 'warn');
    }
  };

  const moveSelected = async (targetId?: string) => {
    if (!list.selected.length) {
      return;
    }
    setBusy(true);
    const result = await updateMaterialCategory(kbId, list.selected, targetId);
    setBusy(false);
    if (!result) {
      return;
    }
    setMoveOpen(false);
    const ok = result.filter((item) => item.success).length;
    toast('分类已更新', `${ok}/${result.length} 个资料已移动`, ok === result.length ? 'success' : 'warn');
    list.setSelected([]);
    void tree.loadTreeMaterials();
    void list.loadMaterials();
  };

  const askRemove = (materialIds: string[]) => {
    list.setSelected(materialIds);
    setConfirmRemove(true);
  };

  const removeSelected = async () => {
    setBusy(true);
    const result = await removeMaterials(kbId, list.selected);
    setBusy(false);
    setConfirmRemove(false);
    if (!result) {
      return;
    }
    const ok = result.filter((item) => item.success).length;
    toast('删除完成', `${ok}/${result.length} 个资料已删除`, ok === result.length ? 'success' : 'warn');
    list.setSelected([]);
    refreshAll();
  };

  const openBatch = () => {
    setBatchName(`知识编译 · ${dayjs().format('MM-DD HH:mm')}`);
    setBatchOpen(true);
  };

  const submitBatch = async () => {
    if (!list.selected.length) {
      return;
    }
    setBatchBusy(true);
    const result = await createCompilationBatch({
      kbId,
      name: batchName.trim() || undefined,
      scopeType: 'WORKSPACE',
      materialIds: list.selected,
    });
    setBatchBusy(false);
    if (!result) {
      return;
    }
    toast(
      '编译组别已创建',
      `${result.successCount}/${result.totalCount} 成功 · 状态 ${result.status}`,
      result.failedCount ? 'warn' : 'success',
    );
    setBatchOpen(false);
    list.setSelected([]);
    refreshAll();
    onBatchCreated?.(result.batchId);
  };

  const openNodeBatch = (node: CategoryNode) => {
    setNodeBatch(node);
    setNodeBatchName(`${node.name} 批量编译`);
  };

  const submitNodeBatch = async () => {
    if (!nodeBatch) {
      return;
    }
    setNodeBatchBusy(true);
    const result = await createCompilationBatch({
      kbId,
      name: nodeBatchName.trim() || undefined,
      scopeType: 'CATEGORY',
      scopeId: nodeBatch.categoryId,
    });
    setNodeBatchBusy(false);
    if (!result) {
      return;
    }
    toast(
      '编译组别已创建',
      `范围 ${result.scopeCount} 份 · ${result.successCount}/${result.totalCount} 成功`,
      result.failedCount ? 'warn' : 'success',
    );
    setNodeBatch(null);
    refreshAll();
    onBatchCreated?.(result.batchId);
  };

  const currentCategory = categoryId ? findCategory(tree.tree, categoryId) : undefined;

  return {
    kbId,
    canWrite,
    canCompile,
    onOpenConcept,
    materialType: materialType as MaterialTypeKey,
    categoryId,
    busy,
    currentCategory,
    ...list,
    ...tree,
    ...detail,
    recycle,
    uploadOpen,
    setUploadOpen,
    uploadFiles,
    setUploadFiles,
    uploading,
    uploadResults,
    setUploadResults,
    fileInputRef,
    moveOpen,
    setMoveOpen,
    confirmRemove,
    setConfirmRemove,
    batchOpen,
    setBatchOpen,
    batchName,
    setBatchName,
    batchBusy,
    nodeBatch,
    setNodeBatch,
    nodeBatchName,
    setNodeBatchName,
    nodeBatchBusy,
    refreshAll,
    syncSource,
    openUpload,
    submitUpload,
    moveSelected,
    askRemove,
    removeSelected,
    openBatch,
    submitBatch,
    openNodeBatch,
    submitNodeBatch,
    download: downloadMaterialFile,
  };
}

export type MaterialWorkspaceController = ReturnType<typeof useMaterialWorkspace>;
