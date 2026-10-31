import { useState } from 'react';
import AppModal from '@/components/app-modal';
import Icon from '@/components/icon';
import type { ScheduleTaskType } from '@/services/taskSchedule';

const MAX_THREAD = 64;
const MAX_FETCH = 5000;

/** 在线改线程数与每批取数：两项整份写回任务类型，范围与后端 52_003 校验一致。 */
export default function ScheduleConfigModal({
  taskType,
  saving,
  onClose,
  onSubmit,
}: {
  taskType: ScheduleTaskType;
  saving: boolean;
  onClose: () => void;
  onSubmit: (threadNumber: number, fetchDataNumber: number) => void;
}) {
  const [threadNumber, setThreadNumber] = useState(String(taskType.threadNumber));
  const [fetchDataNumber, setFetchDataNumber] = useState(String(taskType.fetchDataNumber));
  const [formError, setFormError] = useState('');

  const thread = Number(threadNumber);
  const fetchCount = Number(fetchDataNumber);
  const belowSuggest = thread > 0 && fetchCount > 0 && fetchCount < thread * 10;

  const submit = () => {
    if (!Number.isInteger(thread) || thread < 1 || thread > MAX_THREAD) {
      setFormError(`线程数需为 1~${MAX_THREAD} 的整数`);
      return;
    }
    if (!Number.isInteger(fetchCount) || fetchCount < 1 || fetchCount > MAX_FETCH) {
      setFormError(`每批取数需为 1~${MAX_FETCH} 的整数`);
      return;
    }
    setFormError('');
    onSubmit(thread, fetchCount);
  };

  return (
    <AppModal
      icon="settings"
      title="调整运行参数"
      sub={`任务类型 ${taskType.baseTaskType}，整份写回 ZK 并触发节点刷新。`}
      width={620}
      onClose={onClose}
      body={
        <div className="form-grid">
          <div className="field">
            <label>
              线程数<span className="req">*</span>
            </label>
            <input
              className="input mono"
              type="number"
              min={1}
              max={MAX_THREAD}
              value={threadNumber}
              onChange={(event) => setThreadNumber(event.target.value)}
            />
            <span className="help">
              每个节点起的消费线程数；只在节点重建（暂停→恢复或重启）后按新值起线程
            </span>
          </div>
          <div className="field">
            <label>
              每批取数<span className="req">*</span>
            </label>
            <input
              className="input mono"
              type="number"
              min={1}
              max={MAX_FETCH}
              value={fetchDataNumber}
              onChange={(event) => setFetchDataNumber(event.target.value)}
            />
            <span className="help">单次认领条数，保存后下一次取数即生效</span>
          </div>
          {belowSuggest ? (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="help">
                每批取数低于线程数×10，调度器会记性能告警，建议适当调大
              </span>
            </div>
          ) : null}
          {formError ? (
            <div className="error" style={{ color: 'var(--red)' }}>
              {formError}
            </div>
          ) : null}
        </div>
      }
      footLeft="分片数不在此修改：改分片需重建任务项，部分 id 会短时无人认领"
      footRight={
        <>
          <button className="btn" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" type="button" disabled={saving} onClick={submit}>
            <Icon name="check" size={13} />
            {saving ? '保存中…' : '保存'}
          </button>
        </>
      }
    />
  );
}
