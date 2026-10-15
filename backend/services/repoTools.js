/**
 * repoTools — P9 git commit / push / PR tools for the ReAct loop.
 *
 * Design rules (learned from the "report success you didn't prove" failures):
 *  - every tier reports what ACTUALLY happened: committed / pushed / PR url, or
 *    an honest reason + the exact next command for the user;
 *  - a missing remote, missing gh CLI, or auth failure is NOT an exception —
 *    it's a structured `{success, pushed:false, reason}` the model can relay;
 *  - no shell strings: execFileSync with arg arrays (injection impossible);
 *  - GIT_TERMINAL_PROMPT=0 so git can never hang a run waiting for a password.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const BASE_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };

function run(bin, args, { cwd, timeout = 20000, allowFail = false } = {}) {
  try {
    const stdout = execFileSync(bin, args, {
      cwd,
      timeout,
      encoding: 'utf8',
      env: BASE_ENV,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return { ok: true, stdout: String(stdout).trim() };
  } catch (e) {
    const stderr = String((e.stderr || '') + (e.stdout || '')).trim() || String(e.message || '');
    if (allowFail) return { ok: false, stdout: String(e.stdout || '').trim(), stderr };
    const short = stderr.split('\n').filter(Boolean).slice(-4).join(' ').slice(0, 400);
    const err = new Error(short || `${bin} failed`);
    err.stderr = stderr;
    err.code = e.code;
    throw err;
  }
}

function git(dir, args, opts = {}) {
  return run('git', args, { cwd: dir, ...opts });
}

function identityFlags(dir) {
  const email = git(dir, ['config', 'user.email'], { allowFail: true });
  const name = git(dir, ['config', 'user.name'], { allowFail: true });
  if (email.ok && name.ok) return [];
  // No identity configured (fresh machine / CI) — commit as AI-Dost for THIS
  // commit only (-c is scoped to the invocation, never persisted).
  return ['-c', 'user.name=AI-Dost', '-c', 'user.email=aidost@local'];
}

function describeError(e) {
  if (e && e.code === 'ENOENT') return `${e.path || 'binary'} not found on PATH`;
  return (e && e.message) || String(e);
}

/** Stage everything and create a LOCAL commit. Never claims a push. */
function gitCommit(dir, message) {
  if (!fs.existsSync(dir)) return { success: false, error: `Directory does not exist: ${dir}` };
  const inside = git(dir, ['rev-parse', '--is-inside-work-tree'], { allowFail: true });
  if (!inside.ok || inside.stdout !== 'true') {
    git(dir, ['init']);
    logger.info(`[RepoTools] git init in ${dir}`);
  }
  git(dir, ['add', '-A']);
  const status = git(dir, ['status', '--porcelain']);
  if (!status.stdout) {
    return { success: true, committed: false, reason: 'Nothing to commit — working tree is clean.' };
  }
  const cleanMsg = String(message || 'AI-Dost: agent update').replace(/[\r\n]+/g, ' ').slice(0, 200);
  git(dir, ['commit', ...identityFlags(dir), '-m', cleanMsg], { timeout: 30000 });
  const sha = git(dir, ['rev-parse', '--short', 'HEAD'], { allowFail: true });
  const changed = status.stdout.split('\n').filter(Boolean).length;
  return {
    success: true,
    committed: true,
    commit: sha.ok ? sha.stdout : null,
    filesChanged: changed,
    message: cleanMsg,
    note: 'Local commit only — use git_push to send it to a remote.',
  };
}

function remoteUrl(dir) {
  const r = git(dir, ['remote', 'get-url', 'origin'], { allowFail: true });
  return r.ok && r.stdout ? r.stdout : null;
}

function currentBranch(dir, fallback = 'main') {
  const b = git(dir, ['branch', '--show-current'], { allowFail: true });
  return b.ok && b.stdout ? b.stdout : fallback;
}

