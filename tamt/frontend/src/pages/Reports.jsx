import React, { useEffect, useState } from 'react';
import { Bot, Download } from 'lucide-react';
import { reportsAPI, agentsAPI, downloadXlsx } from '../services/api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AgentActivityPanel from '../components/agents/AgentActivityPanel.jsx';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#6b7280', '#3b82f6'];
const TABS = ['Coverage', 'Execution Summary', 'Defect Analysis'];

export default function Reports() {
  const [tab, setTab] = useState('Coverage');
  const [coverage, setCoverage] = useState([]);
  const [execSummary, setExecSummary] = useState([]);
  const [defectAnalysis, setDefectAnalysis] = useState(null);
  const [agentPanel, setAgentPanel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      reportsAPI.coverage(),
      reportsAPI.executionSummary(),
      reportsAPI.defectAnalysis(),
    ]).then(([c, e, d]) => {
      setCoverage(c.data);
      setExecSummary(e.data);
      setDefectAnalysis(d.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const generateNarrative = async () => {
    try {
      const r = await agentsAPI.run({
        agentType: 'REPORT_NARRATIVE',
        triggerEntityType: 'DateRange',
        additionalContext: { scope: 'DateRange' },
      });
      setAgentPanel({ agentRunId: r.data.agentRunId, agentType: 'REPORT_NARRATIVE' });
    } catch (err) { alert(err.response?.data?.error || err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <button onClick={generateNarrative} className="btn-purple text-sm">
          <Bot className="w-4 h-4" /> Generate AI Narrative
        </button>
      </div>

      {agentPanel && (
        <div className="card overflow-hidden" style={{ height: 420 }}>
          <AgentActivityPanel agentRunId={agentPanel.agentRunId} agentType={agentPanel.agentType} />
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}>
              {t}
            </button>
          ))}
        </nav>
      </div>

      {loading && <div className="text-center text-gray-400 text-sm py-8">Loading...</div>}

      {/* ── Coverage ── */}
      {!loading && tab === 'Coverage' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => downloadXlsx('/reports/export/coverage')} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Export XLSX
            </button>
          </div>
          <div className="card divide-y divide-gray-100">
            <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-gray-50 rounded-t-xl text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-2">Feature</div>
              <div>Type / Sub-Type</div>
              <div>Cases</div>
              <div>Scripts</div>
              <div>Readiness</div>
            </div>
            {coverage.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No data.</div>}
            {coverage.map(f => (
              <div key={f.id} className="grid grid-cols-6 gap-3 px-5 py-3 text-sm items-center">
                <div className="col-span-2 font-medium text-gray-900 truncate">{f.name}</div>
                <div className="text-gray-500 text-xs">
                  {f.feature_type}
                  {f.feature_type === 'API' && f.api_sub_type && (
                    <span className="ml-1 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">{f.api_sub_type}</span>
                  )}
                </div>
                <div className="text-gray-700">
                  {f.total_cases}
                  {f.approved_cases > 0 && <span className="text-xs text-gray-400 ml-1">({f.approved_cases} approved)</span>}
                </div>
                <div className="text-gray-700">
                  {f.scripts}
                  {f.approved_scripts > 0 && <span className="text-xs text-gray-400 ml-1">({f.approved_scripts} approved)</span>}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${(f.prereq_readiness || 0) >= 100 ? 'bg-green-500' : (f.prereq_readiness || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${f.prereq_readiness || 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-8 text-right">{f.prereq_readiness || 0}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Defect Analysis ── */}
      {!loading && tab === 'Defect Analysis' && defectAnalysis && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => downloadXlsx('/reports/export/defects')} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Export Defects XLSX
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">By Severity</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={defectAnalysis.bySeverity} cx="50%" cy="50%" outerRadius={80}
                    dataKey="count" nameKey="severity"
                    label={({ severity, count }) => `${severity}: ${count}`}>
                    {defectAnalysis.bySeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">By Feature (Top 10)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={defectAnalysis.byFeature} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="feature_name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="defect_count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Execution Summary ── */}
      {!loading && tab === 'Execution Summary' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => downloadXlsx('/reports/export/execution-summary')} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Export XLSX
            </button>
          </div>
          <div className="card divide-y divide-gray-100">
            <div className="grid grid-cols-6 gap-3 px-5 py-3 bg-gray-50 rounded-t-xl text-xs font-semibold text-gray-500 uppercase">
              <div className="col-span-2">Run Name</div>
              <div>Status</div>
              <div>Total</div>
              <div>Passed</div>
              <div>Failed</div>
            </div>
            {execSummary.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No execution data.</div>}
            {execSummary.map(r => (
              <div key={r.id} className="grid grid-cols-6 gap-3 px-5 py-3 text-sm items-center">
                <div className="col-span-2 font-medium text-gray-900 truncate">{r.name}</div>
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'Completed' ? 'bg-green-100 text-green-700'
                    : r.status === 'Failed' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>{r.status}</span>
                </div>
                <div className="text-gray-700">{r.total_tests ?? r.execution_count ?? '—'}</div>
                <div className="text-green-600 font-medium">{r.passed ?? '—'}</div>
                <div className="text-red-600 font-medium">{r.failed ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
