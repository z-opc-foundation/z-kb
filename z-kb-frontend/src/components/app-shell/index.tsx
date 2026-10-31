import { getKnowledgeBase, pageKnowledgeBase, type KnowledgeBaseRecord } from '@/services/knowledgeBase';
import { KB_CHANGED_EVENT } from '@/utils/kb-events';
import {
  DEFAULT_TENANT_CODE,
  getActorId,
  getTenantCode,
  getTenantInfo,
  setTenantCode,
  TENANTS,
} from '@/utils/tenant';
import { toast } from '@/utils/toast';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, matchPath, useLocation, useNavigate, useParams } from 'react-router-dom';
import Icon from '@/components/icon';
import AppModal from '@/components/app-modal';
import BrandMark from '@/components/brand-mark';
import { ConfirmHost, confirmAction } from '@/components/confirm';
import { usePermission } from '@/components/auth';
import { logout, redirectToLogin } from '@/services/sso';
import { typeMeta } from '@/pages/knowledge-base/kb-meta';
import { useSidebarWidth } from './use-sidebar-width';
import '@/styles/global.css';

interface NavLeaf {
  label: string;
  icon: string;
  /** 菜单权限编码，与后端 SystemMenu 对齐 */
  code?: string;
  path?: string;
  target?: boolean;
  active?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavLeaf[];
}

interface AppShellProps {
  children: ReactNode;
}

const UNIMPLEMENTED_HINT = '该功能稍后开放';
const IS_LOCAL = import.meta.env.DEV;

function useKbChangedTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((value) => value + 1);
    window.addEventListener(KB_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(KB_CHANGED_EVENT, onChange);
  }, []);
  return tick;
}

