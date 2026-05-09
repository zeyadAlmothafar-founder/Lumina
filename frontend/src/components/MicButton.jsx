import { useState, useRef } from 'react';
import { t } from '../i18n.js';

// Detect Web Speech API — supported in Chrome, Edge, Safari 14.1+; NOT Firefox
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// iOS kills continuous recognition after silence — we restart it transparently
const isIOS = typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

const LANG_CODES = { en: 'en-US', es: 'es-ES', ar: 'ar-SA' };

// Returns null on unsupported browsers (Firefox etc.) — caller renders nothing
export default function MicButton({ onRecorded, disabled, lang = 'en' }) {
  const [recording, setRecording] = useState(false);
  const recognitionRef  = useRef(null);
  const transcriptRef   = useRef('');
  const shouldKeepRef   = useRef(false); // true while user is holding

  // Graceful degradation — hide button entirely on unsupported browsers
  if (!SpeechRecognition) return null;

  const start = () => {
    if (disabled || recording) return;

    const rec = new SpeechRecognition();
    rec.lang           = LANG_CODES[lang] || 'en-US';
    rec.continuous     = true;
    rec.interimResults = false;
    recognitionRef.current = rec;
    transcriptRef.current  = '';
    shouldKeepRef.current  = true;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          transcriptRef.current += e.results[i][0].transcript + ' ';
        }
      }
    };

    rec.onend = () => {
      // iOS auto-stops continuous recognition on silence — restart while still holding
      if (isIOS && shouldKeepRef.current) {
        try { rec.start(); } catch { /* ignore restart errors */ }
        return;
      }
      setRecording(false);
      const text = transcriptRef.current.trim();
      if (text) onRecorded(text);
      recognitionRef.current = null;
    };

    rec.onerror = (e) => {
      // 'no-speech' is normal on iOS when mic catches silence — don't treat as failure
      if (isIOS && e.error === 'no-speech') return;
      console.warn('[mic]', e.error);
      shouldKeepRef.current = false;
      setRecording(false);
      recognitionRef.current = null;
    };

    rec.start();
    setRecording(true);
  };

  const stop = () => {
    shouldKeepRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      setRecording(false);
    }
  };

  return (
    <button
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={e => { e.preventDefault(); start(); }}
      onTouchEnd={e => { e.preventDefault(); stop(); }}
      disabled={disabled && !recording}
      title={t(lang, 'micHold')}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm select-none transition-all"
      style={recording
        ? { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5', transform: 'scale(1.04)' }
        : disabled
        ? { background: 'rgba(var(--b-rgb),0.04)', border: '1px solid rgba(var(--b-rgb),0.08)', color: 'rgba(var(--b-rgb),0.25)', cursor: 'not-allowed' }
        : { background: 'rgba(244,143,104,0.1)', border: '1px solid rgba(244,143,104,0.3)', color: '#F48F68' }
      }
    >
      <span className={`text-base ${recording ? 'animate-pulse' : ''}`}>{recording ? '🔴' : '🎤'}</span>
      <span>{recording ? t(lang, 'micRelease') : t(lang, 'micHold')}</span>
    </button>
  );
}
