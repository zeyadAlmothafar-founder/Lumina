import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import LearningGPS from './components/LearningGPS.jsx';
import FlashQuiz from './components/FlashQuiz.jsx';
import TheExaminer from './components/TheExaminer.jsx';
import Landing from './components/Landing.jsx';
import DebateArena from './components/DebateArena.jsx';
import SynthesisScreen from './components/SynthesisScreen.jsx';
import NotesPanel from './components/NotesPanel.jsx';
import AIWhiteboard from './components/AIWhiteboard.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import { InferenceContext } from './context/InferenceContext.jsx';
import { saveSession } from './db.js';

// ── Debate section wrapper (landing → debate → synthesis phases) ──────────────
function DebateSection({ topicContext, onClearContext, lang, initialData }) {
  const [phase, setPhase] = useState(() => {
    if (initialData?.synthesis) return 'synthesis';
    return 'landing';
  });
  const [session, setSession] = useState(() => {
    if (initialData?.synthesis) {
      return { synthesis: initialData.synthesis, topic: initialData.topic, totalRounds: initialData.totalRounds, sessionId: null };
    }
    return null;
  });

  const handleStart  = useCallback((data) => { setSession(data); setPhase('debate'); }, []);
  const handleSynth  = useCallback((outline) => {
    setSession(s => {
      const next = { ...s, synthesis: outline };
      // Save debate session to local history after synthesis is ready
      saveSession('debate', s.topic || 'Debate', { topic: s.topic, totalRounds: s.totalRounds, synthesis: outline }).catch(() => {});
      return next;
    });
    setPhase('synthesis');
  }, []);
  const handleReset  = useCallback(() => {
    setSession(null); setPhase('landing');
    if (onClearContext) onClearContext();
  }, [onClearContext]);

  if (phase === 'landing')   return <Landing onStart={handleStart} prefillTopic={topicContext?.topic} lang={lang} />;
  if (phase === 'debate')    return <DebateArena session={session} onSynthesized={handleSynth} lang={lang} />;
  if (phase === 'synthesis') return <SynthesisScreen session={session} onRestart={handleReset} lang={lang} />;
}

const SECTION_LABELS = {
  gps:        { en: 'Learning GPS',   es: 'GPS de Aprendizaje', ar: 'خارطة التعلم' },
  quiz:       { en: 'Flash & Quiz',   es: 'Flash & Quiz',       ar: 'بطاقات وامتحان' },
  debate:     { en: 'Debate Arena',   es: 'Arena de Debate',    ar: 'ساحة النقاش' },
  examiner:   { en: 'The Examiner',   es: 'El Examinador',      ar: 'الممتحِن' },
  whiteboard: { en: 'AI Whiteboard',  es: 'Pizarra IA',         ar: 'السبورة الذكية' },
};

// db session type → app section id
const TYPE_TO_SECTION = { gps: 'gps', quiz: 'quiz', debate: 'debate', exam: 'examiner', whiteboard: 'whiteboard' };

