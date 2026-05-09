import { useState, useRef, useEffect, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { marked } from 'marked';
import { t } from '../i18n.js';

marked.setOptions({ breaks: true, gfm: true });

// Web Speech API support — Chrome, Edge, Safari 14.1+; absent in Firefox
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// iOS stops non-continuous recognition quickly on silence — detect for error handling
const isIOS = typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Strip triple-backtick code fences wrapping plain-text analysis.
// The model sometimes puts its entire response inside ``` blocks even when
// the content is markdown prose — this converts those to plain markdown text.
function stripOuterFences(text) {
  // Remove a single outer fence that wraps the whole response (e.g. ```markdown … ```)
  return text.replace(/^```[a-z]*\n([\s\S]*?)\n```\s*$/gm, '$1')
             .replace(/^```[a-z]*\n([\s\S]*?)```/gm, '$1')
             .trim();
}

const LANG_CODES = { en: 'en-US', es: 'es-ES', ar: 'ar-SA' };
const MIN_CHAT_W = 280;
const MAX_CHAT_W = 660;
const DEF_CHAT_W = 400;

let msgId = 0;
const nextId = () => ++msgId;

// Markdown styles injected once — uses CSS vars so they respond to theme changes
const MD_STYLE = `
.wb-md { font-size: 0.8rem; line-height: 1.65; color: rgba(var(--b-rgb),0.9); }
.wb-md p  { margin: 0 0 0.55rem; }
.wb-md p:last-child { margin-bottom: 0; }
.wb-md h1 { font-size: 1rem;   font-weight: 700; color: var(--t1); margin: 0.6rem 0 0.35rem; }
.wb-md h2 { font-size: 0.9rem; font-weight: 700; color: #F08D39;  margin: 0.6rem 0 0.3rem; }
.wb-md h3 { font-size: 0.82rem;font-weight: 600; color: var(--t2);  margin: 0.5rem 0 0.25rem; }
.wb-md ul, .wb-md ol { padding-left: 1.2rem; margin: 0 0 0.5rem; }
.wb-md li { margin-bottom: 0.2rem; }
.wb-md strong { color: var(--t1); font-weight: 600; }
.wb-md em { color: rgba(var(--b-rgb),0.75); font-style: italic; }
.wb-md code { font-family: monospace; font-size: 0.78rem; background: rgba(var(--b-rgb),0.08); border-radius: 4px; padding: 0.1em 0.35em; color: #8BDFDD; }
.wb-md pre  { background: rgba(var(--b-rgb),0.06); border: 1px solid rgba(var(--b-rgb),0.1); border-radius: 8px; padding: 0.6rem 0.8rem; margin: 0.4rem 0; overflow-x: auto; }
.wb-md pre code { background: none; padding: 0; color: #8BDFDD; }
.wb-md blockquote { border-left: 3px solid #F08D39; padding-left: 0.7rem; margin: 0.4rem 0; color: rgba(var(--b-rgb),0.6); }
.wb-md a { color: #F08D39; text-decoration: underline; }
.wb-md hr { border: none; border-top: 1px solid rgba(var(--b-rgb),0.1); margin: 0.5rem 0; }
`;

export default function AIWhiteboard({ lang = 'en', onSaveNote, theme = 'dark' }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [messages, setMessages]           = useState(() => [
    { id: nextId(), role: 'model', text: t(lang, 'wbWelcome') },
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [chatWidth, setChatWidth] = useState(DEF_CHAT_W);

  const chatEndRef    = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef  = useRef('');
  const inputRef       = useRef(null);
  const messagesRef    = useRef(messages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Resize drag handle ──────────────────────────────────────────────────────
  const startResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatWidth;

    const onMove = (ev) => {
      const delta = startX - ev.clientX;          // drag left → wider panel
      setChatWidth(Math.max(MIN_CHAT_W, Math.min(MAX_CHAT_W, startW + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [chatWidth]);

  // ── Snapshot ────────────────────────────────────────────────────────────────
  const takeSnapshot = useCallback(async () => {
    if (!excalidrawAPI || snapping) return;
    setSnapping(true);
    try {
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: { ...excalidrawAPI.getAppState(), exportBackground: true, exportWithDarkMode: theme !== 'light' },
        files: excalidrawAPI.getFiles(),
        mimeType: 'image/png',
        quality: 0.92,
      });
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        setSnapshot(prev => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
          return { base64, previewUrl: URL.createObjectURL(blob) };
        });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('[whiteboard/snapshot]', err);
    } finally {
      setSnapping(false);
    }
  }, [excalidrawAPI, snapping]);

  const removeSnapshot = useCallback(() => {
    setSnapshot(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !snapshot) return;
    if (loading) return;

    const userMsg = {
      id: nextId(),
      role: 'user',
      text: text || '(see attached whiteboard)',
      hasImage: !!snapshot,
      previewUrl: snapshot?.previewUrl,
    };

    const capturedSnapshot = snapshot;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSnapshot(null);
    setLoading(true);

    try {
      const history = messagesRef.current
        .filter(m => m.id !== 1)
        .slice(-10)
        .map(m => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/whiteboard/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          imageBase64: capturedSnapshot?.base64 || null,
          mimeType: 'image/png',
          history,
          language: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMessages(prev => [...prev, { id: nextId(), role: 'model', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: nextId(), role: 'model', text: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, snapshot, loading, lang]);

  // ── Voice input ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (recording || !SpeechRecognitionAPI) return;
    const rec = new SpeechRecognitionAPI();
    rec.lang           = LANG_CODES[lang] || 'en-US';
    rec.continuous     = false;
    rec.interimResults = false;
    recognitionRef.current = rec;
    transcriptRef.current  = '';

    rec.onresult = e => {
      // Collect all final results (some browsers fire multiple)
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcriptRef.current += e.results[i][0].transcript + ' ';
      }
    };
    rec.onend = () => {
      setRecording(false);
      const text = transcriptRef.current.trim();
      if (text) setInput(prev => (prev + ' ' + text).trim());
      recognitionRef.current = null;
      inputRef.current?.focus();
    };
    rec.onerror = (e) => {
      // iOS fires 'no-speech' on silence — let onend handle cleanup naturally
      if (isIOS && e.error === 'no-speech') return;
      console.warn('[wb-mic]', e.error);
      setRecording(false);
      recognitionRef.current = null;
    };

    rec.start();
    setRecording(true);
  }, [recording, lang]);

  const stopRecording = useCallback(() => { recognitionRef.current?.stop(); }, []);

  const clearChat = useCallback(() => {
    setMessages([{ id: nextId(), role: 'model', text: t(lang, 'wbWelcome') }]);
  }, [lang]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      <style>{MD_STYLE}</style>

      {/* ── Excalidraw canvas ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 relative">
        <Excalidraw
          excalidrawAPI={api => setExcalidrawAPI(api)}
          theme={theme}
          initialData={{ appState: { viewBackgroundColor: theme === 'light' ? '#fef8f0' : '#1e1e2e', currentItemFontFamily: 1 } }}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: true,
              export: false,
              saveAsImage: false,
              changeViewBackgroundColor: true,
            },
          }}
        />
        {/* Hint badge */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
               style={{ background: 'rgba(26,16,8,0.75)', border: '1px solid rgba(240,141,57,0.2)', color: 'rgba(var(--t-rgb),0.45)', backdropFilter: 'blur(8px)' }}>
            📸 {t(lang, 'wbSnapshotTip')}
          </div>
        </div>
      </div>

      {/* ── Drag handle ───────────────────────────────────────────────────── */}
      <div
        onMouseDown={startResize}
        className="flex-shrink-0 flex items-center justify-center group"
        style={{
          width: 6,
          cursor: 'col-resize',
          background: 'rgba(240,141,57,0.08)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,141,57,0.25)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(240,141,57,0.08)'}
        title="Drag to resize"
      >
        <div className="w-0.5 h-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
             style={{ background: '#F08D39' }} />
      </div>

      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{
          width: chatWidth,
          background: 'var(--bg-chat-panel)',
          borderLeft: '1px solid rgba(240,141,57,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
             style={{ borderBottom: '1px solid rgba(240,141,57,0.15)' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <span className="font-bold text-sm" style={{ color: 'var(--t1)' }}>
                {t(lang, 'wbChatTitle')}
              </span>
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>
              {t(lang, 'wbSub')}
            </p>
          </div>
          {messages.length > 1 && (
            <button onClick={clearChat}
                    className="text-xs px-2.5 py-1 rounded-lg transition-all flex-shrink-0"
                    style={{ color: 'rgba(var(--t-rgb),0.3)', border: '1px solid rgba(var(--t-rgb),0.1)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(var(--t-rgb),0.6)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(var(--t-rgb),0.3)'}>
              {t(lang, 'wbClear')}
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 debate-scroll">
          {messages.map(msg => (
            <ChatBubble key={msg.id} msg={msg} lang={lang} onSaveNote={onSaveNote} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start items-end gap-2">
              <GemmaAvatar />
              <div className="px-4 py-3 rounded-2xl"
                   style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.1)', borderRadius: '4px 16px 16px 16px' }}>
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                          style={{ background: '#F08D39', animationDelay: `${i * 0.18}s`, animationDuration: '0.9s' }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Snapshot preview */}
        {snapshot && (
          <div className="flex-shrink-0 mx-3 mb-2 rounded-xl overflow-hidden relative"
               style={{ border: '1px solid rgba(240,141,57,0.35)', background: 'rgba(240,141,57,0.06)' }}>
            <img src={snapshot.previewUrl} alt="whiteboard preview" className="w-full block"
                 style={{ maxHeight: 110, objectFit: 'contain' }} />
            <button onClick={removeSnapshot}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(26,16,8,0.85)', color: 'rgba(var(--t-rgb),0.7)' }}>✕</button>
            <div className="absolute bottom-1.5 left-2 text-xs px-2 py-0.5 rounded-full"
                 style={{ background: 'rgba(26,16,8,0.75)', color: '#F08D39' }}>
              📸 {t(lang, 'wbSnapshotAttached')}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid rgba(240,141,57,0.12)' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t(lang, 'wbTypePh')}
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none mb-2.5"
            style={{
              background: 'var(--bg-input)',
              border: `1.5px solid ${input ? '#F08D39' : 'rgba(var(--t-rgb),0.12)'}`,
              color: 'var(--t1)',
              transition: 'border-color 0.15s',
            }}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) sendMessage(); }}
          />
          <div className="flex items-center gap-2">
            {/* 📸 Snapshot */}
            <button onClick={takeSnapshot} disabled={!excalidrawAPI || snapping}
                    title={t(lang, 'wbSnapshotTip')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
                    style={snapshot
                      ? { background: 'rgba(240,141,57,0.22)', border: '1px solid rgba(240,141,57,0.55)', color: '#F08D39' }
                      : snapping
                      ? { background: 'var(--bg-input)', color: 'rgba(var(--t-rgb),0.3)', cursor: 'wait' }
                      : { background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.14)', color: 'rgba(var(--b-rgb),0.55)' }}>
              {snapping ? '⏳' : '📸'} {t(lang, 'wbSnapshot')}
            </button>

            {/* 🎤 Voice — hidden on browsers without Web Speech API (e.g. Firefox) */}
            {SpeechRecognitionAPI && (
              <button onMouseDown={startRecording} onMouseUp={stopRecording}
                      onMouseLeave={stopRecording}
                      onTouchStart={e => { e.preventDefault(); startRecording(); }}
                      onTouchEnd={e => { e.preventDefault(); stopRecording(); }}
                      className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-all select-none"
                      style={recording
                        ? { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' }
                        : { background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.12)', color: 'rgba(var(--b-rgb),0.45)' }}>
                <span className={`text-base ${recording ? 'animate-pulse' : ''}`}>{recording ? '🔴' : '🎤'}</span>
              </button>
            )}

            {/* Send */}
            <button onClick={sendMessage} disabled={loading || (!input.trim() && !snapshot)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={loading || (!input.trim() && !snapshot)
                      ? { background: 'var(--bg-input)', color: 'rgba(var(--b-rgb),0.2)', cursor: 'not-allowed' }
                      : { background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 2px 12px rgba(240,141,57,0.3)' }}>
              {loading ? '…' : t(lang, 'wbSend')}
            </button>
          </div>
          <p className="text-xs mt-1.5 text-center" style={{ color: 'rgba(var(--t-rgb),0.18)' }}>
            Ctrl+Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GemmaAvatar() {
  return (
    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1"
         style={{ background: 'rgba(240,141,57,0.2)', color: '#F08D39', border: '1px solid rgba(240,141,57,0.3)' }}>
      G
    </div>
  );
}

function ChatBubble({ msg, lang, onSaveNote }) {
  const isUser    = msg.role === 'user';
  const isWelcome = msg.id === 1;

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <GemmaAvatar />}

      <div
        className="max-w-[88%]"
        style={isUser
          ? {
              background: 'rgba(240,141,57,0.12)',
              border: '1px solid rgba(240,141,57,0.25)',
              color: 'var(--t1)',
              borderRadius: '16px 4px 16px 16px',
              padding: '10px 14px',
              fontSize: '0.8rem',
              lineHeight: 1.65,
            }
          : {
              background: isWelcome ? 'rgba(240,141,57,0.06)' : 'var(--bg-input)',
              border: `1px solid ${isWelcome ? 'rgba(240,141,57,0.2)' : 'rgba(var(--b-rgb),0.09)'}`,
              borderRadius: '4px 16px 16px 16px',
              padding: '10px 14px',
            }
        }
      >
        {/* Snapshot thumbnail */}
        {msg.hasImage && msg.previewUrl && (
          <div className="mb-2">
            <img src={msg.previewUrl} alt="whiteboard"
                 className="rounded-xl w-full mb-1.5"
                 style={{ maxHeight: 130, objectFit: 'contain', border: '1px solid rgba(240,141,57,0.2)', background: 'var(--bg-input)' }} />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(240,141,57,0.15)', color: '#F08D39', border: '1px solid rgba(240,141,57,0.25)', fontSize: 10 }}>
              📸 {t(lang, 'wbSnapshotAttached')}
            </span>
          </div>
        )}

        {/* Message body — markdown for Gemma, plain text for user */}
        {isUser
          ? <p className="whitespace-pre-wrap" style={{ fontSize: '0.8rem', lineHeight: 1.65 }}>{msg.text}</p>
          : <div className="wb-md" dangerouslySetInnerHTML={{ __html: marked.parse(stripOuterFences(msg.text)) }} />
        }

        {/* Save to notes */}
        {!isUser && !isWelcome && onSaveNote && (
          <button onClick={() => onSaveNote({ text: msg.text, source: t(lang, 'wbTitle') })}
                  className="mt-2 block transition-opacity"
                  style={{ color: 'rgba(240,141,57,0.4)', fontSize: 10 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#F08D39'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,141,57,0.4)'}>
            {t(lang, 'wbSaveNote')}
          </button>
        )}
      </div>
    </div>
  );
}
