import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, Lock, Key, Database, Globe,
  FileCode2, Server, AlertOctagon, CheckSquare, Sparkles, Copy,
  Check, RotateCcw, ArrowRight, Loader2, FileCheck, Layers
} from 'lucide-react';
import axios from 'axios';

const DOMAINS = [
  { id: 'owasp-top-10', name: 'OWASP Top 10', icon: ShieldAlert, category: 'AppSec', desc: 'Injection, Broken Auth, SSRF & Misconfigs' },
  { id: 'secure-coding', name: 'Secure Coding', icon: FileCode2, category: 'Engineering', desc: 'Node.js, Python, Go & React secure patterns' },
  { id: 'auth-security', name: 'Auth & Passwords', icon: Key, category: 'Identity', desc: 'Argon2id, bcrypt salts, MFA & session guards' },
  { id: 'jwt-security', name: 'JWT & Token Lifecycle', icon: Lock, category: 'Identity', desc: 'RS256 asymmetric keys, refresh rotation & cookies' },
  { id: 'api-security', name: 'API Security & BOLA', icon: Server, category: 'API', desc: 'BOLA/IDOR defenses, rate limiting & Zod schemas' },
  { id: 'sqli-prevention', name: 'SQLi Prevention', icon: Database, category: 'Data', desc: 'Parameterized queries & prepared statements' },
  { id: 'xss-csrf-protection', name: 'XSS & CSRF Defense', icon: Globe, category: 'Web', desc: 'Context encoding, DOMPurify, CSP & SameSite' },
  { id: 'security-headers', name: 'Security Headers', icon: Layers, category: 'Infrastructure', desc: 'HSTS, CSP, X-Frame-Options & Referrer-Policy' },
  { id: 'threat-modeling', name: 'STRIDE Threat Model', icon: AlertOctagon, category: 'Architecture', desc: 'Spoofing, Tampering, Repudiation, Info Leak' },
  { id: 'vulnerability-assessment', name: 'Code Auditing', icon: ShieldCheck, category: 'Audit', desc: 'SAST rules, Semgrep & dependency review' },
  { id: 'incident-response', name: 'Incident Response', icon: ShieldAlert, category: 'SecOps', desc: 'SANS PICERL breach triage runbooks' },
  { id: 'security-checklist', name: 'Pre-Deploy Checklist', icon: CheckSquare, category: 'Hardening', desc: 'Production go-live verification audit' }
];

const PRESET_AUDITS = [
  {
    domain: 'sqli-prevention',
    name: 'SQL Injection in Query Concatenation',
    lang: 'javascript',
    code: `// Vulnerable Express endpoint
app.get('/users/search', async (req, res) => {
  const query = "SELECT * FROM users WHERE email = '" + req.query.email + "'";
  const results = await db.query(query);
  res.json(results);
});`
  },
  {
    domain: 'xss-csrf-protection',
    name: 'Unescaped DOM Injection (XSS)',
    lang: 'javascript',
    code: `// Vulnerable React / DOM component
function UserProfile({ bio }) {
  // Dangerous: Rendering unescaped user-supplied HTML
  return <div dangerouslySetInnerHTML={{ __html: bio }} />;
}`
  },
  {
    domain: 'jwt-security',
    name: 'Insecure JWT Verification',
    lang: 'javascript',
    code: `// Vulnerable JWT Verification: Missing algorithm constraint
const jwt = require('jsonwebtoken');
function verifyToken(token) {
  // Vulnerable to algorithm confusion attacks (none or HS256)
  return jwt.verify(token, publicKey);
}`
  },
  {
    domain: 'auth-security',
    name: 'Weak Password Hashing',
    lang: 'javascript',
    code: `// Vulnerable: Plain SHA-256 without salt or key-stretching
const crypto = require('crypto');
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}`
  }
];

const DEFAULT_CHECKLIST = [
  { id: '1', category: 'Authentication', label: 'Argon2id or bcrypt (>=12 rounds) for password storage', checked: true },
  { id: '2', category: 'Authentication', label: 'Rate-limiting on login and password-reset endpoints', checked: true },
  { id: '3', category: 'Tokens', label: 'JWTs signed with asymmetric RS256 and explicit verification algorithms', checked: true },
  { id: '4', category: 'Tokens', label: 'Refresh tokens stored in HTTP-only, Secure, SameSite=Strict cookies', checked: true },
  { id: '5', category: 'Database', label: 'All SQL queries parameterized; zero raw string concatenation', checked: true },
  { id: '6', category: 'Database', label: 'DB user granted least privilege (no DROP or SUPERUSER in app pool)', checked: false },
  { id: '7', category: 'Headers', label: 'HSTS enabled with max-age=31536000 and includeSubDomains', checked: false },
  { id: '8', category: 'Headers', label: 'Content-Security-Policy (CSP) configured with frame-ancestors none', checked: false },
  { id: '9', category: 'Infrastructure', label: 'Secrets stored in environment variables, never committed to git', checked: true },
  { id: '10', category: 'Infrastructure', label: 'CORS configured to explicit origins; no wildcard * with credentials', checked: false }
];

