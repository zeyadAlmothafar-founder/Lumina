export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream:  '#FAF3E1',
        sand:   '#F5E7C6',
        orange: '#F08D39',
        ink:    '#222222',
        'lumina-blue':   '#3852B4',
        'lumina-orange': '#F08D39',
      },
      fontFamily: {
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  safelist: [
    // Agent accent classes used dynamically
    'border-red-500/40',   'bg-red-500/10',   'text-red-300',   'text-red-200',   'bg-red-950/30',
    'border-teal-500/40',  'bg-teal-500/10',  'text-teal-300',  'text-teal-200',  'bg-teal-950/30',
    'border-blue-500/40',  'bg-blue-500/10',  'text-blue-300',  'text-blue-200',  'bg-blue-950/30',
    'border-red-500',  'bg-red-900/30',
    'border-teal-500', 'bg-teal-900/30',
    'border-blue-500', 'bg-blue-900/30',
    'bg-red-500/20',   'bg-teal-500/20',   'bg-blue-500/20',
  ],
};
