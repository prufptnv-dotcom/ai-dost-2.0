import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LuActivity, LuArrowDown, LuArrowLeft, LuArrowRight, LuArrowUp, LuArrowUpRight,
  LuBell, LuCheck, LuCheckCheck, LuChevronDown, LuChevronRight, LuCircleCheck,
  LuCircleDot, LuCloud, LuCode, LuCommand, LuCopy, LuEllipsis, LuExternalLink,
  LuFile, LuFileCode2, LuFileImage, LuFileJson, LuFileText, LuFolder, LuFolderOpen,
  LuGitBranch, LuGlobe, LuHistory, LuImage, LuLayoutDashboard, LuLightbulb,
  LuLoaderCircle, LuLockKeyhole, LuMenu, LuMessageCircle, LuMonitor,
  LuPanelLeft, LuPanelRight, LuPaperclip, LuPlay, LuPlus, LuRefreshCw, LuRocket,
  LuPalette, LuSearch, LuSend, LuSettings2, LuShieldCheck, LuSmartphone, LuSparkles,
  LuSquareTerminal, LuTerminal, LuThumbsUp, LuWandSparkles, LuX, LuZap,
} from 'react-icons/lu';
import './styles.css';

const initialFiles = [
  { name: 'index.html', icon: LuFileCode2, type: 'html', indent: 0 },
  { name: 'src', icon: LuFolderOpen, type: 'folder', indent: 0, open: true },
  { name: 'App.jsx', icon: LuFileCode2, type: 'jsx', indent: 1 },
  { name: 'main.jsx', icon: LuFileCode2, type: 'jsx', indent: 1 },
  { name: 'components', icon: LuFolder, type: 'folder', indent: 1 },
  { name: 'Header.jsx', icon: LuFileCode2, type: 'jsx', indent: 2 },
  { name: 'Hero.jsx', icon: LuFileCode2, type: 'jsx', indent: 2 },
  { name: 'ProductGrid.jsx', icon: LuFileCode2, type: 'jsx', indent: 2 },
  { name: 'styles.css', icon: LuFileText, type: 'css', indent: 0 },
  { name: 'package.json', icon: LuFileJson, type: 'json', indent: 0 },
  { name: 'public', icon: LuFolder, type: 'folder', indent: 0 },
  { name: 'serum-hero.webp', icon: LuFileImage, type: 'image', indent: 1 },
];

const codeSamples = {
  'App.jsx': [
    ['kw', 'import'], ['plain', ' React from '], ['str', "'react'"], ['plain', ';'],
    ['newline'], ['kw', 'import'], ['plain', ' { Header } from '], ['str', "'./components/Header'"], ['plain', ';'],
    ['newline'], ['kw', 'import'], ['plain', ' { Hero } from '], ['str', "'./components/Hero'"], ['plain', ';'],
    ['newline'], ['kw', 'import'], ['plain', ' '], ['str', "'./styles.css'"], ['plain', ';'],
    ['newline'], ['newline'], ['kw', 'export default function'], ['fn', ' App'], ['plain', '() {'],
    ['newline'], ['plain', '  '], ['kw', 'return'], ['plain', ' ('], ['newline'], ['plain', '    <'], ['tag', 'main'], ['plain', ' className='], ['str', '"storefront"'], ['plain', '>'],
    ['newline'], ['plain', '      <'], ['tag', 'Header'], ['plain', ' />'], ['newline'], ['plain', '      <'], ['tag', 'Hero'], ['plain', ' />'],
    ['newline'], ['plain', '      <'], ['tag', 'ProductGrid'], ['plain', ' />'], ['newline'], ['plain', '    </'], ['tag', 'main'], ['plain', '>'],
    ['newline'], ['plain', '  );'], ['newline'], ['plain', '}'],
  ],
  'styles.css': [
    ['sel', ':root'], ['plain', ' {'], ['newline'], ['plain', '  --ink: '], ['str', '#1e2822'], ['plain', ';'],
    ['newline'], ['plain', '  --sage: '], ['str', '#81917c'], ['plain', ';'], ['newline'], ['plain', '  --cream: '], ['str', '#f7f5ef'], ['plain', ';'],
    ['newline'], ['plain', '}'], ['newline'], ['newline'], ['sel', '.hero'], ['plain', ' {'], ['newline'],
    ['plain', '  display: '], ['str', 'grid'], ['plain', ';'], ['newline'], ['plain', '  grid-template-columns: '], ['str', '1fr 1fr'], ['plain', ';'],
    ['newline'], ['plain', '  min-height: '], ['str', '540px'], ['plain', ';'], ['newline'], ['plain', '  background: '], ['str', 'var(--cream)'], ['plain', ';'],
    ['newline'], ['plain', '  align-items: '], ['str', 'center'], ['plain', ';'], ['newline'], ['plain', '}'],
  ],
  'index.html': [
    ['plain', '<!doctype html>'], ['newline'], ['plain', '<'], ['tag', 'html'], ['plain', ' lang='], ['str', '"en"'], ['plain', '>'],
    ['newline'], ['plain', '  <'], ['tag', 'head'], ['plain', '>'], ['newline'], ['plain', '    <'], ['tag', 'meta'], ['plain', ' charset='], ['str', '"UTF-8"'], ['plain', ' />'],
    ['newline'], ['plain', '    <'], ['tag', 'meta'], ['plain', ' name='], ['str', '"viewport"'], ['plain', ' content='], ['str', '"width=device-width, initial-scale=1"'], ['plain', ' />'],
    ['newline'], ['plain', '    <'], ['tag', 'title'], ['plain', '>Aurelia — Botanical skincare</'], ['tag', 'title'], ['plain', '>'],
    ['newline'], ['plain', '  </'], ['tag', 'head'], ['plain', '>'], ['newline'], ['plain', '  <'], ['tag', 'body'], ['plain', '>'],
    ['newline'], ['plain', '    <'], ['tag', 'div'], ['plain', ' id='], ['str', '"root"'], ['plain', '></'], ['tag', 'div'], ['plain', '>'],
    ['newline'], ['plain', '    <'], ['tag', 'script'], ['plain', ' type='], ['str', '"module"'], ['plain', ' src='], ['str', '"/src/main.jsx"'], ['plain', '></'], ['tag', 'script'], ['plain', '>'],
    ['newline'], ['plain', '  </'], ['tag', 'body'], ['plain', '>'], ['newline'], ['plain', '</'], ['tag', 'html'], ['plain', '>'],
  ],
};

