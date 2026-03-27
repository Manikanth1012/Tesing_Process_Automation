import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight, Plus, Users, ClipboardList, TestTube,
  Bug, Settings2, Trash2, UserPlus, X,
} from 'lucide-react';
import { projectsAPI, usersAPI } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

const ROLES = ['Admin', 'Lead', 'Tester', 'Viewer'];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('plans');
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [memberForm, setMemberForm] = useState({ user_id: '', role: 'Tester' });
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = () => {
    projectsAPI.get(id).then(r => {
      setProject(r.data);
      setEditForm({ name: r.data.name, description: r.data.description, status: r.data.status });
      setLoading(false);
    });
  };
  useEffect(load, [id]);

  useEffect(() => {
    if (showAddMember) usersAPI.list().then(r => setAllUsers(r.data));
  }, [showAddMember]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await projectsAPI.addMember(id, memberForm);
      setShowAddMember(false);
      setMemberForm({ user_id: '', role: 'Tester' });
      load();
    } finally { setSaving(false); }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member from the project?')) return;
    await projectsAPI.removeMember(id, userId);
    load();
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await projectsAPI.update(id, editForm);
      setShowEdit(false);
      load();
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--t3)' }}>Loading…</div>;
  if (!project) return <div style={{ color: 'var(--red)', padding: 24 }}>Project not found</div>;

  const { testPlans = [], members = [], stats = {} } = project;
  const TABS = [
    { key: 'plans', label: 'Test Plans', count: testPlans.length },
    { key: 'members', label: 'Members', count: members.length },
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t3)' }}>
        <Link to="/projects" style={{ color: 'var(--t3)', textDecoration: 'none' }} className="hover:text-brand-500">Projects</Link>
        <ChevronRight className="w-3 h-3" />
        <span style={{ color: 'var(--t2)' }}>{project.name}</span>
      </div>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                fontFamily: '"DM Mono",monospace', fontSize: 11, fontWeight: 500,
                color: 'var(--cyan)', background: 'var(--cyan-dim)',
                border: '1px solid var(--border-hi)',
                padding: '2px 8px', borderRadius: 4, letterSpacing: '0.06em',
              }}>
                {project.key}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--t1)', marginBottom: 6 }}>
              {project.name}
            </h1>
            {project.description && (
              <p style={{ color: 'var(--t2)', fontSize: 14, maxWidth: 600 }}>{project.description}</p>
            )}
          </div>
          <button onClick={() => setShowEdit(true)} className="btn-secondary text-sm">
            <Settings2 className="w-4 h-4" /> Edit
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 32, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <StatPill label="Test Plans" value={testPlans.length} color="var(--cyan)" />
          <StatPill label="Test Cases" value={stats.total_test_cases || 0} color="var(--green)" />
          <StatPill label="Automated" value={stats.automated_cases || 0} color="var(--purple)" />
          <StatPill label="Open Defects" value={stats.open_defects || 0} color="var(--red)" />
          <StatPill label="Team Members" value={members.length} color="var(--amber)" />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px', fontSize: 13, fontWeight: 500,
              borderBottom: tab === t.key ? '2px solid var(--cyan)' : '2px solid transparent',
              color: tab === t.key ? 'var(--cyan)' : 'var(--t2)',
              background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--cyan)' : '2px solid transparent',
              cursor: 'pointer', transition: 'color 0.2s',
              fontFamily: '"DM Sans",sans-serif',
            }}
          >
            {t.label}
            <span style={{
              marginLeft: 6,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '1px 6px',
              fontSize: 10,
              fontFamily: '"DM Mono",monospace',
              color: 'var(--t3)',
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Test Plans Tab */}
      {tab === 'plans' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link to="/test-plans" className="btn-secondary text-sm">
              <Plus className="w-4 h-4" /> Create Test Plan
            </Link>
          </div>
          <div className="card divide-y" style={{ '--tw-divide-opacity': 1 }}>
            {testPlans.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)' }}>
                No test plans yet. <Link to="/test-plans" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>Create one</Link> and link it to this project.
              </div>
            )}
            {testPlans.map(tp => (
              <Link key={tp.id} to={`/test-plans/${tp.id}`}
                style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}
                className="hover:bg-bg-2 transition-colors"
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 500, color: 'var(--t1)', fontSize: 14 }}>{tp.name}</span>
                    <StatusBadge status={tp.status} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: '"DM Mono",monospace' }}>
                    {tp.feature_count || 0} features · {tp.run_count || 0} runs
                    {tp.target_release && ` · ${tp.target_release}`}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--t3)' }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddMember(true)} className="btn-secondary text-sm">
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          </div>
          <div className="card divide-y">
            {members.map(m => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0, marginRight: 12,
                  background: 'var(--bg3)', border: '1px solid var(--border-hi)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: '"DM Mono",monospace', fontSize: 12, color: 'var(--cyan)', fontWeight: 500,
                }}>
                  {m.name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--t1)', fontWeight: 500, fontSize: 14 }}>{m.name}</div>
                  <div style={{ color: 'var(--t3)', fontSize: 12 }}>{m.email}</div>
                </div>
                <RoleBadge role={m.role} />
                <button onClick={() => handleRemoveMember(m.user_id)}
                  style={{ marginLeft: 12, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  className="hover:text-danger"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {members.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)' }}>No members yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Project Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="label">User *</label>
            <select className="input" required value={memberForm.user_id}
              onChange={e => setMemberForm(p => ({ ...p, user_id: e.target.value }))}>
              <option value="">Select a user…</option>
              {allUsers
                .filter(u => !members.find(m => m.user_id === u.id))
                .map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label className="label">Project Role</label>
            <select className="input" value={memberForm.role}
              onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add Member'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Project">
        <form onSubmit={handleUpdateProject} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={editForm.name || ''}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={editForm.description || ''}
              onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status || 'Active'}
              onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
              {['Active', 'On Hold', 'Archived'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = { Admin: 'badge-red', Lead: 'badge-amber', Tester: 'badge-cyan', Viewer: 'badge-gray' };
  return <span className={`badge ${colors[role] || 'badge-gray'}`}>{role}</span>;
}
