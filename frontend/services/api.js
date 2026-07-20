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
    let token = localStorage.getItem('ai_dost_token');
    if (!token) {
      token = 'demo_token';
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const fetchProjects = async (userId) => {
  const res = await api.get('/memory/projects', { params: { user_id: userId } });
  return res.data;
};

export const createProject = async (projectName, description, userId) => {
  const res = await api.post('/memory/project', {
    project_name: projectName,
    description
  }, { params: { user_id: userId } });
  return res.data;
};

export const fetchProject = async (projectId) => {
  const res = await api.get(`/memory/project/${projectId}`);
  return res.data;
};

export const executeCode = async (codeData) => {
  try {
    const res = await api.post('/sandbox/execute', codeData);
    return res.data;
  } catch (error) {
    if (error.response) {
      return {
        stdout: '',
        stderr: error.response.data.detail || 'Execution failed',
        exit_code: 1
      };
    }
    return {
      stdout: '',
      stderr: 'Network error: Unable to execute code',
      exit_code: 1
    };
  }
};

export const githubAuth = async (code) => {
  const res = await api.get(`/auth/github/callback?code=${code}`);
  return res.data;
};

export const addProjectFile = async (projectId, filePath, content = '') => {
  const res = await api.post(`/memory/project/${projectId}/file`, {
    file_path: filePath,
    content
  });
  return res.data;
};

export const deleteProjectFile = async (projectId, filePath) => {
  const res = await api.delete(`/memory/project/${projectId}/file`, {
    params: { file_path: filePath }
  });
  return res.data;
};

export const saveProjectFile = async (projectId, filePath, content) => {
  const res = await api.put(`/memory/project/${projectId}/file`, {
    file_path: filePath,
    content
  });
  return res.data;
};

export default api;
