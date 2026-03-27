import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, Upload, FileSpreadsheet, Layers } from 'lucide-react';
import { featuresAPI, downloadXlsx } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import api from '../services/api.js';

const API_SUB_TYPES = ['Technical', 'Functional', 'Both'];
const FEATURE_TYPES = ['API', 'Functional', 'GUI', 'Performance'];
const TYPE_COLOR = { API: 'var(--cyan)', Functional: 'var(--green)', GUI: 'var(--amber)', Performance: 'var(--purple)' };

export default function Features() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ feature_type: '', priority: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', feature_type: 'Functional', api_sub_type: 'Both', priority: 'P2' });
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    featuresAPI.list({ search, ...filter }).then(r => { setFeatures(r.data); setLoading(false); });
  };
  useEffect(load, [search, filter.feature_type, filter.priority]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await featuresAPI.create(form);
      setShowCreate(false);
      setForm({ name: '', description: '', feature_type: 'Functional', api_sub_type: 'Both', priority: 'P2' });
      load();
    } finally { setSaving(false); }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const { data } = await api.post('/features/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(data);
      if (data.created > 0) load();
    } catch (err) {
      setImportResult({ created: 0, errors: [{ row: '-', error: err.response?.data?.error || err.message }] });
    } finally { setImporting(false); }
  };

  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/api/v1/features/import/template';
    a.download = 'feature_import_template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--t1)', marginBottom: 2 }}>Features</h1>
          <p style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t3)' }}>{features.length} features</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => downloadXlsx('/reports/export/test-cases')} className="btn-secondary text-sm">
            <Download size={14} /> Export Cases
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">
            <Upload size={14} /> Import
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            <Plus size={14} /> New Feature
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search features…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 140 }} value={filter.feature_type} onChange={e => setFilter(p => ({ ...p, feature_type: e.target.value }))}>
          <option value="">All Types</option>
          {FEATURE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input" style={{ width: 100 }} value={filter.priority} onChange={e => setFilter(p => ({ ...p, priority: e.target.value }))}>
          <option value="">All</option>
          {['P1', 'P2', 'P3'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12 }}>
        {loading && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)', fontFamily: '"DM Mono",monospace', fontSize: 12 }}>Loading…</div>}
        {!loading && features.length === 0 && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <Layers size={32} style={{ color: 'var(--t3)', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--t2)', marginBottom: 16, fontSize: 14 }}>No features yet.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button onClick={() => setShowImport(true)} className="btn-secondary text-sm"><Upload size={14} /> Import from Excel</button>
              <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus size={14} /> New Feature</button>
            </div>
          </div>
        )}
        {features.map((f, i) => (
          <Link key={f.id} to={`/features/${f.id}`}
            style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: i < features.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 14 }}>{f.name}</span>
                <StatusBadge status={f.status} />
                <StatusBadge status={f.priority} />
                {f.feature_type === 'API' && f.api_sub_type && (
                  <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--purple)', background: 'var(--purple-dim)', border: '1px solid rgba(179,136,255,0.3)', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {f.api_sub_type}
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--t3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.description || 'No description'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginLeft: 16, flexShrink: 0 }}>
              <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: TYPE_COLOR[f.feature_type] || 'var(--t3)', background: TYPE_COLOR[f.feature_type] ? TYPE_COLOR[f.feature_type] + '18' : 'var(--bg3)', border: '1px solid ' + (TYPE_COLOR[f.feature_type] || 'var(--border)') + '44', borderRadius: 4, padding: '2px 8px' }}>
                {f.feature_type}
              </span>
              <div style={{ textAlign: 'center', minWidth: 44 }}>
                <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 16, color: (f.prereq_readiness ?? 0) >= 100 ? 'var(--green)' : (f.prereq_readiness ?? 0) >= 50 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>{f.prereq_readiness ?? 0}%</div>
                <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginTop: 2 }}>readiness</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 32 }}>
                <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--t1)', lineHeight: 1 }}>{f.test_case_count ?? 0}</div>
                <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginTop: 2 }}>cases</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Create Feature Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Feature">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="label">Name *</label><input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Description</label><textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Feature Type</label>
              <select className="input" value={form.feature_type} onChange={e => setForm(p => ({ ...p, feature_type: e.target.value, api_sub_type: 'Both' }))}>
                {FEATURE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {['P1', 'P2', 'P3'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {form.feature_type === 'API' && (
            <div>
              <label className="label">API Testing Sub-Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {API_SUB_TYPES.map(sub => (
                  <button key={sub} type="button" onClick={() => setForm(p => ({ ...p, api_sub_type: sub }))}
                    style={{ padding: '8px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', background: form.api_sub_type === sub ? 'var(--purple-dim)' : 'var(--bg3)', color: form.api_sub_type === sub ? 'var(--purple)' : 'var(--t2)', border: `1px solid ${form.api_sub_type === sub ? 'rgba(179,136,255,0.4)' : 'var(--border)'}` }}>
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Feature'}</button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportFile(null); setImportResult(null); }} title="Import Features from Excel">
        <div className="space-y-4">
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
            <p style={{ color: 'var(--t2)', fontSize: 13, marginBottom: 10 }}>
              Download the template, fill in your features, then upload the completed file.
            </p>
            <button onClick={downloadTemplate} className="btn-secondary text-sm">
              <FileSpreadsheet size={14} /> Download Template (.xlsx)
            </button>
          </div>

          <form onSubmit={handleImport} className="space-y-3">
            <div>
              <label className="label">Upload Completed File</label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => setImportFile(e.target.files[0])} />
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ width: '100%', border: '2px dashed var(--border)', borderRadius: 8, padding: 16, fontSize: 13, color: importFile ? 'var(--cyan)' : 'var(--t3)', background: 'none', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {importFile ? `✓ ${importFile.name}` : '📁 Click to select Excel file'}
              </button>
            </div>

            {importResult && (
              <div style={{ background: importResult.errors?.length ? 'var(--amber-dim)' : 'var(--green-dim)', border: `1px solid ${importResult.errors?.length ? 'rgba(244,162,97,0.4)' : 'rgba(61,214,140,0.3)'}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: importResult.errors?.length ? 'var(--amber)' : 'var(--green)', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  ✓ {importResult.created} features imported{importResult.errors?.length > 0 ? ` · ${importResult.errors.length} errors` : ''}
                </div>
                {importResult.errors?.map((err, i) => (
                  <div key={i} style={{ color: 'var(--amber)', fontSize: 12, fontFamily: '"DM Mono",monospace' }}>Row {err.row}: {err.error}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => { setShowImport(false); setImportFile(null); setImportResult(null); }} className="btn-secondary">
                {importResult?.created > 0 ? 'Close' : 'Cancel'}
              </button>
              {!importResult && (
                <button type="submit" disabled={!importFile || importing} className="btn-primary">
                  {importing ? 'Importing…' : 'Import Features'}
                </button>
              )}
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
