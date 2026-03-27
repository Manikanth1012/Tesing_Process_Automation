import React from 'react';
import Sidebar from './Sidebar.jsx';
import AiAssistant from '../assistant/AiAssistant.jsx';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 ml-56 min-h-screen relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
      <AiAssistant />
    </div>
  );
}
