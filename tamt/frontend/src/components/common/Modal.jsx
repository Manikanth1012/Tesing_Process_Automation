import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const maxWidths = { sm: 440, md: 560, lg: 740, xl: 900 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 16 }}>
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
        <div style={{
          position: 'relative',
          background: 'var(--bg2)',
          border: '1px solid var(--border-hi)',
          borderRadius: 14,
          width: '100%',
          maxWidth: maxWidths[size],
          zIndex: 10,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
          }}>
            <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--t1)', margin: 0 }}>
              {title}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 6 }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div style={{ padding: '22px' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
