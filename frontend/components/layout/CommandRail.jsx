import React from 'react';
import { MessageSquare, Bot, Code2, FolderKanban, FileText, Plus, Sun, Moon, Settings, FileUser, Mic2, History, PlugZap, Image as ImageIcon } from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

export function CommandRail({ currentView = 'chat', onSelectView, onNewChat, theme = 'dark', onToggleTheme, className = '' }) {
  const groups = [
    { label:'Workspace', items:[
      {id:'chat',label:'Chat',icon:MessageSquare,hint:'Ctrl+1'},
      {id:'agent',label:'Agent Workbench',icon:Bot,hint:'Ctrl+2'},
      {id:'copilot',label:'Copilot IDE',icon:Code2,hint:'Ctrl+3'},
      {id:'projects',label:'Projects',icon:FolderKanban,hint:'Ctrl+4'},
      {id:'artifacts',label:'Artifacts',icon:FileText,hint:'Ctrl+5'}
    ]},
    { label:'Tools', items:[
      {id:'resume',label:'Resume Builder',icon:FileUser},
      {id:'voice',label:'Voice Studio',icon:Mic2},
      {id:'images',label:'Image Studio',icon:ImageIcon},
      {id:'mcp',label:'MCP Integrations',icon:PlugZap},
      {id:'history',label:'History',icon:History}
    ]}
  ];
  return (
    <aside aria-label="AI-Dost navigation" className={'aidost-sidebar w-[248px] shrink-0 h-full flex flex-col bg-canvas-subtle border-r border-border select-none z-50 ' + className}>
      <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
        <button type="button" onClick={() => onSelectView?.('chat')} className="flex items-center gap-2.5 min-w-0 rounded-lg focus-ring cursor-pointer" title="AI-Dost Home">
          <span className="w-8 h-8 rounded-lg bg-canvas-surface border border-border flex items-center justify-center shrink-0"><AiDostMark size={20} /></span>
          <span className="text-sm font-semibold tracking-tight text-paper-100">AI-Dost</span>
        </button>
        <span className="text-[9px] font-mono text-ink-muted px-1.5 py-1 rounded-md bg-canvas-surface border border-border">2.0</span>
      </div>
      <div className="px-3 pt-3">
        {onNewChat && <button type="button" onClick={onNewChat} className="w-full h-10 px-3 rounded-lg flex items-center justify-between gap-3 bg-accent text-white hover:bg-accent-hover transition-fast cursor-pointer focus-ring shadow-sm"><span className="flex items-center gap-2 text-sm font-semibold"><Plus className="w-4 h-4" /> New task</span><kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded-md bg-black/15 text-white/80">Ctrl+N</kbd></button>}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Workspace views">
        {groups.map(group => <section key={group.label} aria-label={group.label}><div className="px-2 mb-2 text-[9px] font-mono uppercase tracking-[0.16em] text-ink-muted">{group.label}</div><div className="space-y-1">
          {group.items.map(({id,label,icon:Icon,hint}) => { const active=currentView===id; return <button key={id} data-nav={id} type="button" onClick={() => onSelectView?.(id)} aria-current={active?'page':undefined} title={hint ? label + ' — ' + hint : label} className={'group relative w-full min-h-10 px-3 rounded-lg flex items-center gap-3 text-left transition-fast cursor-pointer focus-ring ' + (active ? 'bg-accent-subtle text-paper-100' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface')}>{active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-accent" />}<span className={'w-7 h-7 rounded-md flex items-center justify-center shrink-0 ' + (active ? 'bg-accent/15 text-accent' : 'text-current')}><Icon className="w-4 h-4" /></span><span className="flex-1 text-xs font-medium">{label}</span>{hint && <kbd className="hidden xl:inline font-mono text-[9px] text-ink-muted group-hover:text-paper-300">{hint}</kbd>}</button>; })}
        </div></section>)}
      </nav>
      <div className="px-3 pb-3 space-y-2 shrink-0">
        <div className="p-3 rounded-xl bg-canvas-surface border border-border"><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-semibold text-paper-200">System status</span><span className="flex items-center gap-1.5 text-[9px] font-mono text-status-success"><span className="w-1.5 h-1.5 rounded-full bg-status-success" /> Online</span></div><div className="text-[10px] text-ink-muted">AI engine · Database · Workspace</div></div>
        <div className="flex items-center gap-1">
          {onToggleTheme && <button type="button" onClick={onToggleTheme} className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer focus-ring" title={theme==='dark'?'Switch to Light':'Switch to Dark'}>{theme==='dark'?<Sun className="w-3.5 h-3.5" />:<Moon className="w-3.5 h-3.5" />}{theme==='dark'?'Light':'Dark'}</button>}
          <button type="button" onClick={() => onSelectView?.('settings')} className={'w-10 h-9 rounded-lg flex items-center justify-center transition-fast cursor-pointer focus-ring ' + (currentView==='settings'?'bg-accent-subtle text-accent':'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface')} title="Settings" aria-label="Settings"><Settings className="w-4 h-4" /></button>
        </div>
      </div>
    </aside>
  );
}
export default CommandRail;