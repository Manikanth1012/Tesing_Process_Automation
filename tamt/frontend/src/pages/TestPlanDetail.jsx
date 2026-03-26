import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bot, Plus, Play } from 'lucide-react';
import { testPlansAPI, agentsAPI, testRunsAPI, featuresAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import AgentActivityPanel from '../components/agents/AgentActivityPanel.jsx';

const TABS = ['Features', 'Test Runs', 'Gap Analysis'];

export default function TestPlanDetail() {
  const { id } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Features');
  const [agentPanel, setAgentPanel] = useState(null);
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [allFeatures, setAllFeatures] = useState([]);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [runForm, setRunForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    testPlansAPI.get(id).then(r => { setPlan(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const runGapAnalysis = async () => {
    try {
      const r = await agentsAPI.run({ agentType: 'GAP_ANALYST', triggerEntityType: 'TestPlan', triggerEntityId: parseInt(id) });
      setAgentPanel({ agentRunId: r.data.agentRunId, agentType: 'GAP_ANALYST' });
      setTab('Gap Analysis');
    } catch (err) { alert(err.response?.data?.error || err.message); }
  };

  const handleAddFeature = async (featureId) => {
    try {
      await testPlansAPI.addFeature(id, featureId);
      load();
      setShowAddFeature(false);
    } catch (err) { alert(err.response?.data?.error || err.message); }
  };

  const handleCreateRun = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await testRunsAPI.create({ test_plan_id: parseInt(id), ...runForm });
      setShowCreateRun(false);
      setRunForm({ name: '' });
      load();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-sm text-gray-400 mt-8 text-center">Loading...</div>;
  if (!plan) return <div className="text-sm text-red-500 mt-8 text-center">Test plan not found.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/test-plans" className="hover:text-brand-600">Test Plans</Link>
            <span>/</span>
            <span className="text-gray-900">{plan.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
            <StatusBadge status={plan.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{plan.target_release && `Release: ${plan.target_release}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runGapAnalysis} className="btn-purple text-sm"><Bot className="w-4 h-4" /> Gap Analysis</button>
          <button onClick={() => setShowCreateRun(true)} className="btn-primary text-sm"><Play className="w-4 h-4" /> New Test Run</button>
        </div>
      </div>

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

      {tab === 'Gap Analysis' && agentPanel && (
        <div className="card overflow-hidden" style={{ height: 500 }}>
          <AgentActivityPanel agentRunId={agentPanel.agentRunId} agentType={agentPanel.agentType} onSuggestionAction={load} onRerun={runGapAnalysis} />
        </div>
      )}
      {tab === 'Gap Analysis' && !agentPanel && (
        <div className="card p-8 text-center text-gray-400 text-sm">
          Click "Gap Analysis" to run an AI-powered coverage analysis.
        </div>
      )}

      {tab === 'Features' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={async () => { const r = await featuresAPI.list(); setAllFeatures(r.data); setShowAddFeature(true); }} className="btn-secondary text-sm">
              <Plus className="w-4 h-4" /> Add Feature
            </button>
          </div>
          <div className="card divide-y divide-gray-100">
            {(plan.features || []).length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No features added.</div>}
            {(plan.features || []).map(f => (
              <Link key={f.id} to={`/features/${f.id}`} className="flex items-center px-5 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-medium text-sm text-gray-900">{f.name}</span><StatusBadge status={f.priority} /></div>
                  <div className="text-xs text-gray-500">{f.feature_type} · {f.prereq_readiness}% ready</div>
                </div>
                <div className="text-xs text-gray-500 ml-4">{f.test_case_count} cases</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === 'Test Runs' && (
        <div className="card divide-y divide-gray-100">
          {(plan.testRuns || []).length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No test runs yet.</div>}
          {(plan.testRuns || []).map(r => (
            <Link key={r.id} to={`/test-runs/${r.id}`} className="flex items-center px-5 py-3 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">{r.name}</div>
                <div className="text-xs text-gray-500">{r.created_at}</div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}

      <Modal open={showAddFeature} onClose={() => setShowAddFeature(false)} title="Add Feature to Plan">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {allFeatures.filter(f => !(plan.features || []).some(pf => pf.id === f.id)).map(f => (
            <button key={f.id} onClick={() => handleAddFeature(f.id)} className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 text-sm">
              <div className="font-medium">{f.name}</div>
              <div className="text-gray-500 text-xs">{f.feature_type} · {f.priority}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={showCreateRun} onClose={() => setShowCreateRun(false)} title="New Test Run">
        <form onSubmit={handleCreateRun} className="space-y-4">
          <div><label className="label">Run Name *</label><input className="input" required value={runForm.name} onChange={e => setRunForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreateRun(false)} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Run'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
