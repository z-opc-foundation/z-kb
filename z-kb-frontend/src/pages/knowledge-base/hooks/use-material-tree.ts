import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  createCategory,
  getCategoryTree,
  moveCategory,
  removeCategory,
  renameCategory,
  type CategoryNode,
} from '@/services/category';
import { updateMaterialCategory, type MaterialRecord } from '@/services/material';
import { confirmAction } from '@/components/confirm';
import { toast } from '@/utils/toast';
import {
  collectCategoryIds,
  countCategoryMaterials,
  findCategory,
  loadLibraryMaterials,
} from '../material-workspace-model';

interface UseMaterialTreeParams {
  kbId: string;
  canWrite: boolean;
  categoryId: string;
  setBusy: (next: boolean) => void;
  onCategoryCleared: (targetId: string) => void;
  onMaterialsChanged: () => void;
}

export function useMaterialTree({
  kbId,
  canWrite,
  categoryId,
  setBusy,
  onCategoryCleared,
  onMaterialsChanged,
}: UseMaterialTreeParams) {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [treeMaterials, setTreeMaterials] = useState<MaterialRecord[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dragMaterialId, setDragMaterialId] = useState('');
  const [dragCategoryId, setDragCategoryId] = useState('');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const cancelRenameRef = useRef(false);
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; parentId?: string }>({
    open: false,
  });
  const [categoryName, setCategoryName] = useState('');

  const knownCategoryIds = useMemo(() => collectCategoryIds(tree), [tree]);

  const materialsByCategory = useMemo(() => {
    const map = new Map<string, MaterialRecord[]>();
    treeMaterials.forEach((item) => {
      const key =
        item.categoryId && knownCategoryIds.has(item.categoryId)
          ? item.categoryId
          : '';
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [knownCategoryIds, treeMaterials]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    countCategoryMaterials(tree, materialsByCategory, counts);
    return counts;
  }, [materialsByCategory, tree]);

  const loadTree = useCallback(async () => {
    const result = await getCategoryTree(kbId);
    if (result) {
      setTree(result);
    }
  }, [kbId]);

  const loadTreeMaterials = useCallback(async () => {
    const result = await loadLibraryMaterials(kbId);
    if (result) {
      setTreeMaterials(result.records);
      setLibraryTotal(result.total);
    }
  }, [kbId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    void loadTreeMaterials();
  }, [loadTreeMaterials]);

  const expandCategory = (targetId: string) => {
    setCollapsed((prev) => {
      if (!prev.has(targetId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  };

  const toggleCollapsed = (targetId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  };

  const isCategoryWithin = (ancestorId: string, candidateId: string) => {
    let cursor = candidateId;
    let guard = 0;
    while (cursor && guard < 50) {
      if (cursor === ancestorId) {
        return true;
      }
      cursor = findCategory(tree, cursor)?.parentId || '';
      guard += 1;
    }
    return false;
  };

  const openCreateCategory = (parentId?: string) => {
    if (parentId) {
      expandCategory(parentId);
    }
    setCategoryModal({ open: true, parentId });
    setCategoryName('');
  };

  const submitCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      toast('请输入分类名称', undefined, 'warn');
      return;
    }
    const result = await createCategory(kbId, name, categoryModal.parentId);
    if (!result) {
      return;
    }
    toast('已创建分类', name, 'success');
    setCategoryModal({ open: false });
    setCategoryName('');
    void loadTree();
  };

  const deleteCategory = async (targetId = categoryId) => {
    if (!targetId) {
      return;
    }
    const ok = await confirmAction({
      title: '删除当前分类？',
      sub: '分类下有子分类或资料时不允许删除。',
      confirmText: '删除',
    });
    if (!ok) {
      return;
    }
    const result = await removeCategory(targetId);
    if (result) {
      toast('已删除分类', undefined, 'success');
      onCategoryCleared(targetId);
    }
  };

  const beginRename = (node: CategoryNode) => {
    cancelRenameRef.current = false;
    setEditingCategoryId(node.categoryId);
    setEditingCategoryName(node.name);
  };

  const cancelRename = () => {
    cancelRenameRef.current = true;
    setEditingCategoryId('');
    setEditingCategoryName('');
  };

  const commitRename = async (node: CategoryNode) => {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    if (editingCategoryId !== node.categoryId) {
      return;
    }
    const name = editingCategoryName.trim();
    setEditingCategoryId('');
    setEditingCategoryName('');
    if (!name || name === node.name) {
      return;
    }
    const result = await renameCategory(node.categoryId, name);
    if (!result) {
      return;
    }
    toast('分类已重命名', `「${node.name}」→ ${name}`, 'success');
    void loadTree();
  };

  const moveMaterialTo = async (materialId: string, targetId: string) => {
    const item = treeMaterials.find((entry) => entry.materialId === materialId);
    if (!item || (item.categoryId || '') === targetId) {
      return;
    }
    setBusy(true);
    const result = await updateMaterialCategory(kbId, [materialId], targetId || undefined);
    setBusy(false);
    if (!result) {
      return;
    }
    const success = result.some((entry) => entry.success);
    const label = targetId ? findCategory(tree, targetId)?.name || '分类' : '未分类';
    toast(
      success ? '已调整分类' : '分类未调整',
      success ? `「${item.title}」→ ${label}` : result[0]?.message || '后端拒绝',
      success ? 'success' : 'warn',
    );
    if (success && targetId) {
      expandCategory(targetId);
    }
    onMaterialsChanged();
  };

  const moveCategoryTo = async (dragId: string, parentId?: string) => {
    if (dragId === parentId) {
      return;
    }
    if (parentId && isCategoryWithin(dragId, parentId)) {
      toast('不能移动到自己的子分类', '请改放到上层分类或根目录', 'warn');
      return;
    }
    const node = findCategory(tree, dragId);
    if ((node?.parentId || '') === (parentId || '')) {
      return;
    }
    setBusy(true);
    const result = await moveCategory(dragId, parentId);
    setBusy(false);
    if (!result) {
      return;
    }
    const targetName = parentId ? findCategory(tree, parentId)?.name || '分类' : '根目录';
    toast('分类已移动', `「${node?.name || '分类'}」→ ${targetName}`, 'success');
    if (parentId) {
      expandCategory(parentId);
    }
    void loadTree();
  };

  const dropProps = (targetId: string) => {
    const key = `cat:${targetId}`;
    return {
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        if (!canWrite || (!dragMaterialId && !dragCategoryId)) {
          return;
        }
        if (dragCategoryId && isCategoryWithin(dragCategoryId, targetId)) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTargetId((prev) => (prev === key ? prev : key));
      },
      onDragLeave: () => {
        setDropTargetId((prev) => (prev === key ? null : prev));
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const categoryDragId =
          event.dataTransfer.getData('application/x-kb-category') || dragCategoryId;
        const materialDragId = event.dataTransfer.getData('text/plain') || dragMaterialId;
        setDragCategoryId('');
        setDragMaterialId('');
        setDropTargetId(null);
        if (categoryDragId) {
          void moveCategoryTo(categoryDragId, targetId);
          return;
        }
        if (materialDragId) {
          void moveMaterialTo(materialDragId, targetId);
        }
      },
    };
  };

  // 树空白处就是根层级：把分类拖到空白处回到根，把资料拖到空白处移出文件夹
  const rootDropProps = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!canWrite || (!dragMaterialId && !dragCategoryId)) {
        return;
      }
      if (event.target !== event.currentTarget) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTargetId((prev) => (prev === 'root' ? prev : 'root'));
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      setDropTargetId((prev) => (prev === 'root' ? null : prev));
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      event.preventDefault();
      const categoryDragId =
        event.dataTransfer.getData('application/x-kb-category') || dragCategoryId;
      const materialDragId = event.dataTransfer.getData('text/plain') || dragMaterialId;
      setDragCategoryId('');
      setDragMaterialId('');
      setDropTargetId(null);
      if (categoryDragId) {
        void moveCategoryTo(categoryDragId);
        return;
      }
      if (materialDragId) {
        void moveMaterialTo(materialDragId, '');
      }
    },
  };

  return {
    tree,
    treeMaterials,
    libraryTotal,
    materialsByCategory,
    categoryCounts,
    collapsed,
    dragMaterialId,
    dragCategoryId,
    dropTargetId,
    setDragMaterialId,
    setDragCategoryId,
    setDropTargetId,
    editingCategoryId,
    editingCategoryName,
    setEditingCategoryName,
    categoryModal,
    setCategoryModal,
    categoryName,
    setCategoryName,
    loadTree,
    loadTreeMaterials,
    expandCategory,
    toggleCollapsed,
    isCategoryWithin,
    openCreateCategory,
    submitCategory,
    deleteCategory,
    beginRename,
    cancelRename,
    commitRename,
    moveCategoryTo,
    moveMaterialTo,
    dropProps,
    rootDropProps,
  };
}

export type MaterialTreeState = ReturnType<typeof useMaterialTree>;
