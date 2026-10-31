import { beforeEach, describe, expect, it } from 'vitest';
import type { EvalRunRecord } from '@/services/evaluation';
import { mergeRunRecords, readKnownRuns, writeKnownRuns } from './run-cache';

const KEY = 'future-knowledge.eval-runs.future_hospital.kb-1';

function run(
  runId: string,
  finishedAt?: string,
  extra: Partial<EvalRunRecord> = {},
): EvalRunRecord {
  return { runId, finishedAt, ...extra };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('run-cache 会话缓存', () => {
  it('未写入时返回空数组', () => {
    expect(readKnownRuns('kb-1')).toEqual([]);
  });

  it('写入后可读回同一批跑批记录', () => {
    writeKnownRuns('kb-1', [run('run-1', '2026-10-20T10:00:00')]);
    expect(readKnownRuns('kb-1')).toEqual([
      { runId: 'run-1', finishedAt: '2026-10-20T10:00:00' },
    ]);
  });

  it('写入最多保留 30 条', () => {
    const runs = Array.from({ length: 35 }, (_, index) =>
      run(`run-${index}`, `2026-10-01T00:00:${String(index).padStart(2, '0')}`),
    );
    writeKnownRuns('kb-1', runs);
    expect(readKnownRuns('kb-1')).toHaveLength(30);
    expect(readKnownRuns('kb-1')[0].runId).toBe('run-0');
  });

  it('损坏 JSON 或非数组内容回退为空数组', () => {
    sessionStorage.setItem(KEY, '{bad json');
    expect(readKnownRuns('kb-1')).toEqual([]);

    sessionStorage.setItem(KEY, JSON.stringify({ runId: 'x' }));
    expect(readKnownRuns('kb-1')).toEqual([]);
  });

  it('按租户与知识库隔离', () => {
    writeKnownRuns('kb-1', [run('run-1')]);
    localStorage.setItem('future-knowledge.tenant-code', 'other_hospital');
    expect(readKnownRuns('kb-1')).toEqual([]);

    writeKnownRuns('kb-1', [run('run-2')]);
    expect(readKnownRuns('kb-1')).toEqual([{ runId: 'run-2' }]);

    localStorage.setItem('future-knowledge.tenant-code', 'future_hospital');
    expect(readKnownRuns('kb-1')).toEqual([{ runId: 'run-1' }]);
  });
});

describe('run-cache 合并', () => {
  it('相同 runId 合并字段并按完成时间倒序', () => {
    const merged = mergeRunRecords(
      [
        run('run-1', '2026-10-18T10:00:00', { status: 'RUNNING' }),
        run('run-2', '2026-10-19T10:00:00'),
      ],
      [
        run('run-1', '2026-10-20T10:00:00', {
          status: 'COMPLETED',
          resultUsable: true,
        }),
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      runId: 'run-1',
      status: 'COMPLETED',
      resultUsable: true,
      finishedAt: '2026-10-20T10:00:00',
    });
    expect(merged[1].runId).toBe('run-2');
  });

  it('忽略缺少 runId 的入参并剔除 undefined 字段', () => {
    const merged = mergeRunRecords([], [
      { runId: '' },
      { runId: 'run-1', status: undefined, finishedAt: undefined },
    ]);
    expect(merged).toEqual([{ runId: 'run-1' }]);
  });

  it('无时间的记录排在最后，结果最多 30 条', () => {
    const current = Array.from({ length: 30 }, (_, index) =>
      run(`old-${index}`, `2026-09-01T00:00:${String(index).padStart(2, '0')}`),
    );
    const merged = mergeRunRecords(current, [
      run('no-time'),
      run('newest', '2026-10-30T10:00:00'),
      run('invalid-time', 'not-a-date'),
    ]);
    expect(merged).toHaveLength(30);
    expect(merged[0].runId).toBe('newest');
    expect(merged.find((item) => item.runId === 'no-time')).toBeUndefined();
    expect(merged.find((item) => item.runId === 'invalid-time')).toBeUndefined();
    expect(merged[merged.length - 1].runId).toBe('old-1');
    expect(merged.find((item) => item.runId === 'old-0')).toBeUndefined();
  });

  it('缺少时间或时间非法的记录排在有效时间之后', () => {
    const merged = mergeRunRecords(
      [run('no-time'), run('invalid', 'not-a-date')],
      [run('dated', '2026-10-01T10:00:00')],
    );
    expect(merged.map((item) => item.runId)).toEqual([
      'dated',
      'no-time',
      'invalid',
    ]);
  });

  it('空入参不改变已有记录', () => {
    const current = [run('run-1', '2026-10-20T10:00:00')];
    expect(mergeRunRecords(current, [])).toEqual(current);
  });
});
