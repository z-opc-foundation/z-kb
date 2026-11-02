import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { withAppShell } from '@/components/app-shell/with-app-shell';

const IndexPage = lazy(() => import('@/pages/index'));
const WelcomePage = lazy(() => import('@/pages/welcome'));
const KnowledgeBaseListPage = lazy(() => import('@/pages/knowledge-base'));
const KnowledgeBaseDetailPage = lazy(() => import('@/pages/knowledge-base/detail'));
const KnowledgeBaseSettingsPage = lazy(() => import('@/pages/knowledge-base/settings'));
const KnowledgeBaseVersionPage = lazy(() => import('@/pages/knowledge-base/version-management'));
const EvaluationListPage = lazy(() => import('@/pages/evaluation'));
const EvaluationWorkbenchPage = lazy(() => import('@/pages/evaluation/detail'));
const AiAgentsPage = lazy(() => import('@/pages/ai/agents'));
const AiSkillsPage = lazy(() => import('@/pages/ai/skills'));
const AiToolsPage = lazy(() => import('@/pages/ai/tools'));
const AiCallMonitorPage = lazy(() => import('@/pages/ai/monitor'));
const AiMetricsPage = lazy(() => import('@/pages/ai/metrics'));
const SystemMonitorPage = lazy(() => import('@/pages/admin/monitor'));
const PermissionAdminPage = lazy(() => import('@/pages/admin/permission'));
const AuditLogPage = lazy(() => import('@/pages/admin/audit'));
const ScheduleAdminPage = lazy(() => import('@/pages/admin/schedule'));
const TaskConfigAdminPage = lazy(() => import('@/pages/admin/task-config'));
const TenantAdminPage = lazy(() => import('@/pages/admin/tenant'));
const QuotaAdminPage = lazy(() => import('@/pages/admin/quota'));
const OntologyPage = lazy(() => import('@/pages/ontology'));
const OntologyGraphPage = lazy(() => import('@/pages/ontology-graph'));
const OntologyModelingPage = lazy(() => import('@/pages/ontology-modeling'));

type RouteComponent = ComponentType | LazyExoticComponent<ComponentType>;

export interface AppRouteConfig {
  key: string;
  label: string;
  path: string;
  /** 菜单权限编码，与后端 SystemMenu 对齐；未填表示不校验 */
  menuCode?: string;
  component: RouteComponent;
}

export const defaultRoutePath = '/index';

/** 控制台页面套知识中台外壳（AppShell）；/welcome 是独立整页，不套外壳也不做菜单鉴权 */
export const allRoutes: AppRouteConfig[] = [
  {
    key: 'index',
    menuCode: 'menu.home',
    label: '首页',
    path: '/index',
    component: withAppShell(IndexPage),
  },
  {
    key: 'welcome',
    label: '系统导览',
    path: '/welcome',
    component: WelcomePage,
  },
  {
    key: 'knowledge-bases',
    menuCode: 'menu.kb',
    label: '知识管理',
    path: '/knowledge-bases',
    component: withAppShell(KnowledgeBaseListPage),
  },
  {
    key: 'knowledge-base-detail',
    menuCode: 'menu.kb',
    label: '知识库详情',
    path: '/knowledge-bases/:kbId',
    component: withAppShell(KnowledgeBaseDetailPage),
  },
  {
    key: 'knowledge-base-settings',
    menuCode: 'menu.kb',
    label: '知识库设置',
    path: '/knowledge-bases/:kbId/settings',
    component: withAppShell(KnowledgeBaseSettingsPage),
  },
  {
    key: 'knowledge-base-versions',
    menuCode: 'menu.kb',
    label: '版本管理',
    path: '/knowledge-bases/:kbId/versions',
    component: withAppShell(KnowledgeBaseVersionPage),
  },
  {
    key: 'evaluations',
    menuCode: 'menu.evaluation',
    label: '知识评测',
    path: '/evaluations',
    component: withAppShell(EvaluationListPage),
  },
  {
    key: 'knowledge-base-evaluation',
    menuCode: 'menu.evaluation',
    label: '知识评测',
    path: '/knowledge-bases/:kbId/evaluation',
    component: withAppShell(EvaluationWorkbenchPage),
  },
  {
    key: 'ai-agents',
    menuCode: 'menu.ai.agents',
    label: '智能管理',
    path: '/ai/agents',
    component: withAppShell(AiAgentsPage),
  },
  {
    key: 'ai-skills',
    menuCode: 'menu.ai.skills',
    label: '技能管理',
    path: '/ai/skills',
    component: withAppShell(AiSkillsPage),
  },
  {
    key: 'ai-tools',
    menuCode: 'menu.ai.tools',
    label: '工具定义',
    path: '/ai/tools',
    component: withAppShell(AiToolsPage),
  },
  {
    key: 'ai-call-monitor',
    menuCode: 'menu.ai.monitor',
    label: '调用监控',
    path: '/ai/monitor',
    component: withAppShell(AiCallMonitorPage),
  },
  {
    key: 'ai-metrics',
    menuCode: 'menu.ai.metrics',
    label: '技术指标',
    path: '/ai/metrics',
    component: withAppShell(AiMetricsPage),
  },
  {
    key: 'system-monitor',
    menuCode: 'menu.admin.monitor',
    label: '系统监测',
    path: '/admin/monitor',
    component: withAppShell(SystemMonitorPage),
  },
  {
    key: 'permission-admin',
    menuCode: 'menu.admin.permission',
    label: '权限管理',
    path: '/admin/permission',
    component: withAppShell(PermissionAdminPage),
  },
  {
    key: 'audit-log',
    menuCode: 'menu.admin.audit',
    label: '审计日志',
    path: '/admin/audit',
    component: withAppShell(AuditLogPage),
  },
  {
    key: 'schedule-admin',
    menuCode: 'menu.admin.schedule',
    label: '调度配置',
    path: '/admin/schedule',
    component: withAppShell(ScheduleAdminPage),
  },
  {
    key: 'task-config-admin',
    menuCode: 'menu.admin.task-config',
    label: '任务配置',
    path: '/admin/task-config',
    component: withAppShell(TaskConfigAdminPage),
  },
  {
    key: 'tenant-admin',
    menuCode: 'menu.admin.tenant',
    label: '租户管理',
    path: '/admin/tenant',
    component: withAppShell(TenantAdminPage),
  },
  {
    key: 'quota-admin',
    menuCode: 'menu.admin.quota',
    label: '配额管理',
    path: '/admin/quota',
    component: withAppShell(QuotaAdminPage),
  },
  {
    key: 'ontology',
    menuCode: 'menu.ontology.build',
    label: '本体概览',
    path: '/ontology',
    component: withAppShell(OntologyPage),
  },
  {
    key: 'ontology-modeling',
    menuCode: 'menu.ontology.build',
    label: '本体建模',
    path: '/ontology-modeling',
    component: withAppShell(OntologyModelingPage),
  },
  {
    key: 'ontology-graph',
    menuCode: 'menu.ontology.retrieval',
    label: '图谱工作台',
    path: '/ontology-graph',
    component: withAppShell(OntologyGraphPage),
  },
  {
    key: 'knowledge-base-detail-tab',
    menuCode: 'menu.kb',
    label: '知识库详情',
    path: '/knowledge-bases/:kbId/:tab',
    component: withAppShell(KnowledgeBaseDetailPage),
  },
];
