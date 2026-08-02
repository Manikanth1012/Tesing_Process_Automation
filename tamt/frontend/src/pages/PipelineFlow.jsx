import React, { useState } from 'react';

/* ─── Stage definitions ───────────────────────────────────────────────────── */
const STAGES = [
  {
    id: 's1', num: 1, label: 'Project Setup', sub: 'Define scope & team',
    color: '#22d3ee', dimBg: '#061624', border: '#0284c7',
    ai: false,
    inputs: ['Project name & description', 'Repository / test-asset URL', 'Team members & role assignments', 'Target environments (dev / staging / prod)'],
    outputs: ['Project record persisted in DB', 'Default Test Plan auto-created', 'Team role assignments recorded', 'Environment configs stored'],
    artifacts: 'projects, environments, users tables',
    trigger: 'Manual — QA Lead creates the project in TAMT UI',
  },
  {
    id: 's2', num: 2, label: 'Feature Onboarding', sub: 'Register features & stories',
    color: '#38bdf8', dimBg: '#061624', border: '#0284c7',
    ai: false,
    inputs: ['Feature name & business description', 'User stories / BDD Gherkin scenarios', 'Acceptance criteria (structured list)', 'Test plan assignment'],
    outputs: ['Feature record created & linked', 'Acceptance criteria stored', 'Status: Awaiting Prerequisites'],
    artifacts: 'features table row',
    trigger: 'Manual — QA engineer registers each in-scope feature',
  },
  {
    id: 's3', num: 3, label: 'Prerequisites', sub: 'AI validates readiness',
    color: '#a78bfa', dimBg: '#12082a', border: '#7c3aed',
    ai: true, agentName: 'Prerequisite Validator Agent',
    inputs: ['Feature description & acceptance criteria', 'Environment configuration details', 'Linked test-data availability', 'Dependency services & external APIs'],
    outputs: ['Readiness score 0–100', 'Missing prerequisite items (itemised)', 'Go / No-Go recommendation', 'Detailed gap narrative'],
    artifacts: 'prerequisites table rows (PASS / FAIL per item)',
    trigger: '"Run Prerequisites Check" action on Feature detail page',
  },
  {
    id: 's4', num: 4, label: 'Test Case Design', sub: 'Manual + AI generation',
    color: '#a78bfa', dimBg: '#12082a', border: '#7c3aed',
    ai: true, agentName: 'Test Case Generator Agent',
    inputs: ['Feature context & user stories', 'Acceptance criteria (from prerequisites)', 'Existing test cases (dedup check)', 'API / UI specifications or OpenAPI doc'],
    outputs: ['Structured test case records with steps', 'Expected result for each step', 'Priority (Critical / High / Medium / Low)', 'Type tags (smoke / regression / e2e)'],
    artifacts: 'test_cases table rows',
    trigger: '"Generate Test Cases" on Feature page — or created manually',
  },
  {
    id: 's5', num: 5, label: 'Script Generation', sub: 'AI writes .robot files',
    color: '#c084fc', dimBg: '#140828', border: '#9333ea',
    ai: true, agentName: 'RF Script Writer Agent',
    inputs: ['Structured test case steps', 'TAMT keyword library catalogue', 'Variable / resource file templates', 'Environment base URLs & credential vars'],
    outputs: ['Complete Robot Framework .robot script', 'Resource file imports section', 'Variable declarations block', 'Suite & test-level tags for filtering'],
    artifacts: 'test_cases.robot_script field updated',
    trigger: '"Generate Script" per test case — Claude API called with RF context',
  },
  {
    id: 's6', num: 6, label: 'Test Execution', sub: 'Live Robot Framework run',
    color: '#fb923c', dimBg: '#180800', border: '#ea580c',
    ai: false,
    inputs: ['Compiled .robot scripts', 'Target environment selection', 'Suite / tag filter expressions', 'Parallel-run configuration'],
    outputs: ['Pass / Fail result per test case', 'Live log stream via SSE (EventSource)', 'output.xml artefact', 'Timing & duration metrics'],
    artifacts: 'test_runs, test_executions, test_run_results tables',
    trigger: '"Run Tests" — python-shell spawns Robot Framework subprocess, streams output',
  },
  {
    id: 's7', num: 7, label: 'Defect Triage', sub: 'AI classifies failures',
    color: '#f87171', dimBg: '#180404', border: '#dc2626',
    ai: true, agentName: 'Defect Classifier & RCA Agent',
    inputs: ['Test failure log & error stack trace', 'Test case context & step details', 'Environment snapshot at time of failure', 'Historical defect patterns from DB'],
    outputs: ['Severity classification: P1–P4', 'Root cause category (env / data / code / script)', 'Affected component identification', 'AI-suggested remediation steps'],
    artifacts: 'defects table rows',
    trigger: 'Auto-triggered on each FAIL in execution run results',
  },
  {
    id: 's8', num: 8, label: 'Gap Analysis', sub: 'AI finds coverage gaps',
    color: '#fbbf24', dimBg: '#140e00', border: '#ca8a04',
    ai: true, agentName: 'Gap Analyzer Agent',
    inputs: ['Executed test set (this run)', 'Feature requirements map', 'Defect frequency & severity data', 'Current test coverage matrix'],
    outputs: ['Uncovered scenario list (ranked by risk)', 'Risk-ranked coverage gaps', 'Recommended new test cases to fill gaps', 'Overall feature coverage % metric'],
    artifacts: 'reports table (type = gap_analysis)',
    trigger: 'Triggered after test run completes — analyses full test set vs requirements',
  },
  {
    id: 's9', num: 9, label: 'Reports & Export', sub: 'XLSX for stakeholders',
    color: '#4ade80', dimBg: '#021408', border: '#15803d',
    ai: true, agentName: 'Report Summarizer Agent',
    inputs: ['Test run results summary', 'Defect severity breakdown', 'Gap analysis findings', 'Historical trend data (previous runs)'],
    outputs: ['Multi-sheet XLSX executive report', 'AI-written summary narrative', 'Coverage trend visualisation data', 'Risk heatmap by feature area'],
    artifacts: 'reports table row + downloadable .xlsx file',
    trigger: '"Generate Report" — AI composes narrative + SheetJS builds workbook',
  },
];

