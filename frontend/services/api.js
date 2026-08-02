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
  try {
    const res = await api.get(`/memory/project/${projectId}`);
    return res.data;
  } catch (error) {
    console.warn('Project fetch API warning, using demo workspace fallback:', error?.message);
    return {
      project_id: projectId,
      user_id: 'demo_user_id',
      project_name: 'AI Dost Workspace',
      description: 'Interactive Development Sandbox & AI Copilot Workspace',
      status: 'Development',
      files: [
        { path: 'main.py', content: '# Write python code here...\nprint("Hello from AI-Dost Sandbox!")\n' },
        { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="container">\n    <h1>Welcome to AI-Dost Sandbox</h1>\n    <p>AI Copilot Workspace is active and ready!</p>\n  </div>\n</body>\n</html>\n' },
        { path: 'style.css', content: 'body {\n  background: #05060a;\n  color: #06b6d4;\n  font-family: sans-serif;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n  margin: 0;\n}\n.container {\n  text-align: center;\n  border: 1px solid rgba(6, 182, 212, 0.2);\n  padding: 32px;\n  border-radius: 16px;\n  background: rgba(14, 16, 24, 0.8);\n}\n' }
      ]
    };
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
      const fallbackRes = await axios.post('http://localhost:3000/api/test/execute', codeData);
      return fallbackRes.data;
    } catch (e2) {}

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
