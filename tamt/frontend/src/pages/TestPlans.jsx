import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { testPlansAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';

export default function TestPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', target_release: '' });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); testPlansAPI.list().then(r => { setPlans(r.data); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await testPlansAPI.create(form); setShowCreate(false); load(); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Test Plans</h1></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Plan</button>
      </div>

      <div className="card divide-y divide-gray-100">
        {loading && <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>}
        {!loading && plans.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No test plans yet.</div>}
        {plans.map(p => (
          <Link key={p.id} to={`/test-plans/${p.id}`} className="flex items-center px-5 py-4 hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-gray-900">{p.name}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="text-sm text-gray-500">{p.target_release || 'No release'}</div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500 ml-4">
              <div className="text-center"><div className="font-semibold text-gray-900">{p.feature_count}</div><div className="text-xs">features</div></div>
              <div className="text-center"><div className="font-semibold text-gray-900">{p.run_count}</div><div className="text-xs">runs</div></div>
            </div>
          </Link>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Test Plan">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Description</label><textarea className="input min-h-20 resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div><label className="label">Target Release</label><input className="input" value={form.target_release} onChange={e => setForm(p => ({ ...p, target_release: e.target.value }))} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
