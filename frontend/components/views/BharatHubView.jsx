import React, { useState, useEffect } from 'react';
import { 
  Building2, Landmark, MapPin, Wheat, Rocket, Calendar, Globe, 
  Search, ExternalLink, Loader2, CheckCircle2, Copy, Check, ArrowRight, ShieldCheck, Sparkles, X, QrCode, Receipt, Fingerprint
} from 'lucide-react';
import api from '../../services/api';

export default function BharatHubView({ onToast }) {
  const [activeTab, setActiveTab] = useState('pincode'); // pincode | ifsc | mandi | isro | holidays | bhashini
  
  // Pincode state
  const [pincodeQuery, setPincodeQuery] = useState('110001');
  const [pincodeData, setPincodeData] = useState(null);
  const [loadingPincode, setLoadingPincode] = useState(false);

  // IFSC state
  const [ifscQuery, setIfscQuery] = useState('SBIN0000001');
  const [ifscData, setIfscData] = useState(null);
  const [loadingIfsc, setLoadingIfsc] = useState(false);

  // Mandi Bhav state
  const [mandiQuery, setMandiQuery] = useState('');
  const [mandiData, setMandiData] = useState(null);
  const [loadingMandi, setLoadingMandi] = useState(false);

  // ISRO state
  const [isroData, setIsroData] = useState(null);

  // Holidays state
  const [holidaysData, setHolidaysData] = useState(null);

  // Bhashini / Indic Translation state
  const [inputText, setInputText] = useState('Welcome');
  const [targetLang, setTargetLang] = useState('hi');
  const [translationResult, setTranslationResult] = useState(null);
  const [translating, setTranslating] = useState(false);

  // Aadhaar state
  const [aadhaarQuery, setAadhaarQuery] = useState('');
  const [aadhaarData, setAadhaarData] = useState(null);
  const [loadingAadhaar, setLoadingAadhaar] = useState(false);

  // GST state
  const [gstinQuery, setGstinQuery] = useState('');
  const [gstinData, setGstinData] = useState(null);
  const [loadingGstin, setLoadingGstin] = useState(false);

  // UPI state
  const [upiVpa, setUpiVpa] = useState('');
  const [upiName, setUpiName] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [upiData, setUpiData] = useState(null);
  const [loadingUpi, setLoadingUpi] = useState(false);

  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (onToast) onToast('Copied to clipboard!', 'success');
      setTimeout(() => setCopiedKey(null), 1500);
    } catch (_) {}
  };

  // Fetch Pincode
  const handleSearchPincode = async (code = pincodeQuery) => {
    if (!code || !code.trim()) return;
    setLoadingPincode(true);
    try {
      const res = await api.get(`/bharat/pincode/${code.trim()}`);
      setPincodeData(res.data);
    } catch (err) {
      if (onToast) onToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoadingPincode(false);
    }
  };

  // Fetch IFSC
  const handleSearchIfsc = async (code = ifscQuery) => {
    if (!code || !code.trim()) return;
    setLoadingIfsc(true);
    try {
      const res = await api.get(`/bharat/ifsc/${code.trim()}`);
      setIfscData(res.data);
    } catch (err) {
      if (onToast) onToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoadingIfsc(false);
    }
  };

  // Fetch Mandi Bhav
  const handleSearchMandi = async (q = mandiQuery) => {
    setLoadingMandi(true);
    try {
      const res = await api.get(`/bharat/mandi?commodity=${encodeURIComponent(q || '')}`);
      setMandiData(res.data);
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    } finally {
      setLoadingMandi(false);
    }
  };

  // Fetch ISRO, Holidays, & default data on mount
  useEffect(() => {
    (async () => {
      try {
        const [isroRes, holRes, pinRes, ifscRes, mandiRes] = await Promise.allSettled([
          api.get('/bharat/isro'),
          api.get('/bharat/holidays?year=2026'),
          api.get('/bharat/pincode/110001'),
          api.get('/bharat/ifsc/SBIN0000001'),
          api.get('/bharat/mandi?commodity='),
        ]);
        if (isroRes.status === 'fulfilled') setIsroData(isroRes.value.data);
        if (holRes.status === 'fulfilled') setHolidaysData(holRes.value.data);
        if (pinRes.status === 'fulfilled') setPincodeData(pinRes.value.data);
        if (ifscRes.status === 'fulfilled') setIfscData(ifscRes.value.data);
        if (mandiRes.status === 'fulfilled') setMandiData(mandiRes.value.data);
      } catch (_) {}
    })();
  }, []);

  // Translate Indic
  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setTranslating(true);
    try {
      const res = await api.post('/bharat/translate', { text: inputText, targetLang });
      setTranslationResult(res.data);
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    } finally {
      setTranslating(false);
    }
  };

  // Fetch Aadhaar
  const handleVerifyAadhaar = async () => {
    if (!aadhaarQuery.trim()) return;
    setLoadingAadhaar(true);
    try {
      const res = await api.post('/bharat/aadhaar', { aadhaar: aadhaarQuery });
      setAadhaarData(res.data);
    } catch (err) {
      if (onToast) onToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoadingAadhaar(false);
    }
  };

  // Fetch GSTIN
  const handleVerifyGstin = async () => {
    if (!gstinQuery.trim()) return;
    setLoadingGstin(true);
    try {
      const res = await api.post('/bharat/gstin', { gstin: gstinQuery });
      setGstinData(res.data);
    } catch (err) {
      if (onToast) onToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoadingGstin(false);
    }
  };

  // Generate UPI
  const handleGenerateUpi = async () => {
    if (!upiVpa.trim()) return;
    setLoadingUpi(true);
    try {
      const res = await api.post('/bharat/upi', { vpa: upiVpa, name: upiName, amount: upiAmount });
      setUpiData(res.data);
    } catch (err) {
      if (onToast) onToast(err.response?.data?.message || err.message, 'error');
    } finally {
      setLoadingUpi(false);
    }
  };

  const TABS = [
    { id: 'pincode', label: 'India Post Pincode', icon: MapPin },
    { id: 'ifsc', label: 'IFSC & Bank Gateway', icon: Landmark },
    { id: 'mandi', label: 'Mandi Bhav (Agmarknet)', icon: Wheat },
    { id: 'isro', label: 'ISRO & Bhuvan Web GIS', icon: Rocket },
    { id: 'holidays', label: 'National Holidays', icon: Calendar },
    { id: 'bhashini', label: 'Bhashini Indic Languages', icon: Globe },
    { id: 'aadhaar', label: 'Aadhaar Verification', icon: Fingerprint },
    { id: 'gstin', label: 'GSTIN Lookup', icon: Receipt },
    { id: 'upi', label: 'UPI Deep Link Gen', icon: QrCode },
  ];

  return (
    <div className="h-full flex flex-col bg-canvas-base text-paper-100 overflow-hidden font-sans">
      {/* ── Top Header Strip ────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 px-4 sm:px-6 bg-canvas-surface border-b border-border flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 via-white/80 to-orange-500 p-0.5 flex items-center justify-center shadow-glow-sm">
            <div className="w-full h-full bg-canvas-base rounded-[6px] flex items-center justify-center text-orange-400">
              <Building2 size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-paper-100 font-display">Bharat Open Digital Infrastructure Hub</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                100% Free Made in India APIs
              </span>
            </div>
            <p className="text-[11px] text-ink-muted hidden sm:block">
              Direct access to India Post, Razorpay Banking IFSC, eNAM Mandi rates, ISRO Bhuvan & Bhashini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <ShieldCheck size={14} />
          <span>Zero API Keys Required</span>
        </div>
      </header>

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 bg-canvas-subtle border-b border-border flex items-center gap-1 overflow-x-auto no-scrollbar py-1 shrink-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-fast cursor-pointer ${
                isActive 
                  ? 'bg-canvas-elevated text-paper-100 border border-border shadow-xs' 
                  : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface/60'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-orange-400' : 'text-ink-muted'} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Main Tab Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* 1. India Post Pincode Lookup */}
        {activeTab === 'pincode' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-canvas-surface border border-border flex flex-col sm:flex-row items-center gap-3 shadow-xs">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pincodeQuery}
                  onChange={(e) => setPincodeQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPincode()}
                  placeholder="Enter 6-digit Indian Pincode (e.g. 110001, 800001, 400001, 560001)..."
                  className="w-full bg-canvas-base border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-paper-100 placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearchPincode()}
                disabled={loadingPincode}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs shrink-0"
              >
                {loadingPincode ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                <span>Find Post Offices</span>
              </button>
            </div>

            {/* Pincode Results */}
            {pincodeData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-ink-muted font-mono">
                  <span>Pincode: {pincodeData.pincode} ({pincodeData.totalPostOffices} offices found)</span>
                  <span className="text-emerald-400">Data Source: India Post Open Directory</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pincodeData.postOffices?.map((po, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-canvas-surface border border-border hover:border-accent/40 transition-all shadow-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-paper-100">{po.Name}</h4>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {po.BranchType}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-muted space-y-1 font-mono">
                        <div>District: <span className="text-paper-200">{po.District}</span></div>
                        <div>State: <span className="text-paper-200">{po.State}</span></div>
                        <div>Division: <span className="text-paper-200">{po.Division}</span></div>
                        <div>Status: <span className="text-emerald-400">{po.DeliveryStatus || 'Delivery'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. IFSC & Indian Bank Branch Gateway */}
        {activeTab === 'ifsc' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-canvas-surface border border-border flex flex-col sm:flex-row items-center gap-3 shadow-xs">
              <div className="relative flex-1 w-full">
                <Landmark className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ifscQuery}
                  onChange={(e) => setIfscQuery(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchIfsc()}
                  placeholder="Enter 11-character Indian IFSC code (e.g. SBIN0000001, HDFC0000001, PUNB0000100)..."
                  className="w-full bg-canvas-base border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-paper-100 placeholder-ink-muted focus:outline-none focus:border-accent font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearchIfsc()}
                disabled={loadingIfsc}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs shrink-0"
              >
                {loadingIfsc ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                <span>Verify Bank IFSC</span>
              </button>
            </div>

            {/* IFSC Details Card */}
            {ifscData && (
              <div className="p-6 rounded-2xl bg-canvas-surface border border-border space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                  <div>
                    <h3 className="text-base font-bold text-paper-100">{ifscData.bank}</h3>
                    <p className="text-xs text-ink-muted">Branch: {ifscData.branch} | City: {ifscData.city}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      {ifscData.ifsc}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(ifscData.ifsc, 'ifsc')}
                      className="p-1 rounded bg-canvas-elevated hover:bg-canvas-subtle border border-border text-ink-muted hover:text-paper-100 cursor-pointer"
                      title="Copy IFSC"
                    >
                      {copiedKey === 'ifsc' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-canvas-base border border-border">
                    <span className="text-[10px] text-ink-muted uppercase font-mono">Branch Address</span>
                    <p className="mt-1 font-medium text-paper-200">{ifscData.address || 'Standard Headquarters'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-canvas-base border border-border">
                    <span className="text-[10px] text-ink-muted uppercase font-mono">State & District</span>
                    <p className="mt-1 font-medium text-paper-200">{ifscData.district}, {ifscData.state}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-canvas-base border border-border">
                    <span className="text-[10px] text-ink-muted uppercase font-mono">MICR Code</span>
                    <p className="mt-1 font-medium text-paper-200">{ifscData.micr || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-xs text-ink-muted font-mono">Payment Rails:</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${ifscData.upi ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                    UPI Enabled: {ifscData.upi ? 'Yes' : 'No'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    IMPS 24x7
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    NEFT / RTGS
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Mandi Bhav & Farmer Rates */}
        {activeTab === 'mandi' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-canvas-surface border border-border flex flex-col sm:flex-row items-center gap-3 shadow-xs">
              <div className="relative flex-1 w-full">
                <Wheat className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={mandiQuery}
                  onChange={(e) => setMandiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMandi()}
                  placeholder="Filter crop or commodity (e.g. Wheat, Mustard, Onion, Potato, Cotton)..."
                  className="w-full bg-canvas-base border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-paper-100 placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearchMandi()}
                disabled={loadingMandi}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs shrink-0"
              >
                {loadingMandi ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                <span>Fetch Mandi Rates</span>
              </button>
            </div>

            {mandiData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mandiData.commodities?.map((c, i) => (
                  <div key={i} className="p-4 rounded-xl bg-canvas-surface border border-border hover:border-emerald-500/40 transition-all space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-paper-100">{c.name}</h4>
                        <span className="text-[11px] text-ink-muted">{c.market} ({c.state})</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400 font-mono">
                        {c.modalPrice}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-border text-ink-muted">
                      <span>Variety: {c.variety}</span>
                      <span>Range: {c.minPrice} - {c.maxPrice}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. ISRO Space & Bhuvan Geo-Portal */}
        {activeTab === 'isro' && isroData && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-zinc-950 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono">
                  {isroData.agency}
                </span>
                <a
                  href={isroData.bhuvanGeoPortal}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <span>Launch Bhuvan 3D GIS</span>
                  <ExternalLink size={12} />
                </a>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl">
                India&apos;s indigenous space research missions and real-time open geospatial Earth observation data portals powered by ISRO & NRSC.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {isroData.notableMissions?.map((m, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-canvas-surface border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-paper-100 font-display">{m.name}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                      {m.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    {m.objective}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. National Holidays */}
        {activeTab === 'holidays' && holidaysData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-ink-muted font-mono">
              <span>Gazetted Calendar: {holidaysData.country} ({holidaysData.year})</span>
              <span>{holidaysData.totalHolidays} Major Public Holidays</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {holidaysData.holidays?.map((h, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-canvas-surface border border-border flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-paper-100">{h.name}</h4>
                    <span className="text-[10px] text-ink-muted font-mono">{h.type}</span>
                  </div>
                  <div className="text-right font-mono text-xs text-orange-400 font-semibold">
                    <div>{h.date}</div>
                    <div className="text-[10px] text-ink-muted font-normal">{h.day}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Bhashini Indic Languages */}
        {activeTab === 'bhashini' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="p-5 rounded-2xl bg-canvas-surface border border-border space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-paper-200">Text to Translate</label>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full bg-canvas-base border border-border rounded-xl px-3 py-2 text-xs text-paper-100 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-paper-200">Target Indian Language</label>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full bg-canvas-base border border-border rounded-xl px-3 py-2 text-xs text-paper-100 focus:outline-none focus:border-accent"
                  >
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="bho">Bhojpuri (भोजपुरी)</option>
                    <option value="bn">Bengali (বাংলা)</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="ta">Tamil (தமிழ்)</option>
                    <option value="mr">Marathi (मराठी)</option>
                    <option value="gu">Gujarati (ગુજરાતી)</option>
                    <option value="kn">Kannada (ಕನ್ನಡ)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating}
                  className="self-end px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-glow-sm"
                >
                  {translating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>Translate</span>
                </button>
              </div>
            </div>

            {translationResult && (
              <div className="p-5 rounded-2xl bg-canvas-surface border border-accent/40 space-y-2">
                <span className="text-[10px] font-mono text-accent font-bold uppercase">Translation Output</span>
                <div className="text-xl font-bold text-paper-100">
                  {translationResult.translated}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. Aadhaar Verification */}
        {activeTab === 'aadhaar' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="p-5 rounded-2xl bg-canvas-surface border border-border flex flex-col items-center gap-3 shadow-xs">
              <div className="relative w-full">
                <Fingerprint className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={aadhaarQuery}
                  onChange={(e) => setAadhaarQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyAadhaar()}
                  placeholder="Enter 12-digit Aadhaar Number..."
                  className="w-full bg-canvas-base border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-paper-100 placeholder-ink-muted focus:outline-none focus:border-accent font-mono tracking-widest"
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyAadhaar}
                disabled={loadingAadhaar}
                className="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                {loadingAadhaar ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                <span>Verify Aadhaar Format</span>
              </button>
            </div>

            {aadhaarData && (
              <div className={`p-5 rounded-2xl border ${aadhaarData.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center gap-2">
                  {aadhaarData.status === 'success' ? <CheckCircle2 className="text-emerald-400" size={20} /> : <X className="text-red-400" size={20} />}
                  <span className={`font-bold ${aadhaarData.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {aadhaarData.message}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. GSTIN Verification */}
        {activeTab === 'gstin' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="p-5 rounded-2xl bg-canvas-surface border border-border flex flex-col items-center gap-3 shadow-xs">
              <div className="relative w-full">
                <Receipt className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={gstinQuery}
                  onChange={(e) => setGstinQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyGstin()}
                  placeholder="Enter 15-character GSTIN..."
                  className="w-full bg-canvas-base border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-paper-100 placeholder-ink-muted focus:outline-none focus:border-accent font-mono uppercase"
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyGstin}
                disabled={loadingGstin}
                className="w-full px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                {loadingGstin ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                <span>Validate GSTIN Format</span>
              </button>
            </div>

            {gstinData && (
              <div className={`p-5 rounded-2xl border ${gstinData.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {gstinData.status === 'success' ? <CheckCircle2 className="text-emerald-400" size={20} /> : <X className="text-red-400" size={20} />}
                  <span className={`font-bold ${gstinData.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {gstinData.message}
                  </span>
                </div>
                {gstinData.status === 'success' && (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-ink-muted block mb-1">State Code</span>
                      <span className="font-mono text-paper-100 bg-canvas-base px-2 py-1 rounded">{gstinData.stateCode}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block mb-1">PAN Number</span>
                      <span className="font-mono text-paper-100 bg-canvas-base px-2 py-1 rounded">{gstinData.pan}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 9. UPI Link Generator */}
        {activeTab === 'upi' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="p-5 rounded-2xl bg-canvas-surface border border-border space-y-4 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-paper-200">UPI ID (VPA) *</label>
                  <input type="text" value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="e.g. john@ybl" className="w-full bg-canvas-base border border-border rounded-xl px-3 py-2 text-xs text-paper-100 focus:outline-none focus:border-accent font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-paper-200">Payee Name</label>
                  <input type="text" value={upiName} onChange={(e) => setUpiName(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-canvas-base border border-border rounded-xl px-3 py-2 text-xs text-paper-100 focus:outline-none focus:border-accent" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-paper-200">Amount (₹)</label>
                  <input type="number" value={upiAmount} onChange={(e) => setUpiAmount(e.target.value)} placeholder="Optional" className="w-full bg-canvas-base border border-border rounded-xl px-3 py-2 text-xs text-paper-100 focus:outline-none focus:border-accent" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateUpi}
                disabled={loadingUpi}
                className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                {loadingUpi ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />}
                <span>Generate Deep Link</span>
              </button>
            </div>

            {upiData && upiData.status === 'success' && (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Generated intent:// URI</span>
                <div className="flex items-center justify-between gap-3 bg-canvas-base p-3 rounded-xl border border-emerald-500/20">
                  <span className="font-mono text-xs text-paper-100 break-all">{upiData.url}</span>
                  <button onClick={() => copyToClipboard(upiData.url, 'upi')} className="shrink-0 p-1.5 rounded bg-canvas-surface hover:bg-canvas-elevated border border-border text-ink-muted hover:text-emerald-400">
                    {copiedKey === 'upi' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-ink-muted">Embed this link in an anchor tag <code>&lt;a href=&quot;...&quot;&gt;</code> or generate a QR code to launch any installed UPI app directly.</p>
              </div>
            )}
            {upiData && upiData.status === 'invalid' && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-bold">{upiData.message}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
