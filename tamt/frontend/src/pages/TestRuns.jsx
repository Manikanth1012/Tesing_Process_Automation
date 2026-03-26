import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { testRunsAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';

export default function TestRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testRunsAPI.list().then(r => { setRuns(r.data); setLoading(false); });
  }, []);

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Test Runs</h1><p className="text-sm text-gray-500 mt-0.5">{runs.length} runs</p></div>
      <div className="card divide-y divide-gray-100">
        {loading && <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>}
        {!loading && runs.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No test runs yet.</div>}
        {runs.map(r => (
          <Link key={r.id} to={`/test-runs/${r.id}`} className="flex items-center px-5 py-4 hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-gray-900">{r.name}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="text-xs text-gray-500">{r.environment_name || 'No env'} · {r.run_type}</div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 ml-4">
              {r.passed != null && <span className="text-green-600 font-medium">{r.passed} pass</span>}
              {r.failed != null && <span className="text-red-600 font-medium">{r.failed} fail</span>}
              <span>{r.execution_count} executions</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
