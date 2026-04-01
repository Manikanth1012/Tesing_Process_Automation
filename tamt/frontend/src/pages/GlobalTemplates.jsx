import React, { useEffect, useState, useRef } from 'react';
import { Plus, Download, Trash2, Eye, FileText, Upload, X, Edit2, Check } from 'lucide-react';
import { refTemplatesAPI } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';

const TYPE_META = {
  FUNCTIONAL_TC: { label: 'Functional TC Template', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  GUI_TC:        { label: 'GUI TC Template',         color: '#c4b5fd', bg: 'rgba(196,181,253,0.1)' },
  API_SPEC:      { label: 'API Specification',       color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  SWAGGER:       { label: 'Swagger / OpenAPI',       color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
};

const TYPES = Object.keys(TYPE_META);

export default function GlobalTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ name: '', template_type: 'FUNCTIONAL_TC', description: '', is_global: true });
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [mode, setMode] = useState('file');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewTmpl, setViewTmpl] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    refTemplatesAPI.list({ is_global: true })
      .then(r => { setTemplates(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('template_type', form.template_type);
      fd.append('description', form.description);
      fd.append('is_global', 'true');
      if (mode === 'file' && file) {
        fd.append('file', file);
      } else if (mode === 'paste') {
        fd.append('content', content);
        fd.append('file_name', `${form.template_type.toLowerCase()}_${Date.now()}.txt`);
      }
      await refTemplatesAPI.upload(fd);
      setShowUpload(false);
      setForm({ name: '', template_type: 'FUNCTIONAL_TC', description: '', is_global: true });
      setFile(null);
      setContent('');
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    await refTemplatesAPI.delete(id).catch(() => {});
    load();
  };

  const handleView = async (tmpl) => {
    try {
      const r = await refTemplatesAPI.getContent(tmpl.id);
      setViewTmpl({ ...tmpl, content: r.data.content });
    } catch {
      setViewTmpl({ ...tmpl, content: null });
    }
  };

  const startEdit = (tmpl) => {
    setEditId(tmpl.id);
    setEditName(tmpl.name);
    setEditDesc(tmpl.description || '');
  };

  const saveEdit = async (id) => {
    await refTemplatesAPI.update(id, { name: editName, description: editDesc }).catch(() => {});
    setEditId(null);
    load();
  };

  const filtered = filterType ? templates.filter(t => t.template_type === filterType) : templates;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--t1)' }}>
            Global Templates
          </h1>
          <p style={{ color: 'var(--t3)', fontSize: 12, marginTop: 2, fontFamily: '"DM Mono",monospace' }}>
            Shared base templates available to all features · {templates.length} templates
          </p>
        </div>
        <button onClick={() => { setShowUpload(true); setSaveError(''); }} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Upload Template
        </button>
      </div>

      {/* Type filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterType('')}
          style={{
            padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: !filterType ? 'var(--cyan-dim)' : 'var(--bg3)',
            color: !filterType ? 'var(--cyan)' : 'var(--t3)',
            border: !filterType ? '1px solid var(--border-hi)' : '1px solid var(--border)',
          }}
        >All</button>
        {TYPES.map(t => {
          const m = TYPE_META[t];
          const active = filterType === t;
          return (
            <button key={t} onClick={() => setFilterType(t)}
              style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: active ? m.bg : 'var(--bg3)',
                color: active ? m.color : 'var(--t3)',
                border: active ? `1px solid ${m.color}` : '1px solid var(--border)',
              }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Template list */}
      {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}>Loading templates…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-4" style={{ color: 'var(--t3)' }} />
          <p style={{ color: 'var(--t2)', marginBottom: 12 }}>No global templates yet. Upload one to share it with all features.</p>
          <button onClick={() => setShowUpload(true)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Upload Template
          </button>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.map((tmpl, i) => {
          const meta = TYPE_META[tmpl.template_type] || { label: tmpl.template_type, color: '#94a3b8', bg: 'transparent' };
          const isEditing = editId === tmpl.id;
          return (
            <div key={tmpl.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Type pill */}
              <div style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, flexShrink: 0,
                background: meta.bg, color: meta.color, border: `1px solid ${meta.color}`,
                minWidth: 100, textAlign: 'center',
              }}>
                {meta.label}
              </div>

              {/* Name + desc */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      className="input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: 13 }}
                    />
                    <input
                      className="input"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Description"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    />
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tmpl.name}
                    </div>
                    {tmpl.description && (
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tmpl.description}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: '"DM Mono",monospace', marginTop: 3 }}>
                      {tmpl.file_name} · uploaded by {tmpl.uploaded_by_name || '—'} · {new Date(tmpl.created_at).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {isEditing ? (
                  <>
                    <button onClick={() => saveEdit(tmpl.id)} title="Save" className="btn-primary text-xs" style={{ padding: '4px 10px' }}>
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => setEditId(null)} title="Cancel" className="btn-secondary text-xs" style={{ padding: '4px 10px' }}>
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleView(tmpl)} title="View content"
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--t3)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => startEdit(tmpl)} title="Edit name/description"
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--t3)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <a href={`/api/v1/ref-templates/${tmpl.id}/download`} download title="Download"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--t3)', textDecoration: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--green)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => handleDelete(tmpl.id)} title="Delete"
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--t3)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload modal */}
      <Modal open={showUpload} onClose={() => { setShowUpload(false); setSaveError(''); }} title="Upload Global Template">
        <form onSubmit={handleUpload} className="space-y-4">
          {saveError && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 12 }}>
              {saveError}
            </div>
          )}
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Functional TC Base Template" />
          </div>
          <div>
            <label className="label">Template Type *</label>
            <select className="input" value={form.template_type}
              onChange={e => setForm(p => ({ ...p, template_type: e.target.value }))}>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description" />
          </div>

          {/* File vs paste toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {['file', 'paste'].map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: mode === m ? 'var(--cyan-dim)' : 'var(--bg3)',
                  color: mode === m ? 'var(--cyan)' : 'var(--t3)',
                  border: mode === m ? '1px solid var(--border-hi)' : '1px solid var(--border)',
                }}>
                {m === 'file' ? <><Upload className="w-3 h-3 inline mr-1" />File Upload</> : <><FileText className="w-3 h-3 inline mr-1" />Paste Content</>}
              </button>
            ))}
          </div>

          {mode === 'file' ? (
            <div>
              <input ref={fileRef} type="file" style={{ display: 'none' }}
                accept=".pdf,.docx,.doc,.txt,.md,.json,.yaml,.yml,.xlsx,.robot"
                onChange={e => setFile(e.target.files[0])} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="btn-secondary text-sm w-full" style={{ justifyContent: 'center' }}>
                {file ? <><FileText className="w-4 h-4" />{file.name}</> : <><Upload className="w-4 h-4" />Choose File</>}
              </button>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                Accepts: PDF, DOCX, TXT, MD, JSON, YAML, XLSX, .robot (max 20 MB)
              </div>
            </div>
          ) : (
            <div>
              <label className="label">Content</label>
              <textarea className="input" rows={6} value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Paste your Swagger JSON, markdown, or template content here…"
                style={{ fontFamily: '"DM Mono",monospace', fontSize: 11 }} />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowUpload(false); setSaveError(''); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || (mode === 'file' && !file) || (mode === 'paste' && !content.trim())} className="btn-primary">
              {saving ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View content modal */}
      <Modal open={!!viewTmpl} onClose={() => setViewTmpl(null)} title={viewTmpl?.name || 'Template Content'}>
        <div>
          {viewTmpl?.content ? (
            <pre style={{
              fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t2)',
              background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
              padding: 14, overflow: 'auto', maxHeight: 420, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {viewTmpl.content}
            </pre>
          ) : (
            <p style={{ color: 'var(--t3)', fontSize: 13 }}>
              This file type cannot be previewed. Use the Download button to view it.
            </p>
          )}
          <div className="flex justify-end gap-3 mt-4">
            <a href={`/api/v1/ref-templates/${viewTmpl?.id}/download`} download className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Download
            </a>
            <button onClick={() => setViewTmpl(null)} className="btn-primary">Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
