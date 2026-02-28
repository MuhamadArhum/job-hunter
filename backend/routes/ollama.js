/**
 * Ollama Local LLM Route
 * Proxies chat requests to a locally running Ollama instance.
 * Uses the OpenAI-compatible endpoint that Ollama exposes at /v1
 */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const authMiddleware = require('../middleware/auth');

// Ollama runs locally — uses the OpenAI-compatible /v1 endpoint
const ollamaClient = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  apiKey: 'ollama', // Ollama does not require a real API key
});

// Default model — can be overridden via env or per-request body
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3:8b';

const SYSTEM_PROMPT = `You are a helpful, intelligent AI assistant running locally via Ollama.
You can help with any topic: coding, writing, math, analysis, or general questions.
Be concise, accurate, and friendly. Use markdown formatting when it helps clarity.`;

/**
 * POST /api/ollama/chat
 * Body: { message: string, history: [{role:'user'|'assistant', content:string}], model?: string }
 * Returns: { reply: string, model: string }
 */
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, history = [], model } = req.body;
    const selectedModel = model || DEFAULT_MODEL;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }

    // Build message array: system + history + current user message
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-20).map(m => ({
        role: m.role === 'bot' ? 'assistant' : (m.role || 'user'),
        content: m.content || '',
      })),
      { role: 'user', content: message.trim() },
    ];

    const response = await ollamaClient.chat.completions.create({
      model: selectedModel,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const reply = response.choices?.[0]?.message?.content || 'No response from model.';

    res.json({
      success: true,
      reply,
      model: selectedModel,
    });

  } catch (error) {
    console.error('[Ollama] Chat error:', error.status, error.message);

    const isConnectionError =
      error.code === 'ECONNREFUSED' ||
      error.cause?.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('fetch failed') ||
      error.message?.toLowerCase().includes('connection error') ||
      error.name === 'APIConnectionError';

    const isModelNotFound =
      error.status === 404 ||
      error.message?.toLowerCase().includes('not found') ||
      error.message?.toLowerCase().includes('model');

    const errorMsg = isConnectionError
      ? 'Cannot connect to Ollama. Run "ollama serve" in a terminal.'
      : isModelNotFound
        ? `Model not found. Run "ollama list" to see available models, then select the correct one.`
        : error.message;

    res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * GET /api/ollama/status
 * Check if Ollama is reachable and what local models are available
 * Returns: { running, activeModel, availableModels: [{id, name}] }
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const models = await ollamaClient.models.list();
    // Filter out cloud/remote models (they have very small size or remote_host)
    const allModels = (models.data || []).map(m => m.id);
    res.json({
      success: true,
      running: true,
      activeModel: DEFAULT_MODEL,
      availableModels: allModels,
    });
  } catch (error) {
    res.json({
      success: true,
      running: false,
      activeModel: DEFAULT_MODEL,
      availableModels: [],
      error: 'Ollama not reachable — run "ollama serve"',
    });
  }
});

module.exports = router;
