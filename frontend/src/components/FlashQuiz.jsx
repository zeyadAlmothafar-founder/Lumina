import { useState, useCallback, useRef } from 'react';
import { t } from '../i18n.js';
import { useInferenceHeaders } from '../context/InferenceContext.jsx';
import { saveSession } from '../db.js';

const COUNT_OPTIONS = [5, 10, 15, 20];
const DIFF_STYLE = {
  easy:   { color: '#8BDFDD', bg: 'rgba(139,223,221,0.12)',  border: 'rgba(139,223,221,0.25)' },
  medium: { color: '#F08D39', bg: 'rgba(240,141,57,0.12)',  border: 'rgba(240,141,57,0.25)' },
  hard:   { color: '#fca5a5', bg: 'rgba(252,165,165,0.12)', border: 'rgba(252,165,165,0.25)' },
};

// ── Single Flashcard (3D flip) ──────────────────────────────────────────────
function Flashcard({ card, index, total, lang = 'en' }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs mb-4" style={{ color: 'rgba(var(--t-rgb),0.35)' }}>
        {t(lang, 'quizCardOf', { n: index + 1, total })}
      </p>

      <div
        onClick={() => setFlipped(f => !f)}
        className="cursor-pointer select-none"
        style={{ width: '100%', maxWidth: 540, height: 280, perspective: 1000 }}
      >
        <div
          className="relative w-full h-full transition-all duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center px-8 py-6"
            style={{
              backfaceVisibility: 'hidden',
              background: 'var(--bg-flip-front)',
              border: '1px solid rgba(240,141,57,0.25)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'rgba(240,141,57,0.6)' }}>{t(lang, 'quizQuestionLabel')}</p>
            <p className="text-lg font-semibold text-center leading-relaxed" style={{ color: 'var(--t1)' }}>
              {card.question}
            </p>
            <p className="text-xs mt-6" style={{ color: 'rgba(var(--t-rgb),0.25)' }}>{t(lang, 'quizTapReveal')}</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center px-8 py-6"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'var(--bg-flip-back)',
              border: '1px solid rgba(240,141,57,0.35)',
              boxShadow: '0 8px 40px rgba(240,141,57,0.1)',
            }}
          >
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#F08D39' }}>{t(lang, 'quizAnswerLabel')}</p>
            <p className="text-base font-semibold text-center leading-relaxed mb-4" style={{ color: 'var(--t1)' }}>
              {card.answer}
            </p>
            {card.explanation && (
              <p className="text-xs text-center leading-relaxed"
                 style={{ color: 'rgba(var(--t-rgb),0.55)', borderTop: '1px solid rgba(240,141,57,0.15)', paddingTop: 12, marginTop: 4 }}>
                {card.explanation}
              </p>
            )}
          </div>
        </div>
      </div>

      {card.difficulty && (() => {
        const d = DIFF_STYLE[card.difficulty] || DIFF_STYLE.medium;
        return (
          <div className="mt-3 text-xs px-3 py-1 rounded-full"
               style={{ background: d.bg, border: `1px solid ${d.border}`, color: d.color }}>
            {card.difficulty}
          </div>
        );
      })()}
    </div>
  );
}

