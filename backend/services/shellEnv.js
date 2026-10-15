'use strict';

/**
 * Sanitized environment for spawned shells (interactive terminal, raw
 * terminal WS, LSP helper processes).
 *
 * Shells used to receive `process.env` verbatim — every API key/token the
 * backend holds (GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, …) was readable from
 * inside the terminal and inherited by any child process. #23: strip
 * secret-looking keys while keeping PATH/HOME/toolchain vars intact.
 */

const SENSITIVE_KEY_RE =
  /(API[_-]?KEY|_TOKEN$|^TOKEN$|TOKEN[_-]|SECRET|PASSWORD|PASSWD|CREDENTIAL|ACCESS[_-]?KEY|AUTH[_-]?TOKEN|BOT[_-]?TOKEN|_PAT$|^PAT$|PRIVATE[_-]?KEY)/i;

function isSensitiveEnvKey(key) {
  return SENSITIVE_KEY_RE.test(String(key || ''));
}

function shellEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (isSensitiveEnvKey(key)) continue;
    env[key] = value;
  }
  return Object.assign(env, extra);
}

/**
 * Strict allowlist environment for MCP child processes (#30).
 *
 * MCP servers are spawned from registered/ad-hoc configs — they must NEVER
 * inherit the backend's full process.env (every API key would be readable by
 * the child). Only toolchain/locale basics are forwarded; anything a server
 * needs (tokens for that service, etc.) must come from its explicit config
 * `env`, which is merged on top of the allowlist.
 */
const MCP_ENV_ALLOWLIST = [
  'PATH', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
  'TMP', 'TEMP', 'TMPDIR', 'TZ',
  'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'SHELL',
  'COMSPEC', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'windir', 'PATHEXT',
  'NODE_ENV', 'NODE_PATH', 'PYTHONPATH', 'PYTHONHOME', 'VIRTUAL_ENV',
  'GOPATH', 'GOROOT', 'CARGO_HOME', 'RUSTUP_HOME',
  'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
  'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE',
];

function mcpChildEnv(extra = {}) {
  const env = {};
  for (const key of MCP_ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  if (extra && typeof extra === 'object') {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) env[key] = value;
    }
  }
  return env;
}

module.exports = { shellEnv, isSensitiveEnvKey, mcpChildEnv, MCP_ENV_ALLOWLIST };
