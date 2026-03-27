import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bot, Play } from 'lucide-react';
import { testRunsAPI, agentsAPI, rfAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import AgentActivityPanel from '../components/agents/AgentActivityPanel.jsx';

export default function TestRunDetail() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agentPanel, setAgentPanel] = useState(null);
  const [executing, setExecuting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    testRunsAPI.get(id).then(r => {
      setRun(r.data);
      setLoading(false);
      // Auto-fire execution monitor if run just completed
      if (r.data.status === 'Completed' || r.data.status === 'Failed') {
        const hasMonitor = (r.data.agentRuns || []).some(ar => ar.agent_type === 'EXECUTION_MONITOR');
        if (!hasMonitor) triggerMonitor();
      }
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const triggerMonitor = async () => {
    try {
      const r = await agentsAPI.run({ agentType: 'EXECUTION_MONITOR', triggerEntityType: 'TestRun', triggerEntityId: parseInt(id) });
      setAgentPanel({ agentRunId: r.data.agentRunId, agentType: 'EXECUTION_MONITOR' });
    } catch (_) {}
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await rfAPI.execute({ testRunId: parseInt(id) });
      setTimeout(load, 2000);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setExecuting(false); }
  };

  const triageFailure = async (execId) => {
    try {
      const r = await agentsAPI.run({ agentType: 'DEFECT_TRIAGE', triggerEntityType: 'TestExecution', triggerEntityId: execId });
      setAgentPanel({ agentRunId: r.data.agentRunId, agentType: 'DEFECT_TRIAGE' });
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Loading...</div>;
  if (!run) return <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>Test run not found.</div>;

  const executions = run.executions || [];
  const passed = executions.filter(e => e.status === 'Pass').length;
  const failed = executions.filter(e => e.status === 'Fail').length;
  const passRate = executions.length > 0 ? Math.round((passed / executions.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t3)', marginBottom: 6 }}>
            <Link to="/test-runs" style={{ color: 'var(--t3)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>Test Runs</Link>
            <span>/</span>
            <span style={{ color: 'var(--t2)' }}>{run.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--t1)' }}>{run.name}</h1>
            <StatusBadge status={run.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={triggerMonitor} className="btn-secondary text-sm"><Bot className="w-4 h-4" /> Analyse Run</button>
          {run.status === 'Pending' && (
            <button onClick={handleExecute} disabled={executing} className="btn-primary text-sm">
              <Play className="w-4 h-4" /> {executing ? 'Executing...' : 'Execute'}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: executions.length, color: 'var(--t1)' },
          { label: 'Passed', value: passed, color: 'var(--green)' },
          { label: 'Failed', value: failed, color: 'var(--red)' },
          { label: 'Pass Rate', value: `${passRate}%`, color: passRate >= 80 ? 'var(--green)' : passRate >= 50 ? 'var(--amber)' : 'var(--red)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: '"Syne",sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Agent panel */}
      {agentPanel && (
        <div className="card overflow-hidden" style={{ height: 420 }}>
          <AgentActivityPanel agentRunId={agentPanel.agentRunId} agentType={agentPanel.agentType} onSuggestionAction={load} />
        </div>
      )}

      {/* RF Log */}
      {run.rfLog && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t1)', marginBottom: 10 }}>RF Execution Log</div>
          <div className="grid grid-cols-4 gap-3">
            {[['Total', run.rfLog.total_tests], ['Passed', run.rfLog.passed], ['Failed', run.rfLog.failed], ['Duration', `${run.rfLog.execution_time_secs?.toFixed(1)}s`]].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: '"DM Mono",monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)', marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executions */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 18px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Executions ({executions.length})</div>
        {executions.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>No executions yet.</div>}
        {executions.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', gap: 12, borderBottom: '1px solid var(--border)' }}>
            <StatusBadge status={e.status} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{e.title}</div>
              {e.actual_result && <div style={{ fontSize: 11, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{e.actual_result}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {e.duration_ms && <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: '"DM Mono",monospace' }}>{e.duration_ms}ms</span>}
              {e.status === 'Fail' && (
                <button onClick={() => triageFailure(e.id)} className="btn-danger text-xs py-1">
                  <Bot className="w-3 h-3" /> Triage
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
