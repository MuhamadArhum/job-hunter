/**
 * LangChain LangFuse Integration
 * Provides observability and tracing for all agents
 */

const { Langfuse } = require('langfuse');
const { OpenAI } = require('openai');

let langfuse = null;
let groqClient = null;

/**
 * Initialize LangFuse with credentials from environment
 */
const initializeLangFuse = () => {
  if (langfuse) return langfuse;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    console.warn('⚠️ LangFuse credentials not configured. Running without observability.');
    return null;
  }

  try {
    langfuse = new Langfuse({
      publicKey,
      secretKey,
      host,
    });

    console.log('✅ LangFuse initialized successfully');
    return langfuse;
  } catch (error) {
    console.error('❌ Failed to initialize LangFuse:', error.message);
    return null;
  }
};

/**
 * Get or create Groq client (OpenAI-compatible)
 */
const getGroqClient = () => {
  if (groqClient) return groqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured in .env');
  }

  groqClient = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  return groqClient;
};

// Backward compatibility alias
const getGeminiClient = getGroqClient;
const getOpenAIClient = getGroqClient;

/**
 * Create a new trace for agent execution
 * @param {string} name - Trace name
 * @param {string} userId - User ID
 * @returns {Object} Trace context
 */
const createTrace = (name, userId) => {
  const lf = initializeLangFuse();
  if (!lf) {
    // Return noop trace — span must be a callable function, not null, to avoid TypeError
    return {
      generation: () => ({ end: () => {} }),
      span: (_opts) => ({ end: (_data) => {} }),
      traceId: null,
      end: () => {},
    };
  }

  const trace = lf.trace({
    name,
    userId,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });

  return {
    generation: trace.generation.bind(trace),
    span: trace.span.bind(trace),
    event: trace.event.bind(trace),
    traceId: trace.traceId,
    end: () => {
      // trace has no end() — flush the client instead
      lf.flushAsync().catch(() => {});
    },
  };
};

/**
 * Log agent activity with full visibility
 * @param {string} agentName - Name of the agent
 * @param {string} action - Action being performed
 * @param {Object} data - Data involved
 */
const logAgentActivity = (agentName, action, data) => {
  const timestamp = new Date().toISOString();
  console.log(`🤖 [${agentName}] ${action}`, {
    timestamp,
    data: JSON.stringify(data, null, 2),
  });

  // Also log to LangFuse as a trace event
  const lf = initializeLangFuse();
  if (lf) {
    try {
      const t = lf.trace({
        name: `agent_${agentName}_${action}`,
        metadata: { agent: agentName, action, data, timestamp },
      });
      t.event({ name: action, metadata: data });
    } catch (_) {}
  }
};

/**
 * Get LangSmith trace URL if configured
 * @param {string} traceId - Trace ID
 * @returns {string|null} Trace URL
 */
const getTraceUrl = (traceId) => {
  const langsmithKey = process.env.LANGSMITH_API_KEY;
  if (!langsmithKey || !traceId) return null;

  return `https://smith.langchain.com/o/${process.env.LANGSMITH_PROJECT || 'default'}/traces/${traceId}`;
};

/**
 * Create a generation for LLM calls
 * @param {Object} trace - Trace object
 * @param {string} name - Generation name
 * @param {Object} params - Model parameters
 */
const createGeneration = (trace, name, params) => {
  if (!trace || !trace.generation) return { end: () => {} };
  return trace.generation(name, params);
};

/**
 * Get LangFuse client instance
 */
const getLangFuse = () => {
  if (!langfuse) {
    return initializeLangFuse();
  }
  return langfuse;
};

module.exports = {
  initializeLangFuse,
  getOpenAIClient,
  getGeminiClient,
  getGroqClient,
  createTrace,
  logAgentActivity,
  getTraceUrl,
  createGeneration,
  getLangFuse,
};
