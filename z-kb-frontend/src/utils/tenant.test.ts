import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TENANT_CODE,
  getActorId,
  getTenantCode,
  getTenantInfo,
  setTenantCode,
  TENANTS,
} from './tenant';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('租户上下文', () => {
  it('默认返回内置未来医院租户', () => {
    expect(DEFAULT_TENANT_CODE).toBe('future_hospital');
    expect(TENANTS).toEqual([{ code: 'future_hospital', name: '未来医院', mark: '未' }]);
    expect(getTenantCode()).toBe(DEFAULT_TENANT_CODE);
    expect(getTenantInfo()).toEqual(TENANTS[0]);
  });

  it('读取并保存本地租户编码', () => {
    setTenantCode('tenant-b');
    expect(localStorage.getItem('future-knowledge.tenant-code')).toBe('tenant-b');
    expect(getTenantCode()).toBe('tenant-b');
  });

  it('未知租户用编码生成名称与首字母标记', () => {
    expect(getTenantInfo('custom')).toEqual({ code: 'custom', name: 'custom', mark: 'C' });
    expect(getTenantInfo('tenant-b').mark).toBe('T');
  });

  it('显式传入租户编码优先于本地存储', () => {
    setTenantCode('tenant-b');
    expect(getTenantInfo('future_hospital').name).toBe('未来医院');
  });

  it('本地存储不可用时回退默认租户且不抛错', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getTenantCode()).toBe(DEFAULT_TENANT_CODE);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setTenantCode('tenant-b')).not.toThrow();
  });

  it('本地操作人 ID 非法时回退 1', () => {
    expect(getActorId()).toBe(1);
  });
});
