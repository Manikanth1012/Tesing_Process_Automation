import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bot, Plus, CheckCircle, XCircle, Download, Upload, FileText, Eye, Trash2 } from 'lucide-react';
import { featuresAPI, prereqsAPI, testCasesAPI, agentsAPI, rfAPI, refTemplatesAPI, downloadXlsx } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import AgentActivityPanel from '../components/agents/AgentActivityPanel.jsx';

const TABS = ['Overview', 'Prerequisites', 'Test Cases', 'Templates & Specs', 'Scripts', 'Agent History'];

const TEMPLATE_TYPE_META = {
  FUNCTIONAL_TC: { label: 'Functional Test Case Template', color: 'bg-blue-50 text-blue-700', icon: '📋' },
  GUI_TC:        { label: 'GUI Test Case Template',        color: 'bg-purple-50 text-purple-700', icon: '🖥️' },
  API_SPEC:      { label: 'API Specification Document',    color: 'bg-green-50 text-green-700', icon: '📄' },
  SWAGGER:       { label: 'Swagger / OpenAPI Contract',    color: 'bg-orange-50 text-orange-700', icon: '⚡' },
};

const API_SUB_TYPES = ['Technical', 'Functional', 'Both'];

export default function FeatureDetail() {
  const { id } = useParams();
  const [feature, setFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const [agentPanel, setAgentPanel] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Prerequisites
  const [showAddPrereq, setShowAddPrereq] = useState(false);
  const [prereqForm, setPrereqForm] = useState({ category: 'API_SPEC', description: '' });

  // Test Cases
  const [showAddCase, setShowAddCase] = useState(false);
  const [caseForm, setCaseForm] = useState({ title: '', description: '', test_type: 'Functional', priority: 'P2' });

  // Reference Templates
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [tmplForm, setTmplForm] = useState({ name: '', template_type: 'FUNCTIONAL_TC', description: '', is_global: false });
  const [tmplFile, setTmplFile] = useState(null);
  const [tmplContent, setTmplContent] = useState('');
  const [tmplMode, setTmplMode] = useState('file'); // 'file' | 'paste'
  const [tmplSaving, setTmplSaving] = useState(false);
  const [viewTemplate, setViewTemplate] = useState(null);
  const fileInputRef = useRef(null);

  // Scripts
  const [scripts, setScripts] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    featuresAPI.get(id).then(r => {
      setFeature(r.data);
      setScripts(r.data.testCases?.flatMap(tc => tc.scripts || []) || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const runAgent = async (agentType) => {
    setAgentLoading(true);
    try {
      const r = await agentsAPI.run({ agentType, triggerEntityType: 'Feature', triggerEntityId: parseInt(id) });
      setAgentPanel({ agentRunId: r.data.agentRunId, agentType });
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setAgentLoading(false); }
  };

  const handlePrereqUpdate = async (pId, isReady) => {
    await prereqsAPI.update(pId, { is_ready: isReady });
    load();
  };

  const handleAddPrereq = async (e) => {
    e.preventDefault();
    await prereqsAPI.create({ feature_id: parseInt(id), ...prereqForm });
    setShowAddPrereq(false);
    setPrereqForm({ category: 'API_SPEC', description: '' });
    load();
  };

  const handleAddCase = async (e) => {
    e.preventDefault();
    await testCasesAPI.create({ feature_id: parseInt(id), ...caseForm });
    setShowAddCase(false);
    setCaseForm({ title: '', description: '', test_type: 'Functional', priority: 'P2' });
    load();
  };

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    setTmplSaving(true);
    try {
      if (tmplMode === 'file' && tmplFile) {
        const fd = new FormData();
        fd.append('file', tmplFile);
        fd.append('name', tmplForm.name);
        fd.append('template_type', tmplForm.template_type);
        fd.append('description', tmplForm.description);
        fd.append('feature_id', id);
        fd.append('is_global', tmplForm.is_global ? 'true' : 'false');
        await refTemplatesAPI.upload(fd);
      } else {
        await refTemplatesAPI.uploadInline({
          name: tmplForm.name,
          template_type: tmplForm.template_type,
          description: tmplForm.description,
          feature_id: id,
          is_global: tmplForm.is_global,
          content: tmplContent,
          file_name: `${tmplForm.template_type.toLowerCase()}_${Date.now()}.txt`,
        });
      }
      setShowAddTemplate(false);
      setTmplFile(null);
      setTmplContent('');
      setTmplForm({ name: '', template_type: 'FUNCTIONAL_TC', description: '', is_global: false });
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setTmplSaving(false); }
  };

  const handleDeleteTemplate = async (tmplId) => {
    if (!confirm('Delete this template?')) return;
    await refTemplatesAPI.delete(tmplId);
    load();
  };

  const handleViewTemplate = async (tmpl) => {
    if (tmpl.content) return setViewTemplate(tmpl);
    try {
      const r = await refTemplatesAPI.getContent(tmpl.id);
      setViewTemplate({ ...tmpl, content: r.data.content });
    } catch (_) {
      setViewTemplate({ ...tmpl, content: '(Binary file — use download)' });
    }
  };

  const handleUpdateApiSubType = async (sub) => {
    await featuresAPI.update(id, { api_sub_type: sub });
    load();
  };

  if (loading) return <div className="text-sm text-gray-400 mt-8 text-center">Loading...</div>;
  if (!feature) return <div className="text-sm text-red-500 mt-8 text-center">Feature not found.</div>;

  const readinessColor = feature.prereq_readiness >= 100 ? 'text-green-600'
    : feature.prereq_readiness >= 70 ? 'text-yellow-600' : 'text-red-600';
  const refTemplates = feature.referenceTemplates || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/features" className="hover:text-brand-600">Features</Link>
            <span>/</span>
            <span className="text-gray-900">{feature.name}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{feature.name}</h1>
            <StatusBadge status={feature.status} />
            <StatusBadge status={feature.priority} />
            <span className="text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{feature.feature_type}</span>
            {feature.feature_type === 'API' && feature.api_sub_type && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                {feature.api_sub_type}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => runAgent('PREREQ_ANALYST')} disabled={agentLoading} className="btn-purple text-sm">
            <Bot className="w-4 h-4" /> Analyse Pre-Reqs
          </button>
          <button
            onClick={() => runAgent('TESTCASE_GENERATOR')}
            disabled={agentLoading || feature.prereq_readiness < 70}
            title={feature.prereq_readiness < 70 ? 'Need ≥70% readiness to generate test cases' : ''}
            className="btn-primary text-sm"
          >
            <Bot className="w-4 h-4" /> Generate Test Cases
          </button>
        </div>
      </div>

      {/* Readiness bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Pre-Req Readiness</span>
          <span className={`text-lg font-bold ${readinessColor}`}>{feature.prereq_readiness ?? 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              feature.prereq_readiness >= 100 ? 'bg-green-500'
              : feature.prereq_readiness >= 70 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${feature.prereq_readiness ?? 0}%` }}
          />
        </div>
        {feature.feature_type === 'API' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">API Testing Sub-Type:</span>
              {API_SUB_TYPES.map(sub => (
                <button
                  key={sub}
                  onClick={() => handleUpdateApiSubType(sub)}
                  className={`text-xs px-3 py-1 rounded-full font-medium border transition-colors ${
                    feature.api_sub_type === sub
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {feature.api_sub_type === 'Technical' && 'Tests focus on API contracts, schemas, authentication, and protocol behaviour.'}
              {feature.api_sub_type === 'Functional' && 'Tests focus on business rules and end-to-end functional scenarios via API calls.'}
              {feature.api_sub_type === 'Both' && 'Tests cover both technical contract validation and business functional flows.'}
            </p>
          </div>
        )}
      </div>

      {/* Agent Panel */}
      {agentPanel && (
        <div className="card overflow-hidden" style={{ height: 480 }}>
          <AgentActivityPanel
            agentRunId={agentPanel.agentRunId}
            agentType={agentPanel.agentType}
            onSuggestionAction={() => load()}
            onRerun={() => runAgent(agentPanel.agentType)}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}>
              {t}
              {t === 'Templates & Specs' && refTemplates.length > 0 && (
                <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{refTemplates.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Overview ── */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Test Cases', value: feature.testCases?.length ?? 0 },
            { label: 'Prerequisites', value: feature.prerequisites?.length ?? 0 },
            { label: 'Templates & Specs', value: refTemplates.length },
          ].map(s => (
            <div key={s.label} className="card p-5 text-center">
              <div className="text-3xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Prerequisites ── */}
      {tab === 'Prerequisites' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddPrereq(true)} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" /> Add Prerequisite
            </button>
          </div>
          <div className="card divide-y divide-gray-100">
            {(feature.prerequisites || []).length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">No prerequisites defined.</div>
            )}
            {(feature.prerequisites || []).map(p => (
              <div key={p.id} className="flex items-center px-5 py-3 gap-4">
                <button onClick={() => handlePrereqUpdate(p.id, !p.is_ready)}>
                  {p.is_ready
                    ? <CheckCircle className="w-5 h-5 text-green-500" />
                    : <XCircle className="w-5 h-5 text-gray-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{p.description}</div>
                  <div className="text-xs text-gray-500">{p.category}{p.notes ? ` · ${p.notes}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Test Cases ── */}
      {tab === 'Test Cases' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{feature.testCases?.length ?? 0} test cases</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadXlsx(`/reports/export/test-cases?feature_id=${id}`)}
                className="btn-secondary text-sm"
              >
                <Download className="w-4 h-4" /> Export XLSX
              </button>
              <button onClick={() => setShowAddCase(true)} className="btn-secondary text-sm">
                <Plus className="w-4 h-4" /> Add Test Case
              </button>
            </div>
          </div>
          <div className="card divide-y divide-gray-100">
            {(feature.testCases || []).length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">No test cases yet.</div>
            )}
            {(feature.testCases || []).map(tc => (
              <Link key={tc.id} to={`/test-cases/${tc.id}`} className="flex items-center px-5 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{tc.title}</span>
                    <StatusBadge status={tc.status} />
                    <StatusBadge status={tc.priority} />
                  </div>
                  <div className="text-xs text-gray-500">{tc.test_type} · {tc.automation_status}</div>
                </div>
                <div className="text-xs text-gray-500 ml-4">{tc.script_count || 0} script{tc.script_count !== 1 ? 's' : ''}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Templates & Specs ── */}
      {tab === 'Templates & Specs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Upload base templates and specification documents that agents and testers reference for this feature.
            </p>
            <button onClick={() => setShowAddTemplate(true)} className="btn-primary text-sm">
              <Upload className="w-4 h-4" /> Add Template / Spec
            </button>
          </div>

          {/* Group by type */}
          {Object.entries(TEMPLATE_TYPE_META).map(([type, meta]) => {
            const items = refTemplates.filter(t => t.template_type === type);
            return (
              <div key={type} className="card">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50 rounded-t-xl">
                  <span className="text-base">{meta.icon}</span>
                  <span className="text-sm font-semibold text-gray-800">{meta.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${meta.color}`}>{items.length} file{items.length !== 1 ? 's' : ''}</span>
                </div>
                {items.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400 italic">No {meta.label.toLowerCase()} uploaded yet.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {items.map(tmpl => (
                      <div key={tmpl.id} className="flex items-center px-5 py-3 gap-3">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{tmpl.name}</div>
                          <div className="text-xs text-gray-500">{tmpl.file_name}
                            {tmpl.is_global ? <span className="ml-2 text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">Global</span> : ''}
                          </div>
                          {tmpl.description && <div className="text-xs text-gray-400 mt-0.5">{tmpl.description}</div>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleViewTemplate(tmpl)} className="p-1.5 rounded hover:bg-gray-100" title="View content">
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <a href={`/api/v1/ref-templates/${tmpl.id}/download`} className="p-1.5 rounded hover:bg-gray-100" title="Download">
                            <Download className="w-4 h-4 text-gray-500" />
                          </a>
                          <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1.5 rounded hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Scripts ── */}
      {tab === 'Scripts' && (
        <div className="card divide-y divide-gray-100">
          <div className="px-5 py-3 text-sm font-semibold text-gray-700 bg-gray-50">RF Scripts for this feature</div>
          {(feature.testCases || []).flatMap(tc => (tc.scripts || []).map(s => ({ ...s, tcTitle: tc.title }))).length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">No scripts yet. Generate scripts from test cases.</div>
          )}
          {(feature.testCases || []).flatMap(tc =>
            (tc.scripts || []).map(s => (
              <div key={s.id} className="flex items-center px-5 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{s.script_name}</div>
                  <div className="text-xs text-gray-500">{tc.title} · v{s.version}</div>
                </div>
                <StatusBadge status={s.status} />
                <a href={`/api/v1/rf/scripts/${s.id}/download`} className="p-1.5 rounded hover:bg-gray-100">
                  <Download className="w-4 h-4 text-gray-500" />
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Agent History ── */}
      {tab === 'Agent History' && (
        <AgentHistoryTab featureId={id} />
      )}

      {/* ─── Modals ─── */}

      {/* Add Prerequisite */}
      <Modal open={showAddPrereq} onClose={() => setShowAddPrereq(false)} title="Add Prerequisite">
        <form onSubmit={handleAddPrereq} className="space-y-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={prereqForm.category} onChange={e => setPrereqForm(p => ({ ...p, category: e.target.value }))}>
              {['API_SPEC', 'SWAGGER', 'INPUTS', 'TEST_DATA', 'ENVIRONMENT', 'CREDENTIALS', 'USER_STORIES'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description *</label>
            <input className="input" required value={prereqForm.description} onChange={e => setPrereqForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddPrereq(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      {/* Add Test Case */}
      <Modal open={showAddCase} onClose={() => setShowAddCase(false)} title="Add Test Case">
        <form onSubmit={handleAddCase} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" required value={caseForm.title} onChange={e => setCaseForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-20 resize-none" value={caseForm.description} onChange={e => setCaseForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={caseForm.test_type} onChange={e => setCaseForm(p => ({ ...p, test_type: e.target.value }))}>
                <option>API</option><option>Functional</option><option>GUI</option><option>Performance</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={caseForm.priority} onChange={e => setCaseForm(p => ({ ...p, priority: e.target.value }))}>
                <option>P1</option><option>P2</option><option>P3</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddCase(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      {/* Add Template / Spec */}
      <Modal open={showAddTemplate} onClose={() => setShowAddTemplate(false)} title="Add Template / Spec Document" size="lg">
        <form onSubmit={handleAddTemplate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" required placeholder="e.g. User Management API Spec" value={tmplForm.name}
                onChange={e => setTmplForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Document Type *</label>
              <select className="input" value={tmplForm.template_type}
                onChange={e => setTmplForm(p => ({ ...p, template_type: e.target.value }))}>
                {Object.entries(TEMPLATE_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="Brief description of this document" value={tmplForm.description}
              onChange={e => setTmplForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          {/* Input mode toggle */}
          <div>
            <label className="label">Content</label>
            <div className="flex gap-2 mb-3">
              {['file', 'paste'].map(m => (
                <button key={m} type="button" onClick={() => setTmplMode(m)}
                  className={`text-sm px-4 py-1.5 rounded-lg border font-medium transition-colors ${
                    tmplMode === m ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {m === 'file' ? 'Upload File' : 'Paste / Type Content'}
                </button>
              ))}
            </div>

            {tmplMode === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 transition-colors"
              >
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                {tmplFile ? (
                  <p className="text-sm font-medium text-brand-600">{tmplFile.name}</p>
                ) : (
                  <p className="text-sm text-gray-500">Click to select a file <span className="text-gray-400">(PDF, Word, Excel, JSON, YAML, Markdown…)</span></p>
                )}
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.json,.yaml,.yml,.md,.txt,.csv,.robot"
                  onChange={e => setTmplFile(e.target.files[0] || null)} />
              </div>
            ) : (
              <textarea
                className="input font-mono text-xs min-h-48 resize-y"
                placeholder="Paste Swagger JSON / YAML, Markdown specification, or test case template content here…"
                value={tmplContent}
                onChange={e => setTmplContent(e.target.value)}
              />
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
            <input type="checkbox" checked={tmplForm.is_global}
              onChange={e => setTmplForm(p => ({ ...p, is_global: e.target.checked }))}
              className="w-4 h-4 rounded" />
            Make globally available to all features
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddTemplate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={tmplSaving || (tmplMode === 'file' && !tmplFile) || (tmplMode === 'paste' && !tmplContent.trim())}
              className="btn-primary">
              {tmplSaving ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Template Content */}
      {viewTemplate && (
        <Modal open={!!viewTemplate} onClose={() => setViewTemplate(null)} title={viewTemplate.name} size="xl">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TEMPLATE_TYPE_META[viewTemplate.template_type]?.color}`}>
              {TEMPLATE_TYPE_META[viewTemplate.template_type]?.label}
            </span>
            <span className="text-xs text-gray-500">{viewTemplate.file_name}</span>
          </div>
          <pre className="bg-gray-900 text-green-300 text-xs font-mono p-4 rounded-xl overflow-auto max-h-[60vh] whitespace-pre-wrap">
            {viewTemplate.content || '(No text content available — download the file to view it)'}
          </pre>
        </Modal>
      )}
    </div>
  );
}

function AgentHistoryTab({ featureId }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    import('../services/api.js').then(({ agentsAPI }) => {
      agentsAPI.getHistory({ entityType: 'Feature', entityId: featureId, limit: 20 }).then(r => setLogs(r.data));
    });
  }, [featureId]);
  return (
    <div className="card divide-y divide-gray-100">
      {logs.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No agent runs for this feature yet.</div>}
      {logs.map(log => (
        <div key={log.id} className="px-5 py-3 text-sm">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-medium text-gray-900">{log.agent_type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${log.status === 'Completed' ? 'bg-green-100 text-green-700' : log.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {log.status}
            </span>
          </div>
          <div className="text-xs text-gray-500">{log.tokens_used} tokens · {log.duration_ms}ms · {log.created_at}</div>
          {log.error_message && <div className="text-xs text-red-500 mt-0.5">{log.error_message}</div>}
        </div>
      ))}
    </div>
  );
}
