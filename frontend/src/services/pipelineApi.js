import api from './api';

export const pipelineApi = {
  // Upload CV file (FormData)
  uploadCV: (file) => {
    const formData = new FormData();
    formData.append('cv', file);
    return api.post('/pipeline/upload-cv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Check if CV is already uploaded
  getCVStatus: () => api.get('/pipeline/cv-status'),

  // Start pipeline (async — returns immediately)
  start: (jobRole, location = 'Pakistan', maxJobs = 5) =>
    api.post('/pipeline/start', { jobRole, location, maxJobs }),

  // Poll pipeline status
  getStatus: (pipelineId) => api.get(`/pipeline/status/${pipelineId}`),

  // Approve CVs → triggers email drafting
  approveCVs: (pipelineId, approvalId, selectedJobIds = null) =>
    api.post('/pipeline/approve-cvs', { pipelineId, approvalId, selectedJobIds }),

  // Approve emails → sends applications
  approveEmails: (pipelineId, approvalId, modifiedEmails = null) =>
    api.post('/pipeline/approve-emails', { pipelineId, approvalId, modifiedEmails }),

  // Reject / cancel pipeline
  reject: (pipelineId, approvalId) =>
    api.post('/pipeline/reject', { pipelineId, approvalId }),
};

export default pipelineApi;
