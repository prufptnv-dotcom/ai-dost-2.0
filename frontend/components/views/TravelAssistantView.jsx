import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Compass, Hotel, UtensilsCrossed, Map, Route, Mountain,
  CalendarCheck, BarChart3, Backpack, Sparkles, Copy, Check,
  ArrowRight, DollarSign, Clock, Users
} from 'lucide-react';
import axios from 'axios';

const DOMAINS = [
  { id: 'restaurant-search', name: 'Restaurant Finder', icon: '🍽️', desc: 'Cuisine, rating, budget & dietary filters' },
  { id: 'hotel-search', name: 'Hotel Search', icon: '🏨', desc: 'Star rating, amenities & price comparison' },
  { id: 'nearby-places', name: 'Nearby Places', icon: '📍', desc: 'POIs, ATMs, hospitals, parks within radius' },
  { id: 'travel-itinerary', name: 'Travel Itinerary', icon: '🗓️', desc: 'Day-by-day plan with timing & meals' },
  { id: 'route-planning', name: 'Route Planning', icon: '🛣️', desc: 'Multi-city optimal route & transport' },
  { id: 'tourist-attractions', name: 'Tourist Attractions', icon: '🏛️', desc: 'Heritage, nature & adventure spots' },
  { id: 'restaurant-reservation', name: 'Reservation Check', icon: '📞', desc: 'Availability, platforms & booking tips' },
  { id: 'city-comparison', name: 'City Comparison', icon: '⚖️', desc: 'Cost, climate, safety & connectivity' },
  { id: 'budget-trip-plan', name: 'Budget Trip Plan', icon: '💰', desc: 'Total cost breakdown with 3 tiers' },
  { id: 'packing-checklist', name: 'Packing Checklist', icon: '🎒', desc: 'Weather-adaptive smart packing list' },
];

const BUDGET_TIERS = ['Budget', 'Mid-Range', 'Premium'];

