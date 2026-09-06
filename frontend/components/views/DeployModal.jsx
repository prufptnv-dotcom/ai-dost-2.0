import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Lock, Loader2, CheckCircle2, AlertTriangle, Cloud, Zap, ArrowRight, ExternalLink } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../services/api';

export default function DeployModal({ isOpen, onClose, projectId, projectPath, onToast }) {
  const [target, setTarget] = useState('vercel');
  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  
  // Credentials
  const [vercelToken, setVercelToken] = useState('');
  const [vercelProjectId, setVercelProjectId] = useState('');
  const [netlifyToken, setNetlifyToken] = useState('');
  const [netlifySiteId, setNetlifySiteId] = useState('');

  // Load saved credentials from localStorage
  useEffect(() => {
    if (isOpen) {
      try {
        setVercelToken(localStorage.getItem('ai_dost_vercel_token') || '');
        setVercelProjectId(localStorage.getItem('ai_dost_vercel_project_id') || '');
        setNetlifyToken(localStorage.getItem('ai_dost_netlify_token') || '');
        setNetlifySiteId(localStorage.getItem('ai_dost_netlify_site_id') || '');
        setSuccessResult(null);
      } catch (e) {}
    }
  }, [isOpen]);

  const handleDeploy = async () => {
    let options = {};
    
    if (target === 'vercel') {
      if (!vercelToken) return onToast('Vercel Token is required', 'error');
      options = { token: vercelToken, projectId: vercelProjectId, name: projectId };
      localStorage.setItem('ai_dost_vercel_token', vercelToken);
      localStorage.setItem('ai_dost_vercel_project_id', vercelProjectId);
    } else if (target === 'netlify') {
      if (!netlifyToken || !netlifySiteId) return onToast('Netlify Token and Site ID are required', 'error');
      options = { token: netlifyToken, siteId: netlifySiteId };
      localStorage.setItem('ai_dost_netlify_token', netlifyToken);
      localStorage.setItem('ai_dost_netlify_site_id', netlifySiteId);
    }

    setLoading(true);
    setSuccessResult(null);
    try {
      // In CopilotIDE, projectPath is typically handled by the backend sandbox or workspace.
      // We will pass projectId and let the backend resolve the exact workspace path if needed, 
      // or we pass a hardcoded projectPath based on our architecture.
      // Actually, looking at deploy.js, it expects `projectPath`.
      // The frontend can send a dummy or backend-resolved path. 
      // For now, we assume the backend knows where the sandbox is if we send projectId,
      // but let's pass a standard path or what the component gave us.
      
      const res = await api.post('/v1/deploy/deploy', {
        projectPath: projectPath || `/tmp/ai-dost-sandbox/${projectId}`, // fallback heuristic
        target,
        options
      });
      
      if (res.data?.success) {
        setSuccessResult(res.data.result);
        onToast('Deployment successful!', 'success');
      } else {
        throw new Error(res.data?.error || 'Deployment failed');
      }
    } catch (err) {
      onToast(err?.response?.data?.error || err.message || 'Deployment error', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deploy Application" size="md">
      <div className="pt-4 pb-2">
        {successResult ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-var-text mb-2">Deployment Successful!</h3>
            <p className="text-sm text-var-muted mb-6 max-w-sm">
              Your application has been compiled and shipped to {target === 'vercel' ? 'Vercel' : 'Netlify'}.
            </p>
            <a 
              href={successResult.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-2.5 bg-var-primary hover:bg-var-primary/90 text-white font-medium rounded-lg shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.4)] transition-all cursor-pointer"
            >
              Visit Live App <ExternalLink className="w-4 h-4" />
            </a>
            
            <button 
              onClick={() => { setSuccessResult(null); onClose(); }}
              className="mt-4 text-xs font-medium text-var-muted hover:text-var-text"
            >
              Close Window
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Target Selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTarget('vercel')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                  target === 'vercel' 
                    ? 'bg-zinc-900 border-zinc-700 text-white shadow-lg relative overflow-hidden' 
                    : 'bg-var-surface/50 border-white/5 text-var-muted hover:bg-var-surface hover:text-var-text'
                }`}
              >
                {target === 'vercel' && <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl -mr-8 -mt-8" />}
                <svg viewBox="0 0 76 65" fill="currentColor" className="w-7 h-7 mb-2 relative z-10">
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
                <span className="font-semibold text-sm relative z-10">Vercel</span>
              </button>

              <button
                onClick={() => setTarget('netlify')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                  target === 'netlify' 
                    ? 'bg-teal-900/30 border-teal-500/50 text-teal-400 shadow-lg relative overflow-hidden' 
                    : 'bg-var-surface/50 border-white/5 text-var-muted hover:bg-var-surface hover:text-var-text'
                }`}
              >
                {target === 'netlify' && <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/10 rounded-full blur-xl -mr-8 -mt-8" />}
                <Cloud className="w-7 h-7 mb-2 relative z-10" />
                <span className="font-semibold text-sm relative z-10">Netlify</span>
              </button>
            </div>

            {/* Vercel Form */}
            {target === 'vercel' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-var-muted uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" /> Vercel Access Token
                  </label>
                  <input
                    type="password"
                    value={vercelToken}
                    onChange={e => setVercelToken(e.target.value)}
                    placeholder="Enter your Vercel API token"
                    className="w-full bg-var-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-var-text focus:outline-none focus:border-var-primary/50"
                  />
                  <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-[10px] text-var-primary hover:underline">Get a token →</a>
                </div>
                
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-var-muted uppercase tracking-wider">
                    <Globe className="w-3.5 h-3.5" /> Project ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={vercelProjectId}
                    onChange={e => setVercelProjectId(e.target.value)}
                    placeholder="Link to existing Vercel project ID"
                    className="w-full bg-var-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-var-text focus:outline-none focus:border-var-primary/50"
                  />
                </div>
              </div>
            )}

            {/* Netlify Form */}
            {target === 'netlify' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-var-muted uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" /> Netlify Access Token
                  </label>
                  <input
                    type="password"
                    value={netlifyToken}
                    onChange={e => setNetlifyToken(e.target.value)}
                    placeholder="Enter your Netlify Personal Access Token"
                    className="w-full bg-var-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-var-text focus:outline-none focus:border-teal-500/50"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-var-muted uppercase tracking-wider">
                    <Globe className="w-3.5 h-3.5" /> Site ID
                  </label>
                  <input
                    type="text"
                    value={netlifySiteId}
                    onChange={e => setNetlifySiteId(e.target.value)}
                    placeholder="Your unique Netlify Site ID (UUID)"
                    className="w-full bg-var-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-var-text focus:outline-none focus:border-teal-500/50"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button 
                onClick={handleDeploy} 
                disabled={loading || (target === 'vercel' && !vercelToken) || (target === 'netlify' && (!netlifyToken || !netlifySiteId))}
                className={`text-white font-semibold transition-all ${
                  target === 'vercel' 
                    ? 'bg-zinc-800 hover:bg-black border border-zinc-700 shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                    : 'bg-teal-600 hover:bg-teal-500 shadow-[0_0_10px_rgba(13,148,136,0.3)]'
                }`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Packaging & Deploying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Deploy to {target === 'vercel' ? 'Vercel' : 'Netlify'}
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
