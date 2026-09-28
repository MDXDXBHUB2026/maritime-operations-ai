import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Ship,
  AlertTriangle,
  Wrench,
  Compass,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  Menu,
  X,
  RotateCcw,
  Bot,
  KeyRound,
  LogOut,
  Users,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { AppConfig } from '../services/config';
import { LiveStatusBar } from '../components/live/LiveStatusBar';
import { useAuth } from '../app/AuthContext';
import { AuthService } from '../services/authService';
import { scopeText } from '../services/authSession';
import styles from './MainLayout.module.css';

interface NavItemDef {
  path: string;
  name: string;
  icon: LucideIcon;
  isAssurance?: boolean;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { path: '/dashboard', name: 'Executive Dashboard', icon: LayoutDashboard },
  { path: '/fleet', name: 'Fleet Overview', icon: Ship },
  { path: '/anomalies', name: 'Anomaly Detection', icon: AlertTriangle },
  { path: '/maintenance', name: 'Predictive Maintenance', icon: Wrench },
  { path: '/voyage', name: 'Voyage & Fuel', icon: Compass },
  { path: '/safety', name: 'Safety Monitoring', icon: ShieldCheck },
  { path: '/automation', name: 'Automation Centre', icon: Cpu },
  { path: '/decisions', name: 'AI Decision Centre', icon: Bot },
  { path: '/crew', name: 'Crew & Delegations', icon: KeyRound },
  { path: '/users', name: 'User Administration', icon: Users, adminOnly: true },
  { path: '/assurance', name: 'Application Assurance', icon: CheckCircle2, isAssurance: true },
];

export const MainLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navItems = NAV_ITEMS.filter((i) => !i.adminOnly || user?.permissions.can_manage_users);

  const handleResetDemo = () => {
    if (window.confirm('Reset all simulated operator actions back to pristine seed data?')) {
      StorageService.resetDemoState();
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
          <div className={styles.brandSubtitle}>OPERATIONS CONTROL TOWER</div>
        </div>

        <nav className={styles.nav} aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isAssurance = item.isAssurance;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''} ${isAssurance ? styles.assuranceItem : ''}`
                }
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarDisclaimer}>
            Conceptual prototype with synthetic operational datasets. No production maritime systems
            connected.
          </div>
          <div className={styles.versionBadge}>
            <span>
              {AppConfig.dataMode === 'api' ? 'API mode · FastAPI' : 'Static GitHub Pages'}
            </span>
            <button
              onClick={handleResetDemo}
              title="Reset simulated actions"
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

          <LiveStatusBar />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {user && (
              <div className="user-chip" data-testid="user-chip" title={user.username}>
                <UserCircle2 size={16} />
                <span>
                  <strong>{user.display_name}</strong>
                  <span className="live-muted">
                    {' '}
                    · {user.role_label}
                    {user.permissions.can_generate ? ` · ${scopeText(user)}` : ''}
                    {(user.scope?.delegations_received ?? []).some((d) => d.status === 'active')
                      ? ' · + delegated authority'
                      : ''}
                  </span>
                </span>
                <button
                  className="user-signout"
                  onClick={() => AuthService.logout()}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
            <button
              onClick={handleResetDemo}
              title="Reset simulated actions"
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