/* ─── AI Agent cards ──────────────────────────────────────────────────────── */
const AGENTS = [
  {
    name: 'Prerequisite Validator',
    color: '#a78bfa', border: '#7c3aed', bg: '#12082a',
    model: 'claude-sonnet-4-5',
    role: 'Assesses whether a feature has all prerequisites met before scripting begins.',
    in: ['Feature description', 'Acceptance criteria', 'Env config', 'Dependency list'],
    out: ['Readiness score', 'Missing items list', 'Go / No-Go verdict'],
  },
  {
    name: 'Test Case Generator',
    color: '#a78bfa', border: '#7c3aed', bg: '#12082a',
    model: 'claude-sonnet-4-5',
    role: 'Generates structured test cases with steps & expected results from feature context.',
    in: ['Feature + ACs', 'User stories', 'Existing TCs (dedup)', 'API spec'],
    out: ['Test case records', 'Steps + expected results', 'Priority & type tags'],
  },
  {
    name: 'RF Script Writer',
    color: '#c084fc', border: '#9333ea', bg: '#140828',
    model: 'claude-sonnet-4-5',
    role: 'Authors Robot Framework .robot files from structured test case steps using keyword library context.',
    in: ['Test steps', 'Keyword library', 'Variable templates', 'Env URLs'],
    out: ['.robot script', 'Resource imports', 'Variable block'],
  },
  {
    name: 'Execution Analyzer',
    color: '#fb923c', border: '#ea580c', bg: '#180800',
    model: 'claude-haiku-4-5',
    role: 'Analyses streaming execution logs to surface anomalies and early failure indicators.',
    in: ['Live log stream', 'Test run config', 'Expected results'],
    out: ['Anomaly flags', 'Early-stop recommendation', 'Log summary'],
  },
  {
    name: 'Defect Classifier & RCA',
    color: '#f87171', border: '#dc2626', bg: '#180404',
    model: 'claude-sonnet-4-5',
    role: 'Classifies test failures by severity and performs AI root-cause analysis with fix suggestions.',
    in: ['Error log', 'Test case context', 'Env snapshot', 'History'],
    out: ['Severity P1–P4', 'RCA category', 'Fix suggestion'],
  },
  {
    name: 'Gap Analyzer',
    color: '#fbbf24', border: '#ca8a04', bg: '#140e00',
    model: 'claude-sonnet-4-5',
    role: 'Identifies untested scenarios and coverage gaps relative to feature requirements.',
    in: ['Executed tests', 'Requirements map', 'Defect patterns', 'Coverage %'],
    out: ['Gap list (risk-ranked)', 'Recommended new TCs', 'Coverage delta'],
  },
  {
    name: 'Report Summarizer',
    color: '#4ade80', border: '#15803d', bg: '#021408',
    model: 'claude-sonnet-4-5',
    role: 'Composes executive summary narratives and generates XLSX reports with SheetJS.',
    in: ['Run results', 'Defect summary', 'Gap findings', 'Trend data'],
    out: ['XLSX workbook', 'AI narrative', 'Risk heatmap data'],
  },
];

