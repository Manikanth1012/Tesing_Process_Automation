import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronDown, ChevronRight, CheckCircle, XCircle, RefreshCw, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useSSE } from '../../hooks/useSSE.js';
import { agentsAPI } from '../../services/api.js';

const AGENT_NAMES = {
  PREREQ_ANALYST: 'Pre-Req Analyst',
  TESTCASE_GENERATOR: 'Test Case Generator',
  SCRIPT_GENERATOR: 'Script Generator',
  EXECUTION_MONITOR: 'Execution Monitor',
  DEFECT_TRIAGE: 'Defect Triage',
  REPORT_NARRATIVE: 'Report Narrative',
  GAP_ANALYST: 'Gap Analyst',
};

/** Single message/event in the feed */
function FeedMessage({ msg }) {
  const [open, setOpen] = useState(false);

  if (msg.type === 'thinking') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm text-gray-400 italic px-3 py-1 thinking-cursor"
      >
        {msg.content}
      </motion.div>
    );
  }

  if (msg.type === 'tool_call') {
    const { toolName, input } = msg.content || {};
    return (
      <motion.div
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="border border-blue-200 rounded-lg overflow-hidden"
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 text-left text-sm"
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 text-blue-500" /> : <ChevronRight className="w-3.5 h-3.5 text-blue-500" />}
          <Zap className="w-3.5 h-3.5 text-blue-500" />
          <span className="font-medium text-blue-700">{toolName}</span>
        </button>
        {open && (
          <pre className="px-3 py-2 text-xs bg-white text-gray-600 overflow-auto max-h-40">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </motion.div>
    );
  }

  if (msg.type === 'tool_result') {
    const { toolName, result } = msg.content || {};
    return (
      <motion.div
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="border border-green-200 rounded-lg overflow-hidden"
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 text-left text-sm"
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 text-green-500" /> : <ChevronRight className="w-3.5 h-3.5 text-green-500" />}
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="font-medium text-green-700">Result: {toolName}</span>
        </button>
        {open && (
          <pre className="px-3 py-2 text-xs bg-white text-gray-600 overflow-auto max-h-40">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </motion.div>
    );
  }

  if (msg.type === 'output') {
    return (
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-gray-200 rounded-xl p-4 prose prose-sm max-w-none"
      >
        <ReactMarkdown>{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</ReactMarkdown>
      </motion.div>
    );
  }

  if (msg.type === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700"
      >
        <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</span>
      </motion.div>
    );
  }

  return null;
}

/**
 * AgentActivityPanel — streams agent activity via SSE.
 * Props:
 *   agentRunId: number
 *   agentType: string
 *   onSuggestionAction: (suggestionId, action) => void
 *   onRerun: () => void
 */
export default function AgentActivityPanel({ agentRunId, agentType, onSuggestionAction, onRerun }) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Running');
  const [tokens, setTokens] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const feedRef = useRef(null);

  const sseUrl = agentRunId ? `/api/v1/agents/run/${agentRunId}/stream` : null;

  useSSE(sseUrl, (data) => {
    if (data.type === 'done') {
      setStatus('Completed');
      setTokens(data.content?.tokensUsed || 0);
      setDurationMs(data.content?.durationMs || 0);
      // Load suggestions
      if (agentRunId) {
        agentsAPI.getSuggestions({ agent_run_id: agentRunId })
          .then(r => setSuggestions(r.data))
          .catch(() => {});
      }
      return;
    }
    if (data.type === 'error') {
      setStatus('Failed');
    }
    setMessages(prev => [...prev, data]);

    // Auto-scroll
    requestAnimationFrame(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    });
  }, { enabled: !!agentRunId && status === 'Running' });

  const handleSuggestion = async (id, action) => {
    try {
      await agentsAPI.updateSuggestion(id, { status: action });
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: action } : s));
      if (onSuggestionAction) onSuggestionAction(id, action);
    } catch (err) {
      console.error('Failed to update suggestion:', err);
    }
  };

  const handleAcceptAll = () => {
    suggestions.filter(s => s.status === 'Pending').forEach(s => handleSuggestion(s.id, 'Accepted'));
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === 'Running' ? 'bg-blue-500 animate-pulse' : status === 'Completed' ? 'bg-green-500' : 'bg-red-500'}`} />
          <Bot className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-sm text-gray-900">
            {AGENT_NAMES[agentType] || agentType}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            status === 'Running' ? 'bg-blue-100 text-blue-700' :
            status === 'Completed' ? 'bg-green-100 text-green-700' :
            'bg-red-100 text-red-700'
          }`}>
            {status}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3 agent-feed min-h-0">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => (
            <FeedMessage key={i} msg={msg} />
          ))}
        </AnimatePresence>
        {status === 'Running' && messages.length === 0 && (
          <div className="text-sm text-gray-400 italic thinking-cursor">Initializing agent</div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {suggestions.length} Suggestion{suggestions.length > 1 ? 's' : ''}
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {suggestions.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="text-gray-500 text-xs">{s.suggestion_type}</span>
                  <div className="text-gray-800 truncate">
                    {JSON.parse(s.content || '{}').title || `Suggestion #${s.id}`}
                  </div>
                </div>
                {s.status === 'Pending' ? (
                  <div className="flex items-center gap-1.5 ml-3">
                    <button
                      onClick={() => handleSuggestion(s.id, 'Accepted')}
                      className="text-xs px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleSuggestion(s.id, 'Rejected')}
                      className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-3 ${
                    s.status === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>{s.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-t border-gray-200">
        <div className="text-xs text-gray-400">
          {tokens > 0 && `${tokens.toLocaleString()} tokens · ${(durationMs / 1000).toFixed(1)}s`}
        </div>
        {status === 'Completed' && (
          <div className="flex items-center gap-2">
            {suggestions.some(s => s.status === 'Pending') && (
              <button onClick={handleAcceptAll} className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Accept All
              </button>
            )}
            {onRerun && (
              <button onClick={onRerun} className="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                <RefreshCw className="w-3 h-3" /> Re-run
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