export default function TravelAssistantView({ onToast }) {
  const [selectedDomain, setSelectedDomain] = useState('travel-itinerary');
  const [destination, setDestination] = useState('');
  const [dates, setDates] = useState('');
  const [budget, setBudget] = useState('Mid-Range');
  const [travelers, setTravelers] = useState(2);
  const [interests, setInterests] = useState('');
  const [constraints, setConstraints] = useState('');
  const [language, setLanguage] = useState('en');

  const [loading, setLoading] = useState(false);
  const [resultOutput, setResultOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (!destination.trim()) {
      onToast?.('Please enter a destination or location', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/travel/generate', {
        domain: selectedDomain,
        destination,
        dates,
        budget,
        travelers: Number(travelers),
        interests,
        constraints,
        language
      });

      if (res.data?.success) {
        setResultOutput(res.data.result);
        onToast?.(`${DOMAINS.find(d => d.id === selectedDomain)?.name || 'Travel'} result ready!`, 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickBudget = async () => {
    if (!destination.trim()) {
      onToast?.('Enter a destination first', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/api/travel/budget-calculator', {
        destination,
        days: parseInt(dates) || 3,
        travelers: Number(travelers),
        budget
      });
      if (res.data?.success) {
        setResultOutput(res.data.budget);
        onToast?.('Budget breakdown generated!', 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPacking = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/travel/packing-checklist', {
        destination: destination || 'General Trip',
        days: parseInt(dates) || 5,
        season: 'Summer',
        activities: interests ? interests.split(',').map(a => a.trim()) : []
      });
      if (res.data?.success) {
        setResultOutput(res.data.checklist);
        onToast?.('Smart packing checklist created!', 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (resultOutput) {
      navigator.clipboard.writeText(resultOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast?.('Copied to clipboard!', 'success');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas-base">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-canvas-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-txt-primary">Travel & Local Business</h1>
            <p className="text-[11px] text-txt-muted">Restaurants, Hotels, Itineraries, Budget Plans & More</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickBudget}
            disabled={loading || !destination.trim()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all disabled:opacity-40 cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Quick Budget
          </button>
          <button
            type="button"
            onClick={handleQuickPacking}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Backpack className="w-3.5 h-3.5" />
            Packing List
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Domain Selector & Form */}
        <div className="w-[340px] min-w-[300px] border-r border-border flex flex-col overflow-y-auto bg-canvas-subtle/50">
          {/* Domain Grid */}
          <div className="p-3">
            <label className="text-[11px] font-mono uppercase tracking-wider text-txt-muted mb-2 block">
              Travel Domain
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {DOMAINS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDomain(d.id)}
                  className={`text-left p-2 rounded-md border transition-all cursor-pointer ${
                    selectedDomain === d.id
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-txt-primary shadow-xs'
                      : 'bg-canvas-surface border-border-subtle text-txt-secondary hover:border-border hover:bg-canvas-surface/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{d.icon}</span>
                    <span className="text-[11px] font-medium truncate">{d.name}</span>
                  </div>
                  <span className="text-[10px] text-txt-muted leading-tight line-clamp-1">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleGenerate} className="flex-1 p-3 space-y-3 border-t border-border-subtle">
            {/* Destination */}
            <div>
              <label className="text-[11px] font-medium text-txt-secondary mb-1 block">
                <MapPin className="w-3 h-3 inline mr-1" />Destination / Location *
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Jaipur, Goa, Manali, Paris..."
                className="w-full px-2.5 py-1.5 rounded-md bg-canvas-base border border-border text-xs text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            {/* Dates / Duration */}
            <div>
              <label className="text-[11px] font-medium text-txt-secondary mb-1 block">
                <Clock className="w-3 h-3 inline mr-1" />Dates / Duration
              </label>
              <input
                type="text"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                placeholder="e.g. 5 days, Dec 20-25, 1 week..."
                className="w-full px-2.5 py-1.5 rounded-md bg-canvas-base border border-border text-xs text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            {/* Budget & Travelers */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-txt-secondary mb-1 block">
                  <DollarSign className="w-3 h-3 inline mr-1" />Budget
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md bg-canvas-base border border-border text-xs text-txt-primary focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                >
                  {BUDGET_TIERS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-txt-secondary mb-1 block">
                  <Users className="w-3 h-3 inline mr-1" />Travelers
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md bg-canvas-base border border-border text-xs text-txt-primary focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Interests */}
            <div>
              <label className="text-[11px] font-medium text-txt-secondary mb-1 block">
                <Mountain className="w-3 h-3 inline mr-1" />Interests & Preferences
              </label>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g. Heritage, Trekking, Street Food, Photography..."
                className="w-full px-2.5 py-1.5 rounded-md bg-canvas-base border border-border text-xs text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            {/* Constraints */}
            <div>
              <label className="text-[11px] font-medium text-txt-secondary mb-1 block">
                Constraints / Dietary / Accessibility
              </label>
              <input
                type="text"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g. Vegetarian only, Wheelchair accessible..."
                className="w-full px-2.5 py-1.5 rounded-md bg-canvas-base border border-border text-xs text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>

            {/* Language */}
            <div>
              <label className="text-[11px] font-medium text-txt-secondary mb-1 block">Language</label>
              <div className="flex gap-1.5">
                {[
                  { val: 'en', label: 'English' },
                  { val: 'hi', label: 'Hindi' },
                  { val: 'hinglish', label: 'Hinglish' }
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setLanguage(val)}
                    className={`flex-1 py-1 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                      language === val
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-canvas-surface border-border-subtle text-txt-muted hover:border-border'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !destination.trim()}
              className="w-full py-2 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-sm disabled:opacity-40 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate {DOMAINS.find(d => d.id === selectedDomain)?.name || 'Result'}
                  <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Panel — Output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {resultOutput ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-canvas-subtle/50">
                <span className="text-[11px] font-mono text-txt-muted">
                  {DOMAINS.find(d => d.id === selectedDomain)?.icon} {DOMAINS.find(d => d.id === selectedDomain)?.name} — {destination}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-canvas-surface border border-border text-txt-secondary hover:text-txt-primary transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Result Content */}
              <div className="flex-1 overflow-y-auto p-5">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="prose prose-sm max-w-none text-txt-primary whitespace-pre-wrap font-mono text-xs leading-relaxed"
                >
                  {resultOutput}
                </motion.div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                  <Compass className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-txt-primary mb-1">Travel Intelligence Engine</h3>
                <p className="text-xs text-txt-muted mb-4 leading-relaxed">
                  Select a domain, enter your destination, and let AI-Dost generate comprehensive
                  travel plans, restaurant recommendations, budget breakdowns, and smart packing lists.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '🗺️', text: 'Day-by-day itineraries' },
                    { icon: '💰', text: 'Budget breakdowns (3 tiers)' },
                    { icon: '🍽️', text: 'Restaurant discovery' },
                    { icon: '🎒', text: 'Weather-smart packing' },
                  ].map((f) => (
                    <div key={f.text} className="flex items-center gap-1.5 p-2 rounded-md bg-canvas-surface border border-border-subtle text-[11px] text-txt-secondary">
                      <span>{f.icon}</span> {f.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