const themePresets = [
  { id: 'violet', name: 'Violet', color: '#a78bfa' },
  { id: 'ocean', name: 'Ocean', color: '#62b5ff' },
  { id: 'emerald', name: 'Emerald', color: '#63d19a' },
  { id: 'rose', name: 'Rose', color: '#ef86ad' },
  { id: 'amber', name: 'Amber', color: '#edb85f' },
  { id: 'rgb', name: 'RGB Flow', color: 'rainbow' },
];

function IconButton({ title, children, className = '', onClick, active = false, ...props }) {
  return <button type="button" title={title} aria-label={title} className={`icon-button ${active ? 'active' : ''} ${className}`} onClick={onClick} {...props}>{children}</button>;
}

function ThemePicker({ theme, setTheme, customColor, setCustomColor }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = event => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);
  const current = themePresets.find(option => option.id === theme);
  return <div className="theme-picker" ref={pickerRef}>
    <button className="theme-trigger" type="button" aria-label="Change workspace theme" aria-expanded={open} title="Change workspace theme" onClick={() => setOpen(value => !value)}>
      <LuPalette size={15} /><span className="theme-label">Theme</span>
      <span className={`theme-trigger-swatch ${theme === 'rgb' ? 'rgb-swatch' : ''}`} style={theme === 'custom' ? { background: customColor } : current?.color !== 'rainbow' ? { background: current?.color } : undefined} />
    </button>
    {open && <div className="theme-popover" role="dialog" aria-label="Workspace theme picker">
      <div className="theme-popover-heading"><b>Color theme</b><small>Make the workspace yours</small></div>
      <div className="theme-grid">
        {themePresets.map(option => <button key={option.id} type="button" className={`theme-option ${theme === option.id ? 'selected' : ''}`} aria-pressed={theme === option.id} onClick={() => { setTheme(option.id); setOpen(false); }}>
          <span className={`theme-option-swatch ${option.id === 'rgb' ? 'rgb-swatch' : ''}`} style={option.color !== 'rainbow' ? { background: option.color } : undefined} />
          <span>{option.name}</span>
          {theme === option.id && <LuCheck size={12} className="theme-option-check" />}
        </button>)}
      </div>
      <label className={`theme-custom-option ${theme === 'custom' ? 'selected' : ''}`}>
        <span className="custom-color-preview" style={{ background: customColor }}><LuPalette size={12} /></span>
        <span className="custom-theme-label">Custom color</span>
        <code>{customColor.toUpperCase()}</code>
        <input type="color" aria-label="Choose custom workspace accent color" value={customColor} onChange={event => { setCustomColor(event.target.value); setTheme('custom'); }} />
      </label>
      <div className="theme-save-note"><LuCheck size={11} /> Saved automatically on this device</div>
    </div>}
  </div>;
}

