import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Compass,
  Cpu,
  Inbox,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Shield,
  ShieldAlert,
  Ship,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import {
  ApprovalService,
  EnterpriseStorage,
  subscribeEnterpriseState,
} from '../services/enterprise';
import styles from './MainLayout.module.css';

interface NavItemDef {
  path: string;
  name: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavGroupDef {
  title: string;
  items: NavItemDef[];
}

export const MainLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeEnterpriseState(() => setTick((t) => t + 1));
  }, []);

  const pendingApprovalsCount = ApprovalService.getPendingApprovals().length;

  const NAV_GROUPS: NavGroupDef[] = [
    {
      title: 'AI ENTERPRISE',
      items: [
        { path: '/command-centre', name: 'Executive Command Centre', icon: LayoutDashboard },
        { path: '/organization', name: 'Organization Hierarchy', icon: Briefcase },
        { path: '/workforce', name: 'AI Workforce Directory', icon: Bot },
        { path: '/tasks', name: 'Task Operations', icon: CheckSquare },
        {
          path: '/approvals',
          name: 'Decision & Approvals',
          icon: Inbox,
          badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
        },
        { path: '/activity', name: 'Live Activity Stream', icon: Activity },
        { path: '/performance', name: 'Workforce Performance', icon: BarChart3 },
        { path: '/governance', name: 'Governance & Registry', icon: Shield },
      ],
    },
    {
      title: 'MARITIME OPERATIONS',
      items: [
        { path: '/dashboard', name: 'Executive Fleet Map', icon: Compass },
        { path: '/fleet', name: 'Fleet Overview', icon: Ship },
        { path: '/anomalies', name: 'Anomaly Detection', icon: AlertTriangle },
        { path: '/maintenance', name: 'Predictive Maintenance', icon: Wrench },
        { path: '/voyage', name: 'Voyage & Fuel', icon: Compass },
        { path: '/safety', name: 'Safety Monitoring', icon: ShieldAlert },
        { path: '/automation', name: 'Automation Centre', icon: Cpu },
      ],
    },
    {
      title: 'ASSURANCE & SECURITY',
      items: [
        { path: '/assurance', name: 'Application Assurance', icon: CheckCircle2 },
      ],
    },
  ];

  const handleResetDemo = () => {
    if (window.confirm('Reset all simulated enterprise actions and maritime data back to pristine seed state?')) {
      StorageService.resetDemoState();
      EnterpriseStorage.resetAll();
      window.location.reload();
    }
  };

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandTitle}>
            <span>⚓</span>
            <span>MARITIME AI</span>
          </div>
          <div className={styles.brandSubtitle}>AI ENTERPRISE CONTROL TOWER</div>
        </div>

        <nav className={styles.nav} aria-label="Main Navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <div className={styles.navGroupTitle}>{group.title}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `${styles.navItem} ${isActive ? styles.active : ''}`
                    }
                  >
                    <Icon size={16} />
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {item.badge !== undefined && (
                      <span className={styles.navBadge} data-testid="nav-approval-badge">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarDisclaimer}>
            Simulated AI Enterprise Control Tower. No external production systems connected.
          </div>
          <div className={styles.versionBadge}>
            <span>Static GitHub Pages</span>
            <button
              onClick={handleResetDemo}
              title="Reset simulated actions"
              data-testid="sidebar-reset-demo-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#25c2d8' }}
            >
              <RotateCcw size={12} />
              Reset Demo
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        <header className={styles.topBar}>
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
            <span className="pill info">
              <span>●</span> SIMULATED ENTERPRISE
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              UTC 2026-07-23 14:02
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--cyan)' }}>
              HQ: Dubai Operations Center
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {pendingApprovalsCount > 0 && (
              <NavLink
                to="/approvals"
                className={styles.pendingApprovalsTopBadge}
                data-testid="topbar-approvals-link"
              >
                <span>⚠️ {pendingApprovalsCount} Decision{pendingApprovalsCount > 1 ? 's' : ''} Pending</span>
              </NavLink>
            )}

            <button
              onClick={handleResetDemo}
              title="Reset simulated actions"
              data-testid="topbar-reset-demo-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                padding: '0.28rem 0.6rem',
                background: 'rgba(37, 194, 216, 0.12)',
                color: '#25c2d8',
                border: '1px solid rgba(37, 194, 216, 0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} />
              <span>Reset Demo</span>
            </button>

            <NavLink
              to="/assurance"
              className="pill low"
              style={{ cursor: 'pointer', textDecoration: 'none' }}
            >
              <CheckCircle2 size={13} />
              <span>CI Assurance: Active</span>
            </NavLink>
          </div>
        </header>

        <main className={styles.pageBody}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
