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
  type LucideIcon,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import styles from './MainLayout.module.css';

interface NavItemDef {
  path: string;
  name: string;
  icon: LucideIcon;
  isAssurance?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { path: '/dashboard', name: 'Executive Dashboard', icon: LayoutDashboard },
  { path: '/fleet', name: 'Fleet Overview', icon: Ship },
  { path: '/anomalies', name: 'Anomaly Detection', icon: AlertTriangle },
  { path: '/maintenance', name: 'Predictive Maintenance', icon: Wrench },
  { path: '/voyage', name: 'Voyage & Fuel', icon: Compass },
  { path: '/safety', name: 'Safety Monitoring', icon: ShieldCheck },
  { path: '/automation', name: 'Automation Centre', icon: Cpu },
  { path: '/assurance', name: 'Application Assurance', icon: CheckCircle2, isAssurance: true },
];

export const MainLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

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
          {NAV_ITEMS.map((item) => {
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
            <span>Static GitHub Pages</span>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span className="pill info">
              <span>●</span> LIVE SYSTEM
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>UTC 2026-07-23 14:00</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
