import React, { useEffect, useState } from 'react';
import { defectsAPI } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';

export default function Defects() {
  const [defects, setDefects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ status: '', severity: '' });

  useEffect(() => {
    setLoading(true);
    defectsAPI.list(filter).then(r => { setDefects(r.data); setLoading(false); });
  }, [filter.status, filter.severity]);

  const updateStatus = async (id, status) => {
    await defectsAPI.update(id, { status });
    setDefects(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    if (selected?.id === id) setSelected(s => ({ ...s, status }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Defects</h1><p className="text-sm text-gray-500 mt-0.5">{defects.length} defects</p></div>
      </div>

      <div className="flex gap-3">
        <select className="input w-36" value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          {['Open', 'In Progress', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input w-36" value={filter.severity} onChange={e => setFilter(p => ({ ...p, severity: e.target.value }))}>
          <option value="">All Severity</option>
          {['Critical', 'Major', 'Minor', 'Trivial'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card divide-y divide-gray-100">
        {loading && <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>}
        {!loading && defects.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No defects found.</div>}
        {defects.map(d => (
          <div key={d.id} onClick={() => setSelected(d)} className="flex items-center px-5 py-3 hover:bg-gray-50 cursor-pointer">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm text-gray-900">{d.title}</span>
                <StatusBadge status={d.severity} />
                <StatusBadge status={d.priority} />
              </div>
              <div className="text-xs text-gray-500">{d.feature_name || 'Unknown feature'}</div>
            </div>
            <StatusBadge status={d.status} />
          </div>
        ))}
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={selected.title} size="lg">
          <div className="space-y-4 text-sm">
            <div className="flex gap-3 flex-wrap">
              <StatusBadge status={selected.severity} size="md" />
              <StatusBadge status={selected.priority} size="md" />
              <StatusBadge status={selected.status} size="md" />
            </div>
            {selected.description && (
              <div className="bg-gray-50 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">{selected.description}</div>
            )}
            {selected.steps_to_reproduce?.length > 0 && (
              <div>
                <div className="font-medium text-gray-700 mb-2">Steps to Reproduce</div>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">{selected.steps_to_reproduce.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {selected.expected_behavior && <div><div className="font-medium text-gray-700 mb-1">Expected</div><div className="text-gray-600 bg-green-50 p-2 rounded">{selected.expected_behavior}</div></div>}
              {selected.actual_behavior && <div><div className="font-medium text-gray-700 mb-1">Actual</div><div className="text-gray-600 bg-red-50 p-2 rounded">{selected.actual_behavior}</div></div>}
            </div>
            {selected.suggested_assignee_team && <div><span className="font-medium text-gray-700">Suggested Team: </span>{selected.suggested_assignee_team}</div>}
            <div className="flex gap-2 pt-2">
              {['Open', 'In Progress', 'Resolved', 'Closed'].map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)} className={`text-xs px-3 py-1.5 rounded-lg border ${selected.status === s ? 'bg-brand-600 text-white border-brand-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{s}</button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
