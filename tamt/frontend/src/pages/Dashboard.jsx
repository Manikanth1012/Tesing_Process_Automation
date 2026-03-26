import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Bug, Play, TestTube, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { reportsAPI } from '../services/api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#6b7280'];

function StatCard({ label, value, sub, icon: Icon, color, to }) {
  const content = (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="hover:shadow-md transition-shadow">{content}</Link> : content;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsAPI.dashboard().then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-sm mt-8 text-center">Loading dashboard...</div>;
  if (!data) return <div className="text-red-500 text-sm mt-8 text-center">Failed to load dashboard.</div>;

  const execStats = data.execStats || [];
  const passRate = execStats.reduce((acc, s) => {
    if (s.status === 'Pass') acc.pass = s.count;
    if (s.status === 'Fail') acc.fail = s.count;
    return acc;
  }, { pass: 0, fail: 0 });

  const pieData = execStats.map(s => ({ name: s.status, value: s.count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Test Automation Management Tool overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Features" value={data.features?.total ?? 0} sub={`${data.features?.active ?? 0} active`} icon={Layers} color="bg-brand-600" to="/features" />
        <StatCard label="Test Cases" value={data.testCases?.total ?? 0} sub={`${data.testCases?.approved ?? 0} approved`} icon={TestTube} color="bg-purple-600" to="/test-cases" />
        <StatCard label="Test Runs" value={data.testRuns?.total ?? 0} sub={`${data.testRuns?.completed ?? 0} completed`} icon={Play} color="bg-green-600" to="/test-runs" />
        <StatCard label="Open Defects" value={data.defects?.open ?? 0} sub={`${data.defects?.critical ?? 0} critical`} icon={Bug} color="bg-red-600" to="/defects" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Stats */}
        {pieData.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Execution Results</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Script Status */}
        {data.scripts?.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Script Coverage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.scripts}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Runs */}
      {data.recentRuns?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Recent Test Runs</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recentRuns.map(run => (
              <Link key={run.id} to={`/test-runs/${run.id}`} className="flex items-center px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{run.name}</div>
                  <div className="text-xs text-gray-500">{run.started_at || run.created_at}</div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {run.total_tests != null && (
                    <>
                      <span className="text-green-600 font-medium">{run.passed} pass</span>
                      <span className="text-red-600 font-medium">{run.failed} fail</span>
                    </>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    run.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    run.status === 'Running' ? 'bg-blue-100 text-blue-700' :
                    run.status === 'Failed' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{run.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