/** Commit (if needed) + push to origin when a remote exists. Honest tiers. */
function gitPush(dir, { message, branch } = {}) {
  const commitRes = gitCommit(dir, message);
  if (!commitRes.success) return commitRes;

  const remote = remoteUrl(dir);
  if (!remote) {
    return {
      ...commitRes,
      pushed: false,
      reason: 'No git remote configured — the commit exists locally only. Add one with `git remote add origin <repo-url>` and run git_push again (or push manually).',
    };
  }
  const branchName = branch || currentBranch(dir, 'main');
  const push = git(dir, ['push', '-u', 'origin', branchName], { timeout: 60000, allowFail: true });
  if (!push.ok) {
    const tail = String(push.stderr || '').split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 400);
    return {
      ...commitRes,
      pushed: false,
      branch: branchName,
      remote,
      reason: `Push to ${remote} failed: ${tail || 'unknown error'} — check credentials (HTTPS PAT or SSH key) and retry.`,
    };
  }
  return { success: true, committed: Boolean(commitRes.committed), pushed: true, commit: commitRes.commit, branch: branchName, remote, message: `Pushed ${branchName} → ${remote}` };
}

function ghAvailable() {
  try {
    execFileSync('gh', ['--version'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    return true;
  } catch (_) {
    return false;
  }
}

/** GitHub compare URL as the no-gh fallback so the user gets a one-click PR link. */
function compareUrl(remote, base, head) {
  const m = String(remote).match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?expand=1`;
}

/**
 * Push the branch and open a PR via `gh`. Without gh (or with no GitHub
 * remote) returns structured instructions + a ready-made compare URL — never
 * a fake success.
 */
function createPullRequest(dir, { title, body, base } = {}) {
  if (!fs.existsSync(dir)) return { success: false, error: `Directory does not exist: ${dir}` };
  const remote = remoteUrl(dir);
  if (!remote) {
    return {
      success: false,
      error: 'No git remote (origin) configured — cannot open a PR. Run `git remote add origin <repo-url>`, then git_push, then create_pr.',
    };
  }
  const branchName = currentBranch(dir, 'main');
  const baseName = base || 'main';
  const compare = compareUrl(remote, baseName, branchName);

  // Branch must be on the remote before a PR can reference it.
  const pushRes = gitPush(dir, { message: title ? `PR: ${title}` : undefined, branch: branchName });
  if (pushRes.pushed === false) {
    return { success: false, error: `Cannot open PR — branch not on remote. ${pushRes.reason || ''}`, compareUrl: compare };
  }

  if (!ghAvailable()) {
    return {
      success: false,
      pushed: true,
      branch: branchName,
      remote,
      compareUrl: compare,
      error: `Branch pushed. GitHub CLI (\`gh\`) is not installed — open the PR yourself: ${compare || 'GitHub → Pull requests → New'} (or install gh: \`winget install GitHub.cli\` then \`gh auth login\`).`,
    };
  }

  const args = ['pr', 'create', '--title', String(title || 'AI-Dost agent changes').slice(0, 200), '--body', String(body || 'Opened automatically by the AI-Dost agent.').slice(0, 4000), '--base', baseName, '--head', branchName];
  const pr = run('gh', args, { cwd: dir, timeout: 60000, allowFail: true });
  if (!pr.ok) {
    const tail = String(pr.stderr || '').split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 400);
    return { success: false, pushed: true, branch: branchName, compareUrl: compare, error: `PR creation failed: ${tail || 'unknown error'} — open manually: ${compare || 'GitHub → New PR'}` };
  }
  const url = (pr.stdout.match(/https:\/\/\S+/) || [null])[0];
  return { success: true, pushed: true, branch: branchName, url: url || undefined, compareUrl: compare, message: url ? `PR opened: ${url}` : 'PR created (no URL in output).' };
}

/** Entry point for the executeTool switch. */
async function execute(action, parameters = {}, projectPath = process.cwd()) {
  try {
    const dir = path.resolve(String(projectPath || process.cwd()));
    const message = parameters.message || parameters.commit_message || parameters.prompt || 'AI-Dost agent update';
    switch (action) {
      case 'git_commit':
        return gitCommit(dir, message);
      case 'git_push':
        return gitPush(dir, { message, branch: parameters.branch || parameters.branch_name });
      case 'create_pr':
        return createPullRequest(dir, {
          title: parameters.title || parameters.pr_title || message,
          body: parameters.body !== undefined ? parameters.body : parameters.pr_body,
          base: parameters.base || parameters.base_branch || parameters.target_branch,
        });
      default:
        return { success: false, error: `repoTools: unknown action ${action}` };
    }
  } catch (e) {
    logger.warn(`[RepoTools] ${action} failed: ${e.message}`);
    return { success: false, error: `${action} failed: ${describeError(e)}` };
  }
}

module.exports = {
  execute,
  gitCommit,
  gitPush,
  createPullRequest,
  ghAvailable,
  compareUrl,
};
