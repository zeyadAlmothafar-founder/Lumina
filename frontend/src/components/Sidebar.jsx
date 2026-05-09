import { t, LANGS } from '../i18n.js';

export default function Sidebar({ active, onNavigate, lang = 'en', onLangChange, notesCount = 0, onNotesToggle, theme = 'dark', onThemeChange }) {
  const NAV = [
    { id: 'gps',        icon: 'explore',     label: t(lang, 'navGps'),        sub: t(lang, 'navGpsSub') },
    { id: 'quiz',       icon: 'quiz',        label: t(lang, 'navQuiz'),       sub: t(lang, 'navQuizSub') },
    { id: 'debate',     icon: 'forum',       label: t(lang, 'navDebate'),     sub: t(lang, 'navDebateSub') },
    { id: 'examiner',   icon: 'edit_note',   label: t(lang, 'navExaminer'),   sub: t(lang, 'navExaminerSub') },
    { id: 'whiteboard', icon: 'history_edu', label: t(lang, 'navWhiteboard'), sub: t(lang, 'navWhiteboardSub') },
  ];
  const isRtl = lang === 'ar';

  return (
    <aside className="flex flex-col flex-shrink-0 h-screen"
      style={{
        width: 230,
        background: '#3852B4',
        borderRight: isRtl ? 'none' : '1px solid rgba(255,255,255,0.1)',
        borderLeft:  isRtl ? '1px solid rgba(255,255,255,0.1)' : 'none',
      }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-3xl" style={{ color: '#F08D39', fontVariationSettings: "'FILL' 1", fontSize: 32 }}>auto_awesome</span>
          <div>
            <div className="font-bold text-base leading-tight" style={{ color: '#ffffff', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              Lu<span style={{ color: '#F08D39' }}>mina</span>
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Gemma 4 Good</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-widest px-2 mb-3"
           style={{ color: 'rgba(255,255,255,0.35)' }}>{t(lang, 'studyTools')}</p>

        {NAV.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={isActive
                ? { background: '#F08D39', boxShadow: '0 2px 12px rgba(240,141,57,0.4)' }
                : { background: 'transparent' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
              <span className="material-symbols-outlined flex-shrink-0"
                    style={{ color: '#ffffff', fontSize: 20 }}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: '#ffffff' }}>{item.label}</div>
                <div className="text-xs truncate" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)' }}>{item.sub}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Notes toggle */}
      <div className="px-3 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onNotesToggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mt-3"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
          <span className="material-symbols-outlined" style={{ color: '#F08D39', fontSize: 18 }}>push_pin</span>
          <span className="text-sm font-medium flex-1 text-left" style={{ color: 'rgba(255,255,255,0.9)' }}>{t(lang, 'notesTitle')}</span>
          {notesCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: '#F08D39', color: '#fff' }}>{notesCount}</span>
          )}
        </button>
      </div>

      {/* Theme toggle */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {theme === 'dark' ? 'Dark mode' : 'Light mode'}
          </span>
          <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 18 }}>
            {theme === 'dark' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>
      </div>

      {/* Language */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>Language</p>
        <div className="flex gap-1.5">
          {LANGS.map(l => (
            <button key={l.code} onClick={() => onLangChange(l.code)}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={lang === l.code
                ? { background: '#F08D39', color: '#fff' }
                : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)' }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{t(lang, 'poweredBy')}</div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.18)' }}>{t(lang, 'track')}</div>
      </div>
    </aside>
  );
}
