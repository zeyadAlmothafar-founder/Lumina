import { useState } from 'react';
import { t } from '../i18n.js';
import { useInferenceHeaders } from '../context/InferenceContext.jsx';
import { saveSession } from '../db.js';

const WEEK_OPTIONS  = [1,2,3,4,6,8,12];
const HOURS_OPTIONS = [0.5,1,1.5,2,3,4];

const EXAMPLES = {
  en: ['Learn the basics of machine learning', 'Understand the French Revolution', 'Become proficient in Python programming', 'Master calculus fundamentals', 'Learn to write persuasive essays'],
  es: ['Aprender los fundamentos del machine learning', 'Entender la Revolución Francesa', 'Dominar la programación en Python', 'Dominar los fundamentos del cálculo', 'Aprender a escribir ensayos persuasivos'],
  ar: ['تعلم أساسيات التعلم الآلي', 'فهم الثورة الفرنسية', 'إتقان البرمجة بلغة بايثون', 'إتقان أساسيات حساب التفاضل والتكامل', 'تعلم كتابة المقالات الإقناعية'],
};

function resourceUrl(r) {
  const low = r.toLowerCase();
  if (low.includes('youtube'))   return `https://youtube.com/results?search_query=${encodeURIComponent(r)}`;
  if (low.includes('khan'))      return `https://khanacademy.org/search?page_search_query=${encodeURIComponent(r)}`;
  if (low.includes('coursera'))  return `https://coursera.org/search?query=${encodeURIComponent(r)}`;
  if (low.includes('udemy'))     return `https://udemy.com/courses/search/?q=${encodeURIComponent(r)}`;
  if (low.includes('mdn') || low.includes('mozilla')) return `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(r)}`;
  if (low.includes('github'))    return `https://github.com/search?q=${encodeURIComponent(r)}`;
  if (low.includes('wikipedia')) return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(r)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(r)}`;
}

function WeekCard({ data, index, isExpanded, onToggle, lang, onSaveNote, onLaunchTopic }) {
  const COLORS = ['#F08D39','#8BDFDD','#93c5fd','#c084fc','#34d399','#f472b6','#fbbf24','#60a5fa'];
  const color = COLORS[index % COLORS.length];

  return (
    <div className="rounded-xl overflow-hidden transition-all"
         style={{ border: `1px solid ${isExpanded ? color+'40' : 'rgba(var(--t-rgb),0.08)'}`, background: isExpanded ? 'rgba(240,141,57,0.03)' : 'rgba(var(--b-rgb),0.02)' }}>

      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left">
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
             style={{ background: color+'20', color, border: `1.5px solid ${color}40` }}>{data.week}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm" style={{ color: 'var(--t1)' }}>{data.theme}</div>
          <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>
            {data.topics.slice(0,2).join(' · ')}{data.topics.length>2 && ` ${t(lang,'gpsMoreTopics',{n:data.topics.length-2})}`}
          </div>
        </div>
        <div className="hidden sm:block text-xs px-2.5 py-1 rounded-full flex-shrink-0"
             style={{ background: color+'15', color, border: `1px solid ${color}30` }}>
          {data.milestone?.split(' ').slice(0,4).join(' ')}…
        </div>
        <span style={{ color: 'rgba(var(--t-rgb),0.35)', fontSize: 14 }}>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: `1px solid ${color}20` }}>
          {/* Topics */}
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>
              {t(lang,'gpsTopics')}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.topics.map((tp,i) => (
                <span key={i} className="text-xs px-3 py-1.5 rounded-full"
                      style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.12)', color: 'var(--t1)' }}>{tp}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: 'rgba(240,141,57,0.06)', border: '1px solid rgba(240,141,57,0.15)' }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#F08D39' }}>{t(lang,'gpsDailyFocus')}</p>
              <p className="text-sm" style={{ color: 'rgba(var(--b-rgb),0.8)' }}>{data.dailyFocus}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: color+'0d', border: `1px solid ${color}25` }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color }}>{t(lang,'gpsMilestone')}</p>
              <p className="text-sm" style={{ color: 'rgba(var(--b-rgb),0.8)' }}>{data.milestone}</p>
            </div>
          </div>

          {/* Resources — clickable */}
          {data.resources?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>
                {t(lang,'gpsFreeRes')}
              </p>
              <div className="space-y-1.5">
                {data.resources.map((r,i) => (
                  <a key={i} href={resourceUrl(r)} target="_blank" rel="noopener noreferrer"
                     className="flex items-start gap-2 text-sm group" style={{ textDecoration: 'none' }}>
                    <span style={{ color: '#F08D39' }} className="mt-0.5">→</span>
                    <span className="group-hover:underline underline-offset-2" style={{ color: 'rgba(240,141,57,0.85)' }}>{r}</span>
                    <span className="text-xs opacity-40 flex-shrink-0" style={{ color: '#F08D39' }}>↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.checkpoint && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(139,223,221,0.06)', border: '1px solid rgba(139,223,221,0.2)' }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#8BDFDD' }}>{t(lang,'gpsSelfCheck')}</p>
              <p className="text-sm italic" style={{ color: 'rgba(var(--b-rgb),0.75)' }}>"{data.checkpoint}"</p>
            </div>
          )}

          {/* Launch buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderTopColor: 'var(--bg-input)' }}>
            <span className="text-xs w-full mb-1" style={{ color: 'rgba(var(--t-rgb),0.3)' }}>{t(lang,'gpsLaunchWith')}</span>
            {[
              { key:'gpsLaunchQuiz',  mode:'quiz',     bg:'rgba(240,141,57,0.12)',  border:'rgba(240,141,57,0.3)',  fg:'#F08D39' },
              { key:'gpsLaunchDebate',mode:'debate',   bg:'rgba(139,223,221,0.08)',  border:'rgba(139,223,221,0.25)', fg:'#8BDFDD' },
              { key:'gpsLaunchExam',  mode:'examiner', bg:'rgba(147,197,253,0.08)', border:'rgba(147,197,253,0.25)',fg:'#93c5fd' },
            ].map(({ key, mode, bg, border, fg }) => (
              <button key={mode} onClick={() => onLaunchTopic(mode, data.theme)}
                      className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                      style={{ background: bg, border: `1px solid ${border}`, color: fg }}>
                {t(lang, key)}
              </button>
            ))}
            <button onClick={() => onSaveNote({ text: `Week ${data.week}: ${data.theme}\n\nTopics: ${data.topics.join(', ')}\nMilestone: ${data.milestone}`, source: `GPS Week ${data.week}` })}
                    className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                    style={{ background: 'var(--bg-input)', border: '1px solid rgba(var(--b-rgb),0.12)', color: 'rgba(var(--b-rgb),0.4)' }}>
              {t(lang,'notesSave')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LearningGPS({ lang = 'en', onSaveNote = () => {}, onLaunchTopic = () => {}, initialData = null }) {
  const inferenceHeaders = useInferenceHeaders();
  const [goal, setGoal]         = useState(initialData?.goal   || '');
  const [weeks, setWeeks]       = useState(initialData?.weeks  || 4);
  const [hours, setHours]       = useState(initialData?.hours  || 1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [roadmap, setRoadmap]   = useState(initialData?.roadmap || null);
  const [expanded, setExpanded] = useState(new Set([1]));

  const toggle = (w) => setExpanded(prev => {
    const s = new Set(prev); s.has(w) ? s.delete(w) : s.add(w); return s;
  });

  const generate = async () => {
    if (!goal.trim()) return;
    setLoading(true); setError(''); setRoadmap(null);
    try {
      const res = await fetch('/api/gps/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...inferenceHeaders },
        body: JSON.stringify({ goal: goal.trim(), weeks, hoursPerDay: hours, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRoadmap(data); setExpanded(new Set([1]));
      // Persist to local history
      saveSession('gps', goal.trim(), { goal: goal.trim(), weeks, hours, roadmap: data }).catch(() => {});
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      <div className="flex-shrink-0 px-8 pt-8 pb-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="material-symbols-outlined" style={{ color: '#F08D39', fontSize: 32, fontVariationSettings: "'FILL' 1" }}>explore</span>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--t1)', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{t(lang,'gpsTitle')}</h1>
        </div>
        <p className="text-sm" style={{ color: 'rgba(var(--t-rgb),0.4)' }}>{t(lang,'gpsSub')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pt-6 pb-8 debate-scroll">

        {!roadmap && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl p-8"
                 style={{ background: 'var(--bg-card)', border: '1px solid rgba(240,141,57,0.2)', boxShadow: '0 0 40px rgba(240,141,57,0.06)' }}>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--t2)' }}>{t(lang,'gpsQ')}</label>
              <textarea value={goal} onChange={e=>setGoal(e.target.value)} placeholder={t(lang,'gpsPlaceholder')} rows={3}
                className="w-full rounded-xl p-4 text-sm resize-none focus:outline-none"
                style={{ background:'var(--bg-input)', border:`1.5px solid ${goal?'#F08D39':'rgba(var(--t-rgb),0.12)'}`, color:'var(--t1)' }}
                onKeyDown={e=>e.key==='Enter'&&e.ctrlKey&&generate()} />

              <div className="flex flex-wrap gap-2 mt-2.5 mb-6">
                {(EXAMPLES[lang] || EXAMPLES.en).map(e=>(
                  <button key={e} onClick={()=>setGoal(e)} className="text-xs px-3 py-1.5 rounded-full transition-all"
                    style={{ background:'rgba(240,141,57,0.06)', border:'1px solid rgba(240,141,57,0.18)', color:'rgba(var(--t-rgb),0.65)' }}
                    onMouseEnter={ev=>ev.currentTarget.style.color='var(--t1)'}
                    onMouseLeave={ev=>ev.currentTarget.style.color='rgba(var(--t-rgb),0.65)'}>{e}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-6 mb-6">
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color:'rgba(var(--t-rgb),0.5)' }}>{t(lang,'gpsTimeframe')}</p>
                  <div className="flex gap-2">
                    {WEEK_OPTIONS.map(w=>(
                      <button key={w} onClick={()=>setWeeks(w)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={weeks===w?{background:'#F08D39',color:'#222'}:{background:'var(--bg-input)',border:'1px solid rgba(var(--b-rgb),0.12)',color:'rgba(var(--b-rgb),0.5)'}}>
                        {w}w
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color:'rgba(var(--t-rgb),0.5)' }}>{t(lang,'gpsHours')}</p>
                  <div className="flex gap-2">
                    {HOURS_OPTIONS.map(h=>(
                      <button key={h} onClick={()=>setHours(h)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={hours===h?{background:'#F08D39',color:'#222'}:{background:'var(--bg-input)',border:'1px solid rgba(var(--b-rgb),0.12)',color:'rgba(var(--b-rgb),0.5)'}}>
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-sm mb-4 px-4 py-2.5 rounded-xl" style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#fca5a5' }}>{error}</p>}

              <button onClick={generate} disabled={!goal.trim()||loading} className="w-full py-4 rounded-xl font-semibold text-base transition-all"
                style={!goal.trim()||loading?{background:'var(--bg-input)',color:'rgba(var(--b-rgb),0.2)',cursor:'not-allowed'}:{background:'linear-gradient(135deg,#F08D39,#c47a2f)',color:'#222',boxShadow:'0 4px 20px rgba(240,141,57,0.3)'}}>
                {loading?<span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 rounded-full animate-spin" style={{borderColor:'rgba(34,34,34,0.3)',borderTopColor:'#222'}}/>{t(lang,'gpsGenLoading')}</span>:t(lang,'gpsGenBtn')}
              </button>
            </div>
          </div>
        )}

        {roadmap && (
          <div>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color:'var(--t1)' }}>{roadmap.title}</h2>
                <p className="text-sm mt-1" style={{ color:'rgba(var(--t-rgb),0.5)' }}>{roadmap.overview}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={()=>onSaveNote({text:`${roadmap.title}\n\n${roadmap.overview}`,source:'GPS Roadmap'})}
                  className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background:'var(--bg-input)',border:'1px solid rgba(var(--b-rgb),0.12)',color:'rgba(var(--b-rgb),0.4)' }}>
                  {t(lang,'notesSave')}
                </button>
                <button onClick={()=>setRoadmap(null)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background:'rgba(240,141,57,0.1)',border:'1px solid rgba(240,141,57,0.25)',color:'#F08D39' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(240,141,57,0.2)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(240,141,57,0.1)'}>
                  {t(lang,'gpsNewGoal')}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              {[{label:t(lang,'gpsWeeks'),value:roadmap.weeks?.length},{label:t(lang,'gpsTotalHours'),value:`~${roadmap.weeks?.length*hours*7}h`},{label:t(lang,'gpsTopics'),value:roadmap.weeks?.reduce((a,w)=>a+(w.topics?.length||0),0)}].map(s=>(
                <div key={s.label} className="px-4 py-2.5 rounded-xl" style={{ background:'rgba(240,141,57,0.08)',border:'1px solid rgba(240,141,57,0.18)' }}>
                  <div className="text-lg font-bold" style={{ color:'#F08D39' }}>{s.value}</div>
                  <div className="text-xs" style={{ color:'rgba(var(--t-rgb),0.4)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {roadmap.prerequisites?.length>0&&(
              <div className="rounded-xl px-5 py-4 mb-5" style={{ background:'rgba(var(--b-rgb),0.04)',border:'1px solid rgba(var(--b-rgb),0.1)' }}>
                <span className="text-xs font-semibold" style={{ color:'rgba(var(--t-rgb),0.4)' }}>{t(lang,'gpsPrereqs')} </span>
                {roadmap.prerequisites.map((p,i)=><span key={i} className="text-xs mr-2" style={{ color:'rgba(var(--t-rgb),0.65)' }}>{p}</span>)}
              </div>
            )}

            <div className="space-y-3">
              {roadmap.weeks?.map((w,i)=>(
                <WeekCard key={w.week} data={w} index={i} isExpanded={expanded.has(w.week)}
                  onToggle={()=>toggle(w.week)} lang={lang} onSaveNote={onSaveNote} onLaunchTopic={onLaunchTopic} />
              ))}
            </div>

            {roadmap.finalOutcome&&(
              <div className="mt-6 rounded-xl px-6 py-5" style={{ background:'linear-gradient(135deg,rgba(240,141,57,0.1),rgba(240,141,57,0.05))',border:'1px solid rgba(240,141,57,0.25)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color:'#F08D39' }}>{t(lang,'gpsByEnd')}</p>
                <p className="text-sm" style={{ color:'rgba(var(--b-rgb),0.85)' }}>{roadmap.finalOutcome}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
