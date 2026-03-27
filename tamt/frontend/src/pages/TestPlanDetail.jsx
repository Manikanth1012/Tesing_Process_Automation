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

  if (loading) return <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Loading...</div>;
  if (!plan) return <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>Test plan not found.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t3)', marginBottom: 6 }}>
            <Link to="/test-plans" style={{ color: 'var(--t3)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>Test Plans</Link>
            <span>/</span>
            <span style={{ color: 'var(--t2)' }}>{plan.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--t1)' }}>{plan.name}</h1>
            <StatusBadge status={plan.status} />
          </div>
          {plan.target_release && <p style={{ color: 'var(--t3)', fontSize: 13, marginTop: 4 }}>Release: {plan.target_release}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runGapAnalysis} className="btn-secondary text-sm"><Bot className="w-4 h-4" /> Gap Analysis</button>
          <button onClick={() => setShowCreateRun(true)} className="btn-primary text-sm"><Play className="w-4 h-4" /> New Test Run</button>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', gap: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 500,
            borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
            color: tab === t ? 'var(--cyan)' : 'var(--t2)',
            background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
            cursor: 'pointer', transition: 'color 0.2s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Gap Analysis' && agentPanel && (
        <div className="card overflow-hidden" style={{ height: 500 }}>
          <AgentActivityPanel agentRunId={agentPanel.agentRunId} agentType={agentPanel.agentType} onSuggestionAction={load} onRerun={runGapAnalysis} />
        </div>
      )}
      {tab === 'Gap Analysis' && !agentPanel && (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
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
          <div className="card" style={{ overflow: 'hidden' }}>
            {(plan.features || []).length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>No features added.</div>}
            {(plan.features || []).map(f => (
              <Link key={f.id} to={`/features/${f.id}`}
                style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--t1)' }}>{f.name}</span>
                    <StatusBadge status={f.priority} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>{f.feature_type} · {f.prereq_readiness}% ready</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 16 }}>{f.test_case_count} cases</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === 'Test Runs' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {(plan.testRuns || []).length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>No test runs yet.</div>}
          {(plan.testRuns || []).map(r => (
            <Link key={r.id} to={`/test-runs/${r.id}`}
              style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--t1)' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{r.created_at}</div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}

      <Modal open={showAddFeature} onClose={() => setShowAddFeature(false)} title="Add Feature to Plan">
        <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allFeatures.filter(f => !(plan.features || []).some(pf => pf.id === f.id)).map(f => (
            <button key={f.id} onClick={() => handleAddFeature(f.id)}
              style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', color: 'var(--t1)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{f.name}</div>
              <div style={{ color: 'var(--t3)', fontSize: 11 }}>{f.feature_type} · {f.priority}</div>
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
