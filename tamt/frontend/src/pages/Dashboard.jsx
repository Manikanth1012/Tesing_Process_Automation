import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug, Play, TestTube, Layers, FolderKanban } from 'lucide-react';
import { reportsAPI, projectsAPI } from '../services/api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatusBadge from '../components/common/StatusBadge.jsx';

const PIE_COLORS = { Pass: '#3dd68c', Fail: '#ff6b6b', Skipped: '#4a6580', Pending: '#00d4ff', Blocked: '#f4a261' };

function StatCard({ label, value, sub, icon: Icon, color, to }) {
  const inner = (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14, transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--t1)', lineHeight: 1 }}>{value}</div>
        <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 3 }}>{label}</div>
        {sub && <div style={{ color: 'var(--t3)', fontSize: 11, fontFamily: '"DM Mono",monospace', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = (() => { try { return JSON.parse(localStorage.getItem('tamt_user') || '{}'); } catch { return {}; } })();

  useEffect(() => {
    Promise.all([
      reportsAPI.dashboard().catch(() => ({ data: null })),
      projectsAPI.list().catch(() => ({ data: [] })),
    ]).then(([dashRes, projRes]) => {
      setData(dashRes.data);
      setProjects(projRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--t3)', fontFamily: '"DM Mono",monospace', fontSize: 12 }}>Loading dashboard…</div>;

  const execStats = data?.execStats || [];
  const pieData = execStats.map(s => ({ name: s.status, value: s.count }));

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 800, fontSize: 26, color: 'var(--t1)', marginBottom: 4 }}>
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p style={{ color: 'var(--t3)', fontFamily: '"DM Mono",monospace', fontSize: 11 }}>TAMT · Test Automation Management Platform</p>
        </div>
        <Link to="/projects" style={{ textDecoration: 'none' }}>
          <button className="btn-secondary text-sm"><FolderKanban size={14} /> All Projects</button>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="Features" value={data?.features?.total ?? 0} sub={`${data?.features?.active ?? 0} active`} icon={Layers} color="var(--cyan)" to="/features" />
        <StatCard label="Test Cases" value={data?.testCases?.total ?? 0} sub={`${data?.testCases?.approved ?? 0} approved`} icon={TestTube} color="var(--purple)" to="/test-cases" />
        <StatCard label="Test Runs" value={data?.testRuns?.total ?? 0} sub={`${data?.testRuns?.completed ?? 0} completed`} icon={Play} color="var(--green)" to="/test-runs" />
        <StatCard label="Open Defects" value={data?.defects?.open ?? 0} sub={`${data?.defects?.critical ?? 0} critical`} icon={Bug} color="var(--red)" to="/defects" />
      </div>

      {projects.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--t1)' }}>Projects</h2>
            <Link to="/projects" style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--cyan)', textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {projects.slice(0, 6).map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)', padding: '1px 7px', borderRadius: 4 }}>{p.key}</span>
                    <span style={{ fontFamily: '"Syne",sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    {[['plans', p.plan_count], ['features', p.feature_count], ['members', p.member_count]].map(([l, v]) => (
                      <span key={l} style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--t3)' }}>
                        <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{v || 0}</span> {l}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {pieData.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--t1)', marginBottom: 16 }}>Execution Results</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} ${value}`} labelLine={false} style={{ fontSize: 10, fontFamily: '"DM Mono",monospace' }}>
                  {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] || '#4a6580'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border-hi)', borderRadius: 8, color: 'var(--t1)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {data?.scripts?.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--t1)', marginBottom: 16 }}>Script Coverage</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.scripts} barSize={28}>
                <XAxis dataKey="status" tick={{ fontSize: 10, fill: 'var(--t3)', fontFamily: '"DM Mono",monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--t3)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border-hi)', borderRadius: 8, color: 'var(--t1)', fontSize: 12 }} cursor={{ fill: 'rgba(0,212,255,0.04)' }} />
                <Bar dataKey="count" fill="var(--cyan)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data?.recentRuns?.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>Recent Test Runs</h3>
            <Link to="/test-runs" style={{ fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--cyan)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {data.recentRuns.map(run => (
            <Link key={run.id} to={`/test-runs/${run.id}`} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--t1)', fontWeight: 500, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.name}</div>
                <div style={{ color: 'var(--t3)', fontFamily: '"DM Mono",monospace', fontSize: 11 }}>{run.started_at || run.created_at}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 16 }}>
                {run.total_tests != null && (<>
                  <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 12, color: 'var(--green)' }}>{run.passed} pass</span>
                  <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 12, color: 'var(--red)' }}>{run.failed} fail</span>
                </>)}
                <StatusBadge status={run.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
