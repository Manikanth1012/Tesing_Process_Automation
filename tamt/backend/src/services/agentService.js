/**
 * Agent Service — Claude API wrapper with tool-use routing and SSE streaming.
 *
 * Design decisions (as required by spec):
 * 1. Agents are NOT autonomous: every suggestion requires human review.
 * 2. Tool calls are executed server-side; frontend only sees SSE events.
 * 3. Context is fetched fresh from DB at trigger time.
 * 4. All runs are auditable in agent_runs table.
 */

const axios = require('axios');
const db = require('../config/database');
const sseService = require('./sseService');

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOKENS = parseInt(process.env.AGENT_MAX_TOKENS) || 4096;
const TEMPERATURE = parseFloat(process.env.AGENT_TEMPERATURE) || 0.2;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Create an agent run record in DB and return its id.
 */
function createAgentRun({ agentType, triggerEntityType, triggerEntityId, inputContext, triggeredBy }) {
  const stmt = db.prepare(`
    INSERT INTO agent_runs (agent_type, trigger_entity_type, trigger_entity_id, input_context, triggered_by, status)
    VALUES (?, ?, ?, ?, ?, 'Running')
  `);
  const result = stmt.run(agentType, triggerEntityType, triggerEntityId, JSON.stringify(inputContext), triggeredBy || 1);
  return result.lastInsertRowid;
}

/**
 * Update agent run on completion or failure.
 */
function completeAgentRun(agentRunId, { status, outputSummary, tokensUsed, durationMs, errorMessage }) {
  db.prepare(`
    UPDATE agent_runs
    SET status = ?, output_summary = ?, tokens_used = ?, duration_ms = ?,
        error_message = ?, completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, outputSummary, tokensUsed || 0, durationMs || 0, errorMessage || null, agentRunId);
}

/**
 * Save agent suggestions to DB.
 */
function saveAgentSuggestions(agentRunId, suggestions) {
  const stmt = db.prepare(`
    INSERT INTO agent_suggestions (agent_run_id, suggestion_type, entity_id, content, status)
    VALUES (?, ?, ?, ?, 'Pending')
  `);
  for (const s of suggestions) {
    stmt.run(agentRunId, s.type, s.entityId || null, JSON.stringify(s.content));
  }
}

/**
 * Execute a tool call requested by Claude.
 * toolHandlers is a map of toolName -> async function(input) -> result
 */
async function executeTool(toolName, toolInput, toolHandlers) {
  if (!toolHandlers || !toolHandlers[toolName]) {
    return { error: `Unknown tool: ${toolName}` };
  }
  try {
    return await toolHandlers[toolName](toolInput);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Main agent runner.
 * Calls Claude API with streaming-style agentic loop (tool_use).
 * Streams SSE events to channel `agent-run:{agentRunId}`.
 */
async function runAgent({
  agentType,
  systemPrompt,
  userMessage,
  tools = [],
  toolHandlers = {},
  triggerEntityType,
  triggerEntityId,
  additionalContext = {},
  triggeredBy,
}) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in .env to use AI agents.');
  }

  const startTime = Date.now();
  const agentRunId = createAgentRun({
    agentType,
    triggerEntityType,
    triggerEntityId,
    inputContext: { userMessage, additionalContext },
    triggeredBy,
  });

  const channel = `agent-run:${agentRunId}`;
  const emit = (type, content) => sseService.sendToChannel(channel, 'message', { type, content });

  emit('thinking', `Starting ${agentType} analysis...`);

  const messages = [{ role: 'user', content: userMessage }];
  let totalTokens = 0;
  let finalOutput = '';
  const suggestions = [];

  try {
    // Agentic loop — keep calling until no more tool_use
    while (true) {
      const requestBody = {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: systemPrompt,
        messages,
      };

      if (tools.length > 0) {
        requestBody.tools = tools;
      }

      emit('thinking', 'Calling Claude API...');

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        requestBody,
        {
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 120000,
        }
      );

      const msg = response.data;
      totalTokens += (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0);

      // Process content blocks
      const toolUseBlocks = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          finalOutput += block.text;
          emit('output', block.text);
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push(block);
          emit('tool_call', { toolName: block.name, input: block.input });
        }
      }

      // Add assistant message to history
      messages.push({ role: 'assistant', content: msg.content });

      // If stop reason is end_turn or no tool_use, we're done
      if (msg.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        break;
      }

      // Execute all tool calls and build tool_result array
      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        emit('thinking', `Executing tool: ${toolBlock.name}...`);
        const result = await executeTool(toolBlock.name, toolBlock.input, toolHandlers);
        emit('tool_result', { toolName: toolBlock.name, result });

        // Collect suggestions from tool results
        if (result && result._suggestions) {
          suggestions.push(...result._suggestions);
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        });
      }

      // Append tool results as user message for next iteration
      messages.push({ role: 'user', content: toolResults });
    }

    // Save suggestions to DB
    if (suggestions.length > 0) {
      saveAgentSuggestions(agentRunId, suggestions);
    }

    const durationMs = Date.now() - startTime;
    completeAgentRun(agentRunId, {
      status: 'Completed',
      outputSummary: finalOutput.substring(0, 2000),
      tokensUsed: totalTokens,
      durationMs,
    });

    emit('done', { agentRunId, tokensUsed: totalTokens, durationMs });
    sseService.closeChannel(channel);

    return { agentRunId, output: finalOutput, suggestions, tokensUsed: totalTokens };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err.response?.data?.error?.message || err.message;

    completeAgentRun(agentRunId, {
      status: 'Failed',
      errorMessage: errorMsg,
      tokensUsed: totalTokens,
      durationMs,
    });

    emit('error', { message: errorMsg });
    sseService.closeChannel(channel);

    throw new Error(errorMsg);
  }
}

module.exports = { runAgent, createAgentRun, saveAgentSuggestions };
