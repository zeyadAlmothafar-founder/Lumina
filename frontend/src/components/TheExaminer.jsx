import { useState, useRef, useEffect, useCallback } from 'react';
import { t } from '../i18n.js';
import { useInferenceHeaders } from '../context/InferenceContext.jsx';
import { saveSession } from '../db.js';

// ── Voice Answer Button ────────────────────────────────────────────────────────
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function VoiceAnswerButton({ onTranscript, disabled, lang = 'en' }) {
  const [state, setState] = useState('idle'); // idle | listening | processing
  const recRef      = useRef(null);
  const resultRef   = useRef('');

  // Map UI lang to BCP-47 code
  const bcp47 = lang === 'es' ? 'es-ES' : lang === 'ar' ? 'ar-SA' : 'en-US';

  const start = useCallback(() => {
    if (disabled || state !== 'idle') return;
    if (!SpeechRecognition) {
      alert('Voice recognition requires Chrome or Edge.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang           = bcp47;
    rec.continuous     = true;
    rec.interimResults = true;
    recRef.current     = rec;
    resultRef.current  = '';

    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) resultRef.current += e.results[i][0].transcript + ' ';
      }
    };
    rec.onend = () => {
      setState('idle');
      const text = resultRef.current.trim();
      if (text) onTranscript(text);
      recRef.current = null;
    };
    rec.onerror = () => { setState('idle'); recRef.current = null; };
    rec.start();
    setState('listening');
  }, [disabled, state, onTranscript, bcp47]);

  const stop = useCallback(() => {
    if (recRef.current) { recRef.current.stop(); setState('processing'); }
  }, []);

  const isListening = state === 'listening';

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative flex items-center justify-center">
        {isListening && (
          <>
            <div className="absolute rounded-full animate-ping"
                 style={{ width: 96, height: 96, background: 'rgba(240,141,57,0.12)' }} />
            <div className="absolute rounded-full animate-ping"
                 style={{ width: 80, height: 80, background: 'rgba(240,141,57,0.18)', animationDelay: '0.15s' }} />
          </>
        )}
        <button
          onMouseDown={start}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={e => { e.preventDefault(); start(); }}
          onTouchEnd={e => { e.preventDefault(); stop(); }}
          disabled={disabled || state === 'processing'}
          className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all select-none"
          style={isListening
            ? { background: 'rgba(239,68,68,0.2)', border: '2px solid rgba(239,68,68,0.6)', boxShadow: '0 0 24px rgba(239,68,68,0.3)', transform: 'scale(1.08)' }
            : disabled
            ? { background: 'rgba(var(--b-rgb),0.04)', border: '2px solid rgba(var(--b-rgb),0.1)', cursor: 'not-allowed' }
            : { background: 'rgba(240,141,57,0.12)', border: '2px solid rgba(240,141,57,0.4)', boxShadow: '0 0 16px rgba(240,141,57,0.15)' }
          }
        >
          <span className={`text-2xl ${isListening ? 'animate-pulse' : ''}`}>
            {state === 'processing' ? '⏳' : isListening ? '🔴' : '🎤'}
          </span>
        </button>
      </div>

      <p className="text-xs" style={{ color: isListening ? '#fca5a5' : 'rgba(var(--t-rgb),0.35)' }}>
        {state === 'processing' ? t(lang, 'examVoiceProcessing') : isListening ? t(lang, 'examVoiceListening') : t(lang, 'examVoiceHold')}
      </p>
    </div>
  );
}

// ── Photo Answer Input ─────────────────────────────────────────────────────────
function PhotoAnswerInput({ onFile, file, lang = 'en' }) {
  const inputRef = useRef(null);

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all py-6"
        style={{
          border: `2px dashed ${file ? 'rgba(240,141,57,0.5)' : 'rgba(var(--t-rgb),0.15)'}`,
          background: file ? 'rgba(240,141,57,0.04)' : 'rgba(var(--b-rgb),0.02)',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,141,57,0.5)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = file ? 'rgba(240,141,57,0.5)' : 'rgba(var(--t-rgb),0.15)'}
      >
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={URL.createObjectURL(file)}
              alt="answer"
              className="max-h-40 rounded-lg object-contain"
              style={{ border: '1px solid rgba(240,141,57,0.3)' }}
            />
            <p className="text-xs" style={{ color: 'rgba(240,141,57,0.7)' }}>
              {t(lang, 'examClickChange', { name: file.name })}
            </p>
          </div>
        ) : (
          <>
            <span className="text-3xl mb-2">📸</span>
            <p className="text-sm font-medium" style={{ color: 'rgba(var(--t-rgb),0.6)' }}>
              {t(lang, 'examPhotoUpload')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>
              {t(lang, 'examPhotoHint')}
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => onFile(e.target.files?.[0] || null)}
      />
    </div>
  );
}

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const Q_COUNTS = [3, 5, 7, 10];

