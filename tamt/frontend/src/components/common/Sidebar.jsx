import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, ClipboardList, Layers,
  TestTube, Play, Bug, BarChart3, Settings, LogOut,
  GitBranch, Cpu, Library,
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/test-plans', icon: ClipboardList, label: 'Test Plans' },
  { to: '/features', icon: Layers, label: 'Features' },
  { to: '/test-cases', icon: TestTube, label: 'Test Cases' },
  { to: '/test-runs', icon: Play, label: 'Test Runs' },
  { to: '/defects', icon: Bug, label: 'Defects' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/global-templates', icon: Library, label: 'Global Templates' },
];

function NavItem({ to, icon: Icon, label, exact }) {
  return (
    <NavLink
      to={to}
      end={exact}
      style={({ isActive }) => isActive ? {
        background: 'var(--cyan-dim)',
        color: 'var(--cyan)',
        border: '1px solid var(--border-hi)',
        fontWeight: 500,
      } : {
        color: 'var(--t2)',
        border: '1px solid transparent',
      }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150"
    >
      {({ isActive }) => (
        <>
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? 'var(--cyan)' : 'var(--t3)' }} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = (() => { try { return JSON.parse(localStorage.getItem('tamt_user') || '{}'); } catch { return {}; } })();

  const handleLogout = () => {
    localStorage.removeItem('tamt_token');
    localStorage.removeItem('tamt_user');
    navigate('/login', { replace: true });
  };

  return (
    <aside
      style={{ background: 'var(--bg2)', borderRight: '1px solid var(--border)' }}
      className="w-56 flex flex-col h-screen fixed left-0 top-0 z-30"
    >
      {/* Logo */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect width="7" height="7" rx="1.5" fill="#00d4ff"/>
              <rect x="9" width="7" height="7" rx="1.5" fill="#00d4ff" opacity="0.5"/>
              <rect y="9" width="7" height="7" rx="1.5" fill="#00d4ff" opacity="0.5"/>
              <rect x="9" y="9" width="7" height="7" rx="1.5" fill="#00d4ff"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 14, color: 'var(--t1)', lineHeight: 1.1 }}>
              TAMT
            </div>
            <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              QA Platform
            </div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {NAV.map(item => <NavItem key={item.to} {...item} />)}

        {/* Learn section */}
        <div style={{ fontSize: 9, color: 'var(--t3)', padding: '14px 10px 4px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: '"DM Mono",monospace' }}>
          Learn
        </div>
        <NavItem to="/process-flow" icon={GitBranch} label="Process Flow" />
        <NavItem to="/memory-arch" icon={Cpu} label="How Memory Works" />
      </nav>

      {/* Bottom */}
      <div className="px-2 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        <NavItem to="/settings" icon={Settings} label="Settings" />

        {/* User info + logout */}
        {user?.name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginTop: 4, borderTop: '1px solid var(--border)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--cyan)', fontWeight: 600 }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{user.role || 'USER'}</div>
            </div>
            <button onClick={handleLogout} title="Sign out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 3, borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="pulse-dot" />
          <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em' }}>
            v1.3.0 · RF 7.x
          </span>
        </div>
      </div>
    </aside>
  );
}
