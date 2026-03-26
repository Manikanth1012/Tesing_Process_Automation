import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { featuresAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';

export default function Features() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', feature_type: 'Functional', priority: 'P2' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    featuresAPI.list({ search }).then(r => { setFeatures(r.data); setLoading(false); });
  };

  useEffect(() => { load(); }, [search]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await featuresAPI.create(form);
      setShowCreate(false);
      setForm({ name: '', description: '', feature_type: 'Functional', priority: 'P2' });
      load();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Features</h1>
          <p className="text-sm text-gray-500 mt-0.5">{features.length} features</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Feature
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search features..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card divide-y divide-gray-100">
        {loading && <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>}
        {!loading && features.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No features yet. Create one to get started.</div>
        )}
        {features.map(f => (
          <Link key={f.id} to={`/features/${f.id}`} className="flex items-center px-5 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-gray-900">{f.name}</span>
                <StatusBadge status={f.status} />
                <StatusBadge status={f.priority} />
              </div>
              <div className="text-sm text-gray-500 truncate">{f.description || 'No description'}</div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500 ml-4">
              <span>{f.feature_type}</span>
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
              <label className="label">Type</label>
              <select className="input" value={form.feature_type} onChange={e => setForm(p => ({ ...p, feature_type: e.target.value }))}>
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
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Feature'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
