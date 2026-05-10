import { useState, useEffect } from 'react';
import { getAllSessions, deleteSession, clearAllSessions } from '../db.js';

const TYPE_META = {
  gps:        { icon: 'explore',     color: '#F08D39', label: 'Learning GPS' },
  quiz:       { icon: 'quiz',        color: '#8BDFDD', label: 'Flash & Quiz' },
  debate:     { icon: 'forum',       color: '#93c5fd', label: 'Debate Arena' },
  exam:       { icon: 'school',      color: '#c084fc', label: 'The Examiner' },
  whiteboard: { icon: 'history_edu', color: '#34d399', label: 'AI Whiteboard' },
};

function formatDate(d) {
  const date = new Date(d);
  const diff  = Date.now() - date;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000)return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString();
}

export default function HistoryPanel({ isOpen, onClose, onLoad, lang = 'en' }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getAllSessions()
      .then(s => { setSessions(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isOpen]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await deleteSession(id);
    setSessions(s => s.filter(x => x.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm(lang === 'ar' ? 'مسح جميع الجلسات؟' : lang === 'es' ? '¿Borrar todas las sesiones?' : 'Clear all saved sessions?')) return;
    await clearAllSessions();
    setSessions([]);
  };

  if (!isOpen) return null;

  const TITLE = lang === 'ar' ? 'سجل الجلسات' : lang === 'es' ? 'Historial' : 'Session History';
  const EMPTY  = lang === 'ar' ? 'لا توجد جلسات محفوظة بعد' : lang === 'es' ? 'Aún no hay sesiones guardadas' : 'No saved sessions yet';
  const CLEAR  = lang === 'ar' ? 'مسح الكل' : lang === 'es' ? 'Borrar todo' : 'Clear all sessions';

  return (
    /* Overlay */
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      {/* Slide-in panel (right side) */}
      <div
        className="ml-auto h-full flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{
          width: 340,
          background: 'var(--bg-card)',
          borderLeft: '1px solid rgba(var(--t-rgb),0.08)',
          boxShadow: '-12px 0 48px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid rgba(var(--t-rgb),0.08)' }}>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined" style={{ color: '#F08D39', fontSize: 20 }}>history</span>
            <h2 className="font-bold text-sm" style={{ color: 'var(--t1)' }}>{TITLE}</h2>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'rgba(var(--t-rgb),0.4)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--t1)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(var(--t-rgb),0.4)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto debate-scroll px-3 py-3 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'rgba(var(--t-rgb),0.35)' }}>
              Loading…
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <span className="material-symbols-outlined" style={{ fontSize: 44, color: 'rgba(var(--t-rgb),0.12)' }}>history</span>
              <p className="text-sm text-center" style={{ color: 'rgba(var(--t-rgb),0.35)' }}>{EMPTY}</p>
            </div>
          ) : (
            sessions.map(s => {
              const meta = TYPE_META[s.type] || TYPE_META.gps;
              return (
                <button
                  key={s.id}
                  onClick={() => onLoad(s)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
                  style={{ background: 'rgba(var(--b-rgb),0.03)', border: '1px solid rgba(var(--b-rgb),0.07)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--b-rgb),0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(var(--b-rgb),0.03)'}
                >
                  {/* Type icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                       style={{ background: meta.color + '18', border: `1px solid ${meta.color}30` }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: meta.color }}>
                      {meta.icon}
                    </span>
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--t1)' }}>{s.title}</div>
                    <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: 'rgba(var(--t-rgb),0.38)' }}>
                      <span>{meta.label}</span>
                      <span>·</span>
                      <span>{formatDate(s.createdAt)}</span>
                    </div>
                  </div>

                  {/* Delete button — visible on hover */}
                  <button
                    onClick={(e) => handleDelete(s.id, e)}
                    className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'rgba(var(--t-rgb),0.35)' }}
                    onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = '#fca5a5'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(var(--t-rgb),0.35)'; }}
                    title="Delete this session"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(var(--t-rgb),0.06)' }}>
            <button
              onClick={handleClearAll}
              className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(252,165,165,0.06)', border: '1px solid rgba(252,165,165,0.15)', color: 'rgba(252,165,165,0.6)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(252,165,165,0.12)'; e.currentTarget.style.color = '#fca5a5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(252,165,165,0.06)'; e.currentTarget.style.color = 'rgba(252,165,165,0.6)'; }}
            >
              🗑 {CLEAR}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
