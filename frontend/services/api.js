import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
export const API_HOST = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, '') : '';

const REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 60000);
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUS = new Set([502, 503, 504]);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

const makeRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

// Add authentication, privacy, and correlation metadata without ever logging secrets.
api.interceptors.request.use(config => {
  config.headers = config.headers || {};
  config.headers['X-Request-ID'] = config.headers['X-Request-ID'] || makeRequestId();

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ai_dost_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const isPrivacyMode = localStorage.getItem('ai_dost_privacy_mode');
    if (isPrivacyMode === 'true') {
      config.headers['X-Privacy-Mode'] = 'true';
    }
  }

  return config;
});

// Retry only idempotent reads after transient upstream failures. Never retry writes
// automatically because a network timeout can happen after the server already acted.
api.interceptors.response.use(undefined, async error => {
  const config = error?.config;
  const method = String(config?.method || '').toLowerCase();
  const canRetry = config && RETRYABLE_METHODS.has(method) &&
    (RETRYABLE_STATUS.has(error?.response?.status) || !error?.response);

  if (canRetry) {
    config.__retryCount = (config.__retryCount || 0) + 1;
    if (config.__retryCount <= 1) {
      await new Promise(resolve => setTimeout(resolve, 250 * config.__retryCount));
      return api(config);
    }
  }

  return Promise.reject(error);
});

const buildApiError = (operation, error) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const requestId = error?.response?.headers?.['x-request-id'] || error?.config?.headers?.['X-Request-ID'];
  const isCanceled = axios.isCancel(error) || error?.code === 'ERR_CANCELED';
  const isTimeout = error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT';

  let detail = data?.detail || data?.error || error?.message || 'Unknown API error';
  if (status >= 500 || isTimeout) {
    detail = isTimeout
      ? 'The server took too long to respond.'
      : 'The server could not complete the request.';
  }
  if (isCanceled) {
    detail = 'Request canceled.';
  }

  if (status >= 500 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai_dost_toast', {
      detail: {
        type: 'error',
        message: requestId ? `Server error. Request ID: ${requestId}` : 'Server error. Please try again.'
      }
    }));
  }

  const wrapped = new Error(`${operation} failed${status ? ` (${status})` : ''}: ${detail}`);
  wrapped.name = isCanceled ? 'ApiCanceledError' : 'ApiError';
  wrapped.status = status;
  wrapped.detail = detail;
  wrapped.requestId = requestId;
  wrapped.isCanceled = isCanceled;
  wrapped.isTimeout = isTimeout;
  wrapped.originalError = error;
  return wrapped;
};

export const fetchProjects = async (userId, options = {}) => {
  try {
    const res = await api.get('/memory/projects', { params: { user_id: userId }, signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Load projects', error);
  }
};

export const createProject = async (projectName, description, userId, options = {}) => {
  try {
    const res = await api.post('/memory/project', {
      project_name: projectName,
      description
    }, { params: { user_id: userId }, signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Create project', error);
  }
};

export const fetchProject = async (projectId, options = {}) => {
  try {
    const res = await api.get(`/memory/project/${projectId}`, { signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Load project', error);
  }
};

export const executeCode = async (codeData, options = {}) => {
  try {
    const res = await api.post('/sandbox/execute', codeData, { signal: options.signal });
    return res.data;
  } catch (error) {
    if (axios.isCancel(error)) {
      throw buildApiError('Execute code', error);
    }

    // Preserve the backend execution contract for expected execution failures.
    if (error.response && error.response.data?.detail) {
      return {
        stdout: '',
        stderr: error.response.data.detail || 'Execution failed',
        exit_code: 1
      };
    }

    try {
      // Fallback to Express backend sandbox runner for transport-level failures.
      const expressUrl = process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || '';
      const fallbackRes = await axios.post(`${expressUrl}/api/test/execute`, codeData, {
        signal: options.signal,
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      });
      return fallbackRes.data;
    } catch (e2) {
      console.warn('Fallback execute also failed:', e2?.message);
    }

    return {
      stdout: '',
      stderr: error.message ? `Execution info: ${error.message}` : 'Network error: Unable to execute code',
      exit_code: 1
    };
  }
};

export const githubAuth = async (code, options = {}) => {
  try {
    const res = await api.get(`/auth/github/callback?code=${encodeURIComponent(code)}`, { signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('GitHub authentication', error);
  }
};

export const addProjectFile = async (projectId, filePath, content = '', options = {}) => {
  try {
    const res = await api.post(`/memory/project/${projectId}/file`, {
      file_path: filePath,
      content
    }, { signal: options.signal });
    return res.data;
  } catch (error) {
    // A write failure must never be reported as success; callers need a chance to
    // roll back optimistic UI state and show a recoverable error.
    throw buildApiError('Add project file', error);
  }
};

export const deleteProjectFile = async (projectId, filePath, options = {}) => {
  try {
    const res = await api.delete(`/memory/project/${projectId}/file`, {
      params: { file_path: filePath },
      signal: options.signal
    });
    return res.data;
  } catch (error) {
    throw buildApiError('Delete project file', error);
  }
};

export const saveProjectFile = async (projectId, filePath, content, options = {}) => {
  try {
    const res = await api.put(`/memory/project/${projectId}/file`, {
      file_path: filePath,
      content
    }, { signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Save project file', error);
  }
};

export const searchVectorMemory = async (query, limit = 3, options = {}) => {
  try {
    const res = await api.get('/vector/search', { params: { query, limit }, signal: options.signal });
    return res.data;
  } catch (error) {
    if (axios.isCancel(error)) throw buildApiError('Search vector memory', error);
    console.error('Vector search error:', error);
    return [];
  }
};

export const addVectorDocument = async (content, sourceType = 'note', options = {}) => {
  try {
    const res = await api.post('/vector/add', { content, source_type: sourceType }, { signal: options.signal });
    return res.data;
  } catch (error) {
    if (axios.isCancel(error)) throw buildApiError('Add vector document', error);
    console.error('Add vector doc error:', error);
    return null;
  }
};

// Voice Assistant API calls
export const startVoiceSession = async (userId = 'default', options = {}) => {
  try {
    const res = await api.post('/voice/start', { user: userId }, { signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Start voice session', error);
  }
};

export const stopVoiceSession = async (sessionId, options = {}) => {
  try {
    const res = await api.post('/voice/stop', { sessionId }, { signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Stop voice session', error);
  }
};

export const getGeminiLiveToken = async (options = {}) => {
  try {
    const res = await api.get('/gemini-live-token', { signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Get Gemini Live token', error);
  }
};

// Resume Builder API calls
export const generateResume = async (prompt, options = {}) => {
  try {
    const res = await api.post('/resume/generate', { prompt }, { signal: options.signal });
    return res.data;
  } catch (error) {
    throw buildApiError('Generate resume', error);
  }
};

export default api;
