import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      response.data.success === true &&
      'data' in response.data
    ) {
      return { ...response, data: response.data.data }
    }
    return response
  },
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred'
    console.error('API Error:', message)
    return Promise.reject(new Error(message))
  }
)

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats').then((r) => r.data)
export const getDashboardHistory = () => api.get('/dashboard/history').then((r) => r.data)
export const getRecentSessions = () => api.get('/dashboard/recent').then((r) => r.data)

// Detection
export const uploadVideo = (formData, onProgress) =>
  api
    .post('/detection/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    })
    .then((r) => r.data)

export const getProcessingStatus = (id) =>
  api.get(`/detection/process/${id}`).then((r) => r.data)

export const getDetectionResults = (id) =>
  api.get(`/detection/results/${id}`).then((r) => r.data)

export const getDetectionSessions = () =>
  api.get('/detection/sessions').then((r) => r.data)

export const runDemoVideo = () =>
  api.post('/detection/demo').then((r) => r.data)

export const deleteSession = (id) =>
  api.delete(`/detection/sessions/${id}`).then((r) => r.data)

// Analysis
export const getAnalysis = (sessionId) =>
  api.get(`/analysis/${sessionId}`).then((r) => r.data)

export const getAnalysisSummary = () =>
  api.get('/analysis/summary').then((r) => r.data)

// Explainability
export const getExplanation = (sessionId) =>
  api.get(`/explain/${sessionId}`).then((r) => r.data)

export const getFeatureImportance = () =>
  api.get('/explain/feature-importance').then((r) => r.data)

export const explainMetrics = (metrics) =>
  api.post('/explain', metrics).then((r) => r.data)

// Reports
export const getReports = () => api.get('/reports').then((r) => r.data)

export const getReport = (sessionId) =>
  api.get(`/reports/${sessionId}`).then((r) => r.data)

export const exportCSV = (sessionId) => {
  window.open(`${API_BASE}/reports/export/${sessionId}`, '_blank')
}

export const exportAllCSV = () => {
  window.open(`${API_BASE}/reports/export/all`, '_blank')
}

// Settings
export const getSettings = () => api.get('/settings').then((r) => r.data)

export const updateSettings = (settings) =>
  api.put('/settings', settings).then((r) => r.data)

export default api
