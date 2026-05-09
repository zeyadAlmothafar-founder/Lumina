import { useEffect, useRef, useReducer, useCallback, useState } from 'react';
import AgentColumn from './AgentColumn.jsx';
import MicButton from './MicButton.jsx';
import { t } from '../i18n.js';

function getAgents(lang) {
  return [
    { id: 'devil',       name: t(lang, 'agentDevilName'),      role: t(lang, 'agentDevilRole'),       icon: '🔍' },
    { id: 'consensus',   name: t(lang, 'agentConsensusName'),  role: t(lang, 'agentConsensusRole'),   icon: '🔭' },
    { id: 'factchecker', name: t(lang, 'agentFactName'),       role: t(lang, 'agentFactRole'),        icon: '📚' },
  ];
}

const EMPTY   = { devil: false, consensus: false, factchecker: false };
const EMPTY_T = { devil: '',    consensus: '',    factchecker: '' };

function init() {
  return {
    currentRound: 0, streaming: false, roundComplete: false,
    roundData: {},
    liveTokens: EMPTY_T, typing: EMPTY,
    vote: null, interruptBanner: null, synthesizing: false,
  };
}

function reducer(s, a) {
  switch (a.type) {
    case 'ROUND_START':
      return { ...s, currentRound: a.round, streaming: true, roundComplete: false,
               vote: null, interruptBanner: a.interrupt || null,
               typing: { devil: true, consensus: true, factchecker: true }, liveTokens: EMPTY_T };
    case 'TOKEN':
      return { ...s,
               typing: { ...s.typing, [a.agent]: false },
               liveTokens: { ...s.liveTokens, [a.agent]: s.liveTokens[a.agent] + a.text } };
    case 'ROUND_COMPLETE':
      return { ...s, streaming: false, roundComplete: true, typing: EMPTY, liveTokens: EMPTY_T,
               roundData: { ...s.roundData, [s.currentRound]: {
                 devil: a.tokens.devil, consensus: a.tokens.consensus,
                 factchecker: a.tokens.factchecker, interrupt: a.hadInterrupt,
               }}};
    case 'INTERRUPT_COMMIT':
      return { ...s, streaming: false, roundComplete: false, typing: EMPTY, liveTokens: EMPTY_T,
               interruptBanner: null,
               roundData: { ...s.roundData, [s.currentRound]: {
                 devil:       (a.tokens.devil       || '') + (a.tokens.devil ? ' ✂︎' : ''),
                 consensus:   (a.tokens.consensus   || '') + (a.tokens.consensus ? ' ✂︎' : ''),
                 factchecker: (a.tokens.factchecker || '') + (a.tokens.factchecker ? ' ✂︎' : ''),
                 interrupt: false,
               }}};
    case 'SET_VOTE':     return { ...s, vote: a.agent };
    case 'SYNTHESIZING': return { ...s, synthesizing: a.value };
    default: return s;
  }
}

