import { describe, expect, it } from 'vitest';
import { MATERIAL_DETAIL_TABS, resolveMaterialDetailTab } from './material-detail-tabs';

describe('资料详情页签解析', () => {
  it('预置八个页签且顺序稳定', () => {
    expect(MATERIAL_DETAIL_TABS.map((tab) => tab.key)).toEqual([
      'basic',
      'versions',
      'draft',
      'compile',
      'compare',
      'wiki',
      'graph',
      'knowledge',
    ]);
    expect(MATERIAL_DETAIL_TABS[0].label).toBe('基本信息');
    expect(MATERIAL_DETAIL_TABS[3].label).toBe('编译');
  });

  it('已知页签原样返回', () => {
    for (const tab of MATERIAL_DETAIL_TABS) {
      expect(resolveMaterialDetailTab(tab.key)).toBe(tab.key);
    }
  });

  it('未知、空值与缺省值回落到基本信息', () => {
    expect(resolveMaterialDetailTab('unknown')).toBe('basic');
    expect(resolveMaterialDetailTab('')).toBe('basic');
    expect(resolveMaterialDetailTab(null)).toBe('basic');
    expect(resolveMaterialDetailTab(undefined)).toBe('basic');
  });

  it('大小写敏感，不做模糊匹配', () => {
    expect(resolveMaterialDetailTab('WIKI')).toBe('basic');
    expect(resolveMaterialDetailTab(' versions ')).toBe('basic');
  });
});
