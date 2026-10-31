import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelCompilation,
  getCompilationByJob,
  getCompilationByMaterial,
  isCompilationActive,
  listCompilationChunks,
  retryCompilation,
  runCompilation,
  type CompilationJobRecord,
  type RetrievalChunkRecord,
} from '@/services/compilation';
import {
  getMaterial,
  reparseMaterial,
  reviseMaterial,
  saveDraftText,
  type MaterialDetailRecord,
} from '@/services/material';
import { toast } from '@/utils/toast';
import { COMPILE_POLL_MS } from '../material-workspace-model';
import { resolveMaterialDetailTab, type MaterialDetailTab } from '../material-detail-tabs';
import { JOB_STATUS } from '../material-status';

interface UseMaterialDetailParams {
  kbId: string;
  initialMaterialId?: string;
  initialDetailTab?: MaterialDetailTab | 'compile';
  onDetailClosed?: () => void;
  onMaterialsChanged: () => void;
}

export function useMaterialDetail({
  kbId,
  initialMaterialId,
  initialDetailTab,
  onDetailClosed,
  onMaterialsChanged,
}: UseMaterialDetailParams) {
  const [detailId, setDetailId] = useState('');
  const [detail, setDetail] = useState<MaterialDetailRecord | null>(null);
  const [detailTab, setDetailTab] = useState<MaterialDetailTab>('basic');
  const [compareMode, setCompareMode] = useState<'version' | 'draft' | null>(null);
  const [versionUploading, setVersionUploading] = useState(false);
  const [reparseBusy, setReparseBusy] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [compilation, setCompilation] = useState<CompilationJobRecord | null>(null);
  const [compilationLoading, setCompilationLoading] = useState(false);
  const [compileBusy, setCompileBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const [chunks, setChunks] = useState<RetrievalChunkRecord[]>([]);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const materialsChangedRef = useRef(onMaterialsChanged);
  useEffect(() => {
    materialsChangedRef.current = onMaterialsChanged;
  }, [onMaterialsChanged]);

  const loadCompilation = useCallback(async (materialId: string) => {
    setCompilationLoading(true);
    const job = await getCompilationByMaterial(materialId);
    setCompilation(job || null);
    if (job) {
      const list = await listCompilationChunks(materialId, job.materialVersionId);
      setChunks(list || []);
    } else {
      setChunks([]);
    }
    setCompilationLoading(false);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollCompilation = useCallback(
    (jobId: string) => {
      stopPolling();
      const tick = async () => {
        const job = await getCompilationByJob(jobId);
        if (!job) {
          pollTimerRef.current = null;
          return;
        }
        setCompilation((prev) => (prev && prev.jobId === jobId ? job : prev));
        if (isCompilationActive(job.runStatus)) {
          pollTimerRef.current = window.setTimeout(tick, COMPILE_POLL_MS);
          return;
        }
        pollTimerRef.current = null;
        if (job.runStatus === 'COMPLETED') {
          toast(job.reused ? '该版本已编译' : '编译完成',
            `M1 已达成 · 检索块 ${job.chunkCount} 个`, 'success');
          const list = await listCompilationChunks(job.materialId, job.materialVersionId);
          setChunks(list || []);
          materialsChangedRef.current();
        } else if (job.runStatus === 'CANCELED') {
          toast('编译已取消', job.failureSummary || '后续阶段未执行', 'warn');
        } else {
          toast('编译未完成', job.failureSummary || job.runStatus, 'warn');
        }
      };
      pollTimerRef.current = window.setTimeout(tick, COMPILE_POLL_MS);
    },
    [stopPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const openDetail = async (materialId: string) => {
    stopPolling();
    setDetailId(materialId);
    setDetail(null);
    setCompilation(null);
    setChunks([]);
    setDetailTab(resolveMaterialDetailTab(initialDetailTab));
    void loadCompilation(materialId);
    const result = await getMaterial(materialId);
    if (result) {
      setDetail(result);
    }
  };

  const closeDetail = () => {
    stopPolling();
    setCompareMode(null);
    setCompilation(null);
    setChunks([]);
    setDetailId('');
    setDetail(null);
    onDetailClosed?.();
  };

  useEffect(() => {
    if (initialMaterialId) {
      void openDetail(initialMaterialId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMaterialId]);

  const submitCompile = async () => {
    if (!detail) {
      return;
    }
    setCompileBusy(true);
    const job = await runCompilation(detail.material.materialId,
      detail.material.currentVersionId || undefined);
    setCompileBusy(false);
    if (!job) {
      return;
    }
    setCompilation(job);
    setDetailTab('basic');
    if (isCompilationActive(job.runStatus)) {
      toast('编译已提交', `任务已进入队列 · ${job.taskStatus || job.runStatus}`, 'success');
      pollCompilation(job.jobId);
      return;
    }
    if (job.runStatus === 'COMPLETED') {
      toast(job.reused ? '该版本已编译' : '编译完成',
        `M1 已达成 · 检索块 ${job.chunkCount} 个`, 'success');
      materialsChangedRef.current();
    } else {
      toast('编译未完成', job.failureSummary || job.runStatus, 'warn');
    }
    const list = await listCompilationChunks(job.materialId, job.materialVersionId);
    setChunks(list || []);
  };

  const submitRerun = async () => {
    if (!compilation) {
      return;
    }
    setCompileBusy(true);
    const job = await retryCompilation(compilation.jobId, 'REGISTER');
    setCompileBusy(false);
    if (!job) {
      return;
    }
    setConfirmRerun(false);
    setCompilation(job);
    if (isCompilationActive(job.runStatus)) {
      toast('重跑已提交', `任务已进入队列 · ${job.taskStatus || job.runStatus}`, 'success');
      pollCompilation(job.jobId);
      return;
    }
    if (job.runStatus === 'COMPLETED') {
      toast('已从 P0 重跑', `检索块 ${job.chunkCount} 个`, 'success');
    } else {
      toast('重跑未完成', job.failureSummary || job.runStatus, 'warn');
    }
    const list = await listCompilationChunks(job.materialId, job.materialVersionId);
    setChunks(list || []);
  };

  const cancelCompile = async () => {
    if (!compilation) {
      return;
    }
    setCancelBusy(true);
    const job = await cancelCompilation(compilation.jobId);
    setCancelBusy(false);
    if (!job) {
      return;
    }
    setCompilation(job);
    if (isCompilationActive(job.runStatus)) {
      toast('取消已提交', '任务将在阶段边界停止', 'warn');
      pollCompilation(job.jobId);
      return;
    }
    stopPolling();
    if (job.runStatus === 'CANCELED') {
      toast('编译已取消', job.failureSummary || '后续阶段未执行', 'warn');
      return;
    }
    toast('任务已结束', `当前状态 ${JOB_STATUS[job.runStatus]?.label || job.runStatus}`, 'warn');
  };

  const submitRevise = async (file: File | undefined) => {
    if (!file || !detailId) {
      return;
    }
    setVersionUploading(true);
    const result = await reviseMaterial(kbId, detailId, file);
    setVersionUploading(false);
    if (!result) {
      return;
    }
    toast(result.success ? '新版本已登记' : '新版本未登记', result.message,
      result.success ? 'success' : 'warn');
    if (result.success) {
      const refreshed = await getMaterial(detailId);
      if (refreshed) {
        setDetail(refreshed);
      }
      materialsChangedRef.current();
    }
  };

  const submitReparse = async () => {
    if (!detailId) {
      return;
    }
    setReparseBusy(true);
    const result = await reparseMaterial(detailId, detail?.material.currentVersionId || undefined);
    setReparseBusy(false);
    if (!result) {
      return;
    }
    toast('已重新解析', result.status === 'READY' ? '解析稿已更新' : result.failureReason || result.status,
      result.status === 'READY' ? 'success' : 'warn');
    const refreshed = await getMaterial(detailId);
    if (refreshed) {
      setDetail(refreshed);
    }
    materialsChangedRef.current();
  };

  const submitDraftText = async (textContent: string) => {
    if (!detailId) {
      return false;
    }
    setDraftSaving(true);
    const result = await saveDraftText(
      detailId,
      textContent,
      detail?.material.currentVersionId || undefined,
    );
    setDraftSaving(false);
    if (!result) {
      return false;
    }
    toast('解析稿已保存', '已生成新解析稿（旧稿保留），重新编译后应用到 Wiki', 'success');
    const refreshed = await getMaterial(detailId);
    if (refreshed) {
      setDetail(refreshed);
    }
    materialsChangedRef.current();
    return true;
  };

  const draftExcerpt = (detail?.currentDraft?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const materialAskQuestion = detail
    ? `请介绍资料「${detail.material.title}」的主要内容、可引用要点与适用场景，并标注引用来源。${
        draftExcerpt ? `资料开头片段：${draftExcerpt}` : ''
      }`
    : undefined;

  return {
    detailId,
    detail,
    detailTab,
    setDetailTab,
    compareMode,
    setCompareMode,
    versionUploading,
    reparseBusy,
    draftSaving,
    compilation,
    compilationLoading,
    compileBusy,
    cancelBusy,
    confirmRerun,
    setConfirmRerun,
    chunks,
    versionInputRef,
    materialAskQuestion,
    openDetail,
    closeDetail,
    submitCompile,
    submitRerun,
    cancelCompile,
    submitRevise,
    submitReparse,
    submitDraftText,
  };
}

export type MaterialDetailState = ReturnType<typeof useMaterialDetail>;
