import React, { useEffect, useState, useRef } from 'react';
import { Trash2, Upload, FileText, Plus, UserPlus, Edit2, X, ShieldCheck } from 'lucide-react';
import { environmentsAPI, agentsAPI, refTemplatesAPI, usersAPI } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';

const TEMPLATE_TYPES = ['FUNCTIONAL_TC', 'GUI_TC', 'API_SPEC', 'SWAGGER'];
const TEMPLATE_TYPE_LABELS = {
  FUNCTIONAL_TC: 'Functional TC Template',
  GUI_TC: 'GUI TC Template',
  API_SPEC: 'API Specification',
  SWAGGER: 'Swagger / OpenAPI Contract',
};
const TABS = ['Environments', 'Users & Roles', 'Global Templates', 'Agent Logs'];
const USER_ROLES = ['QA_ENGINEER', 'QA_LEAD', 'DEVELOPER', 'MANAGER', 'ADMIN'];
const SYSTEM_ROLES = ['User', 'Admin', 'SuperAdmin'];

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px', fontSize: 13, fontWeight: 500,
        borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
        color: active ? 'var(--cyan)' : 'var(--t2)',
        background: 'none', border: 'none',
        borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
        cursor: 'pointer', transition: 'color 0.2s',
      }}
    >
      {label}
    </button>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('Environments');
  const [environments, setEnvironments] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [globalTemplates, setGlobalTemplates] = useState([]);
  const [users, setUsers] = useState([]);

  // Env modal
  const [showAddEnv, setShowAddEnv] = useState(false);
  const [envForm, setEnvForm] = useState({ name: '', base_url: '', env_type: 'SIT' });

  // User modals
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'QA_ENGINEER', system_role: 'User' });

  // Template modal
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', template_type: 'FUNCTIONAL_TC', description: '', content: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMode, setUploadMode] = useState('file');

  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (tab === 'Environments') environmentsAPI.list().then(r => setEnvironments(r.data));
    else if (tab === 'Agent Logs') agentsAPI.getHistory({ limit: 50 }).then(r => setAgentLogs(r.data));
    else if (tab === 'Global Templates') loadGlobalTemplates();
    else if (tab === 'Users & Roles') usersAPI.list().then(r => setUsers(r.data));
  }, [tab]);

  const loadGlobalTemplates = () => refTemplatesAPI.list({ is_global: 1 }).then(r => setGlobalTemplates(r.data));

  const handleAddEnv = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await environmentsAPI.create(envForm);
      setShowAddEnv(false);
      setEnvForm({ name: '', base_url: '', env_type: 'SIT' });
      environmentsAPI.list().then(r => setEnvironments(r.data));
    } finally { setSaving(false); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await usersAPI.create(userForm);
      setShowAddUser(false);
      setUserForm({ name: '', email: '', password: '', role: 'QA_ENGINEER', system_role: 'User' });
      usersAPI.list().then(r => setUsers(r.data));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  };

  const handleEditUser = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...userForm };
      if (!payload.password) delete payload.password;
      await usersAPI.update(selectedUser.id, payload);
      setShowEditUser(false);
      usersAPI.list().then(r => setUsers(r.data));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  };

  const openEditUser = (user) => {
    setSelectedUser(user);
    setUserForm({ name: user.name, email: user.email, password: '', role: user.role, system_role: user.system_role || 'User' });
    setShowEditUser(true);
  };

  const handleDeactivateUser = async (user) => {
    if (!confirm(`Deactivate ${user.name}?`)) return;
    await usersAPI.deactivate(user.id);
    usersAPI.list().then(r => setUsers(r.data));
  };

  const handleAddTemplate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (uploadMode === 'file' && uploadFile) {
        const fd = new FormData();
        fd.append('file', uploadFile);
        fd.append('name', templateForm.name);
        fd.append('template_type', templateForm.template_type);
        fd.append('description', templateForm.description);
        fd.append('is_global', '1');
        await refTemplatesAPI.upload(fd);
      } else {
        await refTemplatesAPI.uploadInline({ ...templateForm, is_global: true });
      }
      setShowAddTemplate(false);
      setTemplateForm({ name: '', template_type: 'FUNCTIONAL_TC', description: '', content: '' });
      setUploadFile(null);
      loadGlobalTemplates();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this global template?')) return;
    await refTemplatesAPI.delete(id);
    loadGlobalTemplates();
  };

  const grouped = TEMPLATE_TYPES.reduce((acc, t) => {
    acc[t] = globalTemplates.filter(tmpl => tmpl.template_type === t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--t1)' }}>Settings</h1>

      <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 0 }}>
        {TABS.map(t => <Tab key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {/* ── Environments ── */}
      {tab === 'Environments' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddEnv(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Environment</button>
          </div>
          <div className="card divide-y" style={{ '--divide-color': 'var(--border)' }}>
            {environments.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)' }}>No environments configured.</div>}
            {environments.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--t1)', fontWeight: 500 }}>{e.name}</div>
                  <div style={{ color: 'var(--t3)', fontSize: 12, fontFamily: '"DM Mono",monospace' }}>{e.base_url}</div>
                </div>
                <span className="badge badge-cyan">{e.env_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Users & Roles ── */}
      {tab === 'Users & Roles' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>Manage platform users and their system-level roles. Project-level roles are managed inside each project.</p>
            <button onClick={() => setShowAddUser(true)} className="btn-primary text-sm"><UserPlus className="w-4 h-4" /> Add User</button>
          </div>
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Email', 'Job Role', 'System Role', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--cyan)', flexShrink: 0 }}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--t2)', fontSize: 13 }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t3)' }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <SystemRoleBadge role={u.system_role || 'User'} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={u.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEditUser(u)} style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeactivateUser(u)} style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Deactivate">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)' }}>No users found.</div>}
          </div>
        </div>
      )}

      {/* ── Global Templates ── */}
      {tab === 'Global Templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>Global templates are available as AI agent context across all features.</p>
            <button onClick={() => setShowAddTemplate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add Template</button>
          </div>
          {TEMPLATE_TYPES.map(type => (
            <div key={type} className="card">
              <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: '12px 12px 0 0' }}>
                <h3 style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--cyan)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {TEMPLATE_TYPE_LABELS[type]}
                </h3>
              </div>
              {grouped[type].length === 0 ? (
                <div style={{ padding: '24px 18px', color: 'var(--t3)', textAlign: 'center', fontSize: 13 }}>No global templates of this type.</div>
              ) : grouped[type].map(tmpl => (
                <div key={tmpl.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
                  <FileText className="w-4 h-4 flex-shrink-0 mr-3" style={{ color: 'var(--t3)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--t1)', fontWeight: 500, fontSize: 13 }}>{tmpl.name}</div>
                    {tmpl.description && <div style={{ color: 'var(--t3)', fontSize: 11 }}>{tmpl.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginLeft: 12, alignItems: 'center' }}>
                    <a href={`/api/v1/ref-templates/${tmpl.id}/download`} target="_blank" rel="noreferrer"
                      style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--cyan)', textDecoration: 'none' }}>
                      Download
                    </a>
                    <button onClick={() => handleDeleteTemplate(tmpl.id)} style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Agent Logs ── */}
      {tab === 'Agent Logs' && (
        <div className="card">
          {agentLogs.length === 0 && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)' }}>No agent runs recorded.</div>}
          {agentLogs.map(log => (
            <div key={log.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 500, color: 'var(--t1)', fontSize: 13 }}>{log.agent_type}</span>
                <span className={`badge ${log.status === 'Completed' ? 'badge-green' : log.status === 'Failed' ? 'badge-red' : 'badge-amber'}`}>
                  {log.status}
                </span>
              </div>
              <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t3)' }}>
                {log.trigger_entity_type} #{log.trigger_entity_id} · {log.tokens_used || 0} tokens · {log.duration_ms || 0}ms
              </div>
              {log.error_message && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{log.error_message}</div>}
              <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{log.created_at}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Environment Modal ── */}
      <Modal open={showAddEnv} onClose={() => setShowAddEnv(false)} title="Add Environment">
        <form onSubmit={handleAddEnv} className="space-y-4">
          <div><label className="label">Name *</label><input className="input" required value={envForm.name} onChange={e => setEnvForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Base URL *</label><input className="input" required type="url" value={envForm.base_url} onChange={e => setEnvForm(p => ({ ...p, base_url: e.target.value }))} /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={envForm.env_type} onChange={e => setEnvForm(p => ({ ...p, env_type: e.target.value }))}>
              {['SIT', 'UAT', 'PROD', 'DEV'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddEnv(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Add User Modal ── */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Add User">
        <form onSubmit={handleAddUser} className="space-y-4">
          <div><label className="label">Full Name *</label><input className="input" required value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Email *</label><input className="input" required type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><label className="label">Password *</label><input className="input" required type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Job Role</label>
              <select className="input" value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}>
                {USER_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">System Role</label>
              <select className="input" value={userForm.system_role} onChange={e => setUserForm(p => ({ ...p, system_role: e.target.value }))}>
                {SYSTEM_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddUser(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal open={showEditUser} onClose={() => setShowEditUser(false)} title={`Edit: ${selectedUser?.name || ''}`}>
        <form onSubmit={handleEditUser} className="space-y-4">
          <div><label className="label">Full Name *</label><input className="input" required value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Email *</label><input className="input" required type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><label className="label">New Password <span style={{ color: 'var(--t3)', textTransform: 'none', letterSpacing: 0 }}>(leave blank to keep current)</span></label><input className="input" type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Job Role</label>
              <select className="input" value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}>
                {USER_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">System Role</label>
              <select className="input" value={userForm.system_role} onChange={e => setUserForm(p => ({ ...p, system_role: e.target.value }))}>
                {SYSTEM_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowEditUser(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Add Global Template Modal ── */}
      <Modal open={showAddTemplate} onClose={() => setShowAddTemplate(false)} title="Add Global Template">
        <form onSubmit={handleAddTemplate} className="space-y-4">
          <div><label className="label">Name *</label><input className="input" required value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div>
            <label className="label">Template Type</label>
            <select className="input" value={templateForm.template_type} onChange={e => setTemplateForm(p => ({ ...p, template_type: e.target.value }))}>
              {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div><label className="label">Description</label><input className="input" value={templateForm.description} onChange={e => setTemplateForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['file', 'paste'].map(m => (
              <button key={m} type="button" onClick={() => setUploadMode(m)}
                style={{
                  flex: 1, padding: '8px', fontSize: 13, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  background: uploadMode === m ? 'var(--cyan-dim)' : 'var(--bg3)',
                  color: uploadMode === m ? 'var(--cyan)' : 'var(--t2)',
                  border: `1px solid ${uploadMode === m ? 'var(--border-hi)' : 'var(--border)'}`,
                }}>
                {m === 'file' ? '📁 Upload File' : '📋 Paste Content'}
              </button>
            ))}
          </div>
          {uploadMode === 'file' ? (
            <div>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0])} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ width: '100%', border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', fontSize: 13, color: uploadFile ? 'var(--cyan)' : 'var(--t3)', background: 'none', cursor: 'pointer' }}>
                {uploadFile ? uploadFile.name : 'Click to select file'}
              </button>
            </div>
          ) : (
            <div>
              <label className="label">Content *</label>
              <textarea className="input" rows={6} style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, resize: 'none' }}
                value={templateForm.content} onChange={e => setTemplateForm(p => ({ ...p, content: e.target.value }))} placeholder="Paste template content here…" />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddTemplate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add Template'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SystemRoleBadge({ role }) {
  const map = { SuperAdmin: 'badge-red', Admin: 'badge-amber', User: 'badge-gray' };
  return <span className={`badge ${map[role] || 'badge-gray'}`}>{role}</span>;
}
