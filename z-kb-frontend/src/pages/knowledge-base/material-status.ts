export const MATERIAL_STATUS: Record<string, { label: string; tag: string }> = {
  REGISTERED: { label: '已登记', tag: 'blue' },
  ACTIVE: { label: '生效', tag: 'green' },
  UPDATING: { label: '更新中', tag: 'amber' },
  DELETED: { label: '已删除', tag: 'gray' },
};

export const PARSE_STATUS: Record<string, { label: string; tag: string }> = {
  READY: { label: '已解析', tag: 'green' },
  PARSING: { label: '解析中', tag: 'amber' },
  FAILED: { label: '解析失败', tag: 'red' },
};

export const JOB_STATUS: Record<string, { label: string; tag: string }> = {
  QUEUED: { label: '排队中', tag: 'gray' },
  RUNNING: { label: '编译中', tag: 'amber' },
  PAUSED: { label: '已暂停', tag: 'amber' },
  COMPLETED: { label: '已完成', tag: 'green' },
  FAILED: { label: '失败', tag: 'red' },
  CANCELED: { label: '已取消', tag: 'gray' },
};

export const STAGE_STATUS: Record<string, { label: string; tag: string }> = {
  PENDING: { label: '待执行', tag: 'gray' },
  RUNNING: { label: '执行中', tag: 'amber' },
  SUCCEEDED: { label: '成功', tag: 'green' },
  FAILED: { label: '失败', tag: 'red' },
  SKIPPED: { label: '跳过', tag: 'gray' },
};

export const STAGE_LABEL: Record<string, string> = {
  REGISTER: 'P0 登记',
  PARSE: 'P1 解析',
  CHUNK: 'P2 切块',
  INDEX: 'P3 索引',
  EXTRACT: 'P4 萃取',
  WIKI: 'Wiki 编译',
};

export const VERSION_STATUS: Record<string, { label: string; tag: string }> = {
  REGISTERED: { label: '已登记', tag: 'blue' },
  PARSING: { label: '解析中', tag: 'amber' },
  PARSED: { label: '已解析', tag: 'green' },
  FAILED: { label: '解析失败', tag: 'red' },
  SUPERSEDED: { label: '已被替换', tag: 'gray' },
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  LOCAL: '本地上传',
  CODE_GIT: '代码仓库',
};
