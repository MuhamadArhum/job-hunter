/**
 * Orchestrator API Service
 * Handles communication with the orchestrator backend
 */

import api from './api';

export const orchestratorApi = {
  /**
   * Send a chat message
   */
  chat: (message, context = {}) => {
    return api.post('/orchestrator/chat', { message, context });
  },

  /**
   * Get all agent statuses
   */
  getAgents: () => {
    return api.get('/orchestrator/agents');
  },

  /**
   * Get tasks
   */
  getTasks: (params = {}) => {
    return api.get('/orchestrator/tasks', { params });
  },

  /**
   * Get pending approvals
   */
  getApprovals: (status = 'pending') => {
    return api.get('/orchestrator/approvals', { params: { status } });
  },

  /**
   * Approve or reject an action
   */
  approve: (approvalId, action, modifiedContent = null, comment = null) => {
    return api.post('/orchestrator/approve', { 
      approvalId, 
      action, 
      modifiedContent, 
      comment 
    });
  },

  /**
   * Get user memory
   */
  getMemory: (params = {}) => {
    return api.get('/orchestrator/memory', { params });
  },

  /**
   * Save to user memory
   */
  saveMemory: (key, value, category = 'custom', memoryType = 'short_term') => {
    return api.post('/orchestrator/memory', { key, value, category, memoryType });
  },

  /**
   * Cancel a task
   */
  cancelTask: (taskId) => {
    return api.post('/orchestrator/cancel', { taskId });
  },

  /**
   * Get activity log
   */
  getActivity: (limit = 50) => {
    return api.get('/orchestrator/activity', { params: { limit } });
  },

  /**
   * Digital FTE: Execute a confirmed plan
   * Called after user clicks "Go Ahead" on the plan preview card
   */
  executeConfirmed: (sessionId) => {
    return api.post('/orchestrator/execute', { sessionId });
  },
};

export default orchestratorApi;
