import React from 'react';

const STATUS_STYLES = {
  // Feature/TestCase status
  Draft: 'bg-gray-100 text-gray-700',
  Active: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Deprecated: 'bg-red-100 text-red-700',
  Review: 'bg-yellow-100 text-yellow-700',
  // Test execution
  Pass: 'bg-green-100 text-green-700',
  Fail: 'bg-red-100 text-red-700',
  Skipped: 'bg-gray-100 text-gray-600',
  Pending: 'bg-blue-50 text-blue-600',
  Blocked: 'bg-orange-100 text-orange-700',
  // Run status
  Running: 'bg-blue-100 text-blue-700',
  Completed: 'bg-green-100 text-green-700',
  Failed: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-600',
  // Priority
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-blue-100 text-blue-700',
  // Severity
  Critical: 'bg-red-100 text-red-800',
  Major: 'bg-orange-100 text-orange-800',
  Minor: 'bg-yellow-100 text-yellow-800',
  Trivial: 'bg-gray-100 text-gray-600',
  // Defect
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-100 text-gray-600',
};

export default function StatusBadge({ status, size = 'sm' }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  const sz = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${style} ${sz}`}>
      {status}
    </span>
  );
}
