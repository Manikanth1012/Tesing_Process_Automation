import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, ChevronDown, Plus, Trash2, MessageSquare, ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { assistantAPI } from '../../services/api.js';

const WELCOME = `Hi! I'm the **TAMT Assistant**.

Ask me anything about using this tool — test plans, features, prerequisites, Robot Framework scripts, AI agents, defect triage, or reports.`;

export default function AiAssistant() {
  const [open, setOpen]         = useState(false);
  const [panel, setPanel]       = useState('chat');   // 'chat' | 'sessions'
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);   // active session
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load sessions when panel opens
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { data } = await assistantAPI.getSessions();
      setSessions(data);
    } catch { /* silently ignore */ }
    finally { setSessionsLoading(false); }
  }, []);

  useEffect(() => {
    if (open && panel === 'sessions') loadSessions();
  }, [open, panel, loadSessions]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  // Load an existing session's messages
  const openSession = async (id) => {
    try {
      const { data } = await assistantAPI.getSession(id);
      const msgs = data.messages.map(m => ({ role: m.role, content: m.content }));
      setMessages([{ role: 'assistant', content: WELCOME }, ...msgs]);
      setSessionId(id);
      setPanel('chat');
    } catch { alert('Failed to load session.'); }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await assistantAPI.deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (sessionId === id) {
      setSessionId(null);
      setMessages([{ role: 'assistant', content: WELCOME }]);
    }
  };

  const newChat = () => {
    setSessionId(null);
    setMessages([{ role: 'assistant', content: WELCOME }]);
    setPanel('chat');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const { data } = await assistantAPI.chat({ message: text, session_id: sessionId });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      // Track session id returned by server (auto-created on first message)
      if (data.session_id && !sessionId) setSessionId(data.session_id);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Sorry, the assistant is temporarily unavailable.';
      setMessages(prev => [...prev, { role: 'assistant', content: `_${errMsg}_` }]);
    } finally { setLoading(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const panelStyle = {
    position: 'fixed', bottom: 90, right: 28,
    width: 370, height: 520,
    background: 'var(--bg2)',
    border: '1px solid var(--border-hi)',
    borderRadius: 14,
    display: 'flex', flexDirection: 'column',
    zIndex: 200,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28,
          width: 48, height: 48,
          background: open ? 'var(--bg3)' : 'var(--cyan)',
          border: '1px solid ' + (open ? 'var(--border-hi)' : 'transparent'),
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 200,
          boxShadow: open ? 'none' : '0 0 20px rgba(0,212,255,0.35)',
          transition: 'all 0.2s',
        }}
        title="TAMT Assistant"
      >
        {open
          ? <ChevronDown style={{ color: 'var(--t2)' }} size={20} />
          : <Bot style={{ color: 'var(--bg)' }} size={20} />}
      </button>

      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {panel === 'sessions' && (
                <button onClick={() => setPanel('chat')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: '2px 4px' }}>
                  <ChevronLeft size={16} />
                </button>
              )}
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={13} style={{ color: 'var(--cyan)' }} />
              </div>
              <div>
                <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>
                  {panel === 'sessions' ? 'Conversations' : 'TAMT Assistant'}
                </div>
                {panel === 'chat' && sessionId && (
                  <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Session #{sessionId} · saved
                  </div>
                )}
                {panel === 'chat' && !sessionId && (
                  <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Scoped to TAMT · QA · RF
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => { if (panel === 'chat') { setPanel('sessions'); } else { newChat(); } }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
                title={panel === 'chat' ? 'View conversation history' : 'New chat'}
              >
                {panel === 'chat' ? <MessageSquare size={15} /> : <Plus size={15} />}
              </button>
              {panel === 'chat' && (
                <button onClick={newChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
                  title="New conversation">
                  <Plus size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Sessions panel ── */}
          {panel === 'sessions' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              <div style={{ padding: '6px 14px 10px' }}>
                <button onClick={newChat} className="btn-primary text-sm" style={{ width: '100%', justifyContent: 'center' }}>
                  <Plus size={14} /> New Conversation
                </button>
              </div>
              {sessionsLoading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Loading…</div>}
              {!sessionsLoading && sessions.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>No saved conversations yet.</div>
              )}
              {sessions.map(s => (
                <div key={s.id}
                  onClick={() => openSession(s.id)}
                  style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <MessageSquare size={13} style={{ color: 'var(--t3)', marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: s.id === sessionId ? 'var(--cyan)' : 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title || 'Conversation'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: '"DM Mono",monospace', marginTop: 2 }}>
                      {s.message_count || 0} messages
                    </div>
                  </div>
                  <button onClick={(e) => deleteSession(s.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Chat panel ── */}
          {panel === 'chat' && (
            <>
              <div className="agent-feed" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '88%', padding: '9px 12px',
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: msg.role === 'user' ? 'var(--cyan-dim)' : 'var(--bg3)',
                      border: '1px solid ' + (msg.role === 'user' ? 'var(--border-hi)' : 'var(--border)'),
                      fontSize: 13, color: 'var(--t1)', lineHeight: 1.6,
                    }}>
                      <ReactMarkdown components={{
                        p:      ({ children }) => <p style={{ margin: '0 0 6px', color: 'var(--t1)' }}>{children}</p>,
                        strong: ({ children }) => <strong style={{ color: 'var(--cyan)', fontWeight: 600 }}>{children}</strong>,
                        code:   ({ children }) => (
                          <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4, fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--green)' }}>
                            {children}
                          </code>
                        ),
                        ul: ({ children }) => <ul style={{ paddingLeft: 16, margin: '4px 0', color: 'var(--t2)' }}>{children}</ul>,
                        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                      }}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={14} style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: '"DM Mono",monospace' }}>Thinking…</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <textarea
                  ref={inputRef} rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about TAMT, RF scripts, test cases…"
                  disabled={loading}
                  style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--t1)', fontSize: 13, padding: '7px 10px', outline: 'none', resize: 'none', fontFamily: '"DM Sans",sans-serif', lineHeight: 1.4 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--border-hi)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                />
                <button
                  onClick={send} disabled={!input.trim() || loading}
                  style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, alignSelf: 'flex-end', background: input.trim() && !loading ? 'var(--cyan)' : 'var(--bg3)', border: '1px solid ' + (input.trim() && !loading ? 'transparent' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
                >
                  <Send size={14} style={{ color: input.trim() && !loading ? 'var(--bg)' : 'var(--t3)' }} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