/* ─── Cross-pipeline data flow table ─────────────────────────────────────── */
const FLOW_ROWS = [
  { from: 'S2 Feature Onboarding', to: 'S3 Prerequisites', data: 'Acceptance criteria + feature description', channel: 'DB → Agent context window' },
  { from: 'S3 Prerequisites', to: 'S4 Test Case Design', data: 'Readiness verdict + gap items', channel: 'prerequisites table records' },
  { from: 'S4 Test Case Design', to: 'S5 Script Generation', data: 'Structured steps + expected results', channel: 'test_cases table' },
  { from: 'S5 Script Generation', to: 'S6 Test Execution', data: '.robot script content', channel: 'test_cases.robot_script field' },
  { from: 'S6 Test Execution', to: 'S7 Defect Triage', data: 'FAIL results + error logs + output.xml', channel: 'test_run_results + SSE stream' },
  { from: 'S6 Test Execution', to: 'S8 Gap Analysis', data: 'Full executed test set + pass/fail matrix', channel: 'test_executions table query' },
  { from: 'S7 Defect Triage', to: 'S8 Gap Analysis', data: 'Defect severity + RCA category', channel: 'defects table join' },
  { from: 'S7 + S8 combined', to: 'S9 Reports', data: 'Defect summary + gap findings', channel: 'DB query → Report agent context' },
];

/* ─── SVG pipeline canvas layout ─────────────────────────────────────────── */
const VBW = 820, VBH = 250;
const NW = 108, NH = 56;
const R1Y = 72, R2Y = 190;
const R1X = [100, 252, 404, 556, 708];  // S1–S5 x-centers
const R2X = [708, 556, 404, 252];        // S6–S9 x-centers (U-shape, right→left)

