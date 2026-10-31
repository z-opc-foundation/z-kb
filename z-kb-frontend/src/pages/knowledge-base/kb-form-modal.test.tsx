import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeBaseRecord } from '@/services/knowledgeBase';

vi.mock('@/services/knowledgeBase', () => ({
  createKnowledgeBase: vi.fn(),
  updateKnowledgeBase: vi.fn(),
}));

vi.mock('@/services/sso', () => ({
  queryCurrentUser: vi.fn(),
}));

import { createKnowledgeBase, updateKnowledgeBase } from '@/services/knowledgeBase';
import { queryCurrentUser } from '@/services/sso';
import KbFormModal from './kb-form-modal';

const KB: KnowledgeBaseRecord = {
  kbId: 'kb-1',
  tenantCode: 'future_hospital',
  name: '护理知识库',
  code: 'kb_nursing',
  type: 'FILE',
  status: 'ACTIVE',
  description: '护理制度与流程',
  ownerId: 7,
  embeddingModel: 'bge-m3',
  createBy: 7,
  createTime: '2026-09-01T08:00:00',
  updateBy: 7,
  updateTime: '2026-10-01T09:30:00',
  canManage: true,
};

describe('知识库表单弹窗', () => {
  beforeEach(() => {
    vi.mocked(queryCurrentUser).mockResolvedValue({ name: '张三', accountNo: 'zhangsan' });
    vi.mocked(createKnowledgeBase).mockResolvedValue(KB);
    vi.mocked(updateKnowledgeBase).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('新建：展示登录人，提交时带上名称、类型、模型与描述', async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<KbFormModal mode="create" onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByText('新建知识库')).toBeTruthy();
    expect(await screen.findByText('张三')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('例如：心内科诊疗知识库'), {
      target: { value: '  心内科诊疗知识库  ' },
    });
    const selects = screen.getAllByRole('combobox');
    // 第一个是编码（禁用编辑的候选列表），第二个是类型
    expect(selects).toHaveLength(2);
    fireEvent.change(selects[1], { target: { value: 'MIX' } });
    fireEvent.change(screen.getByPlaceholderText('留空使用服务端默认'), {
      target: { value: ' bge-m3 ' },
    });
    fireEvent.change(screen.getByPlaceholderText('说明这个库服务什么场景'), {
      target: { value: ' 心内科制度与指南 ' },
    });

    fireEvent.click(screen.getByRole('button', { name: '创建知识库' }));

    await waitFor(() =>
      expect(createKnowledgeBase).toHaveBeenCalledWith({
        name: '心内科诊疗知识库',
        code: expect.stringMatching(/^kb_\d{8}_\d{4}_[a-z0-9]{4}$/),
        type: 'MIX',
        description: '心内科制度与指南',
        embeddingModel: 'bge-m3',
      }),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('新建：名称少于两个字符时提示并阻止提交，修正后可提交', async () => {
    render(<KbFormModal mode="create" onClose={vi.fn()} onSaved={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('例如：心内科诊疗知识库');
    fireEvent.change(nameInput, { target: { value: '心' } });
    fireEvent.click(screen.getByRole('button', { name: '创建知识库' }));

    expect(await screen.findByText('知识库名称至少 2 个字符')).toBeTruthy();
    expect(createKnowledgeBase).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: '心内' } });
    fireEvent.click(screen.getByRole('button', { name: '创建知识库' }));

    await waitFor(() => expect(createKnowledgeBase).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('知识库名称至少 2 个字符')).toBeNull();
  });

  it('编辑：编码与类型只读，仅提交名称与描述', async () => {
    const onSaved = vi.fn();
    render(<KbFormModal mode="edit" kb={KB} onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByText('编辑知识库 · 护理知识库')).toBeTruthy();
    expect(screen.getByText('kb_nursing')).toBeTruthy();
    expect(screen.getByText('文件库')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    // 编辑模式不查询登录人
    expect(queryCurrentUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue('护理知识库'), {
      target: { value: '护理知识库（新）' },
    });
    fireEvent.change(screen.getByDisplayValue('护理制度与流程'), {
      target: { value: '更新后的描述' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() =>
      expect(updateKnowledgeBase).toHaveBeenCalledWith({
        kbId: 'kb-1',
        name: '护理知识库（新）',
        description: '更新后的描述',
      }),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('取消按钮只关闭弹窗，不触发保存', () => {
    const onClose = vi.fn();
    render(<KbFormModal mode="edit" kb={KB} onClose={onClose} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateKnowledgeBase).not.toHaveBeenCalled();
  });
});
