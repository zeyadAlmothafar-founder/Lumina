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

function DebateSection({ topicContext, onClearContext, lang }) {
  const [phase, setPhase]     = useState('landing');
  const [session, setSession] = useState(null);

  const handleStart = useCallback((data) => { setSession(data); setPhase('debate'); }, []);
  const handleSynth = useCallback((outline) => {
    setSession(s => ({ ...s, synthesis: outline })); setPhase('synthesis');
  }, []);
  const handleReset = useCallback(() => {
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

export default function App() {
  const [section, setSection]          = useState('gps');
  const [lang, setLang]                = useState('en');
  const [theme, setTheme]              = useState('dark');
  const [notesOpen, setNotesOpen]      = useState(false);
  const [notes, setNotes]              = useState([]);
  const [topicContext, setTopicContext] = useState(null);
  // Incrementing a section's key causes its component to remount with fresh state
  const [sessionKeys, setSessionKeys]  = useState({ gps: 0, quiz: 0, debate: 0, examiner: 0, whiteboard: 0 });

  const saveNote = useCallback((note) => {
    setNotes(prev => [{ ...note, timestamp: Date.now() }, ...prev]);
    setNotesOpen(true);
  }, []);

  const deleteNote  = useCallback((idx) => setNotes(prev => prev.filter((_, i) => i !== idx)), []);
  const clearNotes  = useCallback(() => setNotes([]), []);

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
    setTopicContext(null);
  }, [section]);

  return (
    <div className="flex h-screen overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}
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
      />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* New Session bar */}
        <div className="flex-shrink-0 flex items-center justify-end px-4 py-1.5"
             style={{ borderBottom: '1px solid rgba(var(--t-rgb),0.06)', background: 'var(--bg-page)' }}>
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
        </div>

        {/* All sections always mounted — hidden via CSS to preserve state */}
        <div className="flex-1 overflow-hidden" style={{ display: section === 'gps' ? 'block' : 'none' }}>
          <LearningGPS key={sessionKeys.gps} lang={lang} onSaveNote={saveNote} onLaunchTopic={handleLaunchTopic} />
        </div>
        <div className="flex-1 overflow-hidden" style={{ display: section === 'quiz' ? 'block' : 'none' }}>
          <FlashQuiz key={sessionKeys.quiz} lang={lang} onSaveNote={saveNote} topicContext={topicContext?.mode === 'quiz' ? topicContext : null} />
        </div>
        <div className="flex-1 overflow-hidden" style={{ display: section === 'debate' ? 'block' : 'none' }}>
          <DebateSection key={sessionKeys.debate} topicContext={topicContext?.mode === 'debate' ? topicContext : null} onClearContext={handleClearContext} lang={lang} />
        </div>
        <div className="flex-1 overflow-hidden" style={{ display: section === 'examiner' ? 'block' : 'none' }}>
          <TheExaminer key={sessionKeys.examiner} lang={lang} onSaveNote={saveNote} topicContext={topicContext?.mode === 'examiner' ? topicContext : null} />
        </div>
        <div className="flex-1 overflow-hidden" style={{ display: section === 'whiteboard' ? 'block' : 'none' }}>
          <AIWhiteboard key={sessionKeys.whiteboard} lang={lang} onSaveNote={saveNote} theme={theme} />
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
    </div>
  );
}
