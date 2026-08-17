import { useState, useEffect, useRef } from 'react';
import { History, MessageSquare, Trash2, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'abhi abhi';
  if (mins < 60) return `${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr pehle`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} din pehle`;
  return new Date(ts).toLocaleDateString();
}

export default function HistoryView({ onToast }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const scrollRef = useRef(null);

  const showToast = onToast || ((m, t) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/chat/history', { params: { session_id: 'default', limit: 100 } });
      const rows = Array.isArray(res.data) ? res.data : (res.data?.history || []);
      const grouped = {};
      for (const row of rows) {
        const sess = row.session_id || 'default';
        if (!grouped[sess]) grouped[sess] = { session: sess, messages: [], updatedAt: 0 };
        grouped[sess].messages.push(row);
        const t = new Date(row.timestamp || row.created_at || 0).getTime();
        if (t > grouped[sess].updatedAt) grouped[sess].updatedAt = t;
      }
      const list = Object.values(grouped).sort((a, b) => b.updatedAt - a.updatedAt);
      setSessions(list);
      if (list.length > 0) setExpanded(list[0].session);
    } catch (e) {
      setSessions([]);
      showToast('History load nahi hui — backend off?', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const clearHistory = async () => {
    if (!window.confirm('Saara chat history delete karein?')) return;
    try {
      await api.delete('/chat/history', { params: { session_id: 'default' } });
      setSessions([]);
      setExpanded(null);
      showToast('History cleared', 'success');
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Chat History</h1>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Aapki baatein SQLite me saved — bilkul private</p>
          </div>
        </div>
        {sessions.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-6 py-6">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl skeleton" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center pt-20">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(75,139,252,0.1)' }}>
                <MessageSquare className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h2 className="mt-4 text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Abhi tak koi history nahi</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Chat me jaake baat karo — pehli baat yahan save hogi.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.session} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                  <button
                    onClick={() => setExpanded(expanded === s.session ? null : s.session)}
                    className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(161,66,244,0.15)' }}>
                      <MessageSquare className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {s.messages[0]?.user_message || s.messages[0]?.prompt || s.session}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        <Clock className="w-3 h-3" /> {timeAgo(s.updatedAt)}
                        <span>•</span> {s.messages.length} messages
                      </div>
                    </div>
                    {expanded === s.session ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />}
                  </button>
                  {expanded === s.session && (
                    <div className="px-4 pb-4 space-y-2">
                      {s.messages.map((msg, idx) => (
                        <div key={idx} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)' }}>
                          <div className="text-[11px] font-bold mb-1" style={{ color: 'var(--color-primary)' }}>You</div>
                          <p className="text-xs leading-relaxed break-words" style={{ color: 'var(--color-text-secondary)' }}>
                            {msg.user_message || msg.prompt || ''}
                          </p>
                          {msg.response && (
                            <>
                              <div className="text-[11px] font-bold mt-2 mb-1" style={{ color: 'var(--color-secondary)' }}>AI-Dost</div>
                              <p className="text-xs leading-relaxed break-words whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                                {msg.response.slice(0, 500)}{msg.response.length > 500 ? '…' : ''}
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}