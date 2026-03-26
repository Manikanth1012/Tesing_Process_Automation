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

  if (loading) return <div className="text-sm text-gray-400 mt-8 text-center">Loading...</div>;
  if (!run) return <div className="text-sm text-red-500 mt-8 text-center">Test run not found.</div>;

  const executions = run.executions || [];
  const passed = executions.filter(e => e.status === 'Pass').length;
  const failed = executions.filter(e => e.status === 'Fail').length;
  const passRate = executions.length > 0 ? Math.round((passed / executions.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/test-runs" className="hover:text-brand-600">Test Runs</Link>
            <span>/</span>
            <span className="text-gray-900">{run.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{run.name}</h1>
            <StatusBadge status={run.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={triggerMonitor} className="btn-purple text-sm"><Bot className="w-4 h-4" /> Analyse Run</button>
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
          { label: 'Total', value: executions.length, color: 'text-gray-900' },
          { label: 'Passed', value: passed, color: 'text-green-600' },
          { label: 'Failed', value: failed, color: 'text-red-600' },
          { label: 'Pass Rate', value: `${passRate}%`, color: passRate >= 80 ? 'text-green-600' : passRate >= 50 ? 'text-yellow-600' : 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
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
        <div className="card p-4 text-sm text-gray-600">
          <div className="font-medium text-gray-900 mb-2">RF Execution Log</div>
          <div className="grid grid-cols-4 gap-3">
            {[['Total', run.rfLog.total_tests], ['Passed', run.rfLog.passed], ['Failed', run.rfLog.failed], ['Duration', `${run.rfLog.execution_time_secs?.toFixed(1)}s`]].map(([k, v]) => (
              <div key={k}><div className="text-xs text-gray-500">{k}</div><div className="font-semibold text-gray-900">{v}</div></div>
            ))}
          </div>
        </div>
      )}

      {/* Executions */}
      <div className="card divide-y divide-gray-100">
        <div className="px-5 py-3 text-sm font-semibold text-gray-700 bg-gray-50">Executions ({executions.length})</div>
        {executions.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No executions yet.</div>}
        {executions.map(e => (
          <div key={e.id} className="flex items-center px-5 py-3 gap-4">
            <StatusBadge status={e.status} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{e.title}</div>
              {e.actual_result && <div className="text-xs text-gray-500 truncate mt-0.5">{e.actual_result}</div>}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {e.duration_ms && <span>{e.duration_ms}ms</span>}
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