const DIFF_STYLE = {
  beginner:     { color: '#8BDFDD', icon: '🌱' },
  intermediate: { color: '#F08D39', icon: '🔥' },
  advanced:     { color: '#fca5a5', icon: '⚡' },
};

const GRADE_COLOR = { A: '#8BDFDD', B: '#F08D39', C: '#fbbf24', D: '#f97316', F: '#fca5a5' };

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ onStart, lang = 'en', prefillSubject }) {
  const inferenceHeaders = useInferenceHeaders();
  const [subject, setSubject]   = useState(prefillSubject || '');
  const [diff, setDiff]         = useState('intermediate');
  const [total, setTotal]       = useState(5);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const EXAMPLES = {
    en: ['The causes of World War I', 'Python programming fundamentals', 'Macroeconomics and GDP', 'Organic chemistry reactions', 'Machine learning concepts'],
    es: ['Las causas de la Primera Guerra Mundial', 'Fundamentos de programación Python', 'Macroeconomía y el PIB', 'Reacciones de química orgánica', 'Conceptos de machine learning'],
    ar: ['أسباب الحرب العالمية الأولى', 'أساسيات برمجة بايثون', 'الاقتصاد الكلي والناتج المحلي الإجمالي', 'تفاعلات الكيمياء العضوية', 'مفاهيم التعلم الآلي'],
  };

  const start = async () => {
    if (!subject.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/examiner/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...inferenceHeaders },
        body: JSON.stringify({ subject: subject.trim(), difficulty: diff, totalQuestions: total, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onStart({ sessionId: data.sessionId, subject: subject.trim(), difficulty: diff, total, firstQuestion: data.question });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const ds = DIFF_STYLE[diff];

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl p-8"
           style={{ background: 'var(--bg-card)', border: '1px solid rgba(240,141,57,0.2)', boxShadow: '0 0 40px rgba(240,141,57,0.06)' }}>

        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--t2)' }}>
          {t(lang, 'examQ')}
        </label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder={t(lang, 'examPlaceholder')}
          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
          style={{
            background: 'var(--bg-input)',
            border: `1.5px solid ${subject ? '#F08D39' : 'rgba(var(--t-rgb),0.12)'}`,
            color: 'var(--t1)',
          }}
          onKeyDown={e => e.key === 'Enter' && start()}
        />

        <div className="flex flex-wrap gap-2 mt-2.5 mb-6">
          {(EXAMPLES[lang] || EXAMPLES.en).map(e => (
            <button key={e} onClick={() => setSubject(e)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all"
                    style={{ background: 'rgba(240,141,57,0.06)', border: '1px solid rgba(240,141,57,0.18)', color: 'rgba(var(--t-rgb),0.65)' }}
                    onMouseEnter={ev => ev.currentTarget.style.color = 'var(--t1)'}
                    onMouseLeave={ev => ev.currentTarget.style.color = 'rgba(var(--t-rgb),0.65)'}>
              {e}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <p className="text-xs font-medium mb-2" style={{ color: 'rgba(var(--t-rgb),0.5)' }}>{t(lang, 'examDiff')}</p>
          <div className="flex gap-3">
            {DIFFICULTIES.map(d => {
              const s = DIFF_STYLE[d];
              const active = diff === d;
              return (
                <button key={d} onClick={() => setDiff(d)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={active
                          ? { background: s.color + '20', border: `1.5px solid ${s.color}60`, color: s.color }
                          : { background: 'rgba(var(--b-rgb),0.04)', border: '1px solid rgba(var(--b-rgb),0.1)', color: 'rgba(var(--b-rgb),0.4)' }}>
                  {s.icon} {t(lang, d === 'beginner' ? 'examBeginner' : d === 'intermediate' ? 'examIntermediate' : 'examAdvanced')}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium mb-2" style={{ color: 'rgba(var(--t-rgb),0.5)' }}>{t(lang, 'examQCount')}</p>
          <div className="flex gap-2">
            {Q_COUNTS.map(n => (
              <button key={n} onClick={() => setTotal(n)}
                      className="w-12 h-10 rounded-lg text-sm font-semibold transition-all"
                      style={total === n
                        ? { background: '#F08D39', color: '#222' }
                        : { background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.12)', color: 'rgba(var(--b-rgb),0.5)' }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm mb-4 px-4 py-2.5 rounded-xl"
             style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            {error}
          </p>
        )}

        <button onClick={start} disabled={!subject.trim() || loading}
                className="w-full py-4 rounded-xl font-semibold text-base transition-all"
                style={!subject.trim() || loading
                  ? { background: 'var(--bg-input)', color: 'rgba(var(--b-rgb),0.2)', cursor: 'not-allowed' }
                  : { background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 20px rgba(240,141,57,0.3)' }}>
          {loading
            ? <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(34,34,34,0.3)', borderTopColor: '#222' }} />
                {t(lang, 'examStarting')}
              </span>
            : `${t(lang, 'examStart')} (${total})`}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          { icon: '🧠', key: 'examAdaptive', descKey: 'examAdaptiveDesc' },
          { icon: '📊', key: 'examScored',   descKey: 'examScoredDesc' },
          { icon: '📋', key: 'examReport',   descKey: 'examReportDesc' },
        ].map(c => (
          <div key={c.key} className="rounded-xl p-4"
               style={{ background: 'rgba(240,141,57,0.05)', border: '1px solid rgba(240,141,57,0.12)' }}>
            <div className="text-xl mb-2">{c.icon}</div>
            <div className="text-sm font-semibold" style={{ color: '#F08D39' }}>{t(lang, c.key)}</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>{t(lang, c.descKey)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Exam Screen ───────────────────────────────────────────────────────────────
function ExamScreen({ exam, onFinish, lang = 'en', onSaveNote, onSaveReport }) {
  const inferenceHeaders = useInferenceHeaders();
  const [answer, setAnswer]         = useState('');
  const [inputMode, setInputMode]   = useState('voice'); // 'voice' | 'type' | 'photo'
  const [photoFile, setPhotoFile]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [feedback, setFeedback]     = useState(null);
  const [history, setHistory]       = useState([]);
  const [question, setQuestion]     = useState(exam.firstQuestion);
  const [qNum, setQNum]             = useState(1);
  const [transcribed, setTranscribed] = useState(null); // for photo mode
  const bottomRef                   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, feedback]);

  const submit = async () => {
    if (loading) return;
    if (inputMode !== 'photo' && !answer.trim()) return;
    if (inputMode === 'photo' && !photoFile) return;

    setLoading(true);
    try {
      let data;

      if (inputMode === 'photo') {
        // Multimodal: send image, Gemma reads handwriting
        const form = new FormData();
        form.append('image', photoFile);
        const res = await fetch(`/api/examiner/${exam.sessionId}/answer-image`, {
          method: 'POST',
          headers: inferenceHeaders,
          body: form,
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTranscribed(data.transcribedAnswer);
        setAnswer(data.transcribedAnswer || '');
      } else {
        const res = await fetch(`/api/examiner/${exam.sessionId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...inferenceHeaders },
          body: JSON.stringify({ answer: answer.trim() }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      setFeedback({ score: data.score, feedback: data.feedback, correctAnswer: data.correctAnswer, _raw: data });

      if (data.isLast) {
        const updatedHistory = [...history, {
          q: qNum, question: question.question,
          answer: inputMode === 'photo' ? (data.transcribedAnswer || '[photo answer]') : answer.trim(),
          score: data.score, feedback: data.feedback, correctAnswer: data.correctAnswer,
        }];
        setHistory(updatedHistory);
        if (onSaveReport) onSaveReport(exam.subject, updatedHistory, data.report);
        setTimeout(() => onFinish(data.report), 1800);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = (data) => {
    setHistory(h => [...h, {
      q: qNum, question: question.question,
      answer: inputMode === 'photo' ? (transcribed || '[photo answer]') : answer,
      score: feedback.score, feedback: feedback.feedback, correctAnswer: feedback.correctAnswer,
    }]);
    setQuestion(data.nextQuestion);
    setQNum(n => n + 1);
    setAnswer('');
    setPhotoFile(null);
    setTranscribed(null);
    setFeedback(null);
    setInputMode('voice');
  };

  const canSubmit = inputMode === 'photo' ? !!photoFile : !!answer.trim();

  const ScoreBar = ({ score }) => {
    const color = score >= 8 ? '#8BDFDD' : score >= 6 ? '#F08D39' : '#fca5a5';
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(var(--b-rgb),0.08)' }}>
          <div className="h-full rounded-full transition-all"
               style={{ width: `${score * 10}%`, background: color }} />
        </div>
        <span className="text-sm font-bold flex-shrink-0" style={{ color }}>{score}/10</span>
      </div>
    );
  };

  const INPUT_MODES = [
    ['voice', t(lang, 'examVoice')],
    ['type',  t(lang, 'examType')],
    ['photo', t(lang, 'examPhoto')],
  ];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto w-full">

      {/* Progress bar */}
      <div className="flex-shrink-0 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
            {t(lang, 'examQuestionOf', { n: qNum, total: exam.total })}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: DIFF_STYLE[exam.difficulty].color + '18', color: DIFF_STYLE[exam.difficulty].color, border: `1px solid ${DIFF_STYLE[exam.difficulty].color}30` }}>
            {DIFF_STYLE[exam.difficulty].icon} {t(lang, exam.difficulty === 'beginner' ? 'examBeginner' : exam.difficulty === 'intermediate' ? 'examIntermediate' : 'examAdvanced')}
          </span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: 'rgba(var(--b-rgb),0.08)' }}>
          <div className="h-full rounded-full transition-all"
               style={{ width: `${((qNum - 1) / exam.total) * 100}%`, background: '#F08D39' }} />
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto space-y-4 debate-scroll pb-2">
        {history.map(h => (
          <div key={h.q} className="rounded-xl overflow-hidden"
               style={{ border: '1px solid rgba(var(--b-rgb),0.08)', background: 'rgba(var(--b-rgb),0.02)' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(var(--b-rgb),0.06)' }}>
              <p className="text-xs mb-1.5" style={{ color: 'rgba(240,141,57,0.6)' }}>Q{h.q}</p>
              <p className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{h.question}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs mb-1" style={{ color: 'rgba(var(--t-rgb),0.35)' }}>{t(lang, 'examYourAnswer')}</p>
              <p className="text-sm mb-3" style={{ color: 'rgba(var(--t-rgb),0.75)' }}>{h.answer}</p>
              <ScoreBar score={h.score} />
              {h.feedback && (
                <p className="text-xs mt-2.5 leading-relaxed" style={{ color: 'rgba(var(--t-rgb),0.55)' }}>
                  {h.feedback}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Current question */}
        <div className="rounded-2xl overflow-hidden"
             style={{ border: '1px solid rgba(240,141,57,0.25)', background: 'rgba(240,141,57,0.04)', boxShadow: '0 0 20px rgba(240,141,57,0.06)' }}>
          <div className="px-6 py-5">
            <p className="text-xs mb-2" style={{ color: '#F08D39' }}>{t(lang, 'examCurrentQ', { n: qNum })}</p>
            <p className="text-base font-semibold leading-relaxed" style={{ color: 'var(--t1)' }}>
              {question.question}
            </p>
            {question.hint && (
              <p className="text-xs mt-2 italic" style={{ color: 'rgba(var(--t-rgb),0.35)' }}>
                💡 {question.hint}
              </p>
            )}
          </div>

          {/* Answer area */}
          {!feedback ? (
            <div className="px-6 pb-6">
              {/* Mode toggle */}
              <div className="flex gap-2 mb-4">
                {INPUT_MODES.map(([mode, label]) => (
                  <button key={mode} onClick={() => { setInputMode(mode); setAnswer(''); setPhotoFile(null); setTranscribed(null); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={inputMode === mode
                            ? { background: 'rgba(240,141,57,0.2)', border: '1px solid rgba(240,141,57,0.5)', color: '#F08D39' }
                            : { background: 'rgba(var(--b-rgb),0.04)', border: '1px solid rgba(var(--b-rgb),0.1)', color: 'rgba(var(--b-rgb),0.4)' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Voice mode */}
              {inputMode === 'voice' && (
                <div className="rounded-xl" style={{ background: 'rgba(var(--b-rgb),0.03)', border: '1px solid rgba(var(--b-rgb),0.08)' }}>
                  <VoiceAnswerButton
                    disabled={loading}
                    lang={lang}
                    onTranscript={text => setAnswer(prev => prev ? prev + ' ' + text : text)}
                  />
                  {answer && (
                    <div className="px-4 pb-4">
                      <p className="text-xs mb-1.5" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>{t(lang, 'examTranscript')}</p>
                      <textarea
                        value={answer}
                        onChange={e => setAnswer(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg p-3 text-sm resize-none focus:outline-none"
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid rgba(240,141,57,0.25)',
                          color: 'var(--t1)',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Type mode */}
              {inputMode === 'type' && (
                <textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder={t(lang, 'examWriteHere')}
                  rows={4}
                  className="w-full rounded-xl p-4 text-sm resize-none focus:outline-none"
                  style={{
                    background: 'var(--bg-input)',
                    border: `1.5px solid ${answer ? '#F08D39' : 'rgba(var(--t-rgb),0.1)'}`,
                    color: 'var(--t1)',
                  }}
                  onKeyDown={e => e.key === 'Enter' && e.ctrlKey && submit()}
                />
              )}

              {/* Photo mode */}
              {inputMode === 'photo' && (
                <PhotoAnswerInput
                  file={photoFile}
                  onFile={setPhotoFile}
                  lang={lang}
                />
              )}

              {/* Photo mode transcription preview */}
              {inputMode === 'photo' && transcribed && (
                <div className="mt-3 rounded-xl px-4 py-3"
                     style={{ background: 'rgba(240,141,57,0.06)', border: '1px solid rgba(240,141,57,0.2)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgba(240,141,57,0.7)' }}>{t(lang, 'examGemmaRead')}</p>
                  <p className="text-sm" style={{ color: 'var(--t1)' }}>{transcribed}</p>
                </div>
              )}

              <button onClick={submit} disabled={!canSubmit || loading}
                      className="mt-3 w-full py-3 rounded-xl font-semibold text-sm transition-all"
                      style={canSubmit && !loading
                        ? { background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 16px rgba(240,141,57,0.3)' }
                        : { background: 'var(--bg-input)', color: 'rgba(var(--b-rgb),0.2)', cursor: 'not-allowed' }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                            style={{ borderColor: 'rgba(34,34,34,0.3)', borderTopColor: '#222' }} />
                      {inputMode === 'photo' ? t(lang, 'examReadingHw') : t(lang, 'examEval')}
                    </span>
                  : t(lang, 'examSubmit')}
              </button>
            </div>
          ) : (
            <div className="px-6 pb-6">
              {/* Transcription show (photo mode) */}
              {transcribed && (
                <div className="rounded-xl px-4 py-3 mb-3"
                     style={{ background: 'rgba(var(--b-rgb),0.04)', border: '1px solid rgba(var(--b-rgb),0.1)' }}>
                  <p className="text-xs mb-1" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
                    {t(lang, 'examGemmaReadHw')}
                  </p>
                  <p className="text-sm italic" style={{ color: 'rgba(var(--t-rgb),0.7)' }}>{transcribed}</p>
                </div>
              )}

              {/* Feedback block */}
              <div className="rounded-xl p-4 mb-4"
                   style={{
                     background: feedback.score >= 7 ? 'rgba(139,223,221,0.07)' : 'rgba(252,165,165,0.07)',
                     border: `1px solid ${feedback.score >= 7 ? 'rgba(139,223,221,0.25)' : 'rgba(252,165,165,0.25)'}`,
                   }}>
                <ScoreBar score={feedback.score} />
                <p className="text-sm mt-3 leading-relaxed" style={{ color: 'rgba(var(--b-rgb),0.85)' }}>
                  {feedback.feedback}
                </p>
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(var(--b-rgb),0.08)' }}>
                  <p className="text-xs" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>{t(lang, 'examModelAnswer')}</p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(var(--b-rgb),0.75)' }}>{feedback.correctAnswer}</p>
                </div>
              </div>

              {feedback._raw && !feedback._raw.isLast && (
                <button
                  onClick={() => nextQuestion(feedback._raw)}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 16px rgba(240,141,57,0.3)' }}>
                  {t(lang, 'examNextQ')}
                </button>
              )}
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Report Screen ─────────────────────────────────────────────────────────────
function ReportScreen({ report, onRetry, lang = 'en', onSaveNote, totalQuestions }) {
  const gc = GRADE_COLOR[report?.grade] || '#F08D39';
  const maxScore = (totalQuestions || 1) * 10;

  const handleSave = () => {
    if (!onSaveNote) return;
    const text = [
      `Grade: ${report.grade} (${report.overallScore}/${maxScore})`,
      `Summary: ${report.summary}`,
      `Strengths: ${report.strengths?.join(', ')}`,
      `Areas to improve: ${report.areasToImprove?.join(', ')}`,
      `Recommendations: ${report.studyRecommendations?.join('; ')}`,
    ].join('\n');
    onSaveNote({ text, source: 'The Examiner' });
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">

      <div className="rounded-2xl px-8 py-8 text-center"
           style={{ background: 'var(--bg-flip-back)', border: '1px solid rgba(240,141,57,0.25)' }}>
        <div className="text-6xl font-black mb-1" style={{ color: gc }}>{report?.grade}</div>
        <div className="text-3xl font-bold mb-2" style={{ color: 'var(--t1)' }}>{report?.overallScore}/{maxScore}</div>
        <p className="text-sm" style={{ color: 'rgba(var(--t-rgb),0.55)' }}>{report?.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'rgba(139,223,221,0.06)', border: '1px solid rgba(139,223,221,0.2)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#8BDFDD' }}>{t(lang, 'examStrengths')}</p>
          <ul className="space-y-2">
            {report?.strengths?.map((s, i) => (
              <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'rgba(var(--t-rgb),0.75)' }}>
                <span style={{ color: '#8BDFDD' }}>•</span>{s}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl p-5" style={{ background: 'rgba(252,165,165,0.06)', border: '1px solid rgba(252,165,165,0.2)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#fca5a5' }}>{t(lang, 'examAreasImprove')}</p>
          <ul className="space-y-2">
            {report?.areasToImprove?.map((a, i) => (
              <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'rgba(var(--t-rgb),0.75)' }}>
                <span style={{ color: '#fca5a5' }}>•</span>{a}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: 'rgba(240,141,57,0.06)', border: '1px solid rgba(240,141,57,0.2)' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: '#F08D39' }}>{t(lang, 'examStudyRecs')}</p>
        <ol className="space-y-2">
          {report?.studyRecommendations?.map((r, i) => (
            <li key={i} className="text-sm flex items-start gap-3" style={{ color: 'rgba(var(--t-rgb),0.75)' }}>
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(240,141,57,0.2)', color: '#F08D39' }}>
                {i + 1}
              </span>
              {r}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-3">
        {onSaveNote && (
          <button onClick={handleSave}
                  className="px-5 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(240,141,57,0.08)', border: '1px solid rgba(240,141,57,0.25)', color: '#F08D39' }}>
            📌 {t(lang, 'notesSave')}
          </button>
        )}
        <button onClick={onRetry}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 16px rgba(240,141,57,0.3)' }}>
          {t(lang, 'examTakeAnother')}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TheExaminer({ lang = 'en', onSaveNote, topicContext, initialData = null }) {
  const [phase, setPhase] = useState(() => initialData?.report ? 'report' : 'setup');
  const [exam, setExam]   = useState(null);
  const [report, setRep]  = useState(() => initialData?.report || null);

  const handleSaveReport = useCallback((subject, history, rep) => {
    saveSession('exam', subject, { subject, history, report: rep }).catch(() => {});
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      <div className="flex-shrink-0 px-8 pt-8 pb-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="material-symbols-outlined" style={{ color: '#F08D39', fontSize: 32, fontVariationSettings: "'FILL' 1" }}>school</span>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t1)', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{t(lang, 'examTitle')}</h1>
            <p className="text-sm" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
              {t(lang, 'examSub')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pt-6 pb-8 debate-scroll">
        {phase === 'setup' && (
          <SetupScreen
            lang={lang}
            prefillSubject={topicContext?.topic}
            onStart={(data) => { setExam(data); setPhase('exam'); }}
          />
        )}
        {phase === 'exam' && (
          <ExamScreen
            exam={exam}
            lang={lang}
            onSaveNote={onSaveNote}
            onFinish={(r) => { setRep(r); setPhase('report'); }}
            onSaveReport={handleSaveReport}
          />
        )}
        {phase === 'report' && (
          <ReportScreen
            report={report}
            totalQuestions={exam?.total}
            lang={lang}
            onSaveNote={onSaveNote}
            onRetry={() => { setExam(null); setRep(null); setPhase('setup'); }}
          />
        )}
      </div>
    </div>
  );
}
