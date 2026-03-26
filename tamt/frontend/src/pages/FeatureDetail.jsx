import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bot, Plus, Upload, CheckCircle, XCircle, Download, Play, FileCode } from 'lucide-react';
import { featuresAPI, prereqsAPI, testCasesAPI, agentsAPI, rfAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import AgentActivityPanel from '../components/agents/AgentActivityPanel.jsx';

const TABS = ['Overview', 'Prerequisites', 'Test Cases', 'Scripts', 'Agent History'];

export default function FeatureDetail() {
  const { id } = useParams();
  const [feature, setFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const [agentPanel, setAgentPanel] = useState(null); // { agentRunId, agentType }
  const [agentLoading, setAgentLoading] = useState(false);
  const [showAddPrereq, setShowAddPrereq] = useState(false);
  const [prereqForm, setPrereqForm] = useState({ category: 'API_SPEC', description: '' });
  const [showAddCase, setShowAddCase] = useState(false);
  const [caseForm, setCaseForm] = useState({ title: '', description: '', test_type: 'Functional', priority: 'P2' });

  const load = useCallback(() => {
    setLoading(true);
    featuresAPI.get(id).then(r => { setFeature(r.data); setLoading(false); }).catch(() => setLoading(false));
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

  if (loading) return <div className="text-sm text-gray-400 mt-8 text-center">Loading...</div>;
  if (!feature) return <div className="text-sm text-red-500 mt-8 text-center">Feature not found.</div>;

  const readinessColor = feature.prereq_readiness >= 100 ? 'text-green-600' : feature.prereq_readiness >= 70 ? 'text-yellow-600' : 'text-red-600';

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{feature.name}</h1>
            <StatusBadge status={feature.status} />
            <StatusBadge status={feature.priority} />
            <span className="text-sm bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{feature.feature_type}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runAgent('PREREQ_ANALYST')}
            disabled={agentLoading}
            className="btn-purple text-sm"
          >
            <Bot className="w-4 h-4" /> Analyse Pre-Reqs
          </button>
          <button
            onClick={() => runAgent('TESTCASE_GENERATOR')}
            disabled={agentLoading || feature.prereq_readiness < 70}
            title={feature.prereq_readiness < 70 ? 'Need 70% readiness to generate cases' : ''}
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
            className={`h-2 rounded-full transition-all ${feature.prereq_readiness >= 100 ? 'bg-green-500' : feature.prereq_readiness >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${feature.prereq_readiness ?? 0}%` }}
          />
        </div>
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
        <nav className="flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Prerequisites */}
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

      {/* Tab: Test Cases */}
      {tab === 'Test Cases' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddCase(true)} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" /> Add Test Case
            </button>
          </div>
          <div className="card divide-y divide-gray-100">
            {(feature.testCases || []).length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">No test cases yet.</div>
            )}
            {(feature.testCases || []).map(tc => (
              <Link key={tc.id} to={`/test-cases/${tc.id}`} className="flex items-center px-5 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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

      {/* Tab: Overview */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Test Cases', value: feature.testCases?.length ?? 0 },
            { label: 'Prerequisites', value: feature.prerequisites?.length ?? 0 },
            { label: 'API Contracts', value: feature.apiContracts?.length ?? 0 },
          ].map(s => (
            <div key={s.label} className="card p-5 text-center">
              <div className="text-3xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
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
    </div>
  );
}
