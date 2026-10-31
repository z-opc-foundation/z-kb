import { describe, expect, it } from 'vitest';
import {
  JOB_STATUS,
  MATERIAL_STATUS,
  PARSE_STATUS,
  SOURCE_TYPE_LABEL,
  STAGE_LABEL,
  STAGE_STATUS,
  VERSION_STATUS,
} from './material-status';

describe('资料相关状态字典', () => {
  it('资料状态包含四个阶段', () => {
    expect(MATERIAL_STATUS.REGISTERED).toEqual({ label: '已登记', tag: 'blue' });
    expect(MATERIAL_STATUS.ACTIVE).toEqual({ label: '生效', tag: 'green' });
    expect(MATERIAL_STATUS.UPDATING.label).toBe('更新中');
    expect(MATERIAL_STATUS.DELETED.label).toBe('已删除');
    expect(Object.keys(MATERIAL_STATUS)).toHaveLength(4);
  });

  it('解析状态包含成功、进行中与失败', () => {
    expect(PARSE_STATUS.READY).toEqual({ label: '已解析', tag: 'green' });
    expect(PARSE_STATUS.PARSING.tag).toBe('amber');
    expect(PARSE_STATUS.FAILED.tag).toBe('red');
  });

  it('编译任务状态覆盖终止态', () => {
    expect(Object.keys(JOB_STATUS)).toEqual([
      'QUEUED',
      'RUNNING',
      'PAUSED',
      'COMPLETED',
      'FAILED',
      'CANCELED',
    ]);
    expect(JOB_STATUS.COMPLETED.label).toBe('已完成');
    expect(JOB_STATUS.CANCELED.tag).toBe('gray');
  });

  it('阶段状态与阶段标签一一对应', () => {
    expect(STAGE_STATUS.SUCCEEDED).toEqual({ label: '成功', tag: 'green' });
    expect(STAGE_STATUS.SKIPPED.tag).toBe('gray');
    expect(STAGE_LABEL.REGISTER).toBe('P0 登记');
    for (const stage of ['REGISTER', 'PARSE', 'CHUNK', 'INDEX', 'EXTRACT']) {
      expect(STAGE_LABEL[stage]).toBeTruthy();
    }
    expect(STAGE_LABEL.WIKI).toBe('Wiki 编译');
  });

  it('版本状态区分解析与替换', () => {
    expect(VERSION_STATUS.PARSED.label).toBe('已解析');
    expect(VERSION_STATUS.SUPERSEDED).toEqual({ label: '已被替换', tag: 'gray' });
    expect(VERSION_STATUS.FAILED.tag).toBe('red');
  });

  it('来源类型目前只有本地上传', () => {
    expect(SOURCE_TYPE_LABEL.LOCAL).toBe('本地上传');
  });
});
