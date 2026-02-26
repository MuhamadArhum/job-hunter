/**
 * Orchestrator Routes
 * Handles chat interface and agent coordination
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const OrchestratorAgent = require('../agents/orchestrator');
const Agent = require('../models/Agent');
const Task = require('../models/Task');
const Approval = require('../models/Approval');
const Memory = require('../models/Memory');

// Store active orchestrator instances per user
const orchestratorInstances = new Map();

/**
 * Get or create orchestrator for user
 */
const getOrchestrator = (userId) => {
  if (!orchestratorInstances.has(userId)) {
    const orchestrator = new OrchestratorAgent(userId);
    orchestratorInstances.set(userId, orchestrator);
  }
  return orchestratorInstances.get(userId);
};

/**
 * POST /api/orchestrator/chat
 * Process a chat message and execute agent actions
 */
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, context = {} } = req.body;
    const userId = req.user._id;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const orchestrator = getOrchestrator(userId);
    
    // Initialize if not already done
    if (!orchestrator.sessionId) {
      await orchestrator.initialize(context.sessionId);
    }

    // Process the message
    const result = await orchestrator.processMessage(message, context);

    res.json({
      success: result.success,
      response: result.response,
      intent: result.intent,
      tasks: result.tasks,
      requiresApproval: result.requiresApproval,
      approvalPoints: result.approvalPoints,
      agentStatuses: result.agentStatuses,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orchestrator/execute
 * Digital FTE: Execute a previously confirmed plan
 * Called after user clicks "Go Ahead" on the plan preview card
 */
router.post('/execute', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user._id;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const orchestrator = getOrchestrator(userId);

    // Ensure orchestrator is initialized
    if (!orchestrator.sessionId) {
      await orchestrator.initialize(sessionId);
    }

    const result = await orchestrator.confirmAndExecute(sessionId);

    res.json({
      success: result.success,
      response: result.response,
      intent: result.intent,
      tasks: result.tasks,
      results: result.results,
      agentStatuses: result.agentStatuses,
      requiresApproval: result.requiresApproval || false,
      approvalPoints: result.approvalPoints || [],
      error: result.error,
    });
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orchestrator/agents
 * Get status of all agents
 */
router.get('/agents', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const agents = await Agent.find({ userId });

    res.json({
      success: true,
      agents: agents.map(a => ({
        agentId: a.agentId,
        agentName: a.agentName,
        status: a.status,
        currentTask: a.currentTask,
        progress: a.progress,
        lastActive: a.lastActive,
        stats: a.stats,
        activityLog: a.activityLog.slice(-5), // Last 5 activities
      })),
    });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orchestrator/tasks
 * Get tasks for current user
 */
router.get('/tasks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, limit = 20 } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orchestrator/approvals
 * Get pending approvals
 */
router.get('/approvals', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status = 'pending' } = req.query;

    const approvals = await Approval.find({ userId, status })
      .sort({ requestedAt: -1 });

    res.json({
      success: true,
      approvals,
    });
  } catch (error) {
    console.error('Get approvals error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orchestrator/approve
 * Approve or reject an action
 */
router.post('/approve', authMiddleware, async (req, res) => {
  try {
    const { approvalId, action, modifiedContent, comment } = req.body;
    const userId = req.user._id;

    if (!approvalId || !action) {
      return res.status(400).json({ error: 'approvalId and action are required' });
    }

    const orchestrator = getOrchestrator(userId);
    const approval = await orchestrator.handleApproval(approvalId, action, modifiedContent, comment);

    res.json({
      success: true,
      message: action === 'approved' ? 'Action approved and executing' : 'Action rejected',
      approval,
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orchestrator/memory
 * Get user memory
 */
router.get('/memory', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { type = 'short_term', category } = req.query;

    const query = { userId, memoryType: type };
    if (category) query.category = category;

    const memories = await Memory.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      memories: memories.map(m => ({
        key: m.key,
        category: m.category,
        value: m.value,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get memory error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orchestrator/memory
 * Save to user memory
 */
router.post('/memory', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { key, value, category = 'custom', memoryType = 'short_term' } = req.body;

    if (!key || !value) {
      return res.status(400).json({ error: 'key and value are required' });
    }

    const memory = await Memory.findOneAndUpdate(
      { userId, memoryType, category, key },
      {
        userId,
        memoryType,
        category,
        key,
        value,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      memory: {
        key: memory.key,
        category: memory.category,
        value: memory.value,
      },
    });
  } catch (error) {
    console.error('Save memory error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orchestrator/cancel
 * Cancel a running task
 */
router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    await Task.findOneAndUpdate(
      { taskId, userId },
      { status: 'cancelled' }
    );

    // Update agent status
    const task = await Task.findOne({ taskId });
    if (task) {
      await Agent.findOneAndUpdate(
        { userId, agentId: task.agentId },
        { status: 'idle', currentTask: null }
      );
    }

    res.json({
      success: true,
      message: 'Task cancelled',
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orchestrator/activity
 * Get recent activity log
 */
router.get('/activity', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 50 } = req.query;

    const tasks = await Task.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const activities = tasks.flatMap(task => ({
      taskId: task.taskId,
      agentId: task.agentId,
      action: task.taskType,
      status: task.status,
      timestamp: task.createdAt,
    }));

    res.json({
      success: true,
      activities,
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
