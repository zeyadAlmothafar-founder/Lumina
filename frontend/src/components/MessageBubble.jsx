import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

// Convert [Source: …] / [Fuente: …] / [المصدر: …] markers to clickable Wikipedia links
function preprocess(text) {
  return text.replace(/\[(Source|Fuente|المصدر):\s*([^\]]+)\]/g, (_, _label, title) => {
    const slug = encodeURIComponent(title.trim().replace(/\s+/g, '_'));
    const url  = `https://en.wikipedia.org/wiki/${slug}`;
    return `<a class="cite-chip" href="${url}" target="_blank" rel="noopener noreferrer">📚 ${title.trim()}</a>`;
  });
}

function renderMarkdown(text) {
  return { __html: marked.parse(preprocess(text)) };
}

const ACCENT = {
  devil:       { border: 'rgba(240,141,57,0.25)', bg: 'rgba(240,141,57,0.06)', label: '#F08D39' },
  consensus:   { border: 'rgba(139,223,221,0.25)', bg: 'rgba(139,223,221,0.06)', label: '#8BDFDD' },
  factchecker: { border: 'rgba(59,130,246,0.2)',   bg: 'rgba(59,130,246,0.05)',  label: '#93c5fd' },
};

export default function MessageBubble({ agentId, round, text, interrupt }) {
  const a = ACCENT[agentId];

  return (
    <div className="rounded-xl px-4 py-3"
         style={{ border: `1px solid ${a.border}`, background: a.bg }}>

      {/* Round badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold" style={{ color: a.label }}>Round {round}</span>
        {interrupt && (
          <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(240,141,57,0.15)', border: '1px solid rgba(240,141,57,0.3)', color: '#F08D39' }}>
            🎤 after your interrupt
          </span>
        )}
      </div>

      {/* Rendered markdown */}
      <style>{`
        .bubble-content p         { margin: 0 0 0.6rem; font-size: 0.875rem; line-height: 1.65; color: rgba(var(--b-rgb),0.88); }
        .bubble-content p:last-child { margin-bottom: 0; }
        .bubble-content ul, .bubble-content ol { padding-left: 1.25rem; margin: 0 0 0.5rem; }
        .bubble-content li        { font-size: 0.875rem; line-height: 1.6; color: rgba(var(--b-rgb),0.82); margin-bottom: 0.2rem; }
        .bubble-content strong    { color: var(--t1); font-weight: 600; }
        .bubble-content em        { font-style: italic; color: rgba(var(--b-rgb),0.75); }
        .bubble-content h1, .bubble-content h2, .bubble-content h3 {
          font-size: 0.875rem; font-weight: 600; color: var(--t1); margin: 0.5rem 0 0.25rem;
        }
        .cite-chip {
          display: inline-flex; align-items: center; gap: 3px;
          background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.35);
          color: #93c5fd; font-size: 0.7rem; padding: 1px 7px; border-radius: 9999px;
          margin: 0 2px; vertical-align: baseline; font-family: inherit;
          text-decoration: none; cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .cite-chip:hover {
          background: rgba(59,130,246,0.28); border-color: rgba(59,130,246,0.6);
          color: #bfdbfe;
        }
      `}</style>
      <div
        className="bubble-content"
        dangerouslySetInnerHTML={renderMarkdown(text)}
      />
    </div>
  );
}
