import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tamt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tamt_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Features ─────────────────────────────────────────────────────────────────
export const featuresAPI = {
  list: (params) => api.get('/features', { params }),
  get: (id) => api.get(`/features/${id}`),
  create: (data) => api.post('/features', data),
  update: (id, data) => api.put(`/features/${id}`, data),
  delete: (id) => api.delete(`/features/${id}`),
  uploadContract: (id, formData) => api.post(`/features/${id}/contracts`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  recalcReadiness: (id) => api.post(`/features/${id}/recalculate-readiness`),
};

// ─── Prerequisites ─────────────────────────────────────────────────────────────
export const prereqsAPI = {
  list: (featureId) => api.get('/prerequisites', { params: { feature_id: featureId } }),
  create: (data) => api.post('/prerequisites', data),
  update: (id, data) => api.patch(`/prerequisites/${id}`, data),
  delete: (id) => api.delete(`/prerequisites/${id}`),
};

// ─── Test Plans ────────────────────────────────────────────────────────────────
export const testPlansAPI = {
  list: () => api.get('/test-plans'),
  get: (id) => api.get(`/test-plans/${id}`),
  create: (data) => api.post('/test-plans', data),
  update: (id, data) => api.put(`/test-plans/${id}`, data),
  delete: (id) => api.delete(`/test-plans/${id}`),
  addFeature: (planId, featureId) => api.post(`/test-plans/${planId}/features`, { feature_id: featureId }),
  removeFeature: (planId, featureId) => api.delete(`/test-plans/${planId}/features/${featureId}`),
};

// ─── Test Cases ────────────────────────────────────────────────────────────────
export const testCasesAPI = {
  list: (params) => api.get('/test-cases', { params }),
  get: (id) => api.get(`/test-cases/${id}`),
  create: (data) => api.post('/test-cases', data),
  update: (id, data) => api.put(`/test-cases/${id}`, data),
  delete: (id) => api.delete(`/test-cases/${id}`),
};

// ─── Test Runs ─────────────────────────────────────────────────────────────────
export const testRunsAPI = {
  list: (params) => api.get('/test-runs', { params }),
  get: (id) => api.get(`/test-runs/${id}`),
  create: (data) => api.post('/test-runs', data),
  update: (id, data) => api.put(`/test-runs/${id}`, data),
  delete: (id) => api.delete(`/test-runs/${id}`),
};

// ─── Test Executions ───────────────────────────────────────────────────────────
export const testExecAPI = {
  list: (params) => api.get('/test-executions', { params }),
  get: (id) => api.get(`/test-executions/${id}`),
  update: (id, data) => api.patch(`/test-executions/${id}`, data),
};

// ─── Defects ───────────────────────────────────────────────────────────────────
export const defectsAPI = {
  list: (params) => api.get('/defects', { params }),
  get: (id) => api.get(`/defects/${id}`),
  create: (data) => api.post('/defects', data),
  update: (id, data) => api.put(`/defects/${id}`, data),
  delete: (id) => api.delete(`/defects/${id}`),
};

// ─── Environments ──────────────────────────────────────────────────────────────
export const environmentsAPI = {
  list: () => api.get('/environments'),
  create: (data) => api.post('/environments', data),
  update: (id, data) => api.put(`/environments/${id}`, data),
};

// ─── Reports ───────────────────────────────────────────────────────────────────
export const reportsAPI = {
  dashboard: () => api.get('/reports/dashboard'),
  executionSummary: (params) => api.get('/reports/execution-summary', { params }),
  defectAnalysis: () => api.get('/reports/defect-analysis'),
  coverage: (params) => api.get('/reports/coverage', { params }),
};

// ─── Agents ────────────────────────────────────────────────────────────────────
export const agentsAPI = {
  run: (data) => api.post('/agents/run', data),
  getRunInfo: (id) => api.get(`/agents/run/${id}`),
  getSuggestions: (params) => api.get('/agents/suggestions', { params }),
  updateSuggestion: (id, data) => api.patch(`/agents/suggestions/${id}`, data),
  getHistory: (params) => api.get('/agents/history', { params }),
};

// ─── Robot Framework ───────────────────────────────────────────────────────────
export const rfAPI = {
  saveScript: (data) => api.post('/rf/scripts', data),
  getScripts: (testCaseId) => api.get(`/rf/scripts/${testCaseId}`),
  getVersions: (scriptId) => api.get(`/rf/scripts/${scriptId}/versions`),
  updateScript: (id, data) => api.put(`/rf/scripts/${id}`, data),
  validateScript: (id) => api.post(`/rf/scripts/${id}/validate`),
  downloadScript: (id) => api.get(`/rf/scripts/${id}/download`),
  execute: (data) => api.post('/rf/execute', data),
  getResults: (runId) => api.get(`/rf/results/${runId}`),
  getTemplates: () => api.get('/rf/templates'),
  getTemplate: (featureType) => api.get(`/rf/templates/${featureType}`),
};

// ─── Reference Templates ───────────────────────────────────────────────────────
export const refTemplatesAPI = {
  list: (params) => api.get('/ref-templates', { params }),
  get: (id) => api.get(`/ref-templates/${id}`),
  upload: (formData) => api.post('/ref-templates', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadInline: (data) => api.post('/ref-templates', data),
  update: (id, data) => api.put(`/ref-templates/${id}`, data),
  delete: (id) => api.delete(`/ref-templates/${id}`),
  getContent: (id) => api.get(`/ref-templates/${id}/content`),
};

// ─── Projects ──────────────────────────────────────────────────────────────────
export const projectsAPI = {
  list: () => api.get('/projects'),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  addMember: (id, data) => api.post(`/projects/${id}/members`, data),
  removeMember: (id, userId) => api.delete(`/projects/${id}/members/${userId}`),
};

// ─── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  deactivate: (id) => api.delete(`/users/${id}`),
};

// ─── AI Assistant ──────────────────────────────────────────────────────────────
export const assistantAPI = {
  chat: (message, history = []) => api.post('/assistant/chat', { message, history }),
};

// ─── XLSX Export helpers ────────────────────────────────────────────────────────
// These trigger a file download by navigating directly to the endpoint.
export function downloadXlsx(path) {
  const token = localStorage.getItem('tamt_token');
  const a = document.createElement('a');
  a.href = `/api/v1${path}${path.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  a.download = '';
  // For authenticated downloads we pass the token as a query param
  // (the backend should accept ?token= as an alternative to Bearer header).
  // In dev mode auth is bypassed, so direct navigation works.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