export default function DebateArena({ session, onSynthesized, lang = 'en' }) {
  const [state, dispatch]      = useReducer(reducer, undefined, init);
  const [activeTab, setActiveTab] = useState(1);
  const [interruptOpen, setInterruptOpen] = useState(false);
  const [interruptText, setInterruptText] = useState('');
  const [interruptTarget, setInterruptTarget] = useState('all');

  const esRef           = useRef(null);
  const liveRef         = useRef(EMPTY_T);
  const currentRoundRef = useRef(0);
  const streamingRef    = useRef(false);

  const agents = getAgents(lang);

  useEffect(() => { currentRoundRef.current = state.currentRound; }, [state.currentRound]);
  useEffect(() => { streamingRef.current    = state.streaming;    }, [state.streaming]);
  useEffect(() => { if (state.currentRound > 0) setActiveTab(state.currentRound); }, [state.currentRound]);

  const startRound = useCallback((roundNum, interruptTxt, target) => {
    esRef.current?.close();
    liveRef.current = EMPTY_T;

    dispatch({ type: 'ROUND_START', round: roundNum, interrupt: interruptTxt || null });
    const hadInterrupt = !!interruptTxt;

    let url = `/api/session/${session.sessionId}/stream?round=${roundNum}`;
    if (interruptTxt) url += `&interrupt=${encodeURIComponent(interruptTxt)}&target=${target || 'all'}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('token', e => {
      const { agent, text } = JSON.parse(e.data);
      liveRef.current = { ...liveRef.current, [agent]: liveRef.current[agent] + text };
      dispatch({ type: 'TOKEN', agent, text });
    });
    es.addEventListener('round_complete', () => {
      dispatch({ type: 'ROUND_COMPLETE', tokens: { ...liveRef.current }, hadInterrupt });
      es.close();
    });
    es.addEventListener('error', () => {
      dispatch({ type: 'ROUND_COMPLETE', tokens: { ...liveRef.current }, hadInterrupt });
      es.close();
    });
  }, [session.sessionId]);

  useEffect(() => { startRound(1); return () => esRef.current?.close(); }, []); // eslint-disable-line

  const handleVoiceInterrupt = useCallback((transcript) => {
    if (streamingRef.current) {
      esRef.current?.close();
      dispatch({ type: 'INTERRUPT_COMMIT', tokens: { ...liveRef.current } });
    }
    startRound(currentRoundRef.current + 1, transcript, 'all');
  }, [startRound]);

  const handleSendInterrupt = () => {
    if (!interruptText.trim()) return;
    if (streamingRef.current) {
      esRef.current?.close();
      dispatch({ type: 'INTERRUPT_COMMIT', tokens: { ...liveRef.current } });
    }
    startRound(currentRoundRef.current + 1, interruptText.trim(), interruptTarget);
    setInterruptText('');
    setInterruptOpen(false);
  };

  const handleSynthesize = async () => {
    dispatch({ type: 'SYNTHESIZING', value: true });
    try {
      const res = await fetch(`/api/session/${session.sessionId}/synthesize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSynthesized(data.outline);
    } catch (err) {
      console.error('Synthesis failed:', err);
      dispatch({ type: 'SYNTHESIZING', value: false });
    }
  };

  const isLastRound = state.currentRound >= session.totalRounds;

  const completedRounds = Object.keys(state.roundData).map(Number).sort((a,b)=>a-b);
  const tabRounds = completedRounds.length > 0 ? completedRounds : (state.currentRound > 0 ? [state.currentRound] : [1]);

  const roundEntry = state.roundData[activeTab];
  const isLiveRound = activeTab === state.currentRound && state.streaming;

  const tabMessages = {
    devil:       roundEntry ? [{ round: activeTab, text: roundEntry.devil,       interrupt: roundEntry.interrupt }] : [],
    consensus:   roundEntry ? [{ round: activeTab, text: roundEntry.consensus,   interrupt: roundEntry.interrupt }] : [],
    factchecker: roundEntry ? [{ round: activeTab, text: roundEntry.factchecker, interrupt: roundEntry.interrupt }] : [],
  };

  const VOTE_STYLE = {
    devil:       { sel: { background:'rgba(240,141,57,0.15)', border:'1px solid rgba(240,141,57,0.5)', color:'#F08D39' } },
    consensus:   { sel: { background:'rgba(139,223,221,0.15)', border:'1px solid rgba(139,223,221,0.5)', color:'#8BDFDD' } },
    factchecker: { sel: { background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.5)', color:'#93c5fd' } },
  };
  const voteIdle = { background:'rgba(var(--b-rgb),0.04)', border:'1px solid rgba(var(--b-rgb),0.1)', color:'rgba(var(--b-rgb),0.35)' };

  // Status bar text
  const statusText = state.streaming
    ? `⟳ ${t(lang, 'debateStreaming', { n: state.currentRound })}`
    : state.roundComplete
    ? t(lang, 'debateComplete', { n: state.currentRound, t: session.totalRounds })
    : t(lang, 'debateRoundOf', { n: state.currentRound, t: session.totalRounds });

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background:'var(--bg-page)' }}>

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b"
           style={{ borderBottomColor:'rgba(240,141,57,0.15)', background:'var(--bg-card-3)' }}>
        <div className="min-w-0">
          <h2 className="font-semibold truncate" style={{ color:'var(--t1)' }}>{session.topic}</h2>
          <p className="text-xs mt-0.5" style={{ color:'rgba(var(--t-rgb),0.4)' }}>{statusText}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {Array.from({ length: session.totalRounds }).map((_, i) => {
            const done = i+1 < state.currentRound, cur = i+1 === state.currentRound;
            return <div key={i} className="rounded-full transition-all duration-300" style={{
              width: cur?10:7, height: cur?10:7,
              background: done?'#F08D39': cur?(state.streaming?'var(--t2)':'#F08D39'):'rgba(var(--t-rgb),0.15)',
              boxShadow: cur?'0 0 8px rgba(240,141,57,0.7)':'none',
            }} />;
          })}
        </div>
      </div>

      {/* Round tabs */}
      {(tabRounds.length > 1 || state.currentRound > 0) && (
        <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 overflow-x-auto"
             style={{ borderBottom:'1px solid rgba(240,141,57,0.1)', background:'var(--bg-card-3)' }}>
          {tabRounds.map(r => (
            <button key={r} onClick={() => setActiveTab(r)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={activeTab === r
                      ? { background:'rgba(240,141,57,0.2)', border:'1px solid rgba(240,141,57,0.45)', color:'#F08D39' }
                      : { background:'rgba(var(--b-rgb),0.04)', border:'1px solid rgba(var(--b-rgb),0.1)', color:'rgba(var(--b-rgb),0.45)' }}>
              {t(lang, 'debateRoundTab', { n: r })}
              {r === state.currentRound && state.streaming && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#F08D39' }} />}
            </button>
          ))}
          {state.currentRound > 0 && !completedRounds.includes(state.currentRound) && (
            <button onClick={() => setActiveTab(state.currentRound)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={activeTab === state.currentRound
                      ? { background:'rgba(240,141,57,0.2)', border:'1px solid rgba(240,141,57,0.45)', color:'#F08D39' }
                      : { background:'rgba(var(--b-rgb),0.04)', border:'1px solid rgba(var(--b-rgb),0.1)', color:'rgba(var(--b-rgb),0.45)' }}>
              {t(lang, 'debateRoundTab', { n: state.currentRound })}
              {state.streaming && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#F08D39' }} />}
            </button>
          )}
        </div>
      )}

      {/* Interrupt banner */}
      {state.interruptBanner && state.streaming && (
        <div className="flex-shrink-0 px-5 py-2 text-sm font-medium"
             style={{ background:'rgba(240,141,57,0.1)', borderBottom:'1px solid rgba(240,141,57,0.2)', color:'#F08D39' }}>
          {t(lang, 'debateYouSaid')} <em>"{state.interruptBanner}"</em>
        </div>
      )}

      {/* 3-column arena */}
      <div className="flex-1 grid grid-cols-3 min-h-0 overflow-hidden">
        {agents.map(agent => (
          <AgentColumn
            key={agent.id}
            agent={agent}
            messages={tabMessages[agent.id]}
            liveText={isLiveRound ? state.liveTokens[agent.id] : ''}
            isTyping={isLiveRound ? state.typing[agent.id] : false}
          />
        ))}
      </div>

      {/* Interrupt input panel */}
      {interruptOpen && (
        <div className="flex-shrink-0 px-5 py-3 border-t"
             style={{ borderTopColor:'rgba(240,141,57,0.2)', background:'var(--bg-card-3)' }}>
          <p className="text-xs mb-2" style={{ color:'rgba(var(--t-rgb),0.4)' }}>{t(lang, 'debateInterruptLabel')}</p>
          <textarea
            value={interruptText}
            onChange={e => setInterruptText(e.target.value)}
            placeholder={t(lang, 'debateTypePh')}
            rows={2}
            autoFocus
            className="w-full rounded-xl p-3 text-sm resize-none focus:outline-none mb-2"
            style={{ background:'var(--bg-input)', border:`1.5px solid ${interruptText?'#F08D39':'rgba(var(--t-rgb),0.12)'}`, color:'var(--t1)' }}
            onKeyDown={e => e.key==='Enter' && e.ctrlKey && handleSendInterrupt()}
          />
          <div className="flex items-center gap-3">
            <span className="text-xs flex-shrink-0" style={{ color:'rgba(var(--t-rgb),0.35)' }}>{t(lang, 'debateTarget')}</span>
            {[
              { id:'all',         label: t(lang, 'debateTargetAll'), color:'#F08D39' },
              { id:'devil',       label: `⚡ ${t(lang, 'agentDevilName').split(' ')[0]}`,     color:'#F08D39' },
              { id:'consensus',   label: `🔭 ${t(lang, 'agentConsensusName').split(' ')[0]}`, color:'#8BDFDD' },
              { id:'factchecker', label: `📚 ${t(lang, 'agentFactName').split(' ')[0]}`,      color:'#93c5fd' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setInterruptTarget(opt.id)}
                      className="text-xs px-2.5 py-1 rounded-full transition-all"
                      style={interruptTarget===opt.id
                        ? { background:opt.color+'22', border:`1px solid ${opt.color}55`, color:opt.color }
                        : { background:'rgba(var(--b-rgb),0.04)', border:'1px solid rgba(var(--b-rgb),0.1)', color:'rgba(var(--b-rgb),0.35)' }}>
                {opt.label}
              </button>
            ))}
            <button onClick={handleSendInterrupt} disabled={!interruptText.trim()}
                    className="ml-auto px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={interruptText.trim()
                      ? { background:'linear-gradient(135deg,#F08D39,#c47a2f)', color:'#222' }
                      : { background:'var(--bg-input)', color:'rgba(var(--b-rgb),0.2)', cursor:'not-allowed' }}>
              {t(lang, 'debateSend')}
            </button>
            <button onClick={() => setInterruptOpen(false)}
                    className="text-xs px-2 py-1.5 rounded-xl"
                    style={{ color:'rgba(var(--t-rgb),0.3)' }}>✕</button>
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t"
           style={{ borderTopColor:'rgba(240,141,57,0.15)', background:'var(--bg-card-3)' }}>

        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {state.roundComplete && (
            <>
              <span className="text-xs whitespace-nowrap" style={{ color:'rgba(var(--t-rgb),0.35)' }}>{t(lang, 'debateBestArg')}</span>
              {agents.map(a => (
                <button key={a.id} onClick={() => dispatch({ type:'SET_VOTE', agent:a.id })}
                        className="text-xs px-3 py-1.5 rounded-full transition-all"
                        style={state.vote===a.id ? VOTE_STYLE[a.id].sel : voteIdle}>
                  {a.icon} {a.name.split(' ')[0]}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <MicButton onRecorded={handleVoiceInterrupt} disabled={false} lang={lang} />

          <button onClick={() => setInterruptOpen(o=>!o)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={interruptOpen
                    ? { background:'rgba(240,141,57,0.2)', border:'1px solid rgba(240,141,57,0.5)', color:'#F08D39' }
                    : { background:'var(--bg-input)', border:'1px solid rgba(var(--b-rgb),0.12)', color:'rgba(var(--b-rgb),0.5)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> {t(lang, 'debateInterrupt')}
          </button>

          {state.roundComplete && !isLastRound && (
            <button onClick={() => startRound(state.currentRound+1, null, null)}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                    style={{ background:'rgba(240,141,57,0.12)', border:'1px solid rgba(240,141,57,0.35)', color:'#F08D39' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(240,141,57,0.22)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(240,141,57,0.12)'}>
              {t(lang, 'debateNextRound')}
            </button>
          )}

          {(state.roundComplete || !state.streaming) && (
            <button onClick={handleSynthesize}
                    disabled={state.synthesizing || state.currentRound===0}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                    style={isLastRound && state.roundComplete
                      ? { background:'linear-gradient(135deg,#F08D39,#c47a2f)', color:'#222', boxShadow:'0 4px 16px rgba(240,141,57,0.3)', opacity:state.synthesizing?0.6:1 }
                      : { background:'var(--bg-input)', border:'1px solid rgba(var(--b-rgb),0.12)', color:'rgba(var(--b-rgb),0.4)', opacity:state.synthesizing||state.currentRound===0?0.4:1 }}>
              {state.synthesizing
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{borderColor:'rgba(34,34,34,0.3)',borderTopColor:'#222'}}/> {t(lang, 'debateSynthesizing')}</span>
                : isLastRound && state.roundComplete ? t(lang, 'debateSynthesize') : t(lang, 'debateEndEarly')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
