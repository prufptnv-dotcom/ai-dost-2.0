import { useEffect } from 'react';
import api from '../../services/api';
import { saveSharedAnalysis } from './sharedChatContext';

function getRequestData(config) {
  if (!config?.data) return {};
  try {
    return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  } catch (_) {
    return {};
  }
}

export default function SharedContextCapture() {
  useEffect(() => {
    const interceptorId = api.interceptors.response.use((response) => {
      const url = String(response?.config?.url || '');
      if (/\/chat\/analyze\/?$/.test(url) && response?.data?.reply) {
        const request = getRequestData(response.config);
        saveSharedAnalysis({
          name: request.filename || request.name || `analysis-${Date.now()}`,
          content: response.data.reply,
          mime: request.imageMime || request.mime,
        });
      }
      return response;
    });

    return () => api.interceptors.response.eject(interceptorId);
  }, []);

  return null;
}
