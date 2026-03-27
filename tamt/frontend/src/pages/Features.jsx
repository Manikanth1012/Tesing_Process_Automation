import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download } from 'lucide-react';
import { featuresAPI, downloadXlsx } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';

const API_SUB_TYPES = ['Technical', 'Functional', 'Both'];

export default function Features() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ feature_type: '', priority: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', feature_type: 'Functional', api_sub_type: 'Both', priority: 'P2',
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    featuresAPI.list({ search, ...filter }).then(r => { setFeatures(r.data); setLoading(false); });
  };

  useEffect(() => { load(); }, [search, filter.feature_type, filter.priority]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await featuresAPI.create(form);
      setShowCreate(false);
      setForm({ name: '', description: '', feature_type: 'Functional', api_sub_type: 'Both', priority: 'P2' });
      load();
    } finally { setSaving(false); }
  };

  const handleDownload = () => {
    const qs = new URLSearchParams({ ...(filter.feature_type && { feature_type: filter.feature_type }), ...(search && { search }) }).toString();
    downloadXlsx(`/reports/export/test-cases${qs ? '?' + qs : ''}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Features</h1>
          <p className="text-sm text-gray-500 mt-0.5">{features.length} features</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Export Test Cases
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Feature
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search features..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-40" value={filter.feature_type} onChange={e => setFilter(p => ({ ...p, feature_type: e.target.value }))}>
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
        {!loading && features.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No features yet. Create one to get started.</div>
        )}
        {features.map(f => (
          <Link key={f.id} to={`/features/${f.id}`} className="flex items-center px-5 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-medium text-gray-900">{f.name}</span>
                <StatusBadge status={f.status} />
                <StatusBadge status={f.priority} />
                {/* API sub-type pill */}
                {f.feature_type === 'API' && f.api_sub_type && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                    {f.api_sub_type}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 truncate">{f.description || 'No description'}</div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500 ml-4">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{f.feature_type}</span>
              <div className="text-center">
                <div className="font-semibold text-gray-900">{f.prereq_readiness ?? 0}%</div>
                <div className="text-xs">readiness</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">{f.test_case_count ?? 0}</div>
                <div className="text-xs">cases</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Feature">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-24 resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Feature Type</label>
              <select className="input" value={form.feature_type}
                onChange={e => setForm(p => ({ ...p, feature_type: e.target.value, api_sub_type: 'Both' }))}>
                <option>API</option><option>Functional</option><option>GUI</option><option>Performance</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                <option>P1</option><option>P2</option><option>P3</option>
              </select>
            </div>
          </div>

          {/* API sub-type — only shown for API features */}
          {form.feature_type === 'API' && (
            <div>
              <label className="label">API Testing Sub-Type</label>
              <div className="grid grid-cols-3 gap-2">
                {API_SUB_TYPES.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, api_sub_type: sub }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.api_sub_type === sub
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {form.api_sub_type === 'Technical' && 'Focuses on request/response contracts, schemas, and API behaviour.'}
                {form.api_sub_type === 'Functional' && 'Focuses on business flows and end-to-end functional validation via APIs.'}
                {form.api_sub_type === 'Both' && 'Covers both technical contract testing and business functional scenarios.'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Feature'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
