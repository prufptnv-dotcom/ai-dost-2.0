'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: DeploymentValidator
 * 
 * Semantic validator for:
 * 1. Dockerfiles (AST/line analysis: offline boundary, approved base images, no remote scripts, no secrets, non-root user)
 * 2. Docker Compose files (semantic check against privileged mode, host networking, unsafe mounts, wildcard ports)
 * 3. Command allowlist enforcement and shell injection prevention
 * 4. Mount safety and port validation
 */

const path = require('path');
const { SecretRedactor } = require('./SecretRedactor');

const APPROVED_BASE_IMAGES = Object.freeze([
  'node:18-alpine',
  'node:20-alpine',
  'node:22-alpine',
  'python:3.11-alpine',
  'python:3.12-alpine',
  'nginx:alpine'
]);

const FORBIDDEN_SHELL_CHARS = /[;&|`$\n\r<>]/;

const SENSITIVE_HOST_PATHS = Object.freeze([
  '/',
  '/etc',
  '/root',
  '/home',
  '/proc',
  '/sys',
  '/dev',
  '/var/run/docker.sock',
  '//./pipe/docker_engine',
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\users\\administrator'
]);

class DeploymentValidator {
  /**
   * Validate a Dockerfile for strict security and offline compliance
   * @param {string} dockerfileContent - Raw content of Dockerfile
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  static validateDockerfile(dockerfileContent) {
    const errors = [];
    const warnings = [];

    if (!dockerfileContent || typeof dockerfileContent !== 'string') {
      return { valid: false, errors: ['Dockerfile content is empty or invalid'], warnings: [] };
    }

    const lines = dockerfileContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    let hasApprovedBaseImage = false;
    let finalUser = 'root'; // default docker user is root if not specified

    for (const line of lines) {
      const upper = line.toUpperCase();

      // 1. FROM instruction
      if (upper.startsWith('FROM ')) {
        const parts = line.split(/\s+/);
        const image = parts[1]?.toLowerCase();
        
        // Check base image against approved list or digest
        const matchesApproved = APPROVED_BASE_IMAGES.some(approved => 
          image === approved || image.startsWith(approved + '@sha256:')
        );

        if (!matchesApproved) {
          errors.push(`DISALLOWED_BASE_IMAGE: Base image "${image}" is not in the approved whitelist (${APPROVED_BASE_IMAGES.join(', ')})`);
        } else {
          hasApprovedBaseImage = true;
        }
      }

      // 2. ADD instruction checking
      if (upper.startsWith('ADD ')) {
        const parts = line.split(/\s+/);
        const src = parts[1];
        if (/^https?:\/\//i.test(src) || /^ftp:\/\//i.test(src)) {
          errors.push(`REMOTE_ADD_FORBIDDEN: Remote URL fetching via ADD is prohibited: "${src}"`);
        }
      }

      // 3. Remote script execution and unsafe commands in RUN
      if (upper.startsWith('RUN ')) {
        const cmd = line.slice(4).trim();
        if (/curl\s+[^|]*\|\s*(ba)?sh/i.test(cmd) || /wget\s+[^|]*\|\s*(ba)?sh/i.test(cmd)) {
          errors.push(`UNSAFE_REMOTE_SCRIPT_EXECUTION: Remote script piping detected in RUN: "${cmd}"`);
        }
        if (/npm\s+install/i.test(cmd) && !/npm\s+install\s+--offline/i.test(cmd) && !/npm\s+ci\s+--offline/i.test(cmd)) {
          errors.push(`ONLINE_PACKAGE_INSTALL_PROHIBITED: Online npm install detected without prepackaged dependencies: "${cmd}"`);
        }
        if (/npx\s+/i.test(cmd)) {
          errors.push(`NPX_PROHIBITED: npx invocation detected in Dockerfile: "${cmd}"`);
        }
      }

      // 4. Secret detection in ARG and ENV
      if (upper.startsWith('ARG ') || upper.startsWith('ENV ')) {
        const redacted = SecretRedactor.redactString(line);
        if (redacted.includes('[REDACTED_SECRET]')) {
          errors.push(`SECRET_IN_DOCKERFILE_DETECTED: Potential secret or credential hardcoded in Dockerfile: "${redacted}"`);
        }
      }

      // 5. User context
      if (upper.startsWith('USER ')) {
        const parts = line.split(/\s+/);
        finalUser = parts[1]?.toLowerCase() || 'root';
      }
    }

    if (!hasApprovedBaseImage && errors.length === 0) {
      errors.push('MISSING_BASE_IMAGE: No valid FROM instruction found');
    }

    if (finalUser === 'root') {
      errors.push('UNSAFE_USER_ROOT: Dockerfile must switch to an unprivileged user (e.g., USER node)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Docker Compose specification semantically
   * @param {object} composeSpec - Parsed YAML object or compose config
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  static validateComposeSpec(composeSpec) {
    const errors = [];
    const warnings = [];

    if (!composeSpec || typeof composeSpec !== 'object') {
      return { valid: false, errors: ['Compose specification must be a valid object'], warnings: [] };
    }

    const services = composeSpec.services || {};
    if (Object.keys(services).length === 0) {
      errors.push('NO_SERVICES_DEFINED: Docker compose file defines no services');
    }

    for (const [svcName, svc] of Object.entries(services)) {
      if (!svc || typeof svc !== 'object') continue;

      // 1. Privileged & security settings
      if (svc.privileged === true) {
        errors.push(`PRIVILEGED_MODE_FORBIDDEN: Service "${svcName}" requests privileged mode`);
      }
      if (svc.network_mode === 'host') {
        errors.push(`HOST_NETWORK_FORBIDDEN: Service "${svcName}" requests host networking`);
      }
      if (svc.pid === 'host') {
        errors.push(`HOST_PID_FORBIDDEN: Service "${svcName}" requests host PID namespace`);
      }
      if (svc.ipc === 'host') {
        errors.push(`HOST_IPC_FORBIDDEN: Service "${svcName}" requests host IPC namespace`);
      }
      if (Array.isArray(svc.cap_add) && svc.cap_add.length > 0) {
        errors.push(`CAP_ADD_FORBIDDEN: Service "${svcName}" requests Linux capabilities: ${svc.cap_add.join(', ')}`);
      }
      if (Array.isArray(svc.devices) && svc.devices.length > 0) {
        errors.push(`DEVICES_FORBIDDEN: Service "${svcName}" requests host devices`);
      }

      // 2. Volumes and mount safety
      if (Array.isArray(svc.volumes)) {
        for (const vol of svc.volumes) {
          const volStr = typeof vol === 'string' ? vol : vol.source;
          if (!volStr) continue;

          // Check Docker socket
          if (volStr.includes('/var/run/docker.sock') || volStr.includes('docker_engine')) {
            errors.push(`DOCKER_SOCKET_FORBIDDEN: Service "${svcName}" attempts to mount Docker socket`);
          }

          // Check sensitive host paths
          const hostPart = (volStr.split(':')[0] || '').toLowerCase().trim();
          for (const sensitive of SENSITIVE_HOST_PATHS) {
            if (hostPart === sensitive || hostPart.startsWith(sensitive + path.sep)) {
              errors.push(`UNSAFE_BIND_MOUNT: Service "${svcName}" mounts sensitive host path "${hostPart}"`);
            }
          }

          // Path traversal
          if (hostPart.includes('..')) {
            errors.push(`PATH_TRAVERSAL_IN_MOUNT: Service "${svcName}" volume mount contains "..": "${hostPart}"`);
          }
        }
      }

      // 3. Port bindings
      if (Array.isArray(svc.ports)) {
        for (const portEntry of svc.ports) {
          const pStr = String(portEntry);
          if (pStr.startsWith('0.0.0.0:') || pStr.startsWith(':::') || (!pStr.includes('127.0.0.1:') && pStr.includes(':'))) {
            // If it's a "8080:80" syntax without host IP, it defaults to 0.0.0.0
            if (/^\d+:\d+$/.test(pStr)) {
              errors.push(`WILDCARD_HOST_PORT_FORBIDDEN: Service "${svcName}" uses wildcard port "${pStr}". Must bind to 127.0.0.1`);
            }
          }
        }
      }

      // 4. Base image check if image is directly specified
      if (svc.image) {
        const image = svc.image.toLowerCase();
        const matches = APPROVED_BASE_IMAGES.some(approved => image === approved || image.startsWith(approved + '@sha256:'));
        if (!matches && !image.startsWith('aidost_')) {
          errors.push(`DISALLOWED_BASE_IMAGE: Service "${svcName}" specifies unapproved image "${image}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate command and arguments against allowlist and injection patterns
   * @param {string} cmd - Command binary
   * @param {string[]} args - Argument array
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateCommand(cmd, args = []) {
    if (FORBIDDEN_SHELL_CHARS.test(cmd)) {
      return { valid: false, error: `COMMAND_INJECTION_DETECTED: Forbidden characters in command binary "${cmd}"` };
    }

    for (const arg of args) {
      if (FORBIDDEN_SHELL_CHARS.test(arg)) {
        return { valid: false, error: `COMMAND_INJECTION_DETECTED: Forbidden characters in argument "${arg}"` };
      }
    }

    const baseCmd = path.basename(cmd).toLowerCase();
    const allowedBinaries = ['docker', 'docker-compose'];

    if (!allowedBinaries.includes(baseCmd)) {
      return { valid: false, error: `DISALLOWED_COMMAND: Binary "${baseCmd}" is not permitted for deployment` };
    }

    return { valid: true };
  }

  /**
   * Validate host port availability and bounds
   * @param {number} port - TCP port
   * @returns {{ valid: boolean, error?: string }}
   */
  static validatePort(port) {
    const p = parseInt(port, 10);
    if (isNaN(p) || p < 1024 || p > 65535) {
      return { valid: false, error: `INVALID_PORT: Port ${port} must be a number between 1024 and 65535` };
    }
    return { valid: true };
  }
}

module.exports = {
  DeploymentValidator,
  APPROVED_BASE_IMAGES,
  SENSITIVE_HOST_PATHS
};
