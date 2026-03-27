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
          <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cases.length} cases</p>
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
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
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

      <div className="card divide-y divide-gray-100">
        {loading && <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>}
        {!loading && cases.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No test cases found.</div>}
        {cases.map(tc => (
          <Link key={tc.id} to={`/test-cases/${tc.id}`} className="flex items-center px-5 py-3 hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm text-gray-900 truncate">{tc.title}</span>
                <StatusBadge status={tc.status} />
                <StatusBadge status={tc.priority} />
              </div>
              <div className="text-xs text-gray-500">{tc.test_type} · {tc.automation_status}</div>
            </div>
            <div className="text-xs text-gray-500 ml-4">{tc.script_count || 0} script{tc.script_count !== 1 ? 's' : ''}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