function Rail() {
  return <aside className="icon-rail" aria-label="Workspace navigation">
    <div className="rail-logo"><span className="forge-mark"><LuSparkles size={17} strokeWidth={2.4} /></span></div>
    <div className="rail-actions">
      <button className="rail-item selected" title="Builder"><LuLayoutDashboard size={18} /><span className="rail-active-dot" /></button>
      <button className="rail-item" title="Search"><LuSearch size={18} /></button>
      <button className="rail-item" title="History"><LuHistory size={18} /></button>
      <button className="rail-item" title="Activity"><LuActivity size={18} /></button>
    </div>
    <div className="rail-bottom">
      <button className="rail-item" title="Settings"><LuSettings2 size={18} /></button>
      <button className="avatar rail-avatar" title="Vikash Kumar">VK</button>
    </div>
  </aside>;
}

function FileSidebar({ open, activeFile, setActiveFile, onClose }) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const filteredFiles = initialFiles.filter(file => !query || file.name.toLowerCase().includes(query.toLowerCase()));
  return <>
    {open && <div className="mobile-scrim" onClick={onClose} />}
    <aside className={`file-sidebar ${open ? 'is-open' : ''}`}>
      <div className="workspace-switcher">
        <span className="workspace-avatar"><LuSparkles size={14} /></span>
        <span className="workspace-name">Studio workspace</span>
        <LuChevronDown size={14} className="muted-icon" />
      </div>
      <button className="new-project"><LuPlus size={15} /><span>New project</span><span className="shortcut">⌘ K</span></button>
      <div className="nav-links">
        <button className="nav-link"><LuLayoutDashboard size={15} /><span>Overview</span></button>
        <button className="nav-link active"><LuCode size={15} /><span>Builder</span><span className="nav-dot" /></button>
        <button className="nav-link"><LuGlobe size={15} /><span>Deployments</span></button>
      </div>
      <div className="sidebar-divider" />
      <div className="project-heading">
        <div className="project-label">CURRENT PROJECT</div>
        <button className="project-switcher" aria-label="Switch project"><span className="project-initial">A</span><span className="project-name">aurelia-store</span><LuChevronDown size={13} className="muted-icon" /></button>
      </div>
      <div className="files-label-row"><span>FILES</span><div className="file-actions"><IconButton title="Search files" onClick={() => searchInputRef.current?.focus()}><LuSearch size={14} /></IconButton><IconButton title="Add file" onClick={() => setActiveFile('NewFile.jsx')}><LuPlus size={14} /></IconButton></div></div>
      <div className="file-search"><LuSearch size={13} /><input ref={searchInputRef} aria-label="Find a file" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a file..." /><kbd>⌘ P</kbd></div>
      <div className="file-tree" role="list" aria-label="Project files">
        {filteredFiles.map((file, index) => {
          const FileIcon = file.icon;
          const isActive = activeFile === file.name;
          return <button key={`${file.name}-${index}`} role="listitem" className={`tree-row ${isActive ? 'active' : ''} ${file.type === 'folder' ? 'tree-folder' : ''}`} style={{ '--indent': file.indent }} onClick={() => file.type !== 'folder' && setActiveFile(file.name)}>
            {file.indent > 0 && <span className="tree-guide" />}
            {file.type === 'folder' ? <LuChevronRight size={12} className={file.open ? 'folder-chevron open' : 'folder-chevron'} /> : <span className="folder-chevron-spacer" />}
            <FileIcon size={14} className={`file-type-icon ${file.type}`} />
            <span>{file.name}</span>
            {file.name === 'App.jsx' && <span className="file-unsaved" />}
          </button>;
        })}
        {filteredFiles.length === 0 && <div className="empty-search">No files found</div>}
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-bottom-card">
        <div className="sidebar-bottom-top"><span className="plan-icon"><LuZap size={14} fill="currentColor" /></span><span>Build faster with Forge Pro</span><LuArrowUpRight size={13} /></div>
        <p>More builds. More possibilities.</p>
        <button className="upgrade-link">Explore plans <LuArrowRight size={12} /></button>
      </div>
      <div className="profile-row"><span className="avatar">VK</span><span className="profile-meta"><strong>Vikash Kumar</strong><small>Personal workspace</small></span><LuEllipsis size={18} className="muted-icon" /></div>
    </aside>
  </>;
}

