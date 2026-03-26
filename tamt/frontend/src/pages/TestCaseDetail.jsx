import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bot, Download, CheckCircle, XCircle } from 'lucide-react';
import { testCasesAPI, agentsAPI, rfAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import AgentActivityPanel from '../components/agents/AgentActivityPanel.jsx';

export default function TestCaseDetail() {
  const { id } = useParams();
  const [tc, setTc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agentPanel, setAgentPanel] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [scripts, setScripts] = useState([]);
  const [validating, setValidating] = useState(false);
  const [tab, setTab] = useState('Details');

  const load = useCallback(() => {
    setLoading(true);
    testCasesAPI.get(id).then(r => {
      setTc(r.data);
      setScripts(r.data.scripts || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const runScriptGenerator = async () => {
    setAgentLoading(true);
    try {
      const r = await agentsAPI.run({ agentType: 'SCRIPT_GENERATOR', triggerEntityType: 'TestCase', triggerEntityId: parseInt(id) });
      setAgentPanel({ agentRunId: r.data.agentRunId, agentType: 'SCRIPT_GENERATOR' });
      setTab('Scripts');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setAgentLoading(false); }
  };

  const handleApprove = async () => {
    await testCasesAPI.update(id, { status: 'Approved' });
    load();
  };

  const handleValidateScript = async (scriptId) => {
    setValidating(true);
    try {
      const r = await rfAPI.validateScript(scriptId);
      alert(r.data.valid ? 'Script is valid!' : `Validation errors:\n${r.data.errors.join('\n')}`);
    } finally { setValidating(false); }
  };

  if (loading) return <div className="text-sm text-gray-400 mt-8 text-center">Loading...</div>;
  if (!tc) return <div className="text-sm text-red-500 mt-8 text-center">Test case not found.</div>;

  const steps = Array.isArray(tc.steps) ? tc.steps : [];
  const latestScript = scripts[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/test-cases" className="hover:text-brand-600">Test Cases</Link>
            <span>/</span>
            <span className="text-gray-900 truncate max-w-xs">{tc.title}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{tc.title}</h1>
            <StatusBadge status={tc.status} />
            <StatusBadge status={tc.priority} />
            <StatusBadge status={tc.test_type} />
          </div>
          <p className="text-sm text-gray-500 mt-1">{tc.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {tc.status !== 'Approved' && (
            <button onClick={handleApprove} className="btn-green text-sm">
              <CheckCircle className="w-4 h-4" /> Approve
            </button>
          )}
          <button
            onClick={runScriptGenerator}
            disabled={agentLoading || tc.status !== 'Approved'}
            title={tc.status !== 'Approved' ? 'Approve test case first' : ''}
            className="btn-green text-sm"
          >
            <Bot className="w-4 h-4" /> Generate RF Script
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {['Details', 'Steps', 'Scripts'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
              {t} {t === 'Scripts' && scripts.length > 0 ? `(${scripts.length})` : ''}
            </button>
          ))}
        </nav>
      </div>

      {/* Agent Panel */}
      {agentPanel && tab === 'Scripts' && (
        <div className="card overflow-hidden" style={{ height: 420 }}>
          <AgentActivityPanel
            agentRunId={agentPanel.agentRunId}
            agentType={agentPanel.agentType}
            onSuggestionAction={load}
            onRerun={runScriptGenerator}
          />
        </div>
      )}

      {tab === 'Details' && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Feature: </span><Link to={`/features/${tc.feature?.id}`} className="text-brand-600 hover:underline">{tc.feature?.name}</Link></div>
            <div><span className="text-gray-500">Type: </span>{tc.test_type}</div>
            <div><span className="text-gray-500">Priority: </span>{tc.priority}</div>
            <div><span className="text-gray-500">Automation: </span>{tc.automation_status}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700 mb-1">Expected Result</div>
            <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{tc.expected_result || 'Not specified'}</div>
          </div>
          {tc.tags?.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {tc.tags.map(tag => <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Steps' && (
        <div className="card divide-y divide-gray-100">
          {steps.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No steps defined.</div>}
          {steps.map((s, i) => (
            <div key={i} className="px-5 py-3 flex gap-4 text-sm">
              <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">{s.step || i + 1}</div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{s.action}</div>
                <div className="text-gray-500 mt-0.5">{s.expected_result}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Scripts' && (
        <div className="space-y-3">
          {scripts.length === 0 && !agentPanel && (
            <div className="card p-8 text-center text-gray-400 text-sm">
              No scripts generated yet. Click "Generate RF Script" to create one.
            </div>
          )}
          {scripts.map(script => (
            <div key={script.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{script.script_name}</span>
                  <StatusBadge status={script.status} />
                  <span className="text-xs text-gray-500">v{script.version}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleValidateScript(script.id)} disabled={validating} className="btn-secondary text-xs py-1">
                    {validating ? 'Validating...' : 'Validate'}
                  </button>
                  <a href={`/api/v1/rf/scripts/${script.id}/download`} className="btn-secondary text-xs py-1">
                    <Download className="w-3 h-3" /> Download
                  </a>
                </div>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto max-h-64 font-mono">
                {script.script_content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
