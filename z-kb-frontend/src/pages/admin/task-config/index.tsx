import { usePermission } from '@/components/auth';
import TaskConfigPanel from './panel';

export default function TaskConfigAdminPage() {
  const { can } = usePermission();
  return (
    <div className="view task-config-admin">
      <TaskConfigPanel canManage={can('task.config.manage')} />
    </div>
  );
}
