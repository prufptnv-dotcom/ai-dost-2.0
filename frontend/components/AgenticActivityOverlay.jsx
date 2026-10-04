import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Activity, 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    Zap, 
    User, 
    Search, 
    Layout, 
    PenTool, 
    ShieldAlert,
    MessageSquare,
    Send
} from 'lucide-react';

/**
 * AgenticActivityOverlay: A real-time "Glass Box" visualization of the AI's cognitive process.
 * Now includes Interactive Intervention (Pause & Steer).
 */
const AgenticActivityOverlay = ({ 
    events = [], 
    isThinking = false, 
    onClose, 
    onIntervene // Callback to send steering feedback to backend
}) => {
    const scrollRef = useRef(null);
    const [showInterveneInput, setShowInterveneInput] = useState(false);
    const [interventionText, setInterventionText] = useState('');
    const [activeSessionId, setActiveSessionId] = useState(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events]);

    useEffect(() => {
        // Track the current active session from the latest event
        if (events.length > 0 && events[events.length - 1].sessionId) {
            setActiveSessionId(events[events.length - 1].sessionId);
        }
    }, [events]);

    const handleSendIntervention = async () => {
        if (!interventionText.trim()) return;
        
        try {
            await onIntervene({
                sessionId: activeSessionId,
                feedback: interventionText
            });
            setInterventionText('');
            setShowInterveneInput(false);
        } catch (e) {
            console.error("Intervention failed", e);
        }
    };

    const getAgentIcon = (agent) => {
        switch (agent?.toUpperCase()) {
            case 'DIRECTOR': return <User className="w-4 h-4 text-blue-400" />;
            case 'RESEARCHER': return <Search className="w-4 h-4 text-green-400" />;
            case 'ARCHITECT': return <Layout className="w-4 h-4 text-purple-400" />;
            case 'EXECUTOR': return <PenTool className="w-4 h-4 text-orange-400" />;
            case 'CRITIC': return <ShieldAlert className="w-4 h-4 text-red-400" />;
            default: return <Activity className="w-4 h-4 text-slate-400" />;
        }
    };

    const getEventStyle = (type) => {
        switch (type) {
            case 'PHASE_START': return 'bg-slate-800/50 border-slate-700';
            case 'PHASE_COMPLETE': return 'bg-blue-900/20 border-blue-800/50';
            case 'ITERATION_START': return 'bg-slate-800/50 border-slate-700';
            case 'DRAFT_CREATED': return 'bg-orange-900/20 border-orange-800/50';
            case 'ITERATION_REVIEW': return 'bg-slate-800/50 border-slate-700';
            case 'ITERATION_APPROVED': return 'bg-green-900/30 border-green-800/50';
            case 'ITERATION_REJECTED': return 'bg-red-900/20 border-red-800/50';
            case 'INTERVENTION_GATE': return 'bg-amber-900/30 border-amber-600 animate-pulse';
            case 'INTERVENTION_APPLIED': return 'bg-indigo-900/30 border-indigo-500';
            case 'TRUTH_CONFLICT': return 'bg-red-600/40 border-red-500 animate-pulse';
            default: return 'bg-slate-800/50 border-slate-700';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-md h-[650px] bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Zap className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-200">Agentic Swarm Intelligence</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Live Cognitive Process</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-500"
                    >
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* Event Stream */}
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
                >
                    {events.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                            <div className="p-4 bg-slate-900 rounded-full animate-pulse">
                                <Activity className="w-8 h-8 text-slate-700" />
                            </div>
                            <p className="text-slate-500 text-sm italic">Awaiting agentic signals...</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {events.map((ev, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`p-3 rounded-xl border ${getEventStyle(ev.type)} transition-all`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    {getAgentIcon(ev.agent)}
                                    <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                                        {ev.agent || 'SYSTEM'}
                                    </span>
                                    <span className="text-[10px] text-slate-600 ml-auto">
                                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    {ev.message || ev.result || ev.feedback || ev.draft?.slice(0, 100) + '...'}
                                </p>
                                
                                {ev.type === 'INTERVENTION_GATE' && (
                                    <button 
                                        onClick={() => setShowInterveneInput(true)}
                                        className="mt-2 flex items-center gap-1 text-[10px] bg-amber-600 text-white px-2 py-1 rounded-md hover:bg-amber-500 transition-colors font-bold"
                                    >
                                        <MessageSquare className="w-3 h-3" /> Steer Agent Now
                                    </button>
                                )}

                                {ev.type === 'ITERATION_APPROVED' && (
                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-green-400 font-bold">
                                        <CheckCircle2 className="w-3 h-3" /> Verified & Approved
                                    </div>
                                )}
                                {ev.type === 'TRUTH_CONFLICT' && (
                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400 font-bold">
                                        <AlertTriangle className="w-3 h-3" /> Hallucination Detected
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isThinking && (
                        <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-xl border border-slate-800 animate-pulse">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                            <span className="text-xs text-slate-400 italic">Agent is reasoning...</span>
                        </div>
                    )}
                </div>

                {/* Intervention Input Area */}
                <AnimatePresence>
                    {showInterveneInput && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 py-3 bg-slate-900 border-t border-amber-600/50 overflow-hidden"
                        >
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={interventionText}
                                    onChange={(e) => setInterventionText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendIntervention()}
                                    placeholder="Type your steering feedback..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <button 
                                    onClick={handleSendIntervention}
                                    className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <button 
                                onClick={() => setShowInterveneInput(false)}
                                className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 underline text-center w-full"
                            >
                                Cancel Intervention
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Status */}
                <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isThinking ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`} />
                        <span className="text-[10px] text-slate-500 font-medium">
                            {isThinking ? 'PROCESSING' : 'IDLE'}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-600">
                        v2.1 Stable Swarm
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AgenticActivityOverlay;
