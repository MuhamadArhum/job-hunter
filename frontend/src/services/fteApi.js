import api from './api';

export const fteApi = {
  /**
   * Main chat endpoint — send a message and optionally a CV file
   */
  chat: (message, cvFile = null) => {
    const form = new FormData();
    if (message) form.append('message', message);
    if (cvFile) form.append('cv', cvFile);
    return api.post('/fte/chat', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60s for PDF parse + LLM
    });
  },

  /**
   * Get current FTE state (for polling)
   */
  getState: () => api.get('/fte/state'),

  /**
   * Approve generated CVs
   */
  approveCVs: (approvalId, selectedJobIds = null) =>
    api.post('/fte/approve-cvs', { approvalId, selectedJobIds }),

  /**
   * Approve email drafts (with optional edits)
   */
  approveEmails: (approvalId, modifiedEmails = null) =>
    api.post('/fte/approve-emails', { approvalId, modifiedEmails }),

  /**
   * Get past session history
   */
  getHistory: () => api.get('/fte/history'),

  /**
   * Reset and start over
   */
  reset: () => api.post('/fte/reset'),
};