function Topbar({ onToggleFiles, onToggleAssistant, onDeploy, mobile, theme, setTheme, customColor, setCustomColor }) {
  return <header className="topbar">
    <div className="topbar-left">
      <IconButton title="Toggle files" className="topbar-panel-button" onClick={onToggleFiles}><LuPanelLeft size={17} /></IconButton>
      <div className="breadcrumb"><span className="crumb-project">aurelia-store</span><LuChevronRight size={13} /><strong>Builder</strong></div>
      <span className="topbar-branch"><LuGitBranch size={12} /> main</span>
    </div>
    <div className="topbar-right">
      <div className="save-state"><span className="save-dot" /> Saved</div>
      <ThemePicker theme={theme} setTheme={setTheme} customColor={customColor} setCustomColor={setCustomColor} />
      <IconButton title="Notifications" className="notification-button"><LuBell size={16} /><i /></IconButton>
      <button className="share-button"><LuExternalLink size={14} /><span>Share</span></button>
      <button className="deploy-button" onClick={onDeploy}><LuRocket size={14} /><span>Deploy</span></button>
      {mobile && <IconButton title="Open assistant" className="topbar-panel-button ai-topbar-button" onClick={onToggleAssistant}><LuMessageCircle size={17} /></IconButton>}
    </div>
  </header>;
}

function Toolbar({ mode, setMode, device, setDevice, onRefresh, onRun, isRunning, onToggleAssistant, mobile }) {
  return <div className="editor-toolbar">
    <div className="mode-tabs" role="tablist" aria-label="Workspace view">
      <button className={mode === 'preview' ? 'selected' : ''} onClick={() => setMode('preview')} role="tab" aria-selected={mode === 'preview'}><LuGlobe size={14} /> Preview</button>
      <button className={mode === 'code' ? 'selected' : ''} onClick={() => setMode('code')} role="tab" aria-selected={mode === 'code'}><LuCode size={14} /> Code</button>
      <button className={mode === 'terminal' ? 'selected' : ''} onClick={() => setMode('terminal')} role="tab" aria-selected={mode === 'terminal'}><LuTerminal size={14} /> Terminal</button>
    </div>
    <div className="editor-tools">
      {mode === 'preview' && <div className="device-switch" aria-label="Preview size">
        <IconButton title="Desktop preview" active={device === 'desktop'} onClick={() => setDevice('desktop')}><LuMonitor size={15} /></IconButton>
        <IconButton title="Mobile preview" active={device === 'mobile'} onClick={() => setDevice('mobile')}><LuSmartphone size={15} /></IconButton>
      </div>}
      <span className="toolbar-separator" />
      <IconButton title="Refresh preview" onClick={onRefresh}><LuRefreshCw size={15} /></IconButton>
      <button className={`run-button ${isRunning ? 'running' : ''}`} onClick={onRun}>{isRunning ? <LuLoaderCircle size={14} className="spin" /> : <LuPlay size={13} fill="currentColor" />}<span>{isRunning ? 'Building' : 'Run'}</span></button>
      {mobile && <IconButton title="Open assistant" className="mobile-ai-icon" onClick={onToggleAssistant}><LuMessageCircle size={16} /></IconButton>}
      <IconButton title="More preview options"><LuEllipsis size={17} /></IconButton>
    </div>
  </div>;
}

function BottleArtwork() {
  return <div className="hero-art" aria-label="Aurelia botanical serum product display" role="img">
    <div className="art-stamp"><span>BOTANICAL<br />FORMULA</span><LuSparkles size={13} /></div>
    <span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" />
    <div className="art-leaf leaf-one" /><div className="art-leaf leaf-two" /><div className="art-leaf leaf-three" />
    <div className="serum-shadow" />
    <div className="serum-bottle"><div className="bottle-cap" /><div className="bottle-neck" /><div className="bottle-body"><span className="bottle-brand">AURELIA</span><span className="bottle-line" /><span className="bottle-sub">BOTANICAL<br />GLOW SERUM</span><span className="bottle-volume">30 ML / 1 FL OZ</span></div></div>
    <div className="art-caption">01 — THE EVERYDAY RITUAL</div>
    <span className="art-sun" />
  </div>;
}

