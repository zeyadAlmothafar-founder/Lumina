import { useState, useRef } from 'react';
import { t } from '../i18n.js';

export default function NotesPanel({ notes, onAdd, onDelete, onClearAll, lang, isOpen, onClose }) {
  const [draft, setDraft] = useState('');
  const textRef = useRef(null);

  const handleAdd = () => {
    if (!draft.trim()) return;
    onAdd({ text: draft.trim(), source: 'manual', timestamp: Date.now() });
    setDraft('');
  };

  const handleDownload = () => {
    const content = notes.map((n, i) => {
      const d = new Date(n.timestamp).toLocaleString();
      return `[${i + 1}] ${d}${n.source !== 'manual' ? ` — ${n.source}` : ''}\n${n.text}`;
    }).join('\n\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-notes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    const win = window.open('', '_blank');
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>My Notes</title>
      <style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #222; line-height: 1.6; }
        h1 { font-size: 24px; border-bottom: 2px solid #F08D39; padding-bottom: 8px; }
        .note { margin: 20px 0; padding: 16px; border-left: 3px solid #F08D39; background: #fff8f0; }
        .meta { font-size: 12px; color: #888; margin-bottom: 6px; }
        .text { white-space: pre-wrap; }
        hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
      </style>
    </head><body>
      <h1>📌 My Notes</h1>
      ${notes.map((n, i) => `
        <div class="note">
          <div class="meta">#${i + 1} · ${new Date(n.timestamp).toLocaleString()}${n.source !== 'manual' ? ` · ${n.source}` : ''}</div>
          <div class="text">${n.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
      `).join('<hr>')}
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  if (!isOpen) return null;

  const isRtl = lang === 'ar';

  return (
    <div
      className="flex flex-col flex-shrink-0 h-screen"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        width: 300,
        background: 'var(--bg-card)',
        borderLeft: '1px solid rgba(56,82,180,0.15)',
        boxShadow: '-4px 0 20px rgba(56,82,180,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3"
           style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ color: '#F08D39', fontSize: 20 }}>push_pin</span>
          <span className="font-bold text-sm" style={{ color: 'var(--t1)' }}>{t(lang, 'notesTitle')}</span>
          {notes.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(240,141,57,0.15)', color: '#F08D39' }}>
              {notes.length}
            </span>
          )}
        </div>
        <button onClick={onClose}
                className="transition-opacity hover:opacity-60"
                style={{ color: 'rgba(var(--t-rgb),0.4)', fontSize: 18 }}>✕</button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 debate-scroll">
        {notes.length === 0 ? (
          <p className="text-xs text-center mt-8 leading-relaxed px-2"
             style={{ color: 'rgba(var(--t-rgb),0.35)' }}>
            {t(lang, 'notesEmpty')}
          </p>
        ) : notes.map((n, i) => (
          <div key={n.timestamp + i}
               className="rounded-xl p-3 group relative"
               style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--t-rgb),0.06)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {n.source !== 'manual' && (
                  <p className="text-xs mb-1" style={{ color: '#F08D39', opacity: 0.8 }}>{n.source}</p>
                )}
                <p className="text-xs leading-relaxed whitespace-pre-wrap"
                   style={{ color: 'var(--t1)' }}>{n.text}</p>
                <p className="text-xs mt-1.5" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>
                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => onDelete(i)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-0.5 rounded"
                      style={{ color: '#ef4444' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add note textarea */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(var(--t-rgb),0.08)' }}>
        <textarea
          ref={textRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t(lang, 'notesAdd')}
          rows={3}
          onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAdd()}
          className="w-full rounded-xl p-3 text-xs resize-none focus:outline-none mb-2"
          style={{
            background: 'var(--bg-input)',
            border: `1px solid ${draft ? 'rgba(240,141,57,0.5)' : 'rgba(var(--t-rgb),0.1)'}`,
            color: 'var(--t1)',
          }}
        />
        <button onClick={handleAdd} disabled={!draft.trim()}
                className="w-full py-2 rounded-xl text-xs font-semibold mb-2 transition-all"
                style={draft.trim()
                  ? { background: 'rgba(240,141,57,0.12)', border: '1px solid rgba(240,141,57,0.35)', color: '#F08D39' }
                  : { background: 'var(--bg-input)', color: 'rgba(var(--t-rgb),0.25)', cursor: 'not-allowed' }}>
          + Add Note
        </button>

        {notes.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handlePrintPdf}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#fff' }}>
              {t(lang, 'notesDownload')} PDF
            </button>
            <button onClick={handleDownload}
                    className="py-2 px-3 rounded-xl text-xs font-medium transition-all"
                    style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--t-rgb),0.1)', color: 'rgba(var(--t-rgb),0.5)' }}>
              .txt
            </button>
            <button onClick={onClearAll}
                    className="py-2 px-3 rounded-xl text-xs font-medium transition-all"
                    style={{ color: 'rgba(239,68,68,0.6)', border: '1px solid rgba(239,68,68,0.15)' }}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
