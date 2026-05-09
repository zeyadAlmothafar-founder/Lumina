import { useState } from 'react';
import { marked } from 'marked';
import { t } from '../i18n.js';

marked.setOptions({ breaks: true, gfm: true });

// Convert [Source: …] / [Fuente: …] / [المصدر: …] to clickable Wikipedia links
function preprocessSynthesis(text) {
  return (text || '')
    .replace(/\[(Source|Fuente|المصدر):\s*([^\]]+)\]/g, (_, _label, title) => {
      const slug = encodeURIComponent(title.trim().replace(/\s+/g, '_'));
      const url  = `https://en.wikipedia.org/wiki/${slug}`;
      return `<a class="synth-cite" href="${url}" target="_blank" rel="noopener noreferrer">📚 ${title.trim()}</a>`;
    });
}

export default function SynthesisScreen({ session, onRestart, lang = 'en' }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const res = await fetch(`/api/session/${session.sessionId}/docx`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'debate-outline.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 debate-scroll" style={{ background: 'var(--bg-landing)' }}>
      <div className="max-w-4xl mx-auto pb-10">

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined" style={{ color: '#F08D39', fontSize: 26, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--t1)', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{t(lang, 'synthTitle')}</h1>
            </div>
            <p className="text-sm" style={{ color: 'rgba(var(--t-rgb),0.5)' }}>"{session.topic}"</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #F08D39, #c47a2f)', color: '#222222',
                       boxShadow: '0 4px 16px rgba(240,141,57,0.3)', opacity: downloading ? 0.7 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
              {downloading
                ? <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                          style={{ borderColor: 'rgba(34,34,34,0.3)', borderTopColor: '#222' }} />
                    {t(lang, 'synthDownloading')}
                  </span>
                : t(lang, 'synthDownload')}
            </button>
            <button
              onClick={onRestart}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.12)', color: 'rgba(var(--b-rgb),0.6)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--b-rgb),0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}
            >
              {t(lang, 'synthNewDebate')}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm mb-4 rounded-xl px-4 py-2.5"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        <div className="rounded-2xl p-8 shadow-2xl"
             style={{ background: 'var(--bg-card-2)', border: '1px solid rgba(240,141,57,0.2)',
                      backdropFilter: 'blur(12px)', boxShadow: '0 0 40px rgba(240,141,57,0.08)' }}>
          <style>{`
            .synthesis-content h1 { color: var(--t1); font-size: 1.45rem; font-weight: 700; margin: 0 0 1.25rem; line-height: 1.4; }
            .synthesis-content h2 { color: #F08D39; font-size: 1.1rem; font-weight: 600; margin: 1.75rem 0 0.6rem; padding-bottom: 0.3rem; border-bottom: 1px solid rgba(240,141,57,0.2); }
            .synthesis-content h3 { color: var(--t2); font-size: 0.95rem; font-weight: 600; margin: 1rem 0 0.35rem; }
            .synthesis-content p  { color: var(--t1); opacity: 0.85; line-height: 1.75; margin-bottom: 0.8rem; font-size: 0.92rem; }
            .synthesis-content li { color: var(--t1); opacity: 0.82; line-height: 1.65; font-size: 0.92rem; margin-bottom: 0.35rem; }
            .synthesis-content ul, .synthesis-content ol { padding-left: 1.5rem; margin-bottom: 0.9rem; }
            .synthesis-content strong { color: var(--t2); font-weight: 600; opacity: 1; }
            .synthesis-content em    { opacity: 0.75; font-style: italic; }
            .synth-cite {
              display: inline-flex; align-items: center; gap: 3px;
              background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3);
              color: #93c5fd; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px;
              margin: 0 3px; vertical-align: middle; font-family: inherit;
              text-decoration: none; cursor: pointer; transition: background 0.15s, border-color 0.15s;
            }
            .synth-cite:hover {
              background: rgba(59,130,246,0.25); border-color: rgba(59,130,246,0.6);
              color: #bfdbfe;
            }
          `}</style>
          <div
            className="synthesis-content"
            dangerouslySetInnerHTML={{ __html: marked.parse(preprocessSynthesis(session.synthesis)) }}
          />
        </div>

        <p className="text-center mt-5 text-xs" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>
          {t(lang, 'synthFooter')}
        </p>
      </div>
    </div>
  );
}