function Storefront({ device, refreshCount }) {
  return <div className={`preview-device ${device === 'mobile' ? 'mobile-device' : ''}`} key={`${device}-${refreshCount}`}>
    <div className="storefront">
      <div className="announcement-bar">Complimentary shipping on all orders over $60 <span>—</span> <u>Discover more</u></div>
      <nav className="store-nav">
        <div className="store-logo"><span className="store-symbol"><LuSparkles size={16} /></span><span>aurelia</span></div>
        <div className="store-links"><span>Shop</span><span>Our ritual</span><span>Journal</span></div>
        <div className="store-actions"><span>Search</span><span>Bag <b>0</b></span></div>
      </nav>
      <section className="store-hero">
        <div className="store-copy">
          <div className="store-eyebrow"><span /> SKINCARE, IN SEASON</div>
          <h1>A slower kind<br />of <em>glow.</em></h1>
          <p>Thoughtful essentials made with nature’s most restorative ingredients. A little more care, every day.</p>
          <button className="shop-button">Find your ritual <LuArrowRight size={14} /></button>
          <div className="hero-note"><LuShieldCheck size={13} /> Clean ingredients. Considered care.</div>
        </div>
        <BottleArtwork />
      </section>
      <section className="store-promise"><div><span className="promise-icon"><LuLeafSafe /></span><span><strong>Thoughtfully sourced</strong><small>Ingredients with intention</small></span></div><i /><div><span className="promise-icon"><LuDropletsSafe /></span><span><strong>Made for your ritual</strong><small>Gentle, effective formulas</small></span></div><i /><div><span className="promise-icon"><LuHeartSafe /></span><span><strong>Kind by nature</strong><small>Good for skin & planet</small></span></div></section>
      <section className="collection-preview"><div><span className="collection-kicker">THE DAILY EDIT</span><h2>Meet your new essentials.</h2></div><button>Shop the collection <LuArrowRight size={13} /></button></section>
      <section className="store-products">
        <article className="product-card"><div className="product-visual product-visual-sage"><span className="product-bottle serum-small"><i /></span><span className="product-card-label">BESTSELLER</span></div><div className="product-meta"><span>01 / HYDRATE</span><span>★★★★★</span></div><h3>Daily Dew Serum</h3><p>Botanical glow · 30 ml</p><b>$48</b></article>
        <article className="product-card"><div className="product-visual product-visual-rose"><span className="product-bottle cream-jar"><i /></span><span className="product-card-label">NEW</span></div><div className="product-meta"><span>02 / NOURISH</span><span>★★★★★</span></div><h3>Cloud Veil Cream</h3><p>Barrier-loving moisture · 50 ml</p><b>$56</b></article>
        <article className="product-card"><div className="product-visual product-visual-sand"><span className="product-bottle amber-drop"><i /></span><span className="product-card-label">RITUAL FAVOURITE</span></div><div className="product-meta"><span>03 / RESTORE</span><span>★★★★★</span></div><h3>Evening Reset Oil</h3><p>Overnight comfort · 30 ml</p><b>$52</b></article>
      </section>
    </div>
  </div>;
}

function LuLeafSafe() { return <span className="mini-leaf">✳</span>; }
function LuDropletsSafe() { return <span className="mini-drop">◌</span>; }
function LuHeartSafe() { return <span className="mini-heart">♡</span>; }

function CodeView({ activeFile }) {
  const sample = codeSamples[activeFile] || codeSamples['App.jsx'];
  const lines = [[]];
  sample.forEach(([type, text]) => {
    if (type === 'newline') lines.push([]);
    else lines[lines.length - 1].push([type, text]);
  });
  return <div className="code-editor">
    <div className="code-tab"><LuFileCode2 size={14} /><span>{activeFile}</span><span className="code-tab-dot" /><LuX size={13} /></div>
    <div className="code-scroll"><pre className="code-lines"><code>{lines.map((tokens, index) => <span className="code-line" key={index}><span className="line-number">{String(index + 1).padStart(2, '0')}</span><span className="code-content">{tokens.map(([type, text], tokenIndex) => <span key={tokenIndex} className={`syntax-${type}`}>{text}</span>)}</span></span>)}</code></pre><div className="code-minimap"><span /><span /><span /><span /><span /><span /><span /><span /></div></div>
    <div className="code-status"><span><LuGitBranch size={12} /> main</span><span>Ln 12, Col 18</span><span>JavaScript JSX</span><span>UTF-8</span></div>
  </div>;
}

