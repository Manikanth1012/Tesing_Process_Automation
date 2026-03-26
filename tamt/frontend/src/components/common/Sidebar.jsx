import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Layers, ClipboardList, TestTube,
  Play, Bug, Settings, BarChart3, Bot,
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/features', icon: Layers, label: 'Features' },
  { to: '/test-plans', icon: ClipboardList, label: 'Test Plans' },
  { to: '/test-cases', icon: TestTube, label: 'Test Cases' },
  { to: '/test-runs', icon: Play, label: 'Test Runs' },
  { to: '/defects', icon: Bug, label: 'Defects' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-30">
      <div className="px-5 py-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm leading-none">TAMT</div>
            <div className="text-xs text-gray-500 leading-none mt-0.5">AI-Powered QA</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-200">
        <div className="text-xs text-gray-400">TAMT v1.0 · RF Integration</div>
      </div>
    </aside>
  );
}
