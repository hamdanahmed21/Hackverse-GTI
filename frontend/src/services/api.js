import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
})

export const runAI = (prompt, context = {}) =>
  api.post('/api/v1/ai/run', { prompt, context })

export default api
