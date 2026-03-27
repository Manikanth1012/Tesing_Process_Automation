import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { testCasesAPI, downloadXlsx } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';

export default function TestCases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ status: '', test_type: '', priority: '' });

  useEffect(() => {
    setLoading(true);
    testCasesAPI.list({ search, ...filter }).then(r => { setCases(r.data); setLoading(false); });
  }, [search, filter.status, filter.test_type, filter.priority]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--t1)' }}>Test Cases</h1>
          <p style={{ color: 'var(--t3)', fontSize: 13, marginTop: 2 }}>{cases.length} cases</p>
        </div>
        <button
          onClick={() => {
            const qs = new URLSearchParams({
              ...(filter.status && { status: filter.status }),
              ...(filter.test_type && { test_type: filter.test_type }),
              ...(filter.priority && { priority: filter.priority }),
              ...(search && { search }),
            }).toString();
            downloadXlsx(`/reports/export/test-cases${qs ? '?' + qs : ''}`);
          }}
          className="btn-secondary text-sm"
        >
          <Download className="w-4 h-4" /> Export XLSX
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--t3)' }} />
          <input className="input pl-9" placeholder="Search test cases..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-36" value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          {['Draft', 'Review', 'Approved', 'Deprecated'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input w-36" value={filter.test_type} onChange={e => setFilter(p => ({ ...p, test_type: e.target.value }))}>
          <option value="">All Types</option>
          {['API', 'Functional', 'GUI', 'Performance'].map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input w-28" value={filter.priority} onChange={e => setFilter(p => ({ ...p, priority: e.target.value }))}>
          <option value="">All</option>
          {['P1', 'P2', 'P3'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Loading...</div>}
        {!loading && cases.length === 0 && <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>No test cases found.</div>}
        {cases.map(tc => (
          <Link key={tc.id} to={`/test-cases/${tc.id}`}
            style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--t1)' }} className="truncate">{tc.title}</span>
                <StatusBadge status={tc.status} />
                <StatusBadge status={tc.priority} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>{tc.test_type} · {tc.automation_status}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 16 }}>{tc.script_count || 0} script{tc.script_count !== 1 ? 's' : ''}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
