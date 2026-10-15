import React, { useState, useMemo } from 'react';
import { Package, Search, Plus, Trash2, X, ExternalLink, Check, Loader2, Sparkles } from 'lucide-react';

const POPULAR_PACKAGES = [
  { name: 'axios', desc: 'Promise based HTTP client for node.js and the browser', version: '^1.7.9' },
  { name: 'lucide-react', desc: 'Beautiful & consistent icon toolkit for React', version: '^1.16.0' },
  { name: 'canvas-confetti', desc: 'Performant confetti animations for web', version: '^1.9.4' },
  { name: 'chart.js', desc: 'Flexible JavaScript charting for designers & developers', version: '^4.4.7' },
  { name: 'framer-motion', desc: 'Production-ready animation library for React', version: '^11.15.0' },
  { name: 'dayjs', desc: 'Fast 2KB alternative to Moment.js with largely compatible API', version: '^1.11.13' },
  { name: 'lodash', desc: 'Modern JavaScript utility library delivering modularity & performance', version: '^4.17.21' },
  { name: 'zustand', desc: 'Bear necessities for state management in React', version: '^5.0.3' },
  { name: 'clsx', desc: 'A tiny utility for constructing className strings conditionally', version: '^2.1.1' },
  { name: 'tailwind-merge', desc: 'Utility function to efficiently merge Tailwind CSS classes', version: '^2.6.0' },
];

export function PackagesModal({ isOpen, onClose, packageJsonContent, onUpdatePackageJson, onRunCommand }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState(false);
  const [customVersion, setCustomVersion] = useState('');

  // Parse package.json
  const parsedPackage = useMemo(() => {
    try {
      if (!packageJsonContent) return { dependencies: {}, devDependencies: {} };
      const parsed = JSON.parse(packageJsonContent);
      return {
        name: parsed.name || 'project',
        dependencies: parsed.dependencies || {},
        devDependencies: parsed.devDependencies || {},
      };
    } catch (_) {
      return { dependencies: {}, devDependencies: {} };
    }
  }, [packageJsonContent]);

  const installedDeps = useMemo(() => {
    const list = [];
    Object.entries(parsedPackage.dependencies).forEach(([name, version]) => {
      list.push({ name, version, type: 'dep' });
    });
    Object.entries(parsedPackage.devDependencies).forEach(([name, version]) => {
      list.push({ name, version, type: 'dev' });
    });
    return list;
  }, [parsedPackage]);

  // Filtered packages
  const filteredPopular = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return POPULAR_PACKAGES;
    return POPULAR_PACKAGES.filter(p => p.name.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query));
  }, [searchQuery]);

  const handleInstall = async (pkgName, version = 'latest') => {
    if (!pkgName || !pkgName.trim()) return;
    const cleanName = pkgName.trim();
    setInstalling(true);
    try {
      let currentObj = {};
      try {
        currentObj = packageJsonContent ? JSON.parse(packageJsonContent) : {};
      } catch (_) {
        currentObj = { name: 'app', dependencies: {} };
      }

      if (!currentObj.dependencies) currentObj.dependencies = {};
      currentObj.dependencies[cleanName] = version.startsWith('^') ? version : `^${version.replace(/^v/, '')}`;

      const updatedStr = JSON.stringify(currentObj, null, 2);
      if (onUpdatePackageJson) {
        await onUpdatePackageJson(updatedStr);
      }

      if (onRunCommand) {
        onRunCommand(`npm install ${cleanName}@${version} --save`);
      }
      setSearchQuery('');
    } catch (err) {
      console.error('Install package error:', err);
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async (pkgName) => {
    if (!pkgName) return;
    try {
      let currentObj = {};
      try {
        currentObj = packageJsonContent ? JSON.parse(packageJsonContent) : {};
      } catch (_) {
        return;
      }

      if (currentObj.dependencies && currentObj.dependencies[pkgName]) {
        delete currentObj.dependencies[pkgName];
      }
      if (currentObj.devDependencies && currentObj.devDependencies[pkgName]) {
        delete currentObj.devDependencies[pkgName];
      }

      const updatedStr = JSON.stringify(currentObj, null, 2);
      if (onUpdatePackageJson) {
        await onUpdatePackageJson(updatedStr);
      }

      if (onRunCommand) {
        onRunCommand(`npm uninstall ${pkgName}`);
      }
    } catch (err) {
      console.error('Uninstall package error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-canvas-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-canvas-elevated border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Package size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-paper-100 flex items-center gap-2">
                Replit Package Manager
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal">
                  npm
                </span>
              </h2>
              <p className="text-[11px] text-ink-muted">Install and manage packages for your application</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-canvas-base text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Direct Install */}
        <div className="p-5 border-b border-border bg-canvas-base space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleInstall(searchQuery.trim(), customVersion || 'latest');
                  }
                }}
                placeholder="Search or enter npm package name (e.g. axios, lucide-react)..."
                className="w-full bg-canvas-surface border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-indigo-500 transition-all font-mono"
              />
            </div>
            <button
              onClick={() => handleInstall(searchQuery.trim(), customVersion || 'latest')}
              disabled={!searchQuery.trim() || installing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-indigo-600/30"
            >
              {installing ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
              Install
            </button>
          </div>
        </div>

        {/* Content Area: Two Sections (Installed & Recommendations) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Installed Packages Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-paper-200 uppercase tracking-wider flex items-center gap-1.5">
                Installed Dependencies ({installedDeps.length})
              </h3>
            </div>

            {installedDeps.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-ink-muted">
                No dependencies listed in package.json yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {installedDeps.map((dep) => (
                  <div
                    key={dep.name}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-canvas-base border border-border hover:border-border-strong transition-all group"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-paper-100 font-mono truncate">{dep.name}</span>
                        {dep.type === 'dev' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            dev
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-ink-muted">{dep.version}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <a
                        href={`https://www.npmjs.com/package/${dep.name}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg hover:bg-canvas-elevated text-ink-muted hover:text-indigo-400 transition-colors"
                        title="View on npm"
                      >
                        <ExternalLink size={12} />
                      </a>
                      <button
                        onClick={() => handleUninstall(dep.name)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-ink-muted hover:text-red-400 transition-colors cursor-pointer"
                        title="Uninstall package"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Popular & Recommended Packages Section */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-paper-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-400" /> Recommended Web Packages
            </h3>

            <div className="grid grid-cols-1 gap-2">
              {filteredPopular.map((pkg) => {
                const isInstalled = !!parsedPackage.dependencies[pkg.name] || !!parsedPackage.devDependencies[pkg.name];
                return (
                  <div
                    key={pkg.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-canvas-base/80 border border-border hover:border-indigo-500/30 transition-all"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-paper-100 font-mono">{pkg.name}</span>
                        <span className="text-[10px] font-mono text-ink-muted">{pkg.version}</span>
                      </div>
                      <p className="text-[11px] text-ink-muted truncate mt-0.5">{pkg.desc}</p>
                    </div>

                    {isInstalled ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <Check size={12} /> Installed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInstall(pkg.name, pkg.version)}
                        disabled={installing}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-canvas-elevated hover:bg-indigo-600 text-paper-200 hover:text-white border border-border hover:border-indigo-500 transition-all cursor-pointer shadow-xs"
                      >
                        <Plus size={12} /> Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-canvas-elevated border-t border-border text-[11px] text-ink-muted">
          <span>Modifications update <code>package.json</code> automatically</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-canvas-surface hover:bg-canvas-base border border-border rounded-lg text-paper-200 font-medium cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default PackagesModal;
