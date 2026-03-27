import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight, ClipboardList } from 'lucide-react';
import { testPlansAPI, projectsAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';

export default function TestPlans() {
  const [plans, setPlans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', target_release: '', project_id: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([testPlansAPI.list(), projectsAPI.list()])
      .then(([plansRes, projRes]) => {
        setPlans(plansRes.data);
        setProjects(projRes.data);
        setLoading(false);
      });
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await testPlansAPI.create({ ...form, project_id: form.project_id || null });
      setShowCreate(false);
      setForm({ name: '', description: '', target_release: '', project_id: '' });
      load();
    } finally { setSaving(false); }
  };

  // Group by project
  const grouped = {};
  plans.forEach(p => {
    const key = p.project_id ? `${p.project_id}|||${p.project_name}|||${p.project_key}` : 'unassigned';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--t1)', marginBottom: 2 }}>Test Plans</h1>
          <p style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t3)' }}>{plans.length} plans</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Plan</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)' }}>Loading…</div>}

      {Object.entries(grouped).map(([key, keyPlans]) => {
        const parts = key.split('|||');
        const isUnassigned = key === 'unassigned';
        const projectName = isUnassigned ? 'Unassigned' : parts[1];
        const projectKey = isUnassigned ? null : parts[2];
        const projectId = isUnassigned ? null : parts[0];

        return (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {projectKey && (
                <Link to={`/projects/${projectId}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)', padding: '1px 7px', borderRadius: 4 }}>
                    {projectKey}
                  </span>
                </Link>
              )}
              <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 15, color: isUnassigned ? 'var(--t3)' : 'var(--t1)' }}>
                {projectName}
              </h2>
              <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '1px 6px' }}>
                {keyPlans.length}
              </span>
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {keyPlans.map((p, i) => (
                <Link key={p.id} to={`/test-plans/${p.id}`} style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: i < keyPlans.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 14 }}>{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t3)' }}>
                      {p.target_release || 'No release'} · {p.feature_count || 0} features · {p.run_count || 0} runs
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--t3)', flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {!loading && plans.length === 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 0', textAlign: 'center' }}>
          <ClipboardList size={32} style={{ color: 'var(--t3)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--t2)', marginBottom: 16 }}>No test plans yet.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> New Plan</button>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Test Plan">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Project</label>
            <select className="input" value={form.project_id} onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}>
              <option value="">— No project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
            </select>
          </div>
          <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Description</label><textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div><label className="label">Target Release</label><input className="input" placeholder="e.g. v2.1.0" value={form.target_release} onChange={e => setForm(p => ({ ...p, target_release: e.target.value }))} /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
