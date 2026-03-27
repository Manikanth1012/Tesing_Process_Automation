import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('tamt_token', data.token);
      localStorage.setItem('tamt_user', JSON.stringify(data.user));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      zIndex: 1,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <rect width="7" height="7" rx="1.5" fill="#00d4ff"/>
                <rect x="9" width="7" height="7" rx="1.5" fill="#00d4ff" opacity="0.5"/>
                <rect y="9" width="7" height="7" rx="1.5" fill="#00d4ff" opacity="0.5"/>
                <rect x="9" y="9" width="7" height="7" rx="1.5" fill="#00d4ff"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--t1)', lineHeight: 1 }}>TAMT</div>
              <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Test Automation Management Tool
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border-hi)',
          borderRadius: 16,
          padding: '36px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--t1)', marginBottom: 6 }}>
            Sign in
          </h2>
          <p style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 28, fontFamily: '"DM Mono",monospace' }}>
            Enter your credentials to continue
          </p>

          {error && (
            <div style={{
              background: 'var(--red-dim)', border: '1px solid rgba(255,107,107,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              color: 'var(--red)', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label">Email address</label>
              <input
                className="input"
                type="email"
                required
                autoFocus
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                required
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                width: '100%', padding: '11px',
                background: loading ? 'var(--bg3)' : 'var(--cyan)',
                color: loading ? 'var(--t3)' : 'var(--bg)',
                border: 'none', borderRadius: 8,
                fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: '14px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Default Credentials
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)' }}>
              <span style={{ color: 'var(--t3)' }}>Email: </span>admin@tamt.local<br/>
              <span style={{ color: 'var(--t3)' }}>Password: </span>password
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
