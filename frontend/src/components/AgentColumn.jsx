import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';
import TypingIndicator from './TypingIndicator.jsx';

const STYLE = {
  devil: {
    headerBg:     'rgba(100,45,20,0.3)',
    headerBorder: 'rgba(240,141,57,0.2)',
    divider:      'rgba(240,141,57,0.1)',
    name:         '#F08D39',
    role:         'rgba(240,141,57,0.5)',
    cursor:       '#F08D39',
  },
  consensus: {
    headerBg:     'rgba(20,85,83,0.3)',
    headerBorder: 'rgba(139,223,221,0.2)',
    divider:      'rgba(139,223,221,0.1)',
    name:         '#8BDFDD',
    role:         'rgba(139,223,221,0.5)',
    cursor:       '#8BDFDD',
  },
  factchecker: {
    headerBg:     'rgba(0,20,80,0.3)',
    headerBorder: 'rgba(59,130,246,0.2)',
    divider:      'rgba(59,130,246,0.1)',
    name:         '#93c5fd',
    role:         'rgba(147,197,253,0.45)',
    cursor:       '#93c5fd',
  },
};

// Strip markdown symbols for a cleaner live-stream view (full render happens on completion)
function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold**
    .replace(/\*([^*]+)\*/g, '$1')        // *italic*
    .replace(/^#{1,3}\s/gm, '')           // headers
    .replace(/^\s*[-*]\s/gm, '• ');       // bullets → nice bullet
}

export default function AgentColumn({ agent, messages, liveText, isTyping }) {
  const s = STYLE[agent.id];
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, liveText]);

  return (
    <div className="flex flex-col min-w-0 overflow-hidden border-r last:border-r-0"
         style={{ borderRightColor: s.divider }}>

      {/* Sticky column header */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b"
           style={{ background: s.headerBg, borderBottomColor: s.headerBorder }}>
        <span className="text-xl select-none">{agent.icon}</span>
        <div>
          <div className="font-semibold text-sm" style={{ color: s.name }}>{agent.name}</div>
          <div className="text-xs" style={{ color: s.role }}>{agent.role}</div>
        </div>
      </div>

      {/* Scrollable messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 debate-scroll">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            agentId={agent.id}
            round={msg.round}
            text={msg.text}
            interrupt={msg.interrupt}
          />
        ))}

        {/* Live streaming text (plain — markdown rendered on completion) */}
        {liveText && (
          <div className="px-1 text-sm leading-relaxed whitespace-pre-wrap"
               style={{ color: 'rgba(var(--b-rgb),0.8)' }}>
            {stripMarkdown(liveText)}
            <span className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom animate-pulse"
                  style={{ background: s.cursor }} />
          </div>
        )}

        {isTyping && !liveText && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