function TerminalView() {
  return <div className="terminal-view">
    <div className="terminal-header"><div className="terminal-tab"><LuTerminal size={14} /> Terminal <LuX size={12} /></div><span className="terminal-session">zsh · 80 × 24</span><IconButton title="New terminal"><LuPlus size={14} /></IconButton></div>
    <div className="terminal-content">
      <div><span className="terminal-prompt">➜</span> <b>~/aurelia-store</b> <span className="terminal-branch">git:(main)</span> <span>npm run dev</span></div>
      <div className="terminal-muted">&gt; aurelia-store@0.1.0 dev</div>
      <div className="terminal-muted">&gt; vite --host 0.0.0.0</div>
      <div className="terminal-success"><LuCircleCheck size={14} /> Ready in 412ms</div>
      <div className="terminal-local"><LuArrowUpRight size={13} /> Local: <u>http://localhost:5173/</u></div>
      <div className="terminal-rule" />
      <div className="terminal-hint">Your development server is running. Changes update automatically.</div>
      <div className="terminal-caret"><span className="terminal-prompt">➜</span> <b>~/aurelia-store</b><i /></div>
    </div>
  </div>;
}

const activitySteps = [
  { label: 'Understanding your request', detail: 'Breaking the brief into actionable requirements', icon: LuMessageCircle },
  { label: 'Planning code changes', detail: 'Mapping the request to relevant project files', icon: LuLightbulb },
  { label: 'Preparing the build', detail: 'Getting the preview update ready', icon: LuCode },
  { label: 'Checking responsive layout', detail: 'Reviewing desktop and mobile states', icon: LuMonitor },
];

function WorkingActivity({ activeStep }) {
  const progress = Math.min(100, Math.round(((activeStep + 0.65) / activitySteps.length) * 100));
  return <div className="workflow-card" aria-live="polite">
    <div className="workflow-header">
      <span className="workflow-spark"><LuSparkles size={13} /></span>
      <span className="workflow-title"><b>Working through your request</b><small>Assistant activity · step {activeStep + 1} of {activitySteps.length}</small></span>
      <span className="workflow-live"><i /> LIVE</span>
    </div>
    <div className="workflow-progress"><span style={{ width: `${progress}%` }} /></div>
    <div className="workflow-steps">
      {activitySteps.map((step, index) => {
        const StepIcon = step.icon;
        const state = index < activeStep ? 'complete' : index === activeStep ? 'active' : 'pending';
        return <div className={`workflow-step ${state}`} key={step.label}>
          <span className="workflow-step-icon">{state === 'complete' ? <LuCheck size={11} /> : state === 'active' ? <LuLoaderCircle size={12} className="spin" /> : <StepIcon size={11} />}</span>
          <span>{step.label}</span>
          {state === 'active' && <span className="workflow-now">in progress</span>}
        </div>;
      })}
    </div>
    <div className="workflow-detail"><span className="workflow-pulse" />{activitySteps[activeStep]?.detail}</div>
    <div className="workflow-note">Demo animation · connect your backend event stream for live task updates</div>
  </div>;
}

function MainWorkspace({ mode, setMode, activeFile, device, setDevice, onRefresh, onRun, isRunning, refreshCount, onToggleAssistant, mobile }) {
  return <main className="main-workspace">
    <Toolbar mode={mode} setMode={setMode} device={device} setDevice={setDevice} onRefresh={onRefresh} onRun={onRun} isRunning={isRunning} onToggleAssistant={onToggleAssistant} mobile={mobile} />
    <div className={`workspace-canvas ${mode === 'preview' ? 'preview-canvas' : ''}`}>
      {mode === 'preview' ? <>
        <div className="browser-bar">
          <div className="browser-controls"><span /><span /><span /></div>
          <div className="address-bar"><LuLockKeyhole size={11} /><span>aurelia-store</span><span className="address-domain">.forge.app</span><LuChevronDown size={11} /></div>
          <div className="browser-actions"><span className="preview-live"><i /> Live preview</span><IconButton title="Open in new tab"><LuExternalLink size={14} /></IconButton></div>
        </div>
        <div className="preview-stage"><Storefront device={device} refreshCount={refreshCount} /></div>
        <div className="canvas-footer"><span><LuCloud size={12} /> Preview synced</span><span>Port <b>5173</b></span><span className="canvas-size">{device === 'mobile' ? '390 × 844' : 'Responsive'}</span></div>
      </> : mode === 'code' ? <CodeView activeFile={activeFile} /> : <TerminalView />}
    </div>
  </main>;
}

