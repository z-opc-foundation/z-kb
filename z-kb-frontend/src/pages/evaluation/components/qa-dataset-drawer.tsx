import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import {
  publishEvalDataset,
  queryEvalDataset,
  saveEvalDatasetDraft,
  type EvalDatasetCase,
  type EvalDatasetDetail,
} from '@/services/evaluation';
import { toast } from '@/utils/toast';
import { useCallback, useEffect, useState } from 'react';
import {
  datasetStatusMeta,
  DrawerShell,
  EmptyState,
  ErrorState,
  fmtTime,
  LoadingState,
  StatusTag,
  Tag,
} from './shared';

interface QaDatasetDrawerProps {
  kbId: string;
  kbName: string;
  onClose: () => void;
  onChanged: () => void;
}

interface DraftCaseForm {
  key: string;
  caseNo: string;
  question: string;
  expectedAnswer: string;
  expectedBehavior: string;
  expectedEvidence: string;
  tags: string;
}

let draftKeySeed = 0;
function nextDraftKey(): string {
  draftKeySeed += 1;
  return `draft-${draftKeySeed}`;
}

function evidenceText(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function toDraftCase(item: EvalDatasetCase, index: number): DraftCaseForm {
  return {
    key: nextDraftKey(),
    caseNo: item.caseNo != null ? String(item.caseNo) : String(index + 1),
    question: item.question || '',
    expectedAnswer: item.expectedAnswer || '',
    expectedBehavior: item.expectedBehavior || 'ANSWER',
    expectedEvidence: evidenceText(item.expectedEvidence),
    tags: (item.tags || []).join(', '),
  };
}

function emptyDraftCase(index: number): DraftCaseForm {
  return {
    key: nextDraftKey(),
    caseNo: String(index + 1),
    question: '',
    expectedAnswer: '',
    expectedBehavior: 'ANSWER',
    expectedEvidence: '',
    tags: '',
  };
}

export default function QaDatasetDrawer({
  kbId,
  kbName,
  onClose,
  onChanged,
}: QaDatasetDrawerProps) {
  const [data, setData] = useState<EvalDatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cases, setCases] = useState<DraftCaseForm[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const result = await queryEvalDataset(kbId);
    setLoading(false);
    if (result === undefined) {
      setFailed(true);
      setData(null);
      return;
    }
    setData(Array.isArray(result) ? { dataset: null, cases: result } : result);
  }, [kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dataset = data?.dataset || null;
  const datasetCases = data?.cases || [];
  const status = datasetStatusMeta(dataset?.status);

  const startEdit = () => {
    setName(`${kbName || '知识库'} QA 集合`);
    setDescription('');
    setCases(datasetCases.map(toDraftCase));
    setFormError('');
    setMode('edit');
  };

  const updateCase = (key: string, patch: Partial<DraftCaseForm>) => {
    setCases((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const removeCase = (key: string) => {
    setCases((prev) => prev.filter((item) => item.key !== key));
  };

  const addCase = () => {
    setCases((prev) => [...prev, emptyDraftCase(prev.length)]);
  };

  const saveDraft = async () => {
    setFormError('');
    if (!cases.length) {
      setFormError('至少需要一道题。');
      return;
    }
    const seen = new Set<string>();
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const no = item.caseNo.trim();
      if (!no) {
        setFormError(`第 ${index + 1} 题缺少题号。`);
        return;
      }
      if (seen.has(no)) {
        setFormError(`题号 ${no} 重复。`);
        return;
      }
      seen.add(no);
      if (!item.question.trim()) {
        setFormError(`第 ${index + 1} 题缺少问题。`);
        return;
      }
      if (!['ANSWER', 'REFUSE'].includes(item.expectedBehavior)) {
        setFormError(`第 ${index + 1} 题期望行为只能是 ANSWER 或 REFUSE。`);
        return;
      }
      if (item.expectedEvidence.trim()) {
        try {
          JSON.parse(item.expectedEvidence);
        } catch (error) {
          setFormError(`第 ${index + 1} 题期望证据不是合法 JSON。`);
          return;
        }
      }
    }
    const payloadCases = cases.map((item) => ({
      caseNo: item.caseNo.trim(),
      question: item.question.trim(),
      expectedAnswer: item.expectedAnswer.trim(),
      expectedBehavior: item.expectedBehavior,
      expectedEvidence: item.expectedEvidence.trim()
        ? JSON.parse(item.expectedEvidence)
        : null,
      tags: item.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    }));
    setSaving(true);
    const result = await saveEvalDatasetDraft({
      kbId,
      name: name.trim() || `${kbName || '知识库'} QA 集合`,
      description: description.trim(),
      cases: payloadCases,
    });
    setSaving(false);
    if (result === undefined) {
      toast('草稿保存失败', 'saveDatasetDraft 返回异常，未切换页面状态。', 'error');
      return;
    }
    toast('QA 草稿已保存', `${payloadCases.length} 道题 · 尚未冻结`, 'success');
    setMode('view');
    await load();
    onChanged();
  };

  const publish = async () => {
    if (!dataset?.versionNo) {
      return;
    }
    setPublishing(true);
    const result = await publishEvalDataset({
      kbId,
      expectedVersionNo: dataset.versionNo,
    });
    setPublishing(false);
    if (result === undefined) {
      toast('发布失败', 'publishDataset 返回异常，版本未变更。', 'error');
      return;
    }
    toast('QA 集合已发布冻结', `${dataset.versionNo} · 发布后不可变`, 'success');
    setPublishOpen(false);
    await load();
    onChanged();
  };

  const viewBody = (
    <div>
      <div className="eval-dataset-head">
        <div className="eval-dataset-meta">
          <div className="logic-cell">
            <label>当前版本</label>
            <b className="mono">{dataset?.versionNo || '未配置'}</b>
          </div>
          <div className="logic-cell">
            <label>状态</label>
            <b>
              <StatusTag meta={status} />
            </b>
          </div>
          <div className="logic-cell">
            <label>题数</label>
            <b>{dataset?.caseCount ?? datasetCases.length}</b>
          </div>
          <div className="logic-cell">
            <label>发布时间</label>
            <b className="mono-sm">{fmtTime(dataset?.publishedAt)}</b>
          </div>
        </div>
        <div className="callout mt-16">
          <Icon name="lock" size={15} />
          <div className="ct">
            <b>发布即冻结</b>
            <p>
              发布后的 QA 版本不可变；后续修改需另存草稿并再次发布。草稿保存不会影响正在使用的冻结版本。
            </p>
          </div>
        </div>
      </div>

      <section className="eval-detail-section">
        <h4>题目列表</h4>
        {datasetCases.length ? (
          <div className="table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  <th>题号</th>
                  <th>问题</th>
                  <th>期望答案</th>
                  <th>行为</th>
                  <th>期望证据</th>
                  <th>标签</th>
                </tr>
              </thead>
              <tbody>
                {datasetCases.map((item, index) => (
                  <tr key={item.caseId || `${item.caseNo}-${index}`}>
                    <td className="mono-sm">{item.caseNo ?? index + 1}</td>
                    <td>
                      <b>{item.question}</b>
                    </td>
                    <td>{item.expectedAnswer || '—'}</td>
                    <td>
                      <Tag
                        tone={
                          String(item.expectedBehavior || '').toUpperCase() ===
                          'REFUSE'
                            ? 'amber'
                            : 'blue'
                        }
                        className="sm"
                      >
                        {String(item.expectedBehavior || '').toUpperCase() ===
                        'REFUSE'
                          ? '拒答'
                          : '作答'}
                      </Tag>
                    </td>
                    <td>
                      <span className="mono-sm ellipsis" title={evidenceText(item.expectedEvidence)}>
                        {item.expectedEvidence
                          ? evidenceText(item.expectedEvidence)
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <div className="tag-list">
                        {(item.tags || []).length
                          ? (item.tags || []).map((tag) => (
                              <Tag key={tag} tone="gray" className="sm">
                                {tag}
                              </Tag>
                            ))
                          : '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="list"
            title="尚无 QA 集合"
            description="当前库还没有题目。创建草稿后保存并发布，才可发起跑批。"
            action={
              <button className="btn primary" type="button" onClick={startEdit}>
                <Icon name="plus" size={13} />
                创建草稿
              </button>
            }
          />
        )}
      </section>
    </div>
  );

  const editBody = (
    <div>
      <div className="alert-banner target" style={{ marginBottom: 14 }}>
        <Icon name="edit" size={15} />
        <div className="txt">
          <b>草稿编辑</b>
          <span> — 期望行为 ANSWER / REFUSE；期望证据填写 JSON；保存草稿不会冻结版本。</span>
        </div>
      </div>
      <div className="eval-form-grid">
        <div className="field">
          <label>集合名称</label>
          <input
            className="input"
            value={name}
            placeholder={`${kbName || '知识库'} QA 集合`}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label>描述</label>
          <input
            className="input"
            value={description}
            placeholder="可选，说明覆盖范围与维护人"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>

      <div className="row between mt-16 mb-12">
        <div>
          <b style={{ fontSize: 12 }}>题目</b>
          <span className="note" style={{ marginLeft: 8 }}>
            {cases.length} 道
          </span>
        </div>
        <button className="btn sm" type="button" onClick={addCase}>
          <Icon name="plus" size={12} />
          添加题目
        </button>
      </div>

      {cases.length ? (
        <div className="eval-draft-list">
          {cases.map((item, index) => (
            <div className="eval-draft-card" key={item.key}>
              <div className="row between">
                <b>第 {index + 1} 题</b>
                <button
                  className="btn xs danger"
                  type="button"
                  onClick={() => removeCase(item.key)}
                >
                  <Icon name="trash" size={11} />
                  删除
                </button>
              </div>
              <div className="eval-form-grid mt-8">
                <div className="field">
                  <label>题号</label>
                  <input
                    className="input"
                    value={item.caseNo}
                    onChange={(event) =>
                      updateCase(item.key, { caseNo: event.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>期望行为</label>
                  <select
                    className="select"
                    value={item.expectedBehavior}
                    onChange={(event) =>
                      updateCase(item.key, {
                        expectedBehavior: event.target.value,
                      })
                    }
                  >
                    <option value="ANSWER">ANSWER · 作答</option>
                    <option value="REFUSE">REFUSE · 拒答</option>
                  </select>
                </div>
              </div>
              <div className="field mt-8">
                <label>
                  问题 <span className="req">*</span>
                </label>
                <textarea
                  className="textarea"
                  value={item.question}
                  onChange={(event) =>
                    updateCase(item.key, { question: event.target.value })
                  }
                />
              </div>
              <div className="field mt-8">
                <label>期望答案</label>
                <textarea
                  className="textarea"
                  value={item.expectedAnswer}
                  onChange={(event) =>
                    updateCase(item.key, { expectedAnswer: event.target.value })
                  }
                />
              </div>
              <div className="field mt-8">
                <label>期望证据 JSON</label>
                <textarea
                  className="textarea mono"
                  value={item.expectedEvidence}
                  placeholder='{"materialId":"...","chunkId":"..."}'
                  onChange={(event) =>
                    updateCase(item.key, {
                      expectedEvidence: event.target.value,
                    })
                  }
                />
              </div>
              <div className="field mt-8">
                <label>标签</label>
                <input
                  className="input"
                  value={item.tags}
                  placeholder="逗号分隔，例如：召回, 生成"
                  onChange={(event) =>
                    updateCase(item.key, { tags: event.target.value })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="list"
          title="还没有题目"
          description="添加至少一道题后才能保存草稿。"
          action={
            <button className="btn primary" type="button" onClick={addCase}>
              <Icon name="plus" size={13} />
              添加第一道题
            </button>
          }
        />
      )}

      {formError ? (
        <div className="callout danger mt-16">
          <Icon name="alert-circle" size={15} />
          <div className="ct">
            <b>草稿校验未通过</b>
            <p>{formError}</p>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <DrawerShell
        icon="list"
        width={940}
        title="QA 集合"
        sub={
          <>
            <span className="mono">{kbId}</span>
            {dataset?.versionNo ? <Tag tone="gray" className="sm">{dataset.versionNo}</Tag> : null}
            <StatusTag meta={status} />
            <span>{mode === 'edit' ? '草稿编辑' : '当前版本'}</span>
          </>
        }
        onClose={() => {
          if (!publishOpen) {
            onClose();
          }
        }}
        footLeft={
          mode === 'edit'
            ? '保存草稿不冻结；发布后不可变'
            : 'QA 集合一库一份；发布后版本不可变'
        }
        footRight={
          mode === 'edit' ? (
            <>
              <button
                className="btn"
                type="button"
                disabled={saving}
                onClick={() => {
                  setMode('view');
                  setFormError('');
                }}
              >
                查看当前版本
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
              >
                {saving ? <span className="spinner" /> : <Icon name="check" size={12} />}
                保存草稿
              </button>
            </>
          ) : (
            <>
              <button className="btn" type="button" onClick={startEdit}>
                <Icon name="edit" size={12} />
                编辑草稿
              </button>
              <button
                className="btn primary-soft"
                type="button"
                disabled={!dataset?.versionNo}
                onClick={() => setPublishOpen(true)}
              >
                <Icon name="lock" size={12} />
                发布冻结
              </button>
            </>
          )
        }
        body={
          loading ? (
            <LoadingState title="正在加载 QA 集合…" />
          ) : failed ? (
            <ErrorState
              title="QA 集合加载失败"
              description="queryDataset 返回异常；不把空结果当成没有集合。"
              onRetry={() => void load()}
            />
          ) : mode === 'edit' ? (
            editBody
          ) : (
            viewBody
          )
        }
      />

      {publishOpen && dataset?.versionNo ? (
        <AppModal
          icon="lock"
          title="发布并冻结 QA 集合"
          sub="发布前二次确认"
          width={560}
          onClose={() => setPublishOpen(false)}
          footLeft="发布后该版本不可变，跑批会固定引用它"
          footRight={
            <>
              <button className="btn" type="button" onClick={() => setPublishOpen(false)}>
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={publishing}
                onClick={() => void publish()}
              >
                {publishing ? <span className="spinner" /> : <Icon name="lock" size={12} />}
                确认发布
              </button>
            </>
          }
          body={
            <div>
              <div className="callout warn">
                <Icon name="alert-triangle" size={15} />
                <div className="ct">
                  <b>发布后不可变</b>
                  <p>
                    将冻结 QA 版本 <span className="mono">{dataset.versionNo}</span>（
                    {dataset.caseCount ?? datasetCases.length} 题）。发布后不能再修改该版本，后续调整需保存新草稿并再次发布。
                  </p>
                </div>
              </div>
              <dl className="kv mt-16">
                <dt>知识库</dt>
                <dd>{kbName || kbId}</dd>
                <dt>版本</dt>
                <dd className="mono">{dataset.versionNo}</dd>
                <dt>题数</dt>
                <dd>{dataset.caseCount ?? datasetCases.length}</dd>
                <dt>当前状态</dt>
                <dd>
                  <StatusTag meta={status} />
                </dd>
              </dl>
            </div>
          }
        />
      ) : null}
    </>
  );
}
