import React, { useEffect, useState } from 'react';
import { environmentsAPI, agentsAPI } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';

export default function Settings() {
  const [tab, setTab] = useState('Environments');
  const [environments, setEnvironments] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [showAddEnv, setShowAddEnv] = useState(false);
  const [envForm, setEnvForm] = useState({ name: '', base_url: '', env_type: 'SIT' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tab === 'Environments') {
      environmentsAPI.list().then(r => setEnvironments(r.data));
    } else if (tab === 'Agent Logs') {
      agentsAPI.getHistory({ limit: 50 }).then(r => setAgentLogs(r.data));
    }
  }, [tab]);

  const handleAddEnv = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await environmentsAPI.create(envForm);
      setShowAddEnv(false);
      setEnvForm({ name: '', base_url: '', env_type: 'SIT' });
      environmentsAPI.list().then(r => setEnvironments(r.data));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {['Environments', 'Agent Logs'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'Environments' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddEnv(true)} className="btn-primary text-sm">+ Add Environment</button>
          </div>
          <div className="card divide-y divide-gray-100">
            {environments.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No environments configured.</div>}
            {environments.map(e => (
              <div key={e.id} className="flex items-center px-5 py-3 text-sm">
                <div className="flex-1"><div className="font-medium text-gray-900">{e.name}</div><div className="text-gray-500 text-xs">{e.base_url}</div></div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.env_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'Agent Logs' && (
        <div className="card divide-y divide-gray-100">
          {agentLogs.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No agent runs recorded.</div>}
          {agentLogs.map(log => (
            <div key={log.id} className="px-5 py-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900">{log.agent_type}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${log.status === 'Completed' ? 'bg-green-100 text-green-700' : log.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{log.status}</span>
              </div>
              <div className="text-gray-500 text-xs">{log.trigger_entity_type} #{log.trigger_entity_id} · {log.tokens_used} tokens · {log.duration_ms}ms</div>
              {log.error_message && <div className="text-red-500 text-xs mt-1">{log.error_message}</div>}
              <div className="text-gray-400 text-xs">{log.created_at}</div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAddEnv} onClose={() => setShowAddEnv(false)} title="Add Environment">
        <form onSubmit={handleAddEnv} className="space-y-4">
          <div><label className="label">Name *</label><input className="input" required value={envForm.name} onChange={e => setEnvForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Base URL *</label><input className="input" required type="url" value={envForm.base_url} onChange={e => setEnvForm(p => ({ ...p, base_url: e.target.value }))} /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={envForm.env_type} onChange={e => setEnvForm(p => ({ ...p, env_type: e.target.value }))}>
              <option>SIT</option><option>UAT</option><option>PROD</option><option>DEV</option>
            </select>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowAddEnv(false)} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