function AssistantPanel({ open, onClose, autopilot, setAutopilot, prompt, setPrompt, messages, onSubmit, onToast, isAssistantWorking, activityStep }) {
  const listRef = useRef(null);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, isAssistantWorking, activityStep]);
  return <>
    {open && <div className="mobile-scrim assistant-scrim" onClick={onClose} />}
    <aside className={`assistant-panel ${open ? 'is-open' : ''}`}>
      <div className="assistant-header">
        <div className="assistant-title"><span className="assistant-mark"><LuSparkles size={16} /></span><div><strong>Forge AI</strong><span>Autonomous builder</span></div></div>
        <div className="assistant-head-actions"><button className={`autopilot-toggle ${autopilot ? 'on' : ''}`} onClick={() => setAutopilot(!autopilot)}><span className="toggle-dot" /> Autopilot {autopilot ? 'on' : 'off'}</button><IconButton title="Assistant options" onClick={() => onToast('Assistant settings are ready to connect.')}><LuEllipsis size={17} /></IconButton><IconButton title="Close assistant" className="assistant-close" onClick={onClose}><LuX size={17} /></IconButton></div>
      </div>
      <div className="task-context"><span className="task-context-dot"><LuWandSparkles size={13} /></span><span><b>Building</b> · Aurelia storefront</span><LuChevronDown size={13} /></div>
      <div className="assistant-thread" ref={listRef}>
        <div className="thread-date"><span /> TODAY, 10:42 AM <span /></div>
        <div className="assistant-message">
          <span className="message-avatar"><LuSparkles size={13} /></span>
          <div className="message-body"><div className="message-meta"><strong>Forge AI</strong><span>10:42 AM</span></div><p>I’ve turned your brief into a polished storefront. Here’s what I’ve put together:</p>
            <div className="build-summary"><div className="summary-heading"><LuCheckCheck size={14} /><span>Build plan</span><span className="summary-done">3 of 4 done</span></div>
              <div className="summary-item done"><span className="summary-check"><LuCheck size={11} /></span><span>Set up responsive layout</span></div>
              <div className="summary-item done"><span className="summary-check"><LuCheck size={11} /></span><span>Design hero & product sections</span></div>
              <div className="summary-item done"><span className="summary-check"><LuCheck size={11} /></span><span>Add warm, botanical styling</span></div>
              <div className="summary-item in-progress"><span className="summary-spinner" /><span>Polishing mobile navigation</span><span className="task-progress">86%</span></div>
              <div className="task-progress-track"><span /></div>
            </div>
            <div className="message-foot"><span><LuActivity size={12} /> Working on it</span><button title="Copy message" onClick={() => onToast('Build summary copied.')}><LuCopy size={12} /></button><button title="Helpful" onClick={() => onToast('Thanks for the feedback.')}><LuThumbsUp size={12} /></button></div>
            <div className="agent-action-card">
              <div className="agent-action-top"><span className="agent-action-icon"><LuCode size={12} /></span><span><b>Last action</b><small>Updated <code>Hero.jsx</code> · just now</small></span><LuCircleCheck size={14} className="agent-action-check" /></div>
              <div className="agent-action-bottom"><span className="diff-added">+38</span><span className="diff-removed">−6</span><span>Mobile spacing reviewed</span></div>
            </div>
          </div>
        </div>
        {messages.map((message, index) => <div key={index} className={`chat-entry ${message.role}`}>
          {message.role === 'assistant' && <span className="message-avatar"><LuSparkles size={13} /></span>}
          <div className="chat-bubble-wrap"><div className="message-meta"><strong>{message.role === 'user' ? 'You' : 'Forge AI'}</strong><span>{message.time}</span></div><div className="chat-bubble">{message.text}</div></div>
          {message.role === 'user' && <span className="avatar message-user-avatar">VK</span>}
        </div>)}
        {isAssistantWorking && <div className="activity-entry"><span className="message-avatar activity-avatar"><LuSparkles size={13} /></span><WorkingActivity activeStep={activityStep} /></div>}
      </div>
      <div className="assistant-bottom">
        <div className="suggestion-row"><button onClick={() => setPrompt('Make the mobile navigation feel more polished')}><LuSmartphone size={12} /> Polish mobile</button><button onClick={() => setPrompt('Review the site for accessibility issues')}><LuShieldCheck size={12} /> Review accessibility</button></div>
        <form className="prompt-composer" onSubmit={onSubmit}>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={isAssistantWorking ? 'Forge is working on your request…' : 'Ask Forge to make a change...'} aria-label="Message Forge AI" rows="2" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit(); } }} />
          <div className="composer-footer"><button type="button" className="composer-tool" title="Attach file" onClick={() => onToast('File attachments can be connected to your backend.')}><LuPaperclip size={15} /></button><span className="composer-hint">{isAssistantWorking ? <><LuLoaderCircle size={11} className="spin" /> Working…</> : <><LuCommand size={11} /> Enter to send</>}</span><button type="submit" className={`send-button ${prompt.trim() && !isAssistantWorking ? 'ready' : ''}`} aria-label="Send message" disabled={!prompt.trim() || isAssistantWorking}><LuArrowUp size={16} /></button></div>
        </form>
        <div className="assistant-disclaimer">Forge can make mistakes. Review changes before deploying.</div>
      </div>
    </aside>
  </>;
}

