const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

class DeployService {
  constructor() {
    this.adapters = {
      vercel: new VercelAdapter(),
      netlify: new NetlifyAdapter(),
      cloudflare: new CloudflareAdapter(),
      static: new StaticAdapter()
    };
  }

  async deploy(projectPath, target, options = {}) {
    const adapter = this.adapters[target];
    if (!adapter) {
      throw new Error(`Unknown deployment target: ${target}. Available: ${Object.keys(this.adapters).join(', ')}`);
    }

    if (!await adapter.validateOptions(options)) {
      throw new Error(`Invalid options for ${target} deployment`);
    }

    return adapter.deploy(projectPath, options);
  }

  getAvailableTargets() {
    return Object.keys(this.adapters);
  }
}

class VercelAdapter {
  async validateOptions(options) {
    return options.token && options.projectId;
  }

  async deploy(projectPath, options) {
    const { token, projectId, teamId, alias } = options;
    
    // Build the project first
    const buildResult = await this.buildProject(projectPath);
    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    // Create deployment
    const deployUrl = `https://api.vercel.com/v13/deployments${projectId ? `?projectId=${projectId}` : ''}${teamId ? `&teamId=${teamId}` : ''}`;
    
    const files = await this.collectFiles(buildResult.outputDir);
    
    const response = await fetch(deployUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: options.name || 'ai-dost-deploy',
        files,
        target: 'production',
        ...(alias && { alias: [alias] })
      })
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Vercel deployment failed: ${result.error.message}`);
    }

    return {
      success: true,
      url: `https://${result.url}`,
      deploymentId: result.id,
      target: 'vercel'
    };
  }

  async buildProject(projectPath) {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('npm run build', { cwd: projectPath, timeout: 180000 }, (err, stdout, stderr) => {
          if (err) {
            return resolve({ success: false, error: stderr || err.message });
          }
          // Detect output directory
          const outputDirs = ['dist', 'build', '.next', 'public'];
          let outputDir = 'dist';
          for (const dir of outputDirs) {
            if (require('fs').existsSync(path.join(projectPath, dir))) {
              outputDir = dir;
              break;
            }
          }
          resolve({ success: true, outputDir });
        });
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async collectFiles(dir) {
    const files = [];
    async function walk(currentDir) {
      const entries = await require('fs').promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const content = await require('fs').promises.readFile(fullPath);
          const relativePath = path.relative(dir, fullPath);
          files.push({
            file: relativePath,
            data: content.toString('base64'),
            encoding: 'base64'
          });
        }
      }
    }
    await walk(dir);
    return files;
  }
}

class NetlifyAdapter {
  async validateOptions(options) {
    return options.token && options.siteId;
  }

  async deploy(projectPath, options) {
    const { token, siteId, alias } = options;
    
    const buildResult = await this.buildProject(projectPath);
    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    const files = await this.collectFiles(buildResult.outputDir);
    
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: files.map(f => ({ path: f.file, sha: this.hashContent(f.data) })),
        draft: false
      })
    });

    const result = await response.json();
    if (result.error) {
      throw new Error(`Netlify deployment failed: ${result.error.message}`);
    }

    return {
      success: true,
      url: `https://${result.ssl_url || result.url}`,
      deploymentId: result.id,
      target: 'netlify'
    };
  }

  async buildProject(projectPath) {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('npm run build', { cwd: projectPath, timeout: 180000 }, (err, stdout, stderr) => {
          if (err) {
            return resolve({ success: false, error: stderr || err.message });
          }
          const outputDirs = ['dist', 'build', '.next', 'public'];
          let outputDir = 'dist';
          for (const dir of outputDirs) {
            if (require('fs').existsSync(path.join(projectPath, dir))) {
              outputDir = dir;
              break;
            }
          }
          resolve({ success: true, outputDir });
        });
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async collectFiles(dir) {
    const files = [];
    async function walk(currentDir) {
      const entries = await require('fs').promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const content = await require('fs').promises.readFile(fullPath);
          const relativePath = path.relative(dir, fullPath);
          files.push({ path: relativePath, content });
        }
      }
    }
    await walk(dir);
    return files;
  }

  hashContent(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

class CloudflareAdapter {
  async validateOptions(options) {
    return options.token && options.accountId;
  }

  async deploy(projectPath, options) {
    const { token, accountId, projectName, alias } = options;
    
    const buildResult = await this.buildProject(projectPath);
    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    const files = await this.collectFiles(buildResult.outputDir);
    
    // Upload to Cloudflare Pages via Wrangler API or direct
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: files.map(f => ({ path: f.file, content: f.data })),
        branch: 'main',
        commit_message: 'Deployed by AI-Dost'
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(`Cloudflare deployment failed: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return {
      success: true,
      url: `https://${result.result.project_name}.pages.dev`,
      deploymentId: result.result.id,
      target: 'cloudflare'
    };
  }

  async buildProject(projectPath) {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('npm run build', { cwd: projectPath, timeout: 180000 }, (err, stdout, stderr) => {
          if (err) {
            return resolve({ success: false, error: stderr || err.message });
          }
          const outputDirs = ['dist', 'build', '.next', 'public'];
          let outputDir = 'dist';
          for (const dir of outputDirs) {
            if (require('fs').existsSync(path.join(projectPath, dir))) {
              outputDir = dir;
              break;
            }
          }
          resolve({ success: true, outputDir });
        });
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async collectFiles(dir) {
    const files = [];
    async function walk(currentDir) {
      const entries = await require('fs').promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const content = await require('fs').promises.readFile(fullPath);
          const relativePath = path.relative(dir, fullPath);
          files.push({ file: relativePath, data: content.toString('base64'), encoding: 'base64' });
        }
      }
    }
    await walk(dir);
    return files;
  }
}

class StaticAdapter {
  async validateOptions(options) {
    return options.targetDir;
  }

  async deploy(projectPath, options) {
    const { targetDir } = options;
    
    const buildResult = await this.buildProject(projectPath);
    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    const sourceDir = path.join(projectPath, buildResult.outputDir);
    const targetPath = path.join(targetDir, `deploy-${Date.now()}`);
    
    await this.copyDir(sourceDir, targetPath);
    
    return {
      success: true,
      url: `file://${targetPath}`,
      deploymentPath: targetPath,
      target: 'static'
    };
  }

  async buildProject(projectPath) {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('npm run build', { cwd: projectPath, timeout: 180000 }, (err, stdout, stderr) => {
          if (err) {
            return resolve({ success: false, error: stderr || err.message });
          }
          const outputDirs = ['dist', 'build', '.next', 'public'];
          let outputDir = 'dist';
          for (const dir of outputDirs) {
            if (require('fs').existsSync(path.join(projectPath, dir))) {
              outputDir = dir;
              break;
            }
          }
          resolve({ success: true, outputDir });
        });
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async copyDir(src, dest) {
    await require('fs').promises.mkdir(dest, { recursive: true });
    const entries = await require('fs').promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await require('fs').promises.copyFile(srcPath, destPath);
      }
    }
  }
}

module.exports = new DeployService();