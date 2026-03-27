import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Users, ClipboardList, Layers, ChevronRight } from 'lucide-react';
import { projectsAPI } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';

const STATUS_COLORS = {
  Active:    'badge-cyan',
  'On Hold': 'badge-amber',
  Archived:  'badge-gray',
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', key: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    projectsAPI.list().then(r => { setProjects(r.data); setLoading(false); });
  };
  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await projectsAPI.create(form);
      setShowCreate(false);
      setForm({ name: '', key: '', description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false); }
  };

  const autoKey = (name) => name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl" style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, color: 'var(--t1)' }}>
            Projects
          </h1>
          <p style={{ color: 'var(--t3)', fontFamily: '"DM Mono",monospace', fontSize: 12, marginTop: 2 }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Grid */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}>Loading projects…</div>
      )}
      {!loading && projects.length === 0 && (
        <div className="card p-12 text-center">
          <FolderKanban className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--t3)' }} />
          <p style={{ color: 'var(--t2)', marginBottom: 12 }}>No projects yet. Create your first project to organise your test plans.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map(p => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card block p-5 hover:border-border-hi transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: '"DM Mono",monospace', fontSize: 10, fontWeight: 500,
                    color: 'var(--cyan)', background: 'var(--cyan-dim)',
                    border: '1px solid var(--border-hi)',
                    padding: '1px 7px', borderRadius: 4, letterSpacing: '0.06em',
                  }}>
                    {p.key}
                  </span>
                  <span className={`badge ${STATUS_COLORS[p.status] || 'badge-gray'}`}>{p.status}</span>
                </div>
                <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--t1)', marginBottom: 4 }}>
                  {p.name}
                </h3>
                {p.description && (
                  <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }} className="line-clamp-2">
                    {p.description}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--t3)' }} />
            </div>

            <div style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <Stat icon={ClipboardList} value={p.plan_count || 0} label="Plans" />
              <Stat icon={Layers} value={p.feature_count || 0} label="Features" />
              <Stat icon={Users} value={p.member_count || 0} label="Members" />
            </div>
          </Link>
        ))}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setError(''); }} title="New Project">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div>
            <label className="label">Project Name *</label>
            <input
              className="input" required
              placeholder="e.g. Payment Gateway"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value, key: autoKey(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Project Key * <span style={{ color: 'var(--t3)', textTransform: 'none', letterSpacing: 0 }}>(short unique ID, max 10 chars)</span></label>
            <input
              className="input" required
              placeholder="e.g. PAYGW"
              value={form.key}
              onChange={e => setForm(p => ({ ...p, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) }))}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="What is this project testing?" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); setError(''); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Project'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--t3)' }} />
      <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t2)' }}>
        {value} <span style={{ color: 'var(--t3)' }}>{label}</span>
      </span>
    </div>
  );
}
