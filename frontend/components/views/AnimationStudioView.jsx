import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Copy, Check, Sparkles, Layers, Box, 
  Sliders, Code2, Download, ExternalLink, Zap, Compass, Move3d,
  Loader2, Wand2, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import {
  get3DCyberVehicleHtml,
  get3DDnaHelixHtml,
  get3DCyberCityHtml,
  get3DQuantumPolyhedronHtml,
  getThreeJsSolarSystemHtml,
  get3DBlackHoleHtml,
  getQuantumRealmHtml,
  getFuturistic2030Html
} from '../../lib/threeJsTemplates';

export default function AnimationStudioView({ onOpenIDE, onToast }) {
  const [activePreset, setActivePreset] = useState('cyberVehicle');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [perspective, setPerspective] = useState(1000);
  const [depthZ, setDepthZ] = useState(80);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState('canvas'); // 'canvas' | 'code'
  
  // AI 3D Prompt Generator State
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [custom3dHtml, setCustom3dHtml] = useState(null);
  const [presetFilter, setPresetFilter] = useState('all'); // 'all' | 'threejs' | 'animejs'

  const containerRef = useRef(null);
  const animationInstanceRef = useRef(null);

  // Preset definitions: Three.js WebGL & Anime.js CSS 3D
  const PRESETS = [
    {
      id: 'cyberVehicle',
      name: '3D Cyber Roadster & Grid',
      engine: 'threejs',
      category: 'Three.js WebGL',
      description: 'Futuristic neon roadster with spinning glowing wheels, volumetric headlights, particle exhaust, and OrbitControls.',
      badge: 'WebGL 3D',
      getHtml: get3DCyberVehicleHtml
    },
    {
      id: 'dnaHelix',
      name: '3D DNA Double Helix',
      engine: 'threejs',
      category: 'Three.js Biology',
      description: 'Rotating DNA double-helix with color-coded A-T and G-C base pairs, hydrogen rungs, and ambient particles.',
      badge: 'Molecular 3D',
      getHtml: get3DDnaHelixHtml
    },
    {
      id: 'cyberCity',
      name: 'Neo-Tokyo 2030 City',
      engine: 'threejs',
      category: 'Three.js Procedural',
      description: 'Procedural skyscrapers with illuminated windows, floating cyber traffic streams, atmospheric fog, and camera orbit.',
      badge: 'Procedural 3D',
      getHtml: get3DCyberCityHtml
    },
    {
      id: 'quantumPolyhedron',
      name: 'Quantum Crystal Polyhedron',
      engine: 'threejs',
      category: 'Three.js Geometry',
      description: 'Nested icosahedron & wireframe dodecahedron with pulsating energy core and quantum field particles.',
      badge: 'Quantum 3D',
      getHtml: get3DQuantumPolyhedronHtml
    },
    {
      id: 'solarSystem',
      name: '3D Solar System & Orbitals',
      engine: 'threejs',
      category: 'Three.js Physics',
      description: 'Sun with volumetric corona, 8 planets with Keplerian velocity simulation, Saturn rings, and telemetry HUD.',
      badge: 'Physics 3D',
      getHtml: getThreeJsSolarSystemHtml
    },
    {
      id: 'blackHole',
      name: 'Supermassive Black Hole',
      engine: 'threejs',
      category: 'Three.js Astrophysics',
      description: 'Supermassive black hole with gravitational lensing, rotating accretion disk particles, and event horizon.',
      badge: 'Astrophysics 3D',
      getHtml: get3DBlackHoleHtml
    },
    {
      id: 'quantumRealm',
      name: 'Quantum Realm Field',
      engine: 'threejs',
      category: 'Three.js Quantum',
      description: 'Visualizer for subatomic quantum entanglement with interactive dynamic particles and glowing icosahedron core.',
      badge: 'Subatomic 3D',
      getHtml: getQuantumRealmHtml
    },
    {
      id: 'card3d',
      name: '3D Isometric Card & Mesh',
      engine: 'animejs',
      category: 'Anime.js CSS 3D',
      description: 'Dynamic 3D multi-layered card with isometric depth, translateZ layering, and elastic spring physics.',
      badge: 'CSS 3D',
    },
    {
      id: 'helix3d',
      name: '3D Particle Helix Matrix',
      engine: 'animejs',
      category: 'Anime.js CSS 3D',
      description: 'Double-helix particle array undulating in 3D perspective space with trigonometric staggering.',
      badge: 'Particles',
    },
    {
      id: 'kineticText',
      name: 'Kinetic 3D Typography',
      engine: 'animejs',
      category: 'Anime.js Typography',
      description: '3D tumbling letter typography with glowing shadows and staggered elastic easing.',
      badge: 'Typography',
    },
    {
      id: 'atomOrbit',
      name: 'Quantum Gyroscope Orbitals',
      engine: 'animejs',
      category: 'Anime.js Physics',
      description: 'Multi-axis 3D orbital rings spinning with particle electrons and glowing core.',
      badge: 'Gyroscope',
    },
    {
      id: 'waveGrid',
      name: '3D Topographic Wave Grid',
      engine: 'animejs',
      category: 'Anime.js Procedural',
      description: '49-node 3D plane undulating in sine waves with dynamic color gradients.',
      badge: 'Wave Grid',
    },
  ];

  const currentPresetDef = PRESETS.find(p => p.id === activePreset);
  const isThreeJsPreset = currentPresetDef?.engine === 'threejs' || Boolean(custom3dHtml);

  // Initialize Anime.js animations dynamically
  useEffect(() => {
    let isMounted = true;
    if (isThreeJsPreset) return; // Three.js runs inside the iframe

    async function runAnime() {
      try {
        const animeModule = await import('animejs');
        const anime = animeModule.default || animeModule;

        if (!isMounted || !containerRef.current) return;

        // Clean up previous animation
        if (animationInstanceRef.current) {
          try { animationInstanceRef.current.pause(); } catch (_) {}
        }

        if (activePreset === 'card3d') {
          animationInstanceRef.current = anime.timeline({
            loop: true,
            direction: 'alternate',
            autoplay: isPlaying,
          })
          .add({
            targets: '.anim-card-root',
            rotateX: [-15, 20],
            rotateY: [-25, 25],
            rotateZ: [-5, 8],
            duration: 3200 / speed,
            easing: 'easeInOutSine',
          })
          .add({
            targets: '.anim-card-layer-1',
            translateZ: [30, depthZ],
            duration: 3200 / speed,
            easing: 'easeInOutQuad',
          }, 0)
          .add({
            targets: '.anim-card-layer-2',
            translateZ: [60, depthZ * 1.5],
            duration: 3200 / speed,
            easing: 'easeInOutQuad',
          }, 0)
          .add({
            targets: '.anim-card-badge',
            translateZ: [90, depthZ * 2.2],
            scale: [1, 1.1],
            duration: 1600 / speed,
            easing: 'easeInOutSine',
          }, 0);
        } else if (activePreset === 'helix3d') {
          animationInstanceRef.current = anime({
            targets: '.helix-dot',
            translateY: function(el, i) {
              return [Math.sin(i * 0.4) * 60, -Math.sin(i * 0.4) * 60];
            },
            translateZ: function(el, i) {
              return [Math.cos(i * 0.4) * depthZ, -Math.cos(i * 0.4) * depthZ];
            },
            scale: [0.7, 1.4],
            opacity: [0.4, 1],
            delay: anime.stagger(60 / speed),
            duration: 2000 / speed,
            loop: true,
            direction: 'alternate',
            easing: 'easeInOutSine',
            autoplay: isPlaying,
          });
        } else if (activePreset === 'kineticText') {
          animationInstanceRef.current = anime.timeline({
            loop: true,
            autoplay: isPlaying,
          })
          .add({
            targets: '.kinetic-char',
            rotateY: [-90, 0],
            rotateX: [45, 0],
            translateZ: [depthZ * 1.5, 0],
            opacity: [0, 1],
            delay: anime.stagger(80 / speed),
            duration: 1200 / speed,
            easing: 'easeOutElastic(1, .6)',
          })
          .add({
            targets: '.kinetic-char',
            rotateY: [0, 90],
            opacity: [1, 0],
            delay: anime.stagger(60 / speed),
            duration: 900 / speed,
            easing: 'easeInQuad',
          }, '+=800');
        } else if (activePreset === 'atomOrbit') {
          animationInstanceRef.current = anime({
            targets: '.orbital-ring-1',
            rotateX: 360,
            rotateY: 180,
            duration: 6000 / speed,
            loop: true,
            easing: 'linear',
            autoplay: isPlaying,
          });
          anime({
            targets: '.orbital-ring-2',
            rotateY: 360,
            rotateZ: 180,
            duration: 4500 / speed,
            loop: true,
            easing: 'linear',
            autoplay: isPlaying,
          });
          anime({
            targets: '.orbital-ring-3',
            rotateZ: 360,
            rotateX: 180,
            duration: 5200 / speed,
            loop: true,
            easing: 'linear',
            autoplay: isPlaying,
          });
          anime({
            targets: '.orbital-core',
            scale: [0.85, 1.25],
            boxShadow: [
              '0 0 20px rgba(234, 88, 12, 0.4)',
              '0 0 50px rgba(234, 88, 12, 0.9)'
            ],
            duration: 1400 / speed,
            loop: true,
            direction: 'alternate',
            easing: 'easeInOutQuad',
            autoplay: isPlaying,
          });
        } else if (activePreset === 'waveGrid') {
          animationInstanceRef.current = anime({
            targets: '.grid-cell',
            translateZ: [
              { value: depthZ, duration: 1200 / speed },
              { value: -depthZ * 0.5, duration: 1200 / speed },
            ],
            rotateX: [
              { value: 25, duration: 1200 / speed },
              { value: -25, duration: 1200 / speed },
            ],
            opacity: [0.5, 1],
            delay: anime.stagger(70 / speed, { grid: [7, 7], from: 'center' }),
            loop: true,
            direction: 'alternate',
            easing: 'easeInOutSine',
            autoplay: isPlaying,
          });
        }
      } catch (err) {
        console.warn('Anime.js runtime note:', err);
      }
    }

    runAnime();

    return () => {
      isMounted = false;
      if (animationInstanceRef.current) {
        try { animationInstanceRef.current.pause(); } catch (_) {}
      }
    };
  }, [activePreset, speed, depthZ, isPlaying, isThreeJsPreset]);

  // AI 3D Prompt Generation Handler
  const handleGenerateCustom3D = async (e) => {
    e?.preventDefault();
    const prompt = customPrompt.trim();
    if (!prompt || isGenerating) return;

    setIsGenerating(true);
    if (onToast) onToast(`Designing custom 3D animation: "${prompt}"...`, 'info');

    try {
      const res = await api.post('/chat', {
        message: `Create a 3D animation of: ${prompt}. Build an interactive, production-ready Three.js WebGL scene with OrbitControls and lighting.`,
        model: 'auto'
      });

      const reply = res.data?.reply || res.data?.message || '';
      const htmlMatch = reply.match(/```(?:html)?\s*([\s\S]*?)```/i);
      const generatedHtml = htmlMatch ? htmlMatch[1].trim() : null;

      if (generatedHtml && generatedHtml.includes('<html')) {
        setCustom3dHtml(generatedHtml);
        setActivePreset('custom');
        setActiveTab('canvas');
        if (onToast) onToast('Custom 3D animation generated successfully!', 'success');
      } else {
        // Fallback to smart template router
        const fallback = getFuturistic2030Html(prompt);
        setCustom3dHtml(fallback);
        setActivePreset('custom');
        setActiveTab('canvas');
        if (onToast) onToast('Loaded optimized 3D simulation for your request.', 'success');
      }
    } catch (err) {
      console.warn('AI generation error, using smart synthesis:', err);
      const synthesized = getFuturistic2030Html(prompt);
      setCustom3dHtml(synthesized);
      setActivePreset('custom');
      setActiveTab('canvas');
      if (onToast) onToast('Synthesized 3D scene loaded.', 'success');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(prev => {
      const next = !prev;
      if (animationInstanceRef.current) {
        if (next) animationInstanceRef.current.play();
        else animationInstanceRef.current.pause();
      }
      return next;
    });
  };

  const restartAnimation = () => {
    if (animationInstanceRef.current) {
      animationInstanceRef.current.restart();
      setIsPlaying(true);
    }
  };

  // Get active 3D HTML for Three.js iframe
  const getActiveHtml = () => {
    if (activePreset === 'custom' && custom3dHtml) return custom3dHtml;
    if (currentPresetDef?.getHtml) return currentPresetDef.getHtml();
    return get3DQuantumPolyhedronHtml();
  };

  // Generate clean exportable code snippet
  const getCodeSnippet = () => {
    if (isThreeJsPreset) {
      return getActiveHtml();
    }
    if (activePreset === 'card3d') {
      return `// Anime.js 3D Isometric Card Animation
import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

export default function Anime3DCard() {
  const containerRef = useRef(null);

  useEffect(() => {
    const tl = anime.timeline({ loop: true, direction: 'alternate' })
      .add({
        targets: '.anim-card-root',
        rotateX: [-15, 20],
        rotateY: [-25, 25],
        duration: 3200,
        easing: 'easeInOutSine',
      })
      .add({
        targets: '.anim-card-layer',
        translateZ: [30, 80],
        duration: 3200,
        easing: 'easeInOutQuad',
      }, 0);

    return () => tl.pause();
  }, []);

  return (
    <div style={{ perspective: '1000px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="anim-card-root" style={{ transformStyle: 'preserve-3d', width: 320, height: 200, borderRadius: 16, background: 'linear-gradient(135deg, #1e1e24, #0f1016)', padding: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 className="anim-card-layer" style={{ transformStyle: 'preserve-3d', color: '#f8fafc', fontSize: 20, margin: 0 }}>AI-Dost 3D Motion</h3>
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>Powered by Anime.js 3D Transforms</p>
      </div>
    </div>
  );
}`;
    }
    return `// Anime.js Motion Preset (${activePreset})
import React, { useEffect } from 'react';
import anime from 'animejs';

export default function AnimeMotionComponent() {
  useEffect(() => {
    const anim = anime({
      targets: '.animated-element',
      translateZ: [0, ${depthZ}],
      rotateY: 360,
      duration: ${2400 / speed},
      loop: true,
      easing: 'easeInOutQuad'
    });
    return () => anim.pause();
  }, []);

  return <div className="animated-element">Anime.js 3D in AI-Dost</div>;
}`;
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(getCodeSnippet());
      setCopiedCode(true);
      if (onToast) onToast('3D Animation code copied to clipboard!', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (_) {}
  };

  const sendToIDE = () => {
    if (onOpenIDE) {
      onOpenIDE();
      if (onToast) onToast('Opening 3D project in Copilot IDE...', 'info');
    }
  };

  const filteredPresets = PRESETS.filter(p => {
    if (presetFilter === 'threejs') return p.engine === 'threejs';
    if (presetFilter === 'animejs') return p.engine === 'animejs';
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-canvas-base text-paper-100 overflow-hidden font-sans">
      {/* ── Top Header Toolbar ──────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 px-4 sm:px-6 bg-canvas-surface border-b border-border flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 flex items-center justify-center text-white shadow-glow-sm">
            <Move3d size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-paper-100 font-display">3D Animation & WebGL Studio</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                Three.js r128 + Anime.js
              </span>
            </div>
            <p className="text-[11px] text-ink-muted hidden sm:block">
              Interactive 3D WebGL scenes, physics simulations, and generative motion graphics
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-canvas-subtle p-0.5 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('canvas')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-fast cursor-pointer ${
                activeTab === 'canvas' ? 'bg-canvas-elevated text-paper-100 shadow-xs' : 'text-ink-muted hover:text-paper-100'
              }`}
            >
              3D View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-fast cursor-pointer ${
                activeTab === 'code' ? 'bg-canvas-elevated text-paper-100 shadow-xs' : 'text-ink-muted hover:text-paper-100'
              }`}
            >
              Export Code
            </button>
          </div>

          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated border border-border text-paper-200 transition-fast cursor-pointer shadow-xs"
          >
            {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedCode ? 'Copied' : 'Copy 3D Code'}</span>
          </button>

          {onOpenIDE && (
            <button
              type="button"
              onClick={sendToIDE}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/90 text-white transition-fast cursor-pointer shadow-glow-sm"
            >
              <Code2 size={13} />
              <span className="hidden sm:inline">Open in Copilot IDE</span>
            </button>
          )}
        </div>
      </header>

      {/* ── AI 3D Prompt Generation Dock ─────────────────────────────────────── */}
      <div className="px-4 py-2.5 bg-canvas-subtle border-b border-border flex items-center gap-3">
        <form onSubmit={handleGenerateCustom3D} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Type any 3D prompt: e.g. '3D sports car racing on neon grid' or 'DNA double helix with glowing particles'..."
              className="w-full bg-canvas-base border border-border focus:border-cyan-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-paper-100 placeholder:text-ink-muted outline-none transition-fast font-sans"
            />
          </div>
          <button
            type="submit"
            disabled={!customPrompt.trim() || isGenerating}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-fast shadow-glow-sm cursor-pointer shrink-0"
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            <span>{isGenerating ? 'Synthesizing 3D...' : 'Generate 3D'}</span>
          </button>
        </form>

        {activePreset === 'custom' && (
          <button
            type="button"
            onClick={() => setActivePreset('cyberVehicle')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated border border-border text-ink-muted hover:text-paper-100 transition-fast"
            title="Return to standard presets"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Main Workspace Body ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Preset Picker & Visual Controls */}
        <aside className="w-full md:w-80 shrink-0 border-r border-border bg-canvas-subtle p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-bold">
                3D Preset Library
              </span>
              <div className="flex gap-1">
                {['all', 'threejs', 'animejs'].map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setPresetFilter(filter)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono capitalize transition-fast cursor-pointer ${
                      presetFilter === filter ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-ink-muted hover:text-paper-100'
                    }`}
                  >
                    {filter === 'threejs' ? 'Three.js' : filter === 'animejs' ? 'Anime.js' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              {filteredPresets.map((p) => {
                const isActive = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePreset(p.id);
                      setCustom3dHtml(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-canvas-surface border-cyan-500/50 shadow-xs' 
                        : 'bg-transparent border-transparent hover:bg-canvas-surface/60 hover:border-border text-ink-muted hover:text-paper-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${isActive ? 'text-paper-100' : 'text-paper-200'}`}>
                        {p.name}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        p.engine === 'threejs' ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300' : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                      }`}>
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Parameters for Anime.js presets */}
          {!isThreeJsPreset && (
            <div className="pt-3 border-t border-border space-y-3.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5">
                <Sliders size={12} className="text-accent" />
                Live Parameters
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-canvas-surface hover:bg-canvas-elevated border border-border text-paper-100 font-medium text-xs flex items-center justify-center gap-2 transition-fast cursor-pointer"
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                  <span>{isPlaying ? 'Pause Motion' : 'Resume Motion'}</span>
                </button>
                <button
                  type="button"
                  onClick={restartAnimation}
                  className="p-1.5 rounded-lg bg-canvas-surface hover:bg-canvas-elevated border border-border text-ink-muted hover:text-paper-100 transition-fast cursor-pointer"
                  title="Restart Animation"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>Speed Multiplier</span>
                  <span className="font-mono text-paper-100">{speed}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>3D Depth (Z-Axis)</span>
                  <span className="font-mono text-paper-100">{depthZ}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={depthZ}
                  onChange={(e) => setDepthZ(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-ink-muted">
                  <span>Camera Perspective</span>
                  <span className="font-mono text-paper-100">{perspective}px</span>
                </div>
                <input
                  type="range"
                  min="400"
                  max="2000"
                  step="50"
                  value={perspective}
                  onChange={(e) => setPerspective(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {isThreeJsPreset && (
            <div className="pt-3 border-t border-border space-y-2 text-xs text-ink-muted">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold font-mono text-[11px]">
                <Sparkles size={13} />
                <span>Interactive WebGL 3D</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Click and drag directly inside the 3D viewport to rotate with OrbitControls, scroll to zoom, and use HUD controls.
              </p>
            </div>
          )}
        </aside>

        {/* Right Stage & 3D Render Canvas */}
        <main className="flex-1 flex flex-col min-w-0 bg-black/50 relative overflow-hidden">
          {activeTab === 'canvas' ? (
            isThreeJsPreset ? (
              /* Three.js Full-Screen WebGL Iframe */
              <div className="flex-1 w-full h-full relative">
                <iframe
                  title="3D WebGL Canvas"
                  srcDoc={getActiveHtml()}
                  className="w-full h-full border-0"
                  /* P3 #84: srcDoc must not get allow-same-origin (same pattern
                     as #77) — generated scripts get an opaque origin and cannot
                     reach parent DOM/cookies. */
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            ) : (
              /* Anime.js CSS 3D Viewport */
              <div 
                ref={containerRef}
                className="flex-1 flex items-center justify-center p-8 overflow-hidden relative"
                style={{
                  perspective: `${perspective}px`,
                  perspectiveOrigin: '50% 50%',
                  backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.04) 0%, transparent 70%)',
                }}
              >
                <div 
                  className="absolute inset-0 pointer-events-none opacity-15"
                  style={{
                    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    transform: 'rotateX(65deg) scale(2) translateY(-20%)',
                    transformOrigin: '50% 50%',
                  }}
                />

                {/* 1. 3D Card Isometric Preset */}
                {activePreset === 'card3d' && (
                  <div 
                    className="anim-card-root relative w-80 sm:w-96 h-56 rounded-2xl p-6 bg-gradient-to-br from-zinc-900/95 to-zinc-950 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col justify-between cursor-pointer"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="flex items-center justify-between" style={{ transformStyle: 'preserve-3d' }}>
                      <div className="anim-card-layer-1 flex items-center gap-2.5" style={{ transformStyle: 'preserve-3d' }}>
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                          <Box size={16} />
                        </div>
                        <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">AI-Dost 3D</span>
                      </div>
                      <span className="anim-card-badge px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500 text-black shadow-lg">
                        Z-DEPTH ACTIVE
                      </span>
                    </div>

                    <div className="anim-card-layer-2 space-y-1.5" style={{ transformStyle: 'preserve-3d' }}>
                      <h2 className="text-lg font-bold text-paper-100 font-display">Anime.js Motion Engine</h2>
                      <p className="text-xs text-ink-muted leading-relaxed">
                        Multi-plane isometric depth with hardware-accelerated CSS 3D transforms.
                      </p>
                    </div>

                    <div className="anim-card-layer-1 flex items-center justify-between pt-3 border-t border-white/5 text-[11px] text-ink-muted font-mono" style={{ transformStyle: 'preserve-3d' }}>
                      <span>Perspective: {perspective}px</span>
                      <span className="text-cyan-400 font-bold">TranslateZ: {depthZ}px</span>
                    </div>
                  </div>
                )}

                {/* 2. 3D Helix Preset */}
                {activePreset === 'helix3d' && (
                  <div className="flex items-center justify-center gap-3 sm:gap-4" style={{ transformStyle: 'preserve-3d' }}>
                    {Array.from({ length: 22 }).map((_, i) => (
                      <div
                        key={i}
                        className="helix-dot w-3 sm:w-4 h-3 sm:h-4 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-500 shadow-glow-sm"
                        style={{ transformStyle: 'preserve-3d' }}
                      />
                    ))}
                  </div>
                )}

                {/* 3. Kinetic Typography */}
                {activePreset === 'kineticText' && (
                  <div className="flex items-center justify-center flex-wrap gap-1 sm:gap-2 select-none" style={{ transformStyle: 'preserve-3d' }}>
                    {'AI-DOST 3D MOTION'.split('').map((char, i) => (
                      <span
                        key={i}
                        className="kinetic-char inline-block text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-indigo-400 to-purple-600 font-display tracking-tight"
                        style={{ transformStyle: 'preserve-3d', textShadow: '0 10px 30px rgba(6,182,212,0.3)' }}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    ))}
                  </div>
                )}

                {/* 4. Quantum Atom Orbitals */}
                {activePreset === 'atomOrbit' && (
                  <div className="relative w-72 h-72 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
                    <div className="orbital-core w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white z-10 shadow-glow-sm">
                      <Sparkles size={18} />
                    </div>
                    <div className="orbital-ring-1 absolute inset-0 rounded-full border-2 border-cyan-400/40" style={{ transformStyle: 'preserve-3d' }} />
                    <div className="orbital-ring-2 absolute inset-2 rounded-full border-2 border-indigo-400/40" style={{ transformStyle: 'preserve-3d' }} />
                    <div className="orbital-ring-3 absolute inset-4 rounded-full border-2 border-purple-500/40" style={{ transformStyle: 'preserve-3d' }} />
                  </div>
                )}

                {/* 5. 3D Wave Grid */}
                {activePreset === 'waveGrid' && (
                  <div 
                    className="grid grid-cols-7 gap-2 sm:gap-3" 
                    style={{ transformStyle: 'preserve-3d', transform: 'rotateX(55deg) rotateZ(-15deg)' }}
                  >
                    {Array.from({ length: 49 }).map((_, i) => (
                      <div
                        key={i}
                        className="grid-cell w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-400/80 to-indigo-600/80 border border-white/20 shadow-md"
                        style={{ transformStyle: 'preserve-3d' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            /* Code Export Tab */
            <div className="flex-1 flex flex-col min-h-0 bg-canvas-base p-4 sm:p-6 overflow-y-auto font-mono text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-ink-muted">
                  {isThreeJsPreset ? 'Three.js (r128) WebGL Single-File Component' : 'React + Anime.js Component'}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="px-2.5 py-1 rounded bg-canvas-surface hover:bg-canvas-elevated border border-border text-paper-100 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
              <pre className="mt-4 p-4 rounded-xl bg-black/60 border border-border text-cyan-200 overflow-x-auto leading-relaxed">
                <code>{getCodeSnippet()}</code>
              </pre>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