function useCurrentKbName(kbId: string | undefined, tick: number): string {
  const [name, setName] = useState('');
  useEffect(() => {
    let alive = true;
    setName('');
    if (!kbId) {
      return () => {
        alive = false;
      };
    }
    getKnowledgeBase(kbId).then((kb) => {
      if (alive && kb) {
        setName(kb.name);
      }
    });
    return () => {
      alive = false;
    };
  }, [kbId, tick]);
  return name;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canSeeMenu, context: authContext } = usePermission();
  const tenant = getTenantInfo();
  const tick = useKbChangedTick();
  const path = location.pathname;
  const accountName =
    authContext?.authenticated && authContext.name
      ? authContext.name
      : IS_LOCAL
        ? '本地账号'
        : '平台账号';
  const accountRoles =
    authContext?.roles?.map((role) => role.roleName).join('、') || '';
  // 已接 apex 登录时展示真实员工号，避免把代理里的本地 actorId 当成登录人
  const actorLabel =
    authContext?.authenticated && authContext.principalId
      ? String(authContext.principalId)
      : String(getActorId());
  const { kbId } = useParams<{ kbId: string }>();
  const kbName = useCurrentKbName(kbId, tick);
  const isIndex = !!matchPath('/index', path);
  const isEvaluationList = !!matchPath('/evaluations', path);
  const isKbEvaluation = !!matchPath('/knowledge-bases/:kbId/evaluation', path);
  const isEvaluation = isEvaluationList || isKbEvaluation;
  const aiPageLabel = path.startsWith('/ai/agents')
    ? '智能管理'
    : path.startsWith('/ai/skills')
      ? '技能管理'
      : path.startsWith('/ai/tools')
        ? '工具定义'
        : path.startsWith('/ai/monitor')
          ? '调用监控'
          : path.startsWith('/ai/metrics')
            ? '技术指标'
            : '';

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { startResize: startSidebarResize, resetWidth: resetSidebarWidth } =
    useSidebarWidth();
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandKbs, setCommandKbs] = useState<KnowledgeBaseRecord[]>([]);
  const [commandIndex, setCommandIndex] = useState(0);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [tenantDraft, setTenantDraft] = useState(tenant.code);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [sidebarCollapsed]);

  // 命令面板打开时才拉知识库列表，避免每次进页面都多打一个请求
  useEffect(() => {
    if (!commandOpen) {
      return;
    }
    let cancelled = false;
    void pageKnowledgeBase({ current: 1, size: 200 }).then((result) => {
      if (!cancelled && result) {
        setCommandKbs(result.records || []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [commandOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandQuery('');
        setCommandOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const signOut = async () => {
    setAccountOpen(false);
    const confirmed = await confirmAction({
      title: '退出登录',
      sub: '退出后需重新通过统一登录认证才能进入知识中台。',
      confirmText: '退出登录',
    });
    if (!confirmed) {
      return;
    }
    try {
      await logout();
    } catch {
      // 未接 SSO 的环境（如本地代理账号）没有可注销的远端会话，直接回登录页
    }
    redirectToLogin();
  };

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        key: 'ai',
        label: '基础设施',
        items: [
          {
            label: '智能管理',
            icon: 'brain',
            code: 'menu.ai.agents',
            path: '/ai/agents',
            active: path.startsWith('/ai/agents'),
          },
          {
            label: '技能管理',
            icon: 'sparkles',
            code: 'menu.ai.skills',
            path: '/ai/skills',
            active: path.startsWith('/ai/skills'),
          },
          {
            label: '工具定义',
            icon: 'workflow',
            code: 'menu.ai.tools',
            path: '/ai/tools',
            active: path.startsWith('/ai/tools'),
          },
          {
            label: '调用监控',
            icon: 'scan',
            code: 'menu.ai.monitor',
            path: '/ai/monitor',
            active: path.startsWith('/ai/monitor'),
          },
          {
            label: '技术指标',
            icon: 'pie-chart',
            code: 'menu.ai.metrics',
            path: '/ai/metrics',
            active: path.startsWith('/ai/metrics'),
          },
        ],
      },
      {
        key: 'space',
        label: '知识空间',
        items: [
          {
            label: '知识管理',
            icon: 'database',
            code: 'menu.kb',
            path: '/knowledge-bases',
            active: path.startsWith('/knowledge-bases') && !isKbEvaluation,
          },
          {
            label: '知识评测',
            icon: 'shield-check',
            code: 'menu.evaluation',
            path: '/evaluations',
            active: isEvaluation,
          },
        ],
      },
      {
        key: 'ontology',
        label: '本体空间',
        items: [
          {
            label: '本体概览',
            icon: 'git-branch',
            code: 'menu.ontology.build',
            path: '/ontology',
            active: path === '/ontology',
          },
          {
            label: '本体建模',
            icon: 'braces',
            code: 'menu.ontology.build',
            path: '/ontology-modeling',
            active: path.startsWith('/ontology-modeling'),
          },
          {
            label: '图谱工作台',
            icon: 'network',
            code: 'menu.ontology.retrieval',
            path: '/ontology-graph',
            active: path.startsWith('/ontology-graph'),
          },
        ],
      },
      {
        key: 'admin',
        label: '运营管理',
        items: [
          {
            label: '系统监测',
            icon: 'activity',
            code: 'menu.admin.monitor',
            path: '/admin/monitor',
            active: path.startsWith('/admin/monitor'),
          },
          {
            label: '权限管理',
            icon: 'shield',
            code: 'menu.admin.permission',
            path: '/admin/permission',
            active: path.startsWith('/admin/permission'),
          },
          { label: '审计日志', icon: 'shield-check', code: 'menu.admin.audit', path: '/admin/audit', active: path.startsWith('/admin/audit') },
          {
            label: '调度配置',
            icon: 'activity',
            code: 'menu.admin.schedule',
            path: '/admin/schedule',
            active: path.startsWith('/admin/schedule'),
          },
          {
            label: '任务配置',
            icon: 'workflow',
            code: 'menu.admin.task-config',
            path: '/admin/task-config',
            active: path.startsWith('/admin/task-config'),
          },
        ],
      },
      {
        key: 'global',
        label: '全局管理',
        items: [
          {
            label: '租户管理',
            icon: 'globe',
            code: 'menu.admin.tenant',
            path: '/admin/tenant',
            active: path.startsWith('/admin/tenant'),
          },
          {
            label: '配额管理',
            icon: 'bar-chart',
            code: 'menu.admin.quota',
            path: '/admin/quota',
            active: path.startsWith('/admin/quota'),
          },
        ],
      },
    ],
    [path, isKbEvaluation, isEvaluation],
  );

  // 强制期按登录人菜单授权裁剪；放行观察期（enforce=false）展示全部入口
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canSeeMenu(item.code)),
        }))
        .filter((group) => group.items.length > 0),
    [navGroups, canSeeMenu],
  );

  const openTenant = useCallback(() => {
    setTenantDraft(tenant.code);
    setTenantOpen(true);
  }, [tenant.code]);

  const go = useCallback((item: NavLeaf) => {
    if (!item.path) {
      toast('页面暂未上线', UNIMPLEMENTED_HINT, 'info');
      return;
    }
    navigate(item.path);
  }, [navigate]);

  const switchTenant = (code: string) => {
    const next = code.trim();
    if (!next) {
      toast('租户编码不能为空', '', 'warn');
      return;
    }
    setTenantCode(next);
    if (getTenantCode() !== next) {
      toast('切换租户失败', '无法保存租户编码，请检查浏览器存储设置', 'error');
      return;
    }
    setTenantOpen(false);
    toast('已切换租户', `${next} · 列表与筛选已重置`, 'success');
    window.location.reload();
  };

  const commandActions = useMemo(() => {
    const actions: {
      label: string;
      hint?: string;
      icon: string;
      kind: '页面' | '动作';
      run: () => void;
    }[] = [];
    visibleGroups.forEach((group) => {
      group.items.forEach((item) => {
        actions.push({
          label: item.label,
          // 与侧栏一致，未上线的入口在搜索里也先标注，避免回车后才发现打不开。
          hint: item.path ? group.label : `${group.label} · 暂未上线`,
          icon: item.icon,
          kind: '页面',
          run: () => {
            setCommandOpen(false);
            go(item);
          },
        });
      });
    });    actions.push({
      label: '系统导览',
      hint: '对客文档与快速上手',
      icon: 'compass',
      kind: '页面',
      run: () => {
        setCommandOpen(false);
        navigate('/welcome');
      },
    });
    actions.push({
      label: '切换租户',
      hint: tenant.code,
      icon: 'layers',
      kind: '动作',
      run: () => {
        setCommandOpen(false);
        openTenant();
      },
    });
    return actions;
  }, [visibleGroups, tenant.code, go, openTenant, navigate]);

  const keyword = commandQuery.trim().toLowerCase();
  const matchedKbs = keyword
    ? commandKbs
        .filter((kb) => `${kb.name} ${kb.code}`.toLowerCase().includes(keyword))
        .slice(0, 6)
    : [];
  const commandOptions = useMemo(() => {
    const kbOptions = matchedKbs.map((kb) => {
      const meta = typeMeta(kb.type);
      return {
        key: `kb-${kb.kbId}`,
        label: kb.name,
        hint: `${meta.label} · ${kb.code}`,
        icon: meta.icon,
        kind: '知识库',
        run: () => {
          setCommandOpen(false);
          navigate(`/knowledge-bases/${kb.kbId}`);
        },
      };
    });
    const actionOptions = commandActions
      .filter((action) =>
        `${action.label} ${action.hint || ''}`.toLowerCase().includes(keyword),
      )
      .map((action) => ({
        key: `${action.hint}-${action.label}`,
        label: action.label,
        hint: action.hint || '',
        icon: action.icon,
        kind: action.kind,
        run: action.run,
      }));
    return [...kbOptions, ...actionOptions];
  }, [commandActions, keyword, matchedKbs, navigate]);
  const activeIndex = Math.min(commandIndex, Math.max(commandOptions.length - 1, 0));

  const crumbs = (
    <>
      <Link to="/index">知识中台</Link>
      {isIndex ? (
        <>
          <span className="sep">/</span>
          <span className="current">首页</span>
        </>
      ) : isEvaluationList ? (
        <>
          <span className="sep">/</span>
          <Link to="/evaluations">知识空间</Link>
          <span className="sep">/</span>
          <span className="current">知识评测</span>
        </>
      ) : aiPageLabel ? (
        <>
          <span className="sep">/</span>
          <span>基础设施</span>
          <span className="sep">/</span>
          <span className="current">{aiPageLabel}</span>
        </>
      ) : path.startsWith('/ontology-modeling') ? (
        <>
          <span className="sep">/</span>
          <span>本体空间</span>
          <span className="sep">/</span>
          <span className="current">本体建模</span>
        </>
      ) : path.startsWith('/ontology-graph') ? (
        <>
          <span className="sep">/</span>
          <span>本体空间</span>
          <span className="sep">/</span>
          <span className="current">图谱工作台</span>
        </>
      ) : path.startsWith('/ontology') ? (
        <>
          <span className="sep">/</span>
          <span>本体空间</span>
          <span className="sep">/</span>
          <span className="current">本体概览</span>
        </>
      ) : path.startsWith('/knowledge-bases') ? (
        <>
          <span className="sep">/</span>
          {kbId ? (
            <>
              <Link to="/knowledge-bases">知识管理</Link>
              <span className="sep">/</span>
              {isKbEvaluation ? (
                <>
                  <Link to={`/knowledge-bases/${encodeURIComponent(kbId)}`}>
                    {kbName || '知识库详情'}
                  </Link>
                  <span className="sep">/</span>
                  <span className="current">知识评测</span>
                </>
              ) : (
                <span className="current">{kbName || '知识库详情'}</span>
              )}
            </>
          ) : (
            <span className="current">知识管理</span>
          )}
        </>
      ) : path.startsWith('/admin/monitor') ? (
        <>
          <span className="sep">/</span>
          <span>运营管理</span>
          <span className="sep">/</span>
          <span className="current">系统监测</span>
        </>
      ) : path.startsWith('/admin/permission') ? (
        <>
          <span className="sep">/</span>
          <span>运营管理</span>
          <span className="sep">/</span>
          <span className="current">权限管理</span>
        </>
      ) : path.startsWith('/admin/audit') ? (
        <>
          <span className="sep">/</span>
          <span>运营管理</span>
          <span className="sep">/</span>
          <span className="current">审计日志</span>
        </>
      ) : path.startsWith('/admin/schedule') ? (
        <>
          <span className="sep">/</span>
          <span>运营管理</span>
          <span className="sep">/</span>
          <span className="current">调度配置</span>
        </>
      ) : path.startsWith('/admin/task-config') ? (
        <>
          <span className="sep">/</span>
          <span>运营管理</span>
          <span className="sep">/</span>
          <span className="current">任务配置</span>
        </>
      ) : path.startsWith('/admin/tenant') ? (
        <>
          <span className="sep">/</span>
          <span>全局管理</span>
          <span className="sep">/</span>
          <span className="current">租户管理</span>
        </>
      ) : path.startsWith('/admin/quota') ? (
        <>
          <span className="sep">/</span>
          <span>全局管理</span>
          <span className="sep">/</span>
          <span className="current">配额管理</span>
        </>
      ) : (
        <>
          <span className="sep">/</span>
          <span className="current">页面不存在</span>
        </>
      )}
    </>
  );

  return (
    <div className="app">
      <aside className="sidebar" id="sidebar">
        <button
          type="button"
          className="brand"
          title="系统导览"
          onClick={() => navigate('/welcome')}
        >
          <div className="brand-mark">
            <BrandMark />
          </div>
          <div className="brand-copy">
            <div className="brand-name">知识中台</div>
            <div className="brand-sub">Knowledge OS</div>
          </div>
        </button>
        <nav className="nav" id="sidebar-nav">
          {visibleGroups.map((group) => {
            const groupActive = group.items.some((item) => item.active);
            const collapsed = !!collapsedGroups[group.key];
            return (
              <div
                key={group.key}
                className={`nav-group ${collapsed ? 'collapsed ' : ''}${
                  groupActive ? 'has-active' : ''
                }`}
              >
                <button
                  type="button"
                  className="nav-label nav-group-toggle"
                  aria-expanded={!collapsed}
                  title={`${collapsed ? '展开' : '折叠'} ${group.label}`}
                  onClick={() =>
                    setCollapsedGroups((prev) => ({
                      ...prev,
                      [group.key]: !prev[group.key],
                    }))
                  }
                >
                  <span>{group.label}</span>
                  {groupActive ? (
                    <span
                      className="nav-group-active"
                      aria-hidden="true"
                    ></span>
                  ) : null}
                  <span className="nav-group-chevron" aria-hidden="true">
                    <Icon name="chevron-down" size={11} />
                  </span>
                </button>
                <div className="nav-items">
                  {group.items.map((item) =>
                    item.path ? (
                      <Link
                        key={item.label}
                        className={`nav-item ${item.active ? 'active' : ''}`}
                        to={item.path}
                        title={item.label}
                      >
                        <Icon name={item.icon} size={16} />
                        <span className="nav-text">{item.label}</span>
                        {item.target ? (
                          <span className="target-dot"></span>
                        ) : null}
                      </Link>
                    ) : (
                      <button
                        key={item.label}
                        type="button"
                        className="nav-item"
                        title={`${item.label}（暂未上线）`}
                        onClick={() => go(item)}
                      >
                        <Icon name={item.icon} size={16} />
                        <span className="nav-text">{item.label}</span>
                        {item.target ? (
                          <span className="target-dot"></span>
                        ) : null}
                      </button>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </nav>
        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整侧栏宽度，双击恢复默认"
          title="拖动调整宽度，双击恢复默认"
          onPointerDown={startSidebarResize}
          onDoubleClick={resetSidebarWidth}
        />
      </aside>

      <div className="shell">
        <header className="topbar">
          <button
            className="icon-btn"
            type="button"
            title="收起/展开侧边栏"
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            <Icon name="panel-left" />
          </button>
          <div className="crumbs">{crumbs}</div>
          <div className="topbar-right">
            <button
              className="search-trigger"
              type="button"
              onClick={() => {
                setCommandQuery('');
                setCommandOpen(true);
              }}
            >
              <Icon name="search" />
              <span className="txt">搜索知识库、页面或操作</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="tenant-chip"
              type="button"
              title="切换租户"
              onClick={openTenant}
            >
              <span className="tenant-mark">{tenant.mark}</span>
              <span className="tenant-copy">
                <b>{tenant.name}</b>
                <small>{tenant.code}</small>
              </span>
              <span className="tenant-chevron">
                <Icon name="chevron-down" size={13} />
              </span>
            </button>
            <button
              className="icon-btn"
              type="button"
              title="系统导览"
              onClick={() => navigate('/welcome')}
            >
              <Icon name="compass" />
            </button>
            <button
              className={`icon-btn ${notificationsRead ? '' : 'has-dot'}`}
              type="button"
              title="通知"
              onClick={() => {
                setNotificationsRead(true);
                toast('没有新通知', '通知中心暂未上线', 'info');
              }}
            >
              <Icon name="bell" />
            </button>
            <div className="account" ref={accountRef}>
              <button
                className={`user-chip${accountOpen ? ' open' : ''}`}
                type="button"
                title="账号与退出登录"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((value) => !value)}
              >
                <span className="avatar">{accountName.slice(0, 1)}</span>
                <span className="user-meta">
                  <b>{accountName}</b>
                  <small>actorId {actorLabel}</small>
                </span>
                <span className="user-chevron">
                  <Icon name="chevron-down" size={13} />
                </span>
              </button>
              {accountOpen ? (
                <div className="account-menu" role="menu">
                  <div className="account-menu-head">
                    <span className="avatar">{accountName.slice(0, 1)}</span>
                    <div>
                      <b>{accountName}</b>
                      <small>actorId {actorLabel}</small>
                    </div>
                  </div>
                  <div className="account-menu-rows">
                    <div>
                      <span>租户</span>
                      <b>{tenant.name}</b>
                    </div>
                    <div>
                      <span>角色</span>
                      <b>{accountRoles || '未配置角色'}</b>
                    </div>
                  </div>
                  <button
                    className="account-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                  >
                    <Icon name="log-out" size={14} />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="content" id="view">
          {children}
        </main>
      </div>

      <footer className="app-footer">
        <Link className="app-footer-link" to="/welcome">
          <Icon name="help-circle" size={13} />
          帮助与系统导览
        </Link>
        <span className="app-footer-meta">
          <kbd>⌘ K</kbd>
          全局搜索
        </span>
      </footer>

      <ConfirmHost />

      {commandOpen ? (
        <AppModal
          icon="search"
          title="搜索知识库、页面或操作"
          sub="输入知识库名称、页面名称或常用操作"
          width={660}
          className="command-modal"
          onClose={() => setCommandOpen(false)}
          body={
            <div>
              <div className="input-icon" style={{ marginBottom: 12 }}>
                <Icon name="search" size={14} />
                <input
                  autoFocus
                  className="input"
                  placeholder="输入知识库、页面或操作名称"
                  value={commandQuery}
                  onChange={(event) => {
                    setCommandQuery(event.target.value);
                    setCommandIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setCommandIndex((current) =>
                        Math.min(current + 1, commandOptions.length - 1),
                      );
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setCommandIndex((current) => Math.max(current - 1, 0));
                    } else if (event.key === 'Enter') {
                      event.preventDefault();
                      commandOptions[activeIndex]?.run();
                    }
                  }}
                />
              </div>
              <div className="command-list">
                {commandOptions.map((option, index) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`command-item${index === activeIndex ? ' active' : ''}`}
                    onMouseEnter={() => setCommandIndex(index)}
                    onClick={option.run}
                  >
                    <span className="c-icon">
                      <Icon name={option.icon} size={14} />
                    </span>
                    <span className="c-copy">
                      <b>{option.label}</b>
                      <small>{option.hint}</small>
                    </span>
                    <span className="c-type">{option.kind}</span>
                  </button>
                ))}
                {!commandOptions.length ? (
                  <div className="empty" style={{ padding: '24px 0' }}>
                    <b>没有匹配项</b>
                    <p>可搜索知识库名称，或「知识库」「基础设施」这类页面。</p>
                  </div>
                ) : null}
              </div>
            </div>
          }
          footLeft="⌘ K 打开 · Esc 关闭"
          footRight={
            <button
              className="btn"
              type="button"
              onClick={() => setCommandOpen(false)}
            >
              关闭
            </button>
          }
        />
      ) : null}

      {tenantOpen ? (
        <AppModal
          icon="layers"
          title="切换租户"
          sub="切换后只展示所选租户内你有权访问的内容"
          width={560}
          onClose={() => setTenantOpen(false)}
          body={
            <div>
              <div className="stack" style={{ gap: 8 }}>
                {TENANTS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className="binding-row"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      marginBottom: 0,
                    }}
                    onClick={() => switchTenant(item.code)}
                  >
                    <span className="ic">
                      <Icon name="layers" size={15} />
                    </span>
                    <div className="copy">
                      <b>{item.name}</b>
                      <small className="mono">{item.code}</small>
                    </div>
                    {item.code === tenant.code ? (
                      <span className="tag green">当前</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="field mt-16">
                <label>其他租户编码</label>
                <input
                  className="input"
                  value={tenantDraft}
                  placeholder={DEFAULT_TENANT_CODE}
                  onChange={(event) => setTenantDraft(event.target.value)}
                />
                <span className="help">输入租户编码后切换，列表、筛选与分页会重置。</span>
              </div>
              <div className="callout mt-16">
                <Icon name="info" size={15} />
                <div className="ct">
                  <b>「全部知识库」不会跨租户</b>
                  <p>列表只返回当前租户内你有权访问的知识库；没有可见库时显示空态。</p>
                </div>
              </div>
            </div>
          }
          footLeft="租户切换会刷新页面"
          footRight={
            <>
              <button
                className="btn"
                type="button"
                onClick={() => setTenantOpen(false)}
              >
                取消
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => switchTenant(tenantDraft)}
              >
                <Icon name="check" size={13} />
                切换
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