export default function App() {
  const [section, setSection]          = useState('gps');
  const [lang, setLang]                = useState('en');
  const [theme, setTheme]              = useState('dark');
  const [notesOpen, setNotesOpen]      = useState(false);
  const [notes, setNotes]              = useState([]);
  const [topicContext, setTopicContext] = useState(null);
  // Incrementing a section's key causes its component to remount with fresh state
  const [sessionKeys, setSessionKeys]  = useState({ gps: 0, quiz: 0, debate: 0, examiner: 0, whiteboard: 0 });

  // ── Inference mode ─────────────────────────────────────────────────────────
  const [inferenceMode, setInferenceMode]     = useState('api'); // 'api' | 'local'
  const [showLocalWarning, setShowLocalWarning] = useState(false);

  // ── History panel ──────────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  // Per-section initialData: populated when user loads a past session
  const [initialData, setInitialData] = useState({ gps: null, quiz: null, debate: null, examiner: null, whiteboard: null });

  const saveNote   = useCallback((note) => {
    setNotes(prev => [{ ...note, timestamp: Date.now() }, ...prev]);
    setNotesOpen(true);
  }, []);
  const deleteNote = useCallback((idx)  => setNotes(prev => prev.filter((_, i) => i !== idx)), []);
  const clearNotes = useCallback(()     => setNotes([]), []);

  const handleLaunchTopic = useCallback((mode, topic) => {
    const targetSection = mode === 'quiz' ? 'quiz' : mode === 'debate' ? 'debate' : 'examiner';
    setTopicContext({ mode, topic });
    setSection(targetSection);
    // Remount the target section so its useState initializers pick up the new topic
    setSessionKeys(prev => ({ ...prev, [targetSection]: prev[targetSection] + 1 }));
  }, []);

  const handleClearContext = useCallback(() => setTopicContext(null), []);

  const handleNavigate = useCallback((s) => {
    setSection(s);
    setTopicContext(null);
  }, []);

  const handleNewSession = useCallback(() => {
    setSessionKeys(prev => ({ ...prev, [section]: prev[section] + 1 }));
    setInitialData(prev => ({ ...prev, [section]: null }));
    setTopicContext(null);
  }, [section]);

  // ── Load a past session from history ──────────────────────────────────────
  const handleLoadSession = useCallback((dbSession) => {
    const target = TYPE_TO_SECTION[dbSession.type] || dbSession.type;
    setInitialData(prev => ({ ...prev, [target]: dbSession.data }));
    setSection(target);
    setTopicContext(null);
    // Bump key so component remounts and reads new initialData
    setSessionKeys(prev => ({ ...prev, [target]: prev[target] + 1 }));
    setHistoryOpen(false);
  }, []);

  // ── Inference mode toggle ──────────────────────────────────────────────────
  const handleToggleInference = useCallback((newMode) => {
    if (newMode === inferenceMode) return;
    if (newMode === 'local') {
      setShowLocalWarning(true);
    } else {
      setInferenceMode('api');
    }
  }, [inferenceMode]);

  const confirmLocalMode = useCallback(() => {
    setInferenceMode('local');
    setShowLocalWarning(false);
  }, []);

  const cancelLocalMode = useCallback(() => setShowLocalWarning(false), []);

  const isRtl = lang === 'ar';

  return (
    <InferenceContext.Provider value={inferenceMode}>
      <div className="flex h-screen overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}
           data-theme={theme} style={{ background: 'var(--bg-page)' }}>

        <Sidebar
          active={section}
          onNavigate={handleNavigate}
          lang={lang}
          onLangChange={setLang}
          notesCount={notes.length}
          onNotesToggle={() => setNotesOpen(o => !o)}
          theme={theme}
          onThemeChange={setTheme}
          onHistoryToggle={() => setHistoryOpen(o => !o)}
          historyOpen={historyOpen}
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Top bar: New Session (left) + Inference toggle (right) */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5"
               style={{ borderBottom: '1px solid rgba(var(--t-rgb),0.06)', background: 'var(--bg-page)' }}>

            {/* New Session */}
            <button
              onClick={handleNewSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'rgba(240,141,57,0.08)', border: '1px solid rgba(240,141,57,0.2)', color: 'rgba(240,141,57,0.7)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,141,57,0.16)'; e.currentTarget.style.color = '#F08D39'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(240,141,57,0.08)'; e.currentTarget.style.color = 'rgba(240,141,57,0.7)'; }}
              title="Discard current session and start fresh"
            >
              ↺ {lang === 'ar' ? 'جلسة جديدة' : lang === 'es' ? 'Nueva sesión' : 'New Session'}
            </button>

            {/* Inference mode toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs hidden sm:inline" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
                {lang === 'ar' ? 'النموذج:' : lang === 'es' ? 'Modelo:' : 'Model:'}
              </span>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(var(--t-rgb),0.12)' }}>
                {[['api', '☁️ Cloud'], ['local', '🖥 Local']].map(([m, label]) => (
                  <button key={m} onClick={() => handleToggleInference(m)}
                    className="px-3 py-1.5 text-xs font-semibold transition-all"
                    style={inferenceMode === m
                      ? { background: '#3852B4', color: '#fff' }
                      : { background: 'transparent', color: 'rgba(var(--t-rgb),0.45)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* All sections always mounted — hidden via CSS to preserve state */}
          <div className="flex-1 overflow-hidden" style={{ display: section === 'gps' ? 'block' : 'none' }}>
            <LearningGPS key={sessionKeys.gps} lang={lang} onSaveNote={saveNote} onLaunchTopic={handleLaunchTopic} initialData={initialData.gps} />
          </div>
          <div className="flex-1 overflow-hidden" style={{ display: section === 'quiz' ? 'block' : 'none' }}>
            <FlashQuiz key={sessionKeys.quiz} lang={lang} onSaveNote={saveNote} topicContext={topicContext?.mode === 'quiz' ? topicContext : null} initialData={initialData.quiz} />
          </div>
          <div className="flex-1 overflow-hidden" style={{ display: section === 'debate' ? 'block' : 'none' }}>
            <DebateSection key={sessionKeys.debate} topicContext={topicContext?.mode === 'debate' ? topicContext : null} onClearContext={handleClearContext} lang={lang} initialData={initialData.debate} />
          </div>
          <div className="flex-1 overflow-hidden" style={{ display: section === 'examiner' ? 'block' : 'none' }}>
            <TheExaminer key={sessionKeys.examiner} lang={lang} onSaveNote={saveNote} topicContext={topicContext?.mode === 'examiner' ? topicContext : null} initialData={initialData.examiner} />
          </div>
          <div className="flex-1 overflow-hidden" style={{ display: section === 'whiteboard' ? 'flex' : 'none' }}>
            <AIWhiteboard key={sessionKeys.whiteboard} lang={lang} onSaveNote={saveNote} theme={theme} initialData={initialData.whiteboard} />
          </div>
        </main>

        <NotesPanel
          notes={notes}
          onAdd={saveNote}
          onDelete={deleteNote}
          onClearAll={clearNotes}
          lang={lang}
          isOpen={notesOpen}
          onClose={() => setNotesOpen(false)}
        />

        <HistoryPanel
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onLoad={handleLoadSession}
          lang={lang}
        />

        {/* Local inference warning modal */}
        {showLocalWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
               style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
               onClick={cancelLocalMode}>
            <div className="rounded-2xl p-6 max-w-md w-full mx-4"
                 style={{ background: 'var(--bg-card)', border: '1px solid rgba(56,82,180,0.35)', boxShadow: '0 0 60px rgba(56,82,180,0.15)' }}
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <span style={{ fontSize: 28 }}>🖥</span>
                <h2 className="text-lg font-bold" style={{ color: 'var(--t1)' }}>Switch to Local (Ollama)</h2>
              </div>
              <p className="text-sm mb-3" style={{ color: 'rgba(var(--t-rgb),0.7)' }}>
                You're switching to <strong style={{ color: 'var(--t1)' }}>local inference via Ollama</strong>. A few things to know:
              </p>
              <ul className="text-sm space-y-2.5 mb-5" style={{ color: 'rgba(var(--t-rgb),0.65)' }}>
                <li className="flex gap-2">
                  <span style={{ color: '#F08D39', flexShrink: 0 }}>⚡</span>
                  <span><strong style={{ color: 'var(--t1)' }}>Debate agents run one at a time</strong> — cloud mode runs all three in parallel; local mode runs them sequentially to avoid saturating your GPU.</span>
                </li>
                <li className="flex gap-2">
                  <span style={{ color: '#8BDFDD', flexShrink: 0 }}>📦</span>
                  <span>You need <strong style={{ color: 'var(--t1)' }}>Ollama running</strong> on port 11434 with the <code style={{ color: '#8BDFDD', background: 'rgba(139,223,221,0.1)', padding: '1px 5px', borderRadius: 4 }}>gemma4</code> model pulled.</span>
                </li>
                <li className="flex gap-2">
                  <span style={{ color: '#c084fc', flexShrink: 0 }}>🔒</span>
                  <span>All processing stays <strong style={{ color: 'var(--t1)' }}>on your device</strong> — nothing is sent to Google.</span>
                </li>
              </ul>
              <div className="flex gap-3">
                <button onClick={cancelLocalMode}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'rgba(var(--b-rgb),0.05)', border: '1px solid rgba(var(--b-rgb),0.12)', color: 'rgba(var(--t-rgb),0.55)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--b-rgb),0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(var(--b-rgb),0.05)'}>
                  Cancel
                </button>
                <button onClick={confirmLocalMode}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'linear-gradient(135deg,#3852B4,#2a3d99)', color: '#fff', boxShadow: '0 4px 16px rgba(56,82,180,0.35)' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  🖥 Use Local Ollama
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </InferenceContext.Provider>
  );
}
