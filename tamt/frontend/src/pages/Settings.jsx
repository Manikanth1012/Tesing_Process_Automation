import React, { useEffect, useState, useRef } from 'react';
import { Trash2, Upload, FileText, Plus, UserPlus, Edit2, X, ShieldCheck, KeyRound, Cpu, ChevronDown } from 'lucide-react';
import { environmentsAPI, agentsAPI, refTemplatesAPI, usersAPI, authAPI, skillsAPI, assistantContextAPI, configAPI, permissionsAPI } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';

const TEMPLATE_TYPES = ['FUNCTIONAL_TC', 'GUI_TC', 'API_SPEC', 'SWAGGER'];
const TEMPLATE_TYPE_LABELS = {
  FUNCTIONAL_TC: 'Functional TC Template',
  GUI_TC: 'GUI TC Template',
  API_SPEC: 'API Specification',
  SWAGGER: 'Swagger / OpenAPI Contract',
};
const TABS = ['Environments', 'Users & Roles', 'Global Templates', 'Agent Logs', 'My Profile', 'Integrations', 'Roles & Permissions'];
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

  // My Profile — Change Password
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg] = useState(null); // { type: 'success'|'error', text: '' }
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('tamt_user') || '{}'); } catch { return {}; } })();

  // My Profile — Skills
  const [mySkills, setMySkills] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [newSkill, setNewSkill] = useState({ skill_name: '', skill_level: 'Intermediate' });
  const [skillSearch, setSkillSearch] = useState('');
  const [contextStatus, setContextStatus] = useState(null);
  const [reindexing, setReindexing] = useState(false);

  // Integrations tab
  const [intConfig, setIntConfig] = useState({});
  const [intSaving, setIntSaving] = useState(false);
  const [intMsg, setIntMsg] = useState(null);

  // Roles & Permissions tab
  const [permMatrix, setPermMatrix] = useState({});
  const [allPermissions, setAllPermissions] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [permLoading, setPermLoading] = useState(false);

  useEffect(() => {
    if (tab === 'Environments') environmentsAPI.list().then(r => setEnvironments(r.data));
    else if (tab === 'Agent Logs') agentsAPI.getHistory({ limit: 50 }).then(r => setAgentLogs(r.data));
    else if (tab === 'Global Templates') loadGlobalTemplates();
    else if (tab === 'Users & Roles') usersAPI.list().then(r => setUsers(r.data));
    else if (tab === 'My Profile') {
      skillsAPI.getMySkills().then(r => setMySkills(r.data)).catch(() => {});
      skillsAPI.getCatalog().then(r => setCatalog(r.data)).catch(() => {});
      assistantContextAPI.status().then(r => setContextStatus(r.data)).catch(() => {});
    }
    else if (tab === 'Integrations') {
      configAPI.getAll().then(r => {
        const map = {};
        (r.data || []).forEach(row => { map[row.key] = row.value; });
        setIntConfig(map);
      }).catch(() => {});
    }
    else if (tab === 'Roles & Permissions') {
      setPermLoading(true);
      permissionsAPI.get().then(r => {
        setPermMatrix(r.data.matrix || {});
        setAllPermissions(r.data.permissions || []);
        setAllRoles(r.data.roles || []);
      }).catch(() => {}).finally(() => setPermLoading(false));
    }
  }, [tab]);

  const handleAddSkill = async (skillName, level = newSkill.skill_level) => {
    try {
      const r = await skillsAPI.addSkill({ skill_name: skillName, skill_level: level });
      setMySkills(prev => [...prev, r.data]);
      setNewSkill(p => ({ ...p, skill_name: '' }));
      setSkillSearch('');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleRemoveSkill = async (id) => {
    await skillsAPI.removeSkill(id);
    setMySkills(prev => prev.filter(s => s.id !== id));
  };

  const handleCycleLevel = async (skill) => {
    const levels = ['Beginner', 'Intermediate', 'Expert'];
    const next = levels[(levels.indexOf(skill.skill_level) + 1) % levels.length];
    await skillsAPI.updateSkill(skill.id, { skill_level: next });
    setMySkills(prev => prev.map(s => s.id === skill.id ? { ...s, skill_level: next } : s));
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const r = await assistantContextAPI.reindex();
      setContextStatus(prev => ({ ...prev, message: r.data.message }));
      assistantContextAPI.status().then(r2 => setContextStatus(r2.data)).catch(() => {});
    } catch (err) {
      alert('Re-index failed: ' + (err.response?.data?.error || err.message));
    } finally { setReindexing(false); }
  };

  const handleSaveIntegrations = async (e) => {
    e.preventDefault();
    setIntSaving(true); setIntMsg(null);
    try {
      await configAPI.update(intConfig);
      setIntMsg({ type: 'success', text: 'Configuration saved.' });
    } catch (err) {
      setIntMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save.' });
    } finally { setIntSaving(false); }
  };

  const handleTogglePerm = async (role, permission, current) => {
    const allowed = !current;
    try {
      await permissionsAPI.update({ role, permission, allowed });
      setPermMatrix(prev => ({
        ...prev,
        [role]: { ...(prev[role] || {}), [permission]: allowed },
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update permission.');
    }
  };

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

      {/* ── My Profile ── */}
      {tab === 'My Profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Left: identity + change password */}
          <div className="space-y-4">
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"DM Mono",monospace', fontSize: 18, color: 'var(--cyan)', fontWeight: 600, flexShrink: 0 }}>
                  {currentUser.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--t1)' }}>{currentUser.name || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)', fontFamily: '"DM Mono",monospace' }}>{currentUser.email}</div>
                </div>
              </div>

              <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--t1)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <KeyRound className="w-4 h-4" style={{ color: 'var(--cyan)' }} /> Change Password
              </h3>

              {pwMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
                  background: pwMsg.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                  border: `1px solid ${pwMsg.type === 'success' ? 'rgba(61,214,140,0.3)' : 'rgba(255,107,107,0.3)'}`,
                  color: pwMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
                }}>{pwMsg.text}</div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault(); setPwMsg(null);
                if (pwForm.new_password !== pwForm.confirm_password) { setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return; }
                if (pwForm.new_password.length < 8) { setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
                setSaving(true);
                try {
                  await authAPI.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
                  setPwMsg({ type: 'success', text: 'Password changed successfully.' });
                  setPwForm({ current_password: '', new_password: '', confirm_password: '' });
                } catch (err) {
                  setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password.' });
                } finally { setSaving(false); }
              }} className="space-y-3">
                <div><label className="label">Current Password *</label><input className="input" type="password" required value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} /></div>
                <div><label className="label">New Password *</label><input className="input" type="password" required value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} placeholder="Min. 8 characters" /></div>
                <div><label className="label">Confirm New Password *</label><input className="input" type="password" required value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} /></div>
                <div style={{ paddingTop: 4 }}>
                  <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Update Password'}</button>
                </div>
              </form>
            </div>

            {/* Context status */}
            {contextStatus && (
              <div className="card" style={{ padding: '16px 20px' }}>
                <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--t1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Cpu className="w-4 h-4" style={{ color: 'var(--cyan)' }} /> AI Context Index
                </h3>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
                  Engine: <span style={{ color: 'var(--cyan)', fontFamily: '"DM Mono",monospace' }}>{contextStatus.engine}</span>
                  {contextStatus.engine === 'tfidf' && <span style={{ marginLeft: 8, color: 'var(--t3)', fontStyle: 'italic' }}>(set VOYAGE_API_KEY for neural embeddings)</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {(contextStatus.indexed || []).map(row => (
                    <span key={row.entity_type} className="badge badge-gray">
                      {row.entity_type}: {row.count}
                    </span>
                  ))}
                  {(!contextStatus.indexed || contextStatus.indexed.length === 0) && (
                    <span style={{ color: 'var(--t3)', fontSize: 12 }}>No documents indexed yet.</span>
                  )}
                </div>
                <button onClick={handleReindex} disabled={reindexing} className="btn-secondary text-sm">
                  {reindexing ? 'Indexing…' : 'Re-index All Platform Data'}
                </button>
              </div>
            )}
          </div>

          {/* Right: Skills */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--t1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--cyan)' }} /> My Skills
            </h3>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>
              The AI assistant uses your skill profile to tailor answer depth and terminology. Click a skill chip to cycle its level.
            </p>

            {/* Current skills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, minHeight: 32 }}>
              {mySkills.length === 0 && <span style={{ color: 'var(--t3)', fontSize: 12, fontStyle: 'italic' }}>No skills added yet.</span>}
              {mySkills.map(skill => (
                <div key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border-hi)' }}>
                  <button
                    onClick={() => handleCycleLevel(skill)}
                    title="Click to change level"
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      background: skill.skill_level === 'Expert' ? 'var(--green-dim)' : skill.skill_level === 'Intermediate' ? 'var(--cyan-dim)' : 'var(--bg3)',
                      color: skill.skill_level === 'Expert' ? 'var(--green)' : skill.skill_level === 'Intermediate' ? 'var(--cyan)' : 'var(--t3)',
                      border: 'none', borderRight: '1px solid var(--border)',
                    }}>
                    {skill.skill_name}
                    <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{skill.skill_level[0]}</span>
                  </button>
                  <button onClick={() => handleRemoveSkill(skill.id)} style={{ padding: '4px 6px', background: 'var(--bg3)', border: 'none', cursor: 'pointer', color: 'var(--t3)', lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add skill */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: 12 }}
                  placeholder="Type or pick a skill…"
                  value={skillSearch || newSkill.skill_name}
                  onChange={e => { setSkillSearch(e.target.value); setNewSkill(p => ({ ...p, skill_name: e.target.value })); }}
                />
                <select className="input" style={{ width: 110, fontSize: 12 }} value={newSkill.skill_level} onChange={e => setNewSkill(p => ({ ...p, skill_level: e.target.value }))}>
                  {['Beginner', 'Intermediate', 'Expert'].map(l => <option key={l}>{l}</option>)}
                </select>
                <button onClick={() => newSkill.skill_name.trim() && handleAddSkill(newSkill.skill_name.trim())} className="btn-primary text-sm" style={{ flexShrink: 0 }}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Catalog browse */}
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {catalog
                  .map(cat => ({
                    ...cat,
                    skills: cat.skills.filter(s =>
                      (!skillSearch || s.toLowerCase().includes(skillSearch.toLowerCase())) &&
                      !mySkills.some(ms => ms.skill_name === s)
                    )
                  }))
                  .filter(cat => cat.skills.length > 0)
                  .map(cat => (
                    <div key={cat.category} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontFamily: '"DM Mono",monospace', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{cat.category}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cat.skills.map(s => (
                          <button key={s} onClick={() => handleAddSkill(s, newSkill.skill_level)}
                            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--t2)', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.color = 'var(--cyan)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--t2)'; }}>
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Integrations ── */}
      {tab === 'Integrations' && (
        <div style={{ maxWidth: 680 }}>
          <p style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 20 }}>
            Configure LLM and vector store credentials. Secrets are stored encrypted in the platform database and never exposed in full after saving.
          </p>
          {intMsg && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
              background: intMsg.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${intMsg.type === 'success' ? 'rgba(61,214,140,0.3)' : 'rgba(255,107,107,0.3)'}`,
              color: intMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
            }}>{intMsg.text}</div>
          )}
          <form onSubmit={handleSaveIntegrations} className="space-y-4">

            {/* LLM section */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--t1)', marginBottom: 16 }}>
                Language Model (Claude / Anthropic)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Anthropic API Key</label>
                  <input className="input" type="password" placeholder="sk-ant-…  (leave blank to keep existing)"
                    value={intConfig.llm_api_key || ''}
                    onChange={e => setIntConfig(p => ({ ...p, llm_api_key: e.target.value }))} />
                  <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Used for AI assistant chat and agent runs.</p>
                </div>
                <div>
                  <label className="label">Claude Model</label>
                  <input className="input" placeholder="claude-sonnet-4-6"
                    value={intConfig.llm_model || ''}
                    onChange={e => setIntConfig(p => ({ ...p, llm_model: e.target.value }))} />
                  <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Latest: claude-opus-4-6 · claude-sonnet-4-6 · claude-haiku-4-5-20251001</p>
                </div>
              </div>
            </div>

            {/* Vector store section */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--t1)', marginBottom: 16 }}>
                Vector Store / Embeddings
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Embedding Engine</label>
                  <select className="input" value={intConfig.vector_engine || 'tfidf'}
                    onChange={e => setIntConfig(p => ({ ...p, vector_engine: e.target.value }))}>
                    <option value="tfidf">TF-IDF (built-in, no API key needed)</option>
                    <option value="voyage">Voyage AI (neural embeddings)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Voyage AI API Key</label>
                  <input className="input" type="password" placeholder="pa-… (required for Voyage engine)"
                    value={intConfig.voyage_api_key || ''}
                    onChange={e => setIntConfig(p => ({ ...p, voyage_api_key: e.target.value }))} />
                  <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Only used when engine is set to "Voyage AI".</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Top-K Results</label>
                    <input className="input" type="number" min={1} max={20}
                      value={intConfig.vector_top_k || '5'}
                      onChange={e => setIntConfig(p => ({ ...p, vector_top_k: e.target.value }))} />
                    <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Max context chunks retrieved per query.</p>
                  </div>
                  <div>
                    <label className="label">Chat Max History</label>
                    <input className="input" type="number" min={2} max={50}
                      value={intConfig.chat_max_history || '20'}
                      onChange={e => setIntConfig(p => ({ ...p, chat_max_history: e.target.value }))} />
                    <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Number of messages loaded per session.</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={intSaving} className="btn-primary">
                {intSaving ? 'Saving…' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Roles & Permissions ── */}
      {tab === 'Roles & Permissions' && (
        <div>
          <p style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 20 }}>
            Configure what each job role can do within the platform. ADMIN always retains full access and cannot be restricted.
          </p>
          {permLoading && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)' }}>Loading…</div>}
          {!permLoading && allPermissions.length > 0 && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', width: 240 }}>Permission</th>
                    {allRoles.map(role => (
                      <th key={role} style={{ padding: '12px 12px', textAlign: 'center', fontFamily: '"DM Mono",monospace', fontSize: 10, color: role === 'ADMIN' ? 'var(--cyan)' : 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {role.replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPermissions.map(perm => (
                    <tr key={perm.key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--t1)' }}>{perm.label}</div>
                        {perm.description && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{perm.description}</div>}
                      </td>
                      {allRoles.map(role => {
                        const allowed = permMatrix[role]?.[perm.key] ?? false;
                        const isLocked = role === 'ADMIN'; // admin always has all
                        return (
                          <td key={role} style={{ padding: '12px 12px', textAlign: 'center' }}>
                            <button
                              onClick={() => !isLocked && handleTogglePerm(role, perm.key, allowed)}
                              disabled={isLocked}
                              style={{
                                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: isLocked ? 'default' : 'pointer',
                                background: allowed ? 'var(--cyan)' : 'var(--bg3)',
                                border: `1px solid ${allowed ? 'transparent' : 'var(--border)'}`,
                                position: 'relative', transition: 'background 0.2s',
                                opacity: isLocked ? 0.5 : 1,
                              }}
                              title={isLocked ? 'ADMIN always has full access' : (allowed ? 'Click to revoke' : 'Click to grant')}
                            >
                              <span style={{
                                position: 'absolute', top: 2,
                                left: allowed ? 'calc(100% - 18px)' : 2,
                                width: 14, height: 14, borderRadius: '50%',
                                background: allowed ? 'var(--bg)' : 'var(--t3)',
                                transition: 'left 0.2s',
                              }} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