function PipelineNode({ stage, cx, cy, selected, onSelect }) {
  const sel = selected === stage.id;
  const [hov, setHov] = useState(false);
  return (
    <g
      onClick={() => onSelect(sel ? null : stage.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={cx - NW / 2} y={cy - NH / 2} width={NW} height={NH} rx={8}
        fill={sel ? stage.dimBg : hov ? '#111827' : '#0a0f1a'}
        stroke={sel || hov ? stage.color : stage.border}
        strokeWidth={sel ? 2 : 1}
        style={{ filter: sel ? `drop-shadow(0 0 8px ${stage.color}55)` : 'none', transition: 'all 0.15s' }}
      />
      {/* number badge */}
      <rect x={cx - NW / 2 + 5} y={cy - NH / 2 + 5} width={18} height={14} rx={3} fill={stage.color} opacity="0.18" />
      <text x={cx - NW / 2 + 14} y={cy - NH / 2 + 15.5} textAnchor="middle" fontSize="8" fontWeight="800" fill={stage.color}>{stage.num}</text>
      {/* AI badge */}
      {stage.ai && (
        <>
          <rect x={cx + NW / 2 - 24} y={cy - NH / 2 + 5} width={19} height={11} rx={3} fill={stage.color} opacity="0.2" />
          <text x={cx + NW / 2 - 14.5} y={cy - NH / 2 + 13.5} textAnchor="middle" fontSize="7" fontWeight="700" fill={stage.color}>AI</text>
        </>
      )}
      {/* label */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={sel ? stage.color : '#e2e8f0'} style={{ transition: 'fill 0.15s' }}>
        {stage.label}
      </text>
      {/* sub */}
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" fill="#64748b">{stage.sub}</text>
    </g>
  );
}

function PipelineCanvas({ selected, onSelect }) {
  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <marker id="arr-r" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0,0.5 L0,5.5 L6,3 z" fill="#475569" />
        </marker>
        <marker id="arr-l" markerWidth="7" markerHeight="7" refX="1" refY="3" orient="auto">
          <path d="M6,0.5 L6,5.5 L0,3 z" fill="#475569" />
        </marker>
        <marker id="arr-d" markerWidth="7" markerHeight="7" refX="3" refY="5" orient="auto">
          <path d="M0.5,0 L5.5,0 L3,6 z" fill="#475569" />
        </marker>
      </defs>

      {/* Row 1 arrows →  */}
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={R1X[i] + NW / 2 + 3} y1={R1Y} x2={R1X[i + 1] - NW / 2 - 3} y2={R1Y}
          stroke="#334155" strokeWidth="1.5" markerEnd="url(#arr-r)" />
      ))}

      {/* Down connector S5 → S6 */}
      <line x1={R1X[4]} y1={R1Y + NH / 2 + 3} x2={R2X[0]} y2={R2Y - NH / 2 - 3}
        stroke="#334155" strokeWidth="1.5" markerEnd="url(#arr-d)" />

      {/* Row 2 arrows ← */}
      {[0, 1, 2].map(i => (
        <line key={i} x1={R2X[i] - NW / 2 - 3} y1={R2Y} x2={R2X[i + 1] + NW / 2 + 3} y2={R2Y}
          stroke="#334155" strokeWidth="1.5" markerEnd="url(#arr-l)" />
      ))}

      {/* Flow direction labels */}
      <text x={R1X[0] - NW / 2 - 6} y={R1Y + 4} textAnchor="end" fontSize="8" fill="#0ea5e9" fontWeight="600">START</text>
      <text x={R2X[3] - NW / 2 - 6} y={R2Y + 4} textAnchor="end" fontSize="8" fill="#4ade80" fontWeight="600">END</text>

      {/* Click hint */}
      <text x={VBW / 2} y={VBH - 8} textAnchor="middle" fontSize="8" fill="#334155">Click any stage to see inputs, outputs &amp; artifacts</text>

      {/* Row 1 nodes S1–S5 */}
      {STAGES.slice(0, 5).map((s, i) => (
        <PipelineNode key={s.id} stage={s} cx={R1X[i]} cy={R1Y} selected={selected} onSelect={onSelect} />
      ))}

      {/* Row 2 nodes S6–S9 */}
      {STAGES.slice(5).map((s, i) => (
        <PipelineNode key={s.id} stage={s} cx={R2X[i]} cy={R2Y} selected={selected} onSelect={onSelect} />
      ))}
    </svg>
  );
}