function Toast({ message }) {
  return message ? <div className="toast"><LuCircleCheck size={15} />{message}</div> : null;
}

function App() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 920px)').matches);
  const [filesOpen, setFilesOpen] = useState(() => !window.matchMedia('(max-width: 920px)').matches);
  const [assistantOpen, setAssistantOpen] = useState(() => !window.matchMedia('(max-width: 920px)').matches);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('forge-ui-theme');
      return themePresets.some(option => option.id === saved) || saved === 'custom' ? saved : 'violet';
    } catch { return 'violet'; }
  });
  const [customColor, setCustomColor] = useState(() => {
    try { return localStorage.getItem('forge-ui-custom-color') || '#a78bfa'; }
    catch { return '#a78bfa'; }
  });
  const [mode, setMode] = useState('preview');
  const [device, setDevice] = useState('desktop');
  const [activeFile, setActiveFile] = useState('App.jsx');
  const [isRunning, setIsRunning] = useState(false);
  const [autopilot, setAutopilot] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [isAssistantWorking, setIsAssistantWorking] = useState(false);
  const [activityStep, setActivityStep] = useState(0);
  const [toast, setToast] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const activityTimers = useRef([]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 920px)');
    const update = () => {
      setMobile(mq.matches);
      if (mq.matches) { setFilesOpen(false); setAssistantOpen(false); }
    };
    update(); mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem('forge-ui-theme', theme);
      localStorage.setItem('forge-ui-custom-color', customColor);
    } catch { /* Theme still works for this session when storage is unavailable. */ }
  }, [theme, customColor]);
  useEffect(() => () => activityTimers.current.forEach(clearTimeout), []);
  const showToast = (message) => setToast(message);
  const runBuild = () => {
    setIsRunning(true);
    window.setTimeout(() => { setIsRunning(false); setRefreshCount(value => value + 1); showToast('Preview refreshed · Build successful'); }, 900);
  };
  const submitPrompt = (event) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isAssistantWorking) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(current => [...current, { role: 'user', text, time }]);
    setPrompt('');
    setIsAssistantWorking(true);
    setActivityStep(0);
    activityTimers.current = [];
    [900, 1800, 2700].forEach((delay, index) => {
      activityTimers.current.push(window.setTimeout(() => setActivityStep(index + 1), delay));
    });
    activityTimers.current.push(window.setTimeout(() => {
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setIsAssistantWorking(false);
      setActivityStep(0);
      setMessages(current => [...current, { role: 'assistant', time: replyTime, text: 'Request received. Connect your assistant endpoint to apply these edits and return live build updates.' }]);
      activityTimers.current = [];
    }, 3600));
  };
  return <div className="app-shell" data-theme={theme} style={theme === 'custom' ? { '--accent': customColor, '--accent-strong': customColor } : undefined}>
    <Rail />
    <FileSidebar open={filesOpen} activeFile={activeFile} setActiveFile={setActiveFile} onClose={() => setFilesOpen(false)} />
    <div className="workspace-main">
      <Topbar onToggleFiles={() => setFilesOpen(!filesOpen)} onToggleAssistant={() => setAssistantOpen(!assistantOpen)} onDeploy={() => showToast('Connect your existing deployment endpoint to publish.')} mobile={mobile} theme={theme} setTheme={setTheme} customColor={customColor} setCustomColor={setCustomColor} />
      <div className="workspace-content">
        <MainWorkspace mode={mode} setMode={setMode} activeFile={activeFile} device={device} setDevice={setDevice} onRefresh={() => setRefreshCount(value => value + 1)} onRun={runBuild} isRunning={isRunning} refreshCount={refreshCount} onToggleAssistant={() => setAssistantOpen(!assistantOpen)} mobile={mobile} />
        <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} autopilot={autopilot} setAutopilot={setAutopilot} prompt={prompt} setPrompt={setPrompt} messages={messages} onSubmit={submitPrompt} onToast={showToast} isAssistantWorking={isAssistantWorking} activityStep={activityStep} />
      </div>
    </div>
    <Toast message={toast} />
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
