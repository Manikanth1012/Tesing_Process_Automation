import React from 'react';

const STAGE_META = {
  prereq:    { color: '#22d3ee', bg: '#051a20' },
  testcase:  { color: '#60a5fa', bg: '#050d20' },
  script:    { color: '#c4b5fd', bg: '#120828' },
  execution: { color: '#4ade80', bg: '#031a0a' },
  monitor:   { color: '#fb923c', bg: '#1a0800' },
  defect:    { color: '#fca5a5', bg: '#1a0505' },
  report:    { color: '#fbbf24', bg: '#140c00' },
};

const STATUS_ICON = { done: '✓', partial: '◑', pending: '○' };
const STATUS_COLOR = {
  done:    { text: 'var(--green)', bg: 'var(--green-dim)',  border: 'rgba(61,214,140,0.3)' },
  partial: { text: 'var(--amber)', bg: 'var(--amber-dim)',  border: 'rgba(244,162,97,0.3)' },
  pending: { text: 'var(--t3)',    bg: 'transparent',       border: 'var(--border)' },
};

/* ── Full pipeline tracker (for ProjectDetail) ─────────────────────────── */
export function PipelineTracker({ stages }) {
  if (!stages?.length) return null;

  const doneCount = stages.filter(s => s.status === 'done').length;
  const pct = Math.round((doneCount / stages.length) * 100);

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>
            Pipeline Progress
          </div>
          <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', marginTop: 2, letterSpacing: '0.06em' }}>
            {doneCount}/{stages.length} stages complete
          </div>
        </div>
        <div style={{
          fontFamily: '"DM Mono",monospace', fontSize: 13, fontWeight: 700,
          color: pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--amber)' : 'var(--t3)',
        }}>
          {pct}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`,
          background: pct === 100
            ? 'var(--green)'
            : 'linear-gradient(90deg, var(--cyan), var(--green))',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Stage list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stages.map((stage, i) => {
          const meta = STAGE_META[stage.id] || { color: '#94a3b8', bg: '#0d1117' };
          const sc = STATUS_COLOR[stage.status] || STATUS_COLOR.pending;
          return (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

              {/* Step number + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: stage.status === 'done' ? meta.color : stage.status === 'partial' ? meta.bg : 'var(--bg3)',
                  border: `1.5px solid ${stage.status !== 'pending' ? meta.color : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  color: stage.status === 'done' ? '#000' : stage.status === 'partial' ? meta.color : 'var(--t3)',
                  flexShrink: 0,
                }}>
                  {stage.status === 'done' ? '✓' : i + 1}
                </div>
                {i < stages.length - 1 && (
                  <div style={{
                    width: 1.5, height: 10,
                    background: stage.status === 'done' ? meta.color : 'var(--border)',
                    marginTop: 2,
                  }} />
                )}
              </div>

              {/* Stage info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: stage.status !== 'pending' ? 'var(--t1)' : 'var(--t3)' }}>
                    {stage.icon} {stage.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                    background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                    flexShrink: 0,
                  }}>
                    {stage.status === 'done' ? 'Done' : stage.status === 'partial' ? 'In Progress' : 'Not Started'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, fontFamily: '"DM Mono",monospace' }}>
                  {stage.detail}
                  {stage.total != null && stage.total > 0 && (
                    <span style={{ marginLeft: 8 }}>
                      <span style={{
                        display: 'inline-block', width: 60, height: 4, background: 'var(--bg3)',
                        borderRadius: 3, overflow: 'hidden', verticalAlign: 'middle',
                      }}>
                        <span style={{
                          display: 'block', height: '100%', borderRadius: 3,
                          background: meta.color,
                          width: `${Math.round((stage.count / stage.total) * 100)}%`,
                        }} />
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Mini strip (for Projects list card) ───────────────────────────────── */
export function PipelineMiniStrip({ stages }) {
  if (!stages?.length) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, paddingTop: 10, marginTop: 10, borderTop: '1px solid var(--border)' }}>
      {stages.map((stage, i) => {
        const meta = STAGE_META[stage.id] || { color: '#94a3b8' };
        return (
          <React.Fragment key={stage.id}>
            <div
              title={`${stage.label}: ${stage.status === 'done' ? 'Done' : stage.status === 'partial' ? 'In Progress' : 'Not Started'} — ${stage.detail}`}
              style={{
                width: 20, height: 20, borderRadius: 6,
                background: stage.status === 'done' ? meta.color : stage.status === 'partial' ? `${meta.color}30` : 'var(--bg3)',
                border: `1px solid ${stage.status !== 'pending' ? meta.color : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, flexShrink: 0, cursor: 'default',
              }}
            >
              {stage.status === 'done' ? '✓' : stage.status === 'partial' ? '◑' : ''}
            </div>
            {i < stages.length - 1 && (
              <div style={{
                flex: 1, height: 1.5, minWidth: 4,
                background: stage.status === 'done' ? meta.color : 'var(--border)',
              }} />
            )}
          </React.Fragment>
        );
      })}
      <span style={{ marginLeft: 8, fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>
        {stages.filter(s => s.status === 'done').length}/{stages.length}
      </span>
    </div>
  );
}
