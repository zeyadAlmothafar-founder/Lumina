import { useState } from 'react';
import { t } from '../i18n.js';

const SUGGESTIONS = {
  en: [
    'Should AI be regulated by governments?',
    'Is social media harmful to democracy?',
    'Does universal basic income help economies?',
    'Should gene editing in humans be allowed?',
    'Is nuclear energy the answer to climate change?',
  ],
  es: [
    '¿Debería la IA ser regulada por gobiernos?',
    '¿Las redes sociales son dañinas para la democracia?',
    '¿El ingreso básico universal ayuda a las economías?',
    '¿Debería permitirse la edición genética en humanos?',
    '¿La energía nuclear es la respuesta al cambio climático?',
  ],
  ar: [
    'هل يجب أن يخضع الذكاء الاصطناعي لتنظيم حكومي؟',
    'هل وسائل التواصل الاجتماعي ضارة بالديمقراطية؟',
    'هل يساعد الدخل الأساسي الشامل الاقتصادات؟',
    'هل يجب السماح بتعديل الجينات البشرية؟',
    'هل الطاقة النووية هي الحل لأزمة المناخ؟',
  ],
};

function getAgents(lang) {
  return [
    {
      id: 'devil',
      name: t(lang, 'agentDevilName'),
      icon: '🔍',
      role: t(lang, 'agentDevilRole'),
      cardStyle: { background: 'rgba(100,45,20,0.35)', border: '1px solid rgba(240,141,57,0.3)' },
      accentColor: '#F08D39',
    },
    {
      id: 'consensus',
      name: t(lang, 'agentConsensusName'),
      icon: '🔭',
      role: t(lang, 'agentConsensusRole'),
      cardStyle: { background: 'rgba(20,85,83,0.35)', border: '1px solid rgba(139,223,221,0.3)' },
      accentColor: '#8BDFDD',
    },
    {
      id: 'factchecker',
      name: t(lang, 'agentFactName'),
      icon: '📚',
      role: t(lang, 'agentFactRole'),
      cardStyle: { background: 'rgba(0,20,80,0.35)', border: '1px solid rgba(59,130,246,0.3)' },
      accentColor: '#93c5fd',
    },
  ];
}

export default function Landing({ onStart, prefillTopic, lang = 'en' }) {
  const [topic, setTopic] = useState(prefillTopic || '');
  const [rounds, setRounds] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.en;
  const agents = getAgents(lang);

  const handleStart = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmed, rounds, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start session');
      onStart({ ...data, topic: trimmed, totalRounds: rounds });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-landing)' }}
    >
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5 blur-3xl pointer-events-none"
           style={{ background: '#F08D39' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5 blur-3xl pointer-events-none"
           style={{ background: '#F08D39' }} />

      <div className="relative w-full max-w-2xl z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 glow-orange-sm"
               style={{ background: 'linear-gradient(135deg, #F08D39, #c47a2f)' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 44, fontVariationSettings: "'FILL' 1" }}>balance</span>
          </div>
          <h1 className="text-5xl font-bold mb-2" style={{ color: 'var(--t1)', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            Agent<span style={{ color: '#F08D39' }}>Debate</span>
          </h1>
          <p className="text-lg font-light" style={{ color: 'var(--t2)', opacity: 0.6 }}>
            {t(lang, 'navDebateSub')}
          </p>
        </div>

        <div
          className="rounded-2xl p-8 border mb-6 glow-orange"
          style={{
            background: 'var(--bg-card-2)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(240,141,57,0.25)',
          }}
        >
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--t2)' }}>
            {t(lang, 'debateEnterTopic')}
          </label>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder={t(lang, 'debateTopicPh')}
            rows={3}
            className="w-full rounded-xl p-4 text-base resize-none placeholder:opacity-30 focus:outline-none transition-all"
            style={{
              background: 'var(--bg-input)',
              border: `1.5px solid ${topic ? '#F08D39' : 'rgba(var(--t-rgb),0.15)'}`,
              color: 'var(--t1)',
            }}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleStart(); }}
          />

          <div className="flex flex-wrap gap-2 mt-3 mb-6">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: 'rgba(240,141,57,0.06)',
                  borderColor: 'rgba(240,141,57,0.2)',
                  color: 'var(--t2)',
                  opacity: 0.75,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'rgba(240,141,57,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.75'; e.currentTarget.style.borderColor = 'rgba(240,141,57,0.2)'; }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--t2)' }}>
              {t(lang, 'debateRoundsLabel')}
            </span>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setRounds(n)}
                  className="w-10 h-10 rounded-lg text-sm font-semibold transition-all"
                  style={rounds === n
                    ? { background: '#F08D39', color: '#222222', boxShadow: '0 0 12px rgba(240,141,57,0.4)' }
                    : { background: 'var(--bg-input)', color: 'var(--t2)', border: '1px solid rgba(var(--t-rgb),0.15)' }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-xs opacity-40" style={{ color: 'var(--t1)' }}>{t(lang, 'debateDefault')}</span>
          </div>

          {error && (
            <div className="text-sm mb-4 rounded-xl px-4 py-2.5"
                 style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!topic.trim() || loading}
            className="w-full py-4 rounded-xl font-semibold text-base transition-all"
            style={!topic.trim() || loading
              ? { background: 'var(--bg-input)', color: 'rgba(var(--b-rgb),0.25)', cursor: 'not-allowed' }
              : { background: 'linear-gradient(135deg, #F08D39, #c47a2f)', color: '#222222', boxShadow: '0 4px 24px rgba(240,141,57,0.35)' }
            }
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(34,34,34,0.3)', borderTopColor: '#222222' }} />
                {t(lang, 'debateStartingBtn')}
              </span>
            ) : (
              t(lang, 'debateStartBtn')
            )}
          </button>
          <p className="text-center mt-2.5 text-xs opacity-30" style={{ color: 'var(--t1)' }}>
            {t(lang, 'debateCtrlEnter')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {agents.map(a => (
            <div
              key={a.id}
              className="rounded-xl p-4"
              style={a.cardStyle}
            >
              <div className="text-2xl mb-2">{a.icon}</div>
              <div className="font-semibold text-sm mb-1" style={{ color: a.accentColor }}>{a.name}</div>
              <div className="text-xs leading-snug opacity-60" style={{ color: 'var(--t2)' }}>{a.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