// ── Quiz Mode ─────────────────────────────────────────────────────────────────
function QuizMode({ cards, onFinish, lang = 'en' }) {
  const [idx, setIdx]         = useState(0);
  const [input, setInput]     = useState('');
  const [submitted, setSubm]  = useState(false);
  const [results, setResults] = useState([]);

  const card = cards[idx];
  // Compute correctness independently so it can be used both in handleSubmit
  // (before `submitted` flips to true) and in the UI (after submission).
  const checkCorrect = (answer) =>
    answer.toLowerCase().trim().includes(card.answer.toLowerCase().trim().split(' ')[0]);

  const isCorrect = submitted && checkCorrect(input);

  const handleSubmit = () => {
    if (!input.trim() || submitted) return;
    const correct = checkCorrect(input);   // evaluate before state update
    setSubm(true);
    setResults(r => [...r, { card, userAnswer: input.trim(), passed: correct }]);
  };

  const handleNext = () => {
    if (idx + 1 < cards.length) {
      setIdx(i => i + 1);
      setInput('');
      setSubm(false);
    } else {
      onFinish(results);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-xl mx-auto">
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(var(--b-rgb),0.08)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${((idx + 1) / cards.length) * 100}%`, background: '#F08D39' }}
          />
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
          {idx + 1}/{cards.length}
        </span>
      </div>

      <div className="w-full rounded-2xl px-8 py-7"
           style={{ background: 'var(--bg-card-2)', border: '1px solid rgba(240,141,57,0.2)' }}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'rgba(240,141,57,0.6)' }}>{t(lang, 'quizQuestionN', { n: idx + 1 })}</p>
        <p className="text-base font-semibold leading-relaxed mb-6" style={{ color: 'var(--t1)' }}>{card.question}</p>

        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={submitted}
          placeholder={t(lang, 'quizTypePh')}
          rows={3}
          className="w-full rounded-xl p-4 text-sm resize-none focus:outline-none"
          style={{
            background: submitted ? 'rgba(var(--b-rgb),0.03)' : 'var(--bg-input)',
            border: `1.5px solid ${submitted
              ? isCorrect ? 'rgba(139,223,221,0.4)' : 'rgba(252,165,165,0.4)'
              : input ? '#F08D39' : 'rgba(var(--t-rgb),0.12)'}`,
            color: 'var(--t1)',
          }}
          onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleSubmit()}
        />

        {submitted && (
          <div className="mt-4 rounded-xl px-4 py-3"
               style={{
                 background: isCorrect ? 'rgba(139,223,221,0.07)' : 'rgba(252,165,165,0.07)',
                 border: `1px solid ${isCorrect ? 'rgba(139,223,221,0.25)' : 'rgba(252,165,165,0.25)'}`,
               }}>
            <p className="text-sm font-semibold mb-1"
               style={{ color: isCorrect ? '#8BDFDD' : '#fca5a5' }}>
              {isCorrect ? t(lang, 'quizGoodAns') : t(lang, 'quizNotQuite')}
            </p>
            <p className="text-sm" style={{ color: 'var(--t1)' }}>
              <span style={{ color: 'rgba(var(--t-rgb),0.5)' }}>{t(lang, 'quizModelAns')} </span>
              {card.answer}
            </p>
            {card.explanation && (
              <p className="text-xs mt-2" style={{ color: 'rgba(var(--t-rgb),0.55)' }}>{card.explanation}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {!submitted ? (
          <button onClick={handleSubmit} disabled={!input.trim()}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={input.trim()
                    ? { background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 16px rgba(240,141,57,0.3)' }
                    : { background: 'var(--bg-input)', color: 'rgba(var(--b-rgb),0.2)', cursor: 'not-allowed' }}>
            {t(lang, 'quizSubmit')}
          </button>
        ) : (
          <button onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 16px rgba(240,141,57,0.3)' }}>
            {idx + 1 < cards.length ? t(lang, 'quizNext') : t(lang, 'quizSeeResults')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────
function QuizResults({ results, onRetry, onStudy, lang = 'en' }) {
  const passed = results.filter(r => r.passed).length;
  const pct = Math.round((passed / results.length) * 100);

  return (
    <div className="flex flex-col items-center gap-6 max-w-xl mx-auto w-full">
      <div className="text-center">
        <div
          className="inline-flex items-center justify-center rounded-full font-bold text-4xl"
          style={{
            width: 120, height: 120,
            background: `conic-gradient(#F08D39 ${pct * 3.6}deg, rgba(var(--b-rgb),0.08) 0deg)`,
            color: '#F08D39',
          }}
        >
          <div className="w-[90px] h-[90px] rounded-full flex items-center justify-center"
               style={{ background: 'var(--bg-page)' }}>
            {pct}%
          </div>
        </div>
        <p className="text-lg font-bold mt-3" style={{ color: 'var(--t1)' }}>
          {pct >= 80 ? t(lang, 'quizExcellent') : pct >= 60 ? t(lang, 'quizGoodEffort') : t(lang, 'quizKeepStudying')}
        </p>
        <p className="text-sm" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
          {t(lang, 'quizCorrectOf', { n: passed, total: results.length })}
        </p>
      </div>

      <div className="w-full space-y-2">
        {results.map((r, i) => (
          <div key={i} className="rounded-xl px-4 py-3 flex items-start gap-3"
               style={{
                 background: r.passed ? 'rgba(139,223,221,0.05)' : 'rgba(252,165,165,0.05)',
                 border: `1px solid ${r.passed ? 'rgba(139,223,221,0.2)' : 'rgba(252,165,165,0.2)'}`,
               }}>
            <span style={{ color: r.passed ? '#8BDFDD' : '#fca5a5', fontSize: 16 }}>
              {r.passed ? '✓' : '✗'}
            </span>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--t1)' }}>{r.card.question}</p>
              {!r.passed && (
                <p className="text-xs mt-1" style={{ color: 'rgba(var(--t-rgb),0.5)' }}>
                  {t(lang, 'quizCorrectLabel')} {r.card.answer}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onStudy}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(240,141,57,0.1)', border: '1px solid rgba(240,141,57,0.3)', color: '#F08D39' }}>
          {t(lang, 'quizReview')}
        </button>
        <button onClick={onRetry}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222' }}>
          {t(lang, 'quizRetake')}
        </button>
      </div>
    </div>
  );
}

// ── Image Upload Zone ─────────────────────────────────────────────────────────
function ImageUploadZone({ images, onImages, lang = 'en' }) {
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5);
    onImages(prev => {
      const combined = [...prev, ...valid].slice(0, 5);
      return combined;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const remove = (idx) => onImages(prev => prev.filter((_, i) => i !== idx));

  return (
    <div>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
        style={{
          minHeight: 120,
          border: `2px dashed ${images.length ? 'rgba(240,141,57,0.4)' : 'rgba(var(--t-rgb),0.15)'}`,
          background: images.length ? 'rgba(240,141,57,0.04)' : 'rgba(var(--b-rgb),0.02)',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(240,141,57,0.5)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = images.length ? 'rgba(240,141,57,0.4)' : 'rgba(var(--t-rgb),0.15)'}
      >
        {images.length === 0 ? (
          <>
            <span className="text-3xl mb-2">📸</span>
            <p className="text-sm font-medium" style={{ color: 'rgba(var(--t-rgb),0.6)' }}>
              {t(lang, 'quizImgLabel')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>
              {t(lang, 'quizClickDrop')}
            </p>
          </>
        ) : (
          <p className="text-xs py-2" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
            {t(lang, 'quizAddMore')}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {images.map((img, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden flex-shrink-0"
                 style={{ width: 72, height: 72, border: '1px solid rgba(240,141,57,0.3)' }}>
              <img
                src={URL.createObjectURL(img)}
                alt={`note-${i}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => remove(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FlashQuiz({ lang = 'en', onSaveNote, topicContext, initialData = null }) {
  const inferenceHeaders = useInferenceHeaders();
  const [inputTab, setInputTab]   = useState('text');
  const [topic, setTopic]         = useState(initialData?.topic || topicContext?.topic || '');
  const [images, setImages]       = useState([]);
  const [count, setCount]         = useState(initialData?.count || 10);
  const [loading, setLoad]        = useState(false);
  const [error, setError]         = useState('');
  const [cards, setCards]         = useState(initialData?.cards || null);
  const [mode, setMode]           = useState('study');      // 'study' | 'quiz' | 'results'
  const [cardIdx, setIdx]         = useState(0);
  const [results, setRes]         = useState([]);

  const generate = useCallback(async () => {
    if (inputTab === 'text' && !topic.trim()) return;
    if (inputTab === 'images' && !images.length) return;
    setLoad(true); setError(''); setCards(null);

    try {
      let arr;
      if (inputTab === 'text') {
        const res = await fetch('/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...inferenceHeaders },
          body: JSON.stringify({ topic: topic.trim(), count, language: lang }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        arr = Array.isArray(data) ? data : data.cards;
      } else {
        const form = new FormData();
        images.forEach(img => form.append('images', img));
        form.append('count', String(count));
        form.append('language', lang);
        const res = await fetch('/api/quiz/from-images', { method: 'POST', body: form, headers: inferenceHeaders });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        arr = Array.isArray(data) ? data : data.cards;
      }

      if (!Array.isArray(arr) || arr.length === 0) throw new Error('Model returned no cards — try again.');
      setCards(arr);
      setMode('study');
      setIdx(0);
      // Persist to local history
      saveSession('quiz', topic.trim() || 'Image flashcards', { topic: topic.trim(), count, cards: arr }).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad(false);
    }
  }, [inputTab, topic, images, count, lang, inferenceHeaders]);

  const canGenerate = inputTab === 'text' ? !!topic.trim() : images.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined" style={{ color: '#F08D39', fontSize: 32, fontVariationSettings: "'FILL' 1" }}>quiz</span>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--t1)', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{t(lang, 'quizTitle')}</h1>
              <p className="text-sm" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>{t(lang, 'quizSub')}</p>
            </div>
          </div>

          {/* Mode tabs (only when cards exist) */}
          {cards && mode !== 'results' && (
            <div className="flex gap-2">
              {[['study', t(lang, 'quizStudy')], ['quiz', t(lang, 'quizQuiz')]].map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setIdx(0); }}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                        style={mode === m
                          ? { background: '#F08D39', color: '#222' }
                          : { background: 'rgba(240,141,57,0.08)', border: '1px solid rgba(240,141,57,0.2)', color: '#F08D39' }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pt-6 pb-8 debate-scroll">

        {/* Generator form */}
        {!cards && (
          <div className="max-w-xl mx-auto">
            <div className="rounded-2xl p-8"
                 style={{ background: 'var(--bg-card)', border: '1px solid rgba(240,141,57,0.2)', boxShadow: '0 0 40px rgba(240,141,57,0.06)' }}>

              {/* Input source tabs */}
              <div className="flex gap-2 mb-5">
                {[['text', t(lang, 'quizFromText')], ['images', t(lang, 'quizFromImages')]].map(([tab, label]) => (
                  <button key={tab} onClick={() => setInputTab(tab)}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={inputTab === tab
                            ? { background: 'rgba(240,141,57,0.2)', border: '1.5px solid rgba(240,141,57,0.5)', color: '#F08D39' }
                            : { background: 'rgba(var(--b-rgb),0.04)', border: '1px solid rgba(var(--b-rgb),0.1)', color: 'rgba(var(--b-rgb),0.4)' }}>
                    {tab === 'text' ? '✏️' : '📸'} {label}
                  </button>
                ))}
              </div>

              {/* Text input */}
              {inputTab === 'text' && (
                <>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--t2)' }}>
                    {t(lang, 'quizLabel')}
                  </label>
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder={t(lang, 'quizTopicPh')}
                    rows={4}
                    className="w-full rounded-xl p-4 text-sm resize-none focus:outline-none"
                    style={{
                      background: 'var(--bg-input)',
                      border: `1.5px solid ${topic ? '#F08D39' : 'rgba(var(--t-rgb),0.12)'}`,
                      color: 'var(--t1)',
                    }}
                  />
                </>
              )}

              {/* Image upload */}
              {inputTab === 'images' && (
                <>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--t2)' }}>
                    {t(lang, 'quizImgLabel')}
                  </label>
                  <ImageUploadZone images={images} onImages={setImages} lang={lang} />
                  {images.length > 0 && (
                    <p className="text-xs mt-2" style={{ color: 'rgba(240,141,57,0.6)' }}>
                      {t(lang, 'quizImgPrompt')}
                    </p>
                  )}
                </>
              )}

              <div className="flex items-center gap-4 my-5">
                <span className="text-sm font-medium" style={{ color: 'rgba(var(--t-rgb),0.5)' }}>
                  {t(lang, 'quizCount')}
                </span>
                <div className="flex gap-2">
                  {COUNT_OPTIONS.map(n => (
                    <button key={n} onClick={() => setCount(n)}
                            className="w-10 h-10 rounded-lg text-sm font-semibold transition-all"
                            style={count === n
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

              <button onClick={generate} disabled={!canGenerate || loading}
                      className="w-full py-4 rounded-xl font-semibold text-base transition-all"
                      style={!canGenerate || loading
                        ? { background: 'var(--bg-input)', color: 'rgba(var(--b-rgb),0.2)', cursor: 'not-allowed' }
                        : { background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 20px rgba(240,141,57,0.3)' }}>
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 rounded-full animate-spin"
                            style={{ borderColor: 'rgba(34,34,34,0.3)', borderTopColor: '#222' }} />
                      {t(lang, 'quizGenLoading')}
                    </span>
                  : `${t(lang, 'quizGenBtn')} (${count})`}
              </button>
            </div>
          </div>
        )}

        {/* Study mode */}
        {cards && mode === 'study' && (
          <div>
            <Flashcard card={cards[cardIdx]} index={cardIdx} total={cards.length} lang={lang} />

            <div className="flex items-center justify-center gap-4 mt-8">
              <button onClick={() => setIdx(i => Math.max(0, i - 1))}
                      disabled={cardIdx === 0}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.12)', color: cardIdx === 0 ? 'rgba(var(--b-rgb),0.2)' : 'var(--t1)' }}>
                {t(lang, 'quizPrevCard')}
              </button>

              <div className="flex gap-1.5">
                {cards.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)}
                          className="rounded-full transition-all"
                          style={{ width: i === cardIdx ? 20 : 6, height: 6,
                                   background: i === cardIdx ? '#F08D39' : 'rgba(var(--b-rgb),0.15)' }} />
                ))}
              </div>

              <button onClick={() => setIdx(i => Math.min(cards.length - 1, i + 1))}
                      disabled={cardIdx === cards.length - 1}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.12)', color: cardIdx === cards.length - 1 ? 'rgba(var(--b-rgb),0.2)' : 'var(--t1)' }}>
                {t(lang, 'quizNextCard')}
              </button>
            </div>

            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => { setMode('quiz'); setIdx(0); }}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: 'linear-gradient(135deg,#F08D39,#c47a2f)', color: '#222', boxShadow: '0 4px 16px rgba(240,141,57,0.3)' }}>
                {t(lang, 'quizStartQuiz')}
              </button>
              {onSaveNote && (
                <button
                  onClick={() => onSaveNote({ text: cards.map((c, i) => `Q${i+1}: ${c.question}\nA: ${c.answer}`).join('\n\n'), source: 'Flash & Quiz' })}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(240,141,57,0.08)', border: '1px solid rgba(240,141,57,0.25)', color: '#F08D39' }}>
                  📌 {t(lang, 'notesSave')}
                </button>
              )}
              <button onClick={() => { setCards(null); setImages([]); setTopic(''); }}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.1)', color: 'rgba(var(--b-rgb),0.5)' }}>
                {t(lang, 'quizNewTopic')}
              </button>
            </div>
          </div>
        )}

        {/* Quiz mode */}
        {cards && mode === 'quiz' && (
          <QuizMode
            cards={cards}
            lang={lang}
            onFinish={(res) => { setRes(res); setMode('results'); }}
          />
        )}

        {/* Results */}
        {mode === 'results' && (
          <QuizResults
            results={results}
            lang={lang}
            onRetry={() => { setMode('quiz'); setIdx(0); }}
            onStudy={() => { setMode('study'); setIdx(0); }}
          />
        )}
      </div>
    </div>
  );
}
