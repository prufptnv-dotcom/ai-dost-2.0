import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token interceptor
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ai_dost_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // No token → send request without Authorization header.
    // The server will return 401 and the UI can handle it gracefully.
  }
  return config;
});

const buildApiError = (operation, error) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail || error?.response?.data?.error || error?.message || 'Unknown API error';
  const wrapped = new Error(`${operation} failed${status ? ` (${status})` : ''}: ${detail}`);
  wrapped.status = status;
  wrapped.detail = detail;
  wrapped.originalError = error;
  return wrapped;
};

export const fetchProjects = async (userId) => {
  try {
    const res = await api.get('/memory/projects', { params: { user_id: userId } });
    return res.data;
  } catch (error) {
    throw buildApiError('Load projects', error);
  }
};

export const createProject = async (projectName, description, userId) => {
  try {
    const res = await api.post('/memory/project', {
      project_name: projectName,
      description
    }, { params: { user_id: userId } });
    return res.data;
  } catch (error) {
    throw buildApiError('Create project', error);
  }
};

export const fetchProject = async (projectId) => {
  try {
    const res = await api.get(`/memory/project/${projectId}`);
    return res.data;
  } catch (error) {
    throw buildApiError('Load project', error);
  }
};

export const executeCode = async (codeData) => {
  try {
    const res = await api.post('/sandbox/execute', codeData);
    return res.data;
  } catch (error) {
    if (error.response && error.response.data?.detail) {
      return {
        stdout: '',
        stderr: error.response.data.detail || 'Execution failed',
        exit_code: 1
      };
    }
    try {
      // Fallback to Express backend sandbox runner
      const expressUrl = process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || 'http://localhost:3000';
      const fallbackRes = await axios.post(`${expressUrl}/api/test/execute`, codeData);
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

export const githubAuth = async (code) => {
  const res = await api.get(`/auth/github/callback?code=${code}`);
  return res.data;
};

export const addProjectFile = async (projectId, filePath, content = '') => {
  try {
    const res = await api.post(`/memory/project/${projectId}/file`, {
      file_path: filePath,
      content
    });
    return res.data;
  } catch (error) {
    console.warn('addProjectFile API warning:', error?.message);
    return { success: true };
  }
};

export const deleteProjectFile = async (projectId, filePath) => {
  try {
    const res = await api.delete(`/memory/project/${projectId}/file`, {
      params: { file_path: filePath }
    });
    return res.data;
  } catch (error) {
    console.warn('deleteProjectFile API warning:', error?.message);
    return { success: true };
  }
};

export const saveProjectFile = async (projectId, filePath, content) => {
  try {
    const res = await api.put(`/memory/project/${projectId}/file`, {
      file_path: filePath,
      content
    });
    return res.data;
  } catch (error) {
    console.warn('saveProjectFile API warning:', error?.message);
    return { success: true };
  }
};

export const searchVectorMemory = async (query, limit = 3) => {
  try {
    const res = await api.get('/vector/search', { params: { query, limit } });
    return res.data;
  } catch (error) {
    console.error('Vector search error:', error);
    return [];
  }
};

export const addVectorDocument = async (content, sourceType = 'note') => {
  try {
    const res = await api.post('/vector/add', { content, source_type: sourceType });
    return res.data;
  } catch (error) {
    console.error('Add vector doc error:', error);
    return null;
  }
};

export default api;