export default function SecurityHubView({ onToast }) {
  const [activeTab, setActiveTab] = useState('auditor'); // 'auditor' | 'headers' | 'threat-model' | 'checklist'
  const [selectedDomain, setSelectedDomain] = useState('sqli-prevention');
  const [inputCode, setInputCode] = useState(PRESET_AUDITS[0].code);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState('');
  const [copied, setCopied] = useState(false);

  // Headers Tool state
  const [headerFramework, setHeaderFramework] = useState('express');
  const [headersOutput, setHeadersOutput] = useState('');

  // Threat Model state
  const [systemDesc, setSystemDesc] = useState('E-commerce web app with Next.js frontend, Express microservices, Stripe payments, and PostgreSQL');
  const [threatResult, setThreatResult] = useState('');

  // Checklist state
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);

  const activeDomainConfig = DOMAINS.find(d => d.id === selectedDomain) || DOMAINS[0];

  const handleAudit = async (e) => {
    e?.preventDefault();
    if (!inputCode.trim()) {
      onToast?.('Please enter code to audit', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/security/audit', {
        code: inputCode,
        language: codeLanguage,
        domain: selectedDomain,
        context
      });

      if (res.data?.success) {
        setAuditResult(res.data.audit);
        onToast?.('Security audit completed!', 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateHeaders = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/security/headers', { framework: headerFramework });
      if (res.data?.success) {
        setHeadersOutput(res.data.codeSnippet);
        onToast?.(`${res.data.framework} security headers generated!`, 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleThreatModel = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/security/threat-model', { systemDescription: systemDesc });
      if (res.data?.success) {
        setThreatResult(res.data.threatModel);
        onToast?.('STRIDE threat model generated!', 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    onToast?.('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const applyAuditPreset = (preset) => {
    setSelectedDomain(preset.domain);
    setCodeLanguage(preset.lang);
    setInputCode(preset.code);
    setActiveTab('auditor');
  };

  const toggleChecklistItem = (id) => {
    setChecklist(checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const passedCount = checklist.filter(c => c.checked).length;

  return (
    <div className="h-full flex flex-col bg-canvas-base text-paper-100 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-paper-100">Security & Defensive Hub</h1>
              <p className="text-xs md:text-sm text-ink-muted">
                OWASP Top 10, Secure Coding, STRIDE Threat Modeling, API hardening & production audits
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            Category 17 • Defensive SecOps
          </span>
        </div>
      </div>

      {/* Primary Tool Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
        <button
          onClick={() => setActiveTab('auditor')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'auditor'
              ? 'bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
              : 'text-paper-200 hover:text-paper-100 hover:bg-canvas-subtle'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Code Auditor & Hardener</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('headers');
            if (!headersOutput) handleGenerateHeaders();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'headers'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-canvas-subtle'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Security Headers Generator</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('threat-model');
            if (!threatResult) handleThreatModel();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'threat-model'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-canvas-subtle'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>STRIDE Threat Model</span>
        </button>

        <button
          onClick={() => setActiveTab('checklist')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'checklist'
              ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-canvas-subtle'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Hardening Checklist ({passedCount}/{checklist.length})</span>
        </button>
      </div>

      {/* Preset Quick Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-text-tertiary whitespace-nowrap flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" /> Audit Presets:
        </span>
        {PRESET_AUDITS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => applyAuditPreset(p)}
            className="px-2.5 py-1 rounded-full bg-canvas-subtle border border-border-subtle hover:border-rose-500/40 text-text-secondary hover:text-rose-300 transition-colors whitespace-nowrap"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Tab 1: Code Auditor & Hardener */}
      {activeTab === 'auditor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          <div className="lg:col-span-6 flex flex-col space-y-4">
            <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 flex flex-col space-y-4 flex-1">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                    {activeDomainConfig.name}
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">{activeDomainConfig.desc}</p>
                </div>
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="bg-canvas-base border border-border-subtle text-xs rounded-lg px-2.5 py-1 text-text-primary focus:outline-none"
                >
                  {DOMAINS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Code Area */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-semibold text-text-secondary">Code Snippet to Audit:</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={codeLanguage}
                      onChange={(e) => setCodeLanguage(e.target.value)}
                      className="bg-transparent text-[11px] text-text-tertiary focus:outline-none cursor-pointer"
                    >
                      <option value="javascript">JavaScript / Node.js</option>
                      <option value="typescript">TypeScript</option>
                      <option value="python">Python</option>
                      <option value="go">Go</option>
                      <option value="sql">SQL</option>
                    </select>
                    {inputCode && (
                      <button
                        onClick={() => setInputCode('')}
                        className="text-[11px] text-text-tertiary hover:text-text-secondary flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Paste potentially vulnerable code snippet here..."
                  rows={8}
                  className="w-full bg-canvas-base border border-border-subtle rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-rose-500/60 resize-none text-text-primary"
                />
              </div>

              {/* Context */}
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">
                  Optional Context (Framework, DB, or Cloud environment):
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. Node.js 20, PostgreSQL on AWS RDS, Public REST endpoint..."
                  className="w-full bg-canvas-base border border-border-subtle rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500/60"
                />
              </div>

              {/* Run Audit */}
              <button
                onClick={handleAudit}
                disabled={loading || !inputCode.trim()}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer mt-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing CWEs, OWASP Risks & Hardening Patterns...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Run Defensive Security Audit</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Audit Results Panel */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 flex flex-col flex-1">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Remediation & Hardened Code
                  </h3>
                </div>

                {auditResult && (
                  <button
                    onClick={() => handleCopy(auditResult)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-canvas-base border border-border-subtle hover:border-rose-500/50 text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 bg-canvas-base rounded-xl border border-border-subtle p-4 overflow-y-auto max-h-[540px]">
                {loading ? (
                  <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-text-tertiary space-y-3">
                    <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
                    <p className="text-xs">Generating drop-in secure remediation & testing guidelines...</p>
                  </div>
                ) : auditResult ? (
                  <div className="prose prose-invert prose-xs max-w-none text-text-primary leading-relaxed text-xs">
                    <pre className="whitespace-pre-wrap font-sans bg-transparent border-0 p-0 text-text-primary">
                      {auditResult}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-text-tertiary text-center p-6 space-y-2">
                    <ShieldCheck className="w-8 h-8 text-text-tertiary/40" />
                    <p className="text-xs font-medium text-text-secondary">Ready for Defensive Security Audit</p>
                    <p className="text-[11px] max-w-sm text-text-tertiary">
                      Paste a suspect function or query on the left. AI-Dost will scan for OWASP vulnerabilities and generate a verified, drop-in replacement.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Security Headers Generator */}
      {activeTab === 'headers' && (
        <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Production Security Headers Generator
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Hardened configurations for HSTS, Content Security Policy (CSP), X-Frame-Options, and Referrer-Policy
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={headerFramework}
                onChange={(e) => setHeaderFramework(e.target.value)}
                className="bg-canvas-base border border-border-subtle text-xs rounded-lg px-3 py-1.5 text-text-primary focus:outline-none cursor-pointer font-medium"
              >
                <option value="express">Express.js (Helmet)</option>
                <option value="nextjs">Next.js (next.config.mjs)</option>
                <option value="nginx">Nginx Server Block</option>
              </select>
              <button
                onClick={handleGenerateHeaders}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-colors"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="relative">
            <pre className="bg-canvas-base p-4 rounded-xl border border-border-subtle font-mono text-xs overflow-x-auto text-emerald-400 whitespace-pre-wrap leading-relaxed">
              {headersOutput || 'Click Generate to load security header configuration...'}
            </pre>
            {headersOutput && (
              <button
                onClick={() => handleCopy(headersOutput)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-canvas-subtle border border-border-subtle hover:border-rose-500 text-text-secondary hover:text-text-primary transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: STRIDE Threat Model */}
      {activeTab === 'threat-model' && (
        <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4" /> STRIDE Architectural Threat Modeling
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Analyze system components against Spoofing, Tampering, Repudiation, Information Leak, DoS, and Elevation of Privilege
              </p>
            </div>
            <button
              onClick={handleThreatModel}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Generate STRIDE Analysis</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              System Architecture & Components:
            </label>
            <textarea
              value={systemDesc}
              onChange={(e) => setSystemDesc(e.target.value)}
              rows={2}
              className="w-full bg-canvas-base border border-border-subtle rounded-xl p-2.5 text-xs focus:outline-none focus:border-rose-500/60 font-sans"
            />
          </div>

          <div className="bg-canvas-base rounded-xl border border-border-subtle p-4 overflow-y-auto max-h-[500px]">
            {loading ? (
              <div className="h-40 flex flex-col items-center justify-center text-xs text-text-tertiary space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                <p>Synthesizing STRIDE threat matrix and mitigation controls...</p>
              </div>
            ) : threatResult ? (
              <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed">
                <pre className="whitespace-pre-wrap font-sans bg-transparent border-0 p-0 text-text-primary">
                  {threatResult}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Tab 4: Pre-Deployment Security Checklist */}
      {activeTab === 'checklist' && (
        <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Production Go-Live Security Checklist
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Verify critical defense-in-depth controls before opening traffic to the public internet
              </p>
            </div>
            <div className="text-xs font-semibold px-3 py-1 rounded-full bg-canvas-base border border-border-subtle">
              Score: <span className={passedCount === checklist.length ? 'text-emerald-400' : 'text-amber-400'}>{passedCount} / {checklist.length} Passed</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleChecklistItem(item.id)}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  item.checked
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-text-primary'
                    : 'bg-canvas-base/80 border-border-subtle text-text-secondary hover:border-border-default'
                }`}
              >
                <div className={`mt-0.5 p-1 rounded ${item.checked ? 'bg-emerald-500 text-white' : 'bg-canvas-subtle border border-border-subtle'}`}>
                  <Check className={`w-3.5 h-3.5 ${item.checked ? 'opacity-100' : 'opacity-0'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-text-tertiary">
                      {item.category}
                    </span>
                    <span className={`text-[10px] font-bold ${item.checked ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {item.checked ? 'VERIFIED' : 'PENDING'}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-snug">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
