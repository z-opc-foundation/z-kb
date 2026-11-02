import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import {
  createEvalRun,
  type EvalCreateRunResult,
  type EvalOverview,
  type EvalRunRecord,
} from '@/services/evaluation';
import { toast } from '@/utils/toast';
import { useMemo, useState } from 'react';
import { datasetStatusMeta, fmtTime, StatusTag } from './shared';

interface RunCreateModalProps {
  kbId: string;
  overview?: EvalOverview | null;
  knownRuns: EvalRunRecord[];
  defaultBaselineRunId?: string;
  onClose: () => void;
  onCreated: (result: EvalCreateRunResult) => void;
}

export default function RunCreateModal({
  kbId,
  overview,
  knownRuns,
  defaultBaselineRunId,
  onClose,
  onCreated,
}: RunCreateModalProps) {
  const dataset = overview?.dataset;
  const datasetVersion = dataset?.versionNo || '';
  const statusKey = String(dataset?.status || '').toUpperCase();
  const frozen =
    !statusKey || ['FROZEN', 'PUBLISHED', 'ACTIVE'].includes(statusKey);
  const canRun = !!datasetVersion && frozen;
  const [baselineRunId, setBaselineRunId] = useState(defaultBaselineRunId || '');
  const [submitting, setSubmitting] = useState(false);
  const status = datasetStatusMeta(dataset?.status);
  const options = useMemo(
    () => knownRuns.filter((item) => item.runId),
    [knownRuns],
  );

  const submit = async () => {
    if (!canRun) {
      return;
    }
    setSubmitting(true);
    const result = await createEvalRun({
      kbId,
      ...(datasetVersion ? { datasetVersionNo: datasetVersion } : {}),
      ...(baselineRunId ? { baselineRunId } : {}),
      allowReuse: true,
    });
    setSubmitting(false);
    if (result === undefined) {
      toast('发起跑批失败', 'createRun 返回异常；未跳转，也未写入本地结果。', 'error');
      return;
    }
    toast(
      result.reused ? '已复用同口径跑批' : '跑批已发起',
      `${result.runId}${result.reused ? ' · reused=true' : ''}`,
      result.reused ? 'info' : 'success',
    );
    onCreated(result);
  };

  return (
    <AppModal
      icon="play"
      title="发起跑批"
      sub="固定 QA 集合版本与本次基线；编译、审批与索引完成后自助自查"
      width={620}
      onClose={onClose}
      footLeft="同库、同数据集、同配置、同 Judge 两小时内已完成时优先复用"
      footRight={
        <>
          <button className="btn" type="button" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={submitting || !canRun}
            onClick={() => void submit()}
          >
            {submitting ? <span className="spinner" /> : <Icon name="play" size={12} />}
            发起跑批
          </button>
        </>
      }
      body={
        <div>
          {!datasetVersion ? (
            <div className="callout warn">
              <Icon name="alert-triangle" size={15} />
              <div className="ct">
                <b>尚无可用 QA 版本</b>
                <p>先在「编辑 QA 集合」中保存草稿并发布冻结，再发起跑批。</p>
              </div>
            </div>
          ) : !frozen ? (
            <div className="callout warn">
              <Icon name="lock" size={15} />
              <div className="ct">
                <b>当前 QA 版本尚未冻结</b>
                <p>
                  数据集状态为「{status.label}」。发布冻结后才能发起跑批，避免边改题边出结果。
                </p>
              </div>
            </div>
          ) : (
            <div className="callout success">
              <Icon name="check-circle" size={15} />
              <div className="ct">
                <b>QA 版本已冻结</b>
                <p>本次跑批会固定该版本、配置版本与 Judge 版本。</p>
              </div>
            </div>
          )}

          <div className="field mt-16">
            <label>QA 版本</label>
            <select
              className="select"
              value={datasetVersion}
              disabled
              title="当前契约只返回最新冻结版本"
            >
              {datasetVersion ? (
                <option value={datasetVersion}>
                  {datasetVersion} · {status.label} · {dataset?.caseCount ?? '—'} 题
                </option>
              ) : (
                <option value="">无可用版本</option>
              )}
            </select>
            <span className="help">
              默认最新冻结版本；当前接口未提供版本列表，只展示 overview 返回的最新版本。
            </span>
          </div>

          <div className="field mt-12">
            <label>基线跑批（可选）</label>
            <select
              className="select"
              value={baselineRunId}
              onChange={(event) => setBaselineRunId(event.target.value)}
            >
              <option value="">不指定基线</option>
              {options.map((item) => (
                <option key={item.runId} value={item.runId}>
                  {item.runId}
                  {item.datasetVersionNo ? ` · ${item.datasetVersionNo}` : ''}
                  {item.finishedAt ? ` · ${fmtTime(item.finishedAt)}` : ''}
                </option>
              ))}
            </select>
            <span className="help">
              基线用于历史对照；数据集、配置、Judge 或覆盖范围不同时不会计算 Δ。
            </span>
          </div>

          <div className="mt-16">
            <dl className="kv">
              <dt>知识库</dt>
              <dd className="mono">{kbId}</dd>
              <dt>数据集</dt>
              <dd className="mono">{datasetVersion || '—'}</dd>
              <dt>数据集状态</dt>
              <dd>
                <StatusTag meta={status} />
              </dd>
              <dt>复用策略</dt>
              <dd>allowReuse = true</dd>
              <dt>基线</dt>
              <dd className="mono">{baselineRunId || '不指定'}</dd>
            </dl>
          </div>

          <div className="callout mt-16">
            <Icon name="info" size={15} />
            <div className="ct">
              <b>同步返回后跳转本次结果</b>
              <p>
                发起成功后跳到 ?view=result&amp;runId=…；若后端返回 reused=true，会在结果页显示复用提示。
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
}
