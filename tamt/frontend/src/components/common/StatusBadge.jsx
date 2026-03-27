import React from 'react';

// Maps status/priority values to badge CSS class names from index.css
const STATUS_CLASS = {
  // Feature / Test Case status
  Draft:        'badge-gray',
  Active:       'badge-cyan',
  Approved:     'badge-green',
  Deprecated:   'badge-gray',
  Review:       'badge-amber',
  'On Hold':    'badge-amber',
  Archived:     'badge-gray',
  // Test execution results
  Pass:         'badge-green',
  Fail:         'badge-red',
  Skipped:      'badge-gray',
  Pending:      'badge-cyan',
  Blocked:      'badge-amber',
  // Test run status
  Running:      'badge-cyan',
  Completed:    'badge-green',
  Failed:       'badge-red',
  Cancelled:    'badge-gray',
  // Priority
  P1:           'badge-red',
  P2:           'badge-amber',
  P3:           'badge-cyan',
  // Defect severity
  Critical:     'badge-red',
  Major:        'badge-amber',
  Minor:        'badge-cyan',
  Trivial:      'badge-gray',
  // Defect status
  Open:         'badge-red',
  'In Progress':'badge-amber',
  Resolved:     'badge-green',
  Closed:       'badge-gray',
  // Scripts
  Validated:    'badge-green',
  Scripted:     'badge-purple',
};

export default function StatusBadge({ status }) {
  const cls = STATUS_CLASS[status] || 'badge-gray';
  return <span className={`badge ${cls}`}>{status}</span>;
}
