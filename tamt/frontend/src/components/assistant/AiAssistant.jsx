import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { assistantAPI } from '../../services/api.js';

const WELCOME = `Hi! I'm the **TAMT Assistant**.

Ask me anything about using this tool — test plans, features, prerequisites, Robot Framework scripts, AI agents, defect triage, or reports.`;

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const history = newMessages.slice(1, -1); // exclude welcome + latest user msg
      const { data } = await assistantAPI.chat(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '_Sorry, the assistant is temporarily unavailable. Please try again._' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
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
          : <Bot style={{ color: 'var(--bg)' }} size={20} />
        }
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: 90, right: 28,
            width: 360, height: 500,
            background: 'var(--bg2)',
            border: '1px solid var(--border-hi)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column',
            zIndex: 200,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'var(--cyan-dim)', border: '1px solid var(--border-hi)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={14} style={{ color: 'var(--cyan)' }} />
              </div>
              <div>
                <div style={{ fontFamily: '"Syne",sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>
                  TAMT Assistant
                </div>
                <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Scoped to TAMT · QA · RF
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="agent-feed" style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' ? 'var(--cyan-dim)' : 'var(--bg3)',
                  border: '1px solid ' + (msg.role === 'user' ? 'var(--border-hi)' : 'var(--border)'),
                  fontSize: 13,
                  color: 'var(--t1)',
                  lineHeight: 1.6,
                }}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p style={{ margin: '0 0 6px', color: 'var(--t1)' }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ color: 'var(--cyan)', fontWeight: 600 }}>{children}</strong>,
                      code: ({ children }) => (
                        <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4, fontFamily: '"DM Mono",monospace', fontSize: 11, color: 'var(--green)' }}>
                          {children}
                        </code>
                      ),
                      ul: ({ children }) => <ul style={{ paddingLeft: 16, margin: '4px 0', color: 'var(--t2)' }}>{children}</ul>,
                      li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={14} style={{ color: 'var(--cyan)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: 'var(--t3)', fontFamily: '"DM Mono",monospace' }}>Thinking…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about TAMT, RF scripts, test cases…"
              disabled={loading}
              style={{
                flex: 1,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--t1)',
                fontSize: 13,
                padding: '7px 10px',
                outline: 'none',
                resize: 'none',
                fontFamily: '"DM Sans",sans-serif',
                lineHeight: 1.4,
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--border-hi)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: input.trim() && !loading ? 'var(--cyan)' : 'var(--bg3)',
                border: '1px solid ' + (input.trim() && !loading ? 'transparent' : 'var(--border)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              <Send size={14} style={{ color: input.trim() && !loading ? 'var(--bg)' : 'var(--t3)' }} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
