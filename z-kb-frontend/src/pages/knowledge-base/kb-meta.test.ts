import { describe, expect, it } from 'vitest';
import { statusMeta, TYPE_META, typeMeta } from './kb-meta';

describe('知识库类型与状态元数据', () => {
  it('五种知识库类型都有中文名与图标', () => {
    expect(Object.keys(TYPE_META)).toEqual(['FILE', 'MIX', 'YUQUE', 'CODE', 'DATABASE']);
    expect(TYPE_META.FILE).toEqual({ label: '文件库', icon: 'file-text' });
    expect(TYPE_META.MIX.label).toBe('混合库');
    expect(TYPE_META.DATABASE.icon).toBe('database');
  });

  it('typeMeta 命中已知类型', () => {
    expect(typeMeta('MIX')).toEqual({ label: '混合库', icon: 'layers' });
    expect(typeMeta('CODE').label).toBe('代码库');
  });

  it('typeMeta 对未知类型回落到文件库', () => {
    expect(typeMeta('UNKNOWN' as never)).toEqual(TYPE_META.FILE);
  });

  it('statusMeta 覆盖运行中、归档、删除中', () => {
    expect(statusMeta('ACTIVE')).toEqual({ label: '运行中', kind: 'success', tag: 'green' });
    expect(statusMeta('ARCHIVED')).toEqual({ label: '已归档', kind: 'neutral', tag: 'gray' });
    expect(statusMeta('DELETING')).toEqual({ label: '删除中', kind: 'danger', tag: 'red' });
  });

  it('statusMeta 未知状态原样展示，空状态显示未知', () => {
    expect(statusMeta('PAUSED')).toEqual({ label: 'PAUSED', kind: 'neutral', tag: 'gray' });
    expect(statusMeta('')).toEqual({ label: '未知', kind: 'neutral', tag: 'gray' });
  });
});
