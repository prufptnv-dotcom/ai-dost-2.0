'use strict';

const crypto = require('crypto');

class ApiClientGenerator {
  /**
   * Synthesizes a runtime-validated native fetch API client
   */
  static generateFetchClient(spec, plan) {
    const isTs = plan.language === 'typescript';
    const operations = ApiClientGenerator.extractOperations(spec);

    const methodsCode = operations.map(op => {
      const { methodName, httpMethod, pathTemplate, hasBody, hasPathParams, pathParamNames, summary } = op;

      const paramSig = [
        ...pathParamNames,
        hasBody ? (isTs ? 'payload: Record<string, any>' : 'payload') : null,
        isTs ? 'options: RequestOptions = {}' : 'options = {}'
      ].filter(Boolean).join(', ');

      const buildUrl = pathParamNames.length > 0
        ? `const path = '${pathTemplate}'${pathParamNames.map(p => `.replace('{${p}}', encodeURIComponent(String(${p})))`).join('')};`
        : `const path = '${pathTemplate}';`;

      const jsDoc = [
        '  /**',
        `   * ${summary || methodName}`,
        ...pathParamNames.map(p => `   * @param {string|number} ${p} - Path parameter`),
        hasBody ? '   * @param {Record<string, any>} payload - Request body' : null,
        '   * @param {Object} [options] - Optional request overrides',
        '   * @returns {Promise<any>} Runtime-validated response promise',
        '   */'
      ].filter(Boolean).join('\n');

      return `
${jsDoc}
  async ${methodName}(${paramSig}) {
    ${buildUrl}
    return this._request('${httpMethod.toUpperCase()}', path, {
      ...options,
      ${hasBody ? 'body: payload,' : ''}
    });
  }`;
    }).join('\n');

    return `/**
 * AI-Dost 2.0 Auto-Generated API Client (Phase 4D)
 * Style: Native Fetch (Runtime-Validated)
 * OpenAPI Spec: ${spec.info?.title || 'API'} (v${spec.info?.version || '1.0.0'})
 */

/* AI-DOST-AUTO-GENERATED: START */

export class ApiError extends Error {
  constructor(message, status = 0, data = null, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

const DEFAULT_RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ApiClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || '/api';
    this.timeoutMs = typeof config.timeoutMs === 'number' ? config.timeoutMs : ${plan.timeoutMs || 15000};
    this.maxRetries = typeof config.maxRetries === 'number' ? config.maxRetries : ${plan.maxRetries || 3};
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(config.defaultHeaders || {})
    };
  }

  async _request(method, path, options = {}) {
    const url = \`\${this.baseUrl.replace(/\\/+$/, '')}/\${path.replace(/^\\/+/, '')}\`;
    const headers = { ...this.defaultHeaders, ...(options.headers || {}) };
    const maxRetries = typeof options.retries === 'number' ? options.retries : (IDEMPOTENT_METHODS.has(method) ? this.maxRetries : 0);
    const timeoutMs = options.timeoutMs || this.timeoutMs;

    let attempt = 0;
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const fetchOptions = {
          method,
          headers,
          signal: controller.signal,
          ...(options.body ? { body: JSON.stringify(options.body) } : {})
        };

        const res = await fetch(url, fetchOptions);
        clearTimeout(timer);

        if (!res.ok) {
          let errorData = null;
          try {
            errorData = await res.json();
          } catch {
            errorData = await res.text().catch(() => null);
          }

          if (attempt <= maxRetries && DEFAULT_RETRYABLE_STATUSES.has(res.status)) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          throw new ApiError(
            errorData?.message || \`HTTP \${res.status} \${res.statusText}\`,
            res.status,
            errorData,
            false
          );
        }

        if (res.status === 204) return null;
        return await res.json();
      } catch (err) {
        clearTimeout(timer);

        const isAbort = err.name === 'AbortError';
        const isNetwork = isAbort || err instanceof TypeError;

        if (attempt <= maxRetries && isNetwork && IDEMPOTENT_METHODS.has(method)) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (err instanceof ApiError) throw err;

        throw new ApiError(
          isAbort ? \`Request timed out after \${timeoutMs}ms\` : (err.message || 'Network request failed'),
          0,
          null,
          true
        );
      }
    }
  }

  // --- API Operation Methods ---
${methodsCode}
}

export const api = new ApiClient();
export default api;

/* AI-DOST-AUTO-GENERATED: END */
`;
  }

  /**
   * Synthesizes an Axios-based client when configured
   */
  static generateAxiosClient(spec, plan) {
    const operations = ApiClientGenerator.extractOperations(spec);

    const methodsCode = operations.map(op => {
      const { methodName, httpMethod, pathTemplate, hasBody, pathParamNames, summary } = op;
      const paramSig = [
        ...pathParamNames,
        hasBody ? 'payload' : null,
        'options = {}'
      ].filter(Boolean).join(', ');

      const buildUrl = pathParamNames.length > 0
        ? `const path = '${pathTemplate}'${pathParamNames.map(p => `.replace('{${p}}', encodeURIComponent(String(${p})))`).join('')};`
        : `const path = '${pathTemplate}';`;

      return `
  /**
   * ${summary || methodName}
   */
  async ${methodName}(${paramSig}) {
    ${buildUrl}
    return this.axiosInstance.request({
      url: path,
      method: '${httpMethod.toUpperCase()}',
      ${hasBody ? 'data: payload,' : ''}
      ...options
    }).then(res => res.data);
  }`;
    }).join('\n');

    return `/**
 * AI-Dost 2.0 Auto-Generated API Client (Phase 4D)
 * Style: Axios (Runtime-Validated)
 */

/* AI-DOST-AUTO-GENERATED: START */

import axios from 'axios';

export class ApiClient {
  constructor(config = {}) {
    const baseUrl = config.baseUrl || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || '/api';
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: config.timeoutMs || ${plan.timeoutMs || 15000},
      headers: {
        'Content-Type': 'application/json',
        ...(config.defaultHeaders || {})
      }
    });
  }

  // --- API Operation Methods ---
${methodsCode}
}

export const api = new ApiClient();
export default api;

/* AI-DOST-AUTO-GENERATED: END */
`;
  }

  /**
   * Extracts clean operation descriptors from an OpenAPI specification
   */
  static extractOperations(spec) {
    const operations = [];
    if (!spec || !spec.paths) return operations;

    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(pathItem)) {
        if (typeof op !== 'object') continue;

        const pathParamNames = (op.parameters || [])
          .filter(p => p.in === 'path')
          .map(p => p.name);

        const hasBody = !!op.requestBody;
        const methodName = op.operationId || `${method}${pathKey.replace(/[^a-zA-Z0-9]/g, '_')}`;

        operations.push({
          methodName,
          httpMethod: method.toLowerCase(),
          pathTemplate: pathKey,
          hasBody,
          hasPathParams: pathParamNames.length > 0,
          pathParamNames,
          summary: op.summary || `${method.toUpperCase()} ${pathKey}`
        });
      }
    }

    return operations;
  }
}

module.exports = {
  ApiClientGenerator
};