/* ─── Stage detail panel ──────────────────────────────────────────────────── */
function StagePanel({ stage, onClose }) {
  if (!stage) return null;
  return (
    <div style={{ marginBottom: 20, background: '#0d1117', border: `1.5px solid ${stage.border}`, borderRadius: 14, overflow: 'hidden', animation: 'tamt-slide-in 0.2s ease' }}>
      {/* header */}
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #1e293b', background: stage.dimBg }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: stage.color + '20', border: `1px solid ${stage.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: stage.color, flexShrink: 0 }}>
          {stage.num}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{stage.label}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{stage.sub}</div>
        </div>
        {stage.ai && (
          <div style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: stage.color + '18', color: stage.color, border: `1px solid ${stage.border}`, flexShrink: 0 }}>
            {stage.agentName}
          </div>
        )}
        <button
          onClick={onClose}
          style={{ marginLeft: stage.ai ? 10 : 'auto', width: 26, height: 26, borderRadius: '50%', background: '#1e293b', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >×</button>
      </div>
      {/* inputs / outputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, color: '#3b82f6' }}>▼ INPUTS</div>
          {stage.inputs.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: '#94a3b8', marginBottom: 7, lineHeight: 1.55 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 4 }} />
              {item}
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 18px', borderLeft: '1px solid #1e293b' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, color: stage.color }}>▲ OUTPUTS</div>
          {stage.outputs.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: '#94a3b8', marginBottom: 7, lineHeight: 1.55 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: stage.color, flexShrink: 0, marginTop: 4 }} />
              {item}
            </div>
          ))}
        </div>
      </div>
      {/* footer */}
      <div style={{ padding: '9px 18px', borderTop: '1px solid #1e293b', background: '#080d14', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#475569', marginRight: 6 }}>ARTIFACTS</span>
          {stage.artifacts}
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#475569', marginRight: 6 }}>TRIGGER</span>
          {stage.trigger}
        </div>
      </div>
    </div>
  );
}

/* ─── Agent card ──────────────────────────────────────────────────────────── */
function AgentCard({ agent }) {
  return (
    <div style={{ background: agent.bg, border: `1px solid ${agent.border}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: agent.color, marginBottom: 4 }}>{agent.name}</div>
      <div style={{ fontSize: 9, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>{agent.role}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#3b82f6', marginBottom: 5 }}>▼ INPUT</div>
          {agent.in.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 9, color: '#7c8fa6', marginBottom: 3, lineHeight: 1.45 }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 4 }} />
              {x}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: agent.color, marginBottom: 5 }}>▲ OUTPUT</div>
          {agent.out.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 9, color: '#7c8fa6', marginBottom: 3, lineHeight: 1.45 }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: agent.color, flexShrink: 0, marginTop: 4 }} />
              {x}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 8, paddingTop: 7, borderTop: `1px solid ${agent.border}30`, fontSize: 9, color: '#475569' }}>
        Model: <span style={{ color: agent.color }}>{agent.model}</span>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function PipelineFlow() {
  const [selected, setSelected] = useState(null);
  const selectedStage = STAGES.find(s => s.id === selected);

  const sectionLabel = {
    fontSize: 10, fontWeight: 700, letterSpacing: '1.5px',
    textTransform: 'uppercase', color: '#475569', marginBottom: 14,
  };
  const divider = { border: 'none', borderTop: '1px solid #1a2233', margin: '28px 0' };
  const card = { background: '#0d1117', border: '1px solid #1e293b', borderRadius: 14, overflow: 'hidden' };
  const cardHdr = { padding: '12px 16px', borderBottom: '1px solid #1e293b' };

  return (
    <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', color: '#e2e8f0', paddingBottom: 40 }}>
      <style>{`
        @keyframes tamt-slide-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: '"Syne", sans-serif', fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
              TAMT Process Pipeline
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              End-to-end flow from feature onboarding to stakeholder reporting · 9 stages · 7 AI agents · Click any stage to explore
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '9 Stages', bg: '#0c1a30', color: '#22d3ee' },
              { label: '7 AI Agents', bg: '#12082a', color: '#a78bfa' },
              { label: 'Robot Framework 7', bg: '#1a0800', color: '#fb923c' },
              { label: 'Claude API', bg: '#021408', color: '#4ade80' },
            ].map(b => (
              <span key={b.label} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: b.bg, color: b.color, border: `1px solid ${b.color}30` }}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* stage badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
          {STAGES.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(selected === s.id ? null : s.id)}
              style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: selected === s.id ? s.color + '25' : '#0d1117',
                color: s.color, border: `1px solid ${selected === s.id ? s.color : s.border + '60'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {s.num}. {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SVG Pipeline Canvas ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...cardHdr, background: '#080d14' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Pipeline Flow — U-shape: Start (top-left) → Script Generation (top-right) → Test Execution (down) → Reports (bottom-left)</span>
        </div>
        <div style={{ padding: '16px 12px 8px' }}>
          <PipelineCanvas selected={selected} onSelect={setSelected} />
        </div>
      </div>

      {/* ── Stage detail panel ── */}
      <StagePanel stage={selectedStage} onClose={() => setSelected(null)} />

      <hr style={divider} />

      {/* ── AI Agents section ── */}
      <div style={sectionLabel}>AI Agents — Model, Role &amp; I/O</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, marginBottom: 4 }}>
        {AGENTS.map(a => <AgentCard key={a.name} agent={a} />)}
      </div>

      <hr style={divider} />

      {/* ── Cross-pipeline data flow table ── */}
      <div style={sectionLabel}>Cross-Pipeline Data Flow</div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {['FROM', 'TO', 'DATA PASSED', 'CHANNEL'].map(h => (
                <th key={h} style={{ background: '#0f1520', color: '#64748b', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 14px', borderBottom: '1px solid #1e293b', textAlign: 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FLOW_ROWS.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #0f1520' }}>
                <td style={{ padding: '9px 14px', color: '#60a5fa', fontWeight: 600 }}>{row.from}</td>
                <td style={{ padding: '9px 14px', color: '#a78bfa', fontWeight: 600 }}>{row.to}</td>
                <td style={{ padding: '9px 14px', color: '#94a3b8' }}>{row.data}</td>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#1e293b', color: '#64748b', fontFamily: '"DM Mono", monospace' }}>
                    {row.channel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr style={divider} />

      {/* ── Similar project example: VIL Migration ── */}
      <div style={sectionLabel}>Similar Tool Built with This Approach — VIL Migration Automation</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

        {/* Left: overview */}
        <div style={{ background: '#0f0a1e', border: '1.5px solid #7c3aed', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ background: '#1a1040', padding: '12px 16px', borderBottom: '1px solid #2d1f60' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd' }}>VIL Migration — AI-Powered Data Pipeline</div>
            <div style={{ fontSize: 10, color: '#7c6fcd', marginTop: 3 }}>9 AI agents · 7 pipeline stages · same pattern as TAMT</div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, marginBottom: 14 }}>
              Built using the same multi-agent orchestration approach as TAMT, the VIL Migration tool automates end-to-end data migration pipelines. Each pipeline stage has a dedicated AI agent that validates, transforms, and reconciles data — mirroring TAMT's philosophy of an AI agent per critical lifecycle step.
            </p>

            {/* Stage comparison */}
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#475569', marginBottom: 10 }}>STAGE COMPARISON</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['TAMT Stage', 'VIL Migration Equivalent'],
                ['Project Setup', 'Instance Creation'],
                ['Feature Onboarding', 'File Mapping (CSV → stg_*)'],
                ['Prerequisites Check', 'Readiness Check Agent'],
                ['Test Case Design', 'Pre-Validation (Stage 2)'],
                ['Script Generation', 'Transform Rules Engine'],
                ['Test Execution', 'Target Load (Stage 5)'],
                ['Defect Triage', 'Error Recovery Agent'],
                ['Gap Analysis', 'Reconciliation (Stage 6)'],
                ['Reports & Export', 'Migration Reports + Excel'],
              ].map(([a, b], i) => (
                <React.Fragment key={i}>
                  <div style={{ padding: '5px 8px', background: i === 0 ? '#0f1520' : '#0a0f1a', borderRadius: i === 0 ? '6px 0 0 0' : 4, fontSize: i === 0 ? 9 : 10, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#475569' : '#60a5fa', border: '1px solid #1e293b' }}>{a}</div>
                  <div style={{ padding: '5px 8px', background: i === 0 ? '#0f1520' : '#0a0f1a', borderRadius: i === 0 ? '0 6px 0 0' : 4, fontSize: i === 0 ? 9 : 10, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? '#475569' : '#a78bfa', border: '1px solid #1e293b', borderLeft: 'none' }}>{b}</div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Tech stack comparison */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #2d1f60', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Claude API', color: '#a78bfa' },
              { label: 'Python + FastAPI', color: '#60a5fa' },
              { label: 'ChromaDB (vector)', color: '#34d399' },
              { label: 'MySQL (staging)', color: '#fbbf24' },
              { label: '9 AI Agents', color: '#f87171' },
              { label: 'SSE streaming', color: '#fb923c' },
            ].map(t => (
              <span key={t.label} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: t.color + '15', color: t.color, border: `1px solid ${t.color}30` }}>{t.label}</span>
            ))}
          </div>
        </div>

        {/* Right: agent list + memory architecture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Agent list */}
          <div style={{ background: '#0a1020', border: '1.5px solid #0284c7', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ background: '#0c1a30', padding: '12px 16px', borderBottom: '1px solid #1e3a5f' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#7dd3fc' }}>VIL AI Agents</div>
              <div style={{ fontSize: 10, color: '#4a7fa3', marginTop: 2 }}>6 specialist + 1 orchestration agent</div>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { name: 'IntentRouter', desc: 'NLP → dispatch to specialist', color: '#7dd3fc' },
                { name: 'DataQueryAgent', desc: 'NL → SQL → staging DB query', color: '#60a5fa' },
                { name: 'PipelineControlAgent', desc: 'Run / rollback / stage trigger', color: '#a78bfa' },
                { name: 'InstanceMgmtAgent', desc: 'NEW / DELTA instance lifecycle', color: '#34d399' },
                { name: 'RulesMgmtAgent', desc: 'Transform rules CRUD + dedup', color: '#fbbf24' },
                { name: 'ReportAgent', desc: 'Reconciliation report + Excel', color: '#fb923c' },
                { name: 'GeneralAgent', desc: 'Fallback + episodic memory', color: '#f87171' },
              ].map(a => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#0f1a30', border: '1px solid #1e3a5f', borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: a.color }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3-layer memory */}
          <div style={{ background: '#0f0a1e', border: '1.5px solid #4c1d95', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd', marginBottom: 10 }}>3-Layer Memory Architecture</div>
            {[
              { layer: 'L1 — Turn History', detail: 'Frontend history[] · last 10 messages · session-only' },
              { layer: 'L2 — Session Memory', detail: 'active_instance · active_job · pending_confirm · 30-min TTL' },
              { layer: 'L3 — ChromaDB (persistent)', detail: 'conversation_memory · intent_examples · error_patterns · global_rules_semantic' },
            ].map(m => (
              <div key={m.layer} style={{ background: '#1a1040', border: '1px solid #4c1d95', borderRadius: 7, padding: '8px 11px', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>{m.layer}</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{m.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Key takeaways ── */}
      <hr style={divider} />
      <div style={sectionLabel}>Key Design Principles — Applied in Both Tools</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {[
          { title: 'One Agent Per Stage', desc: 'Each critical lifecycle stage has a dedicated AI agent with a focused context and clear I/O contract.', color: '#22d3ee' },
          { title: 'DB as Truth Layer', desc: 'Agents read from and write to SQLite / MySQL — state is persistent, auditable, and shared across agents.', color: '#a78bfa' },
          { title: 'SSE Streaming', desc: 'Long-running operations (RF execution, DB migration) stream output live via Server-Sent Events.', color: '#fb923c' },
          { title: 'Human in the Loop', desc: 'Every AI suggestion surfaces for human review before taking destructive or irreversible actions.', color: '#fbbf24' },
          { title: 'RAG + Semantic Context', desc: 'Vector-indexed docs and examples (ChromaDB / TF-IDF) ground AI responses in project-specific knowledge.', color: '#4ade80' },
          { title: 'XLSX Export', desc: 'All reports are downloadable as multi-sheet Excel workbooks for stakeholder distribution.', color: '#f87171' },
        ].map(p => (
          <div key={p.title} style={{ background: '#0d1117', border: `1px solid ${p.color}30`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: p.color, marginBottom: 5 }}>{p.title}</div>
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.55 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', padding: '28px 0 0', fontSize: 11, color: '#334155' }}>
        TAMT v1.3.0 · 9 stages · 7 AI agents · Robot Framework 7 · Claude API
      </div>
    </div>
  );
}
