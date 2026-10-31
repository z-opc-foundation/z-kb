import { useEffect, useState } from 'react';
import { listMembers, type OrgMember } from '@/services/identity';

export interface ActorDirectory {
  /** staffId → 姓名，用于把日志里的操作人换成人名 */
  names: Record<number, string>;
  /** 当前机构成员，用于操作人筛选下拉 */
  members: OrgMember[];
}

const EMPTY_DIRECTORY: ActorDirectory = { names: {}, members: [] };

/** 当前机构成员名册：审计日志的展示增强与操作人筛选共用同一份数据。 */
export function useActorDirectory(): ActorDirectory {
  const [directory, setDirectory] = useState<ActorDirectory>(EMPTY_DIRECTORY);

  useEffect(() => {
    let alive = true;
    // 名册只是展示增强，成员接口不可用（无权限/网络异常）时保持空表，不影响日志列表
    void listMembers(undefined, { silent: true })
      .then((members) => {
        if (!alive) {
          return;
        }
        const names: Record<number, string> = {};
        members.forEach((member) => {
          if (member.staffId != null && member.name) {
            names[Number(member.staffId)] = member.name;
          }
        });
        setDirectory({ names, members });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return directory;
}

/** 只取 staffId → 姓名映射。 */
export function useActorNames(): Record<number, string> {
  return useActorDirectory().names;
}
