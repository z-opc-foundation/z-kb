import AuditLogPanel from '@/components/audit-log';

/** 系统审计：当前租户全部留痕，按「归属」列区分系统级与知识库级。 */
export default function AuditLogPage() {
  return (
    <div className="view audit-list-page">
      <AuditLogPanel showType />
    </div>
  );
}
