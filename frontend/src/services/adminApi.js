import api from './api';

export const adminAPI = {
  getStats:     ()                  => api.get('/admin/stats'),
  getUsers:     (params)            => api.get('/admin/users', { params }),
  getUserById:  (id)                => api.get(`/admin/users/${id}`),
  toggleStatus: (id, isActive)      => api.patch(`/admin/users/${id}/status`, { isActive }),
};
