const BACKEND = (typeof window !== 'undefined' && window.__AI_DOST_BACKEND__) || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/**
 * Thin client for Figma integration — proxies through the backend
 * (/api/figma/*) so the API key stays server-side.
 */
class FigmaClient {
  constructor(backendUrl = BACKEND) {
    this.base = backendUrl;
  }

  async _request(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(`${this.base}/api/figma${path}`, { signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `Figma request failed (${res.status})`);
        err.status = res.status;
        err.code = data.code;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Check whether a Figma API key is configured server-side. */
  async health() {
    return this._request('/health');
  }

  /** Fetch file metadata. */
  async getFile(fileKey) {
    return this._request(`/file/${encodeURIComponent(fileKey)}`);
  }

  /** List components (optionally filter by componentId). */
  async components(fileKey, componentId) {
    const q = componentId ? `&componentId=${encodeURIComponent(componentId)}` : '';
    return this._request(`/components?fileKey=${encodeURIComponent(fileKey)}${q}`);
  }

  /** Convert a Figma node to React JSX. */
  async designToCode(fileKey, nodeId) {
    return this._request(`/design-to-code?fileKey=${encodeURIComponent(fileKey)}&nodeId=${encodeURIComponent(nodeId)}`);
  }

  /** Export a node as png/svg image URL. */
  async exportNode(fileKey, nodeId, format = 'png') {
    return this._request(`/export?fileKey=${encodeURIComponent(fileKey)}&nodeId=${encodeURIComponent(nodeId)}&format=${format}`);
  }
}

export default FigmaClient;