import React, { useEffect, useState, useRef } from 'react';
import { Trash2, Upload, FileText, Plus } from 'lucide-react';
import { environmentsAPI, agentsAPI, refTemplatesAPI } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';

const TEMPLATE_TYPES = ['FUNCTIONAL_TC', 'GUI_TC', 'API_SPEC', 'SWAGGER'];
const TEMPLATE_TYPE_LABELS = {
  FUNCTIONAL_TC: 'Functional TC Template',
  GUI_TC: 'GUI TC Template',
  API_SPEC: 'API Specification',
  SWAGGER: 'Swagger / OpenAPI Contract',
};

const TABS = ['Environments', 'Global Templates', 'Agent Logs'];

export default function Settings() {
  const [tab, setTab] = useState('Environments');
  const [environments, setEnvironments] = useState([]);
  const [agentLogs, setAgentLogs] = useState([]);
  const [globalTemplates, setGlobalTemplates] = useState([]);
  const [showAddEnv, setShowAddEnv] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [envForm, setEnvForm] = useState({ name: '', base_url: '', env_type: 'SIT' });
  const [templateForm, setTemplateForm] = useState({ name: '', template_type: 'FUNCTIONAL_TC', description: '', content: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMode, setUploadMode] = useState('file');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (tab === 'Environments') {
      environmentsAPI.list().then(r => setEnvironments(r.data));
    } else if (tab === 'Agent Logs') {
      agentsAPI.getHistory({ limit: 50 }).then(r => setAgentLogs(r.data));
    } else if (tab === 'Global Templates') {
      loadGlobalTemplates();
    }
  }, [tab]);

  const loadGlobalTemplates = () => {
    refTemplatesAPI.list({ is_global: 1 }).then(r => setGlobalTemplates(r.data));
  };

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

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    setSaving(true);
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
        await refTemplatesAPI.uploadInline({
          name: templateForm.name,
          template_type: templateForm.template_type,
          description: templateForm.description,
          content: templateForm.content,
          is_global: true,
        });
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
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {TABS.map(t => (
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

      {tab === 'Global Templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Global templates are available to all features as a base reference for agents.</p>
            <button onClick={() => setShowAddTemplate(true)} className="btn-primary text-sm">
              <Plus className="w-4 h-4" /> Add Global Template
            </button>
          </div>

          {TEMPLATE_TYPES.map(type => (
            <div key={type} className="card">
              <div className="px-5 py-3 bg-gray-50 rounded-t-xl border-b border-gray-100">
                <h3 className="font-semibold text-gray-700 text-sm">{TEMPLATE_TYPE_LABELS[type]}</h3>
              </div>
              {grouped[type].length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">No global templates of this type.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {grouped[type].map(tmpl => (
                    <div key={tmpl.id} className="flex items-center px-5 py-3 text-sm">
                      <FileText className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{tmpl.name}</div>
                        {tmpl.description && <div className="text-xs text-gray-500 truncate">{tmpl.description}</div>}
                        <div className="text-xs text-gray-400">{tmpl.file_name}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <a
                          href={`/api/v1/ref-templates/${tmpl.id}/download`}
                          className="text-xs text-blue-600 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                        <button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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

      {/* Add Environment Modal */}
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

      {/* Add Global Template Modal */}
      <Modal open={showAddTemplate} onClose={() => setShowAddTemplate(false)} title="Add Global Template">
        <form onSubmit={handleAddTemplate} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Template Type</label>
            <select className="input" value={templateForm.template_type} onChange={e => setTemplateForm(p => ({ ...p, template_type: e.target.value }))}>
              {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{TEMPLATE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={templateForm.description} onChange={e => setTemplateForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="flex gap-2">
            <button type="button"
              onClick={() => setUploadMode('file')}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${uploadMode === 'file' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              <Upload className="w-4 h-4 inline mr-1" /> Upload File
            </button>
            <button type="button"
              onClick={() => setUploadMode('paste')}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${uploadMode === 'paste' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              <FileText className="w-4 h-4 inline mr-1" /> Paste Content
            </button>
          </div>

          {uploadMode === 'file' ? (
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => setUploadFile(e.target.files[0])} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
                {uploadFile ? uploadFile.name : 'Click to select file'}
              </button>
            </div>
          ) : (
            <div>
              <label className="label">Content *</label>
              <textarea className="input min-h-32 resize-none font-mono text-xs"
                value={templateForm.content}
                onChange={e => setTemplateForm(p => ({ ...p, content: e.target.value }))}
                placeholder="Paste template content here..." />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddTemplate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add Template'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
