export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-3">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full inline-block animate-bounce"
          style={{
            background: 'rgba(240,141,57,0.5)',
            animationDelay: `${i * 0.18}s`,
            animationDuration: '0.9s',
          }}
        />
      ))}
    </div>
  );
}
