/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'slide-up': { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'slide-up': 'slide-up 0.2s ease-out',
      },
      colors: {
        todo: '#3B82F6',
        inprogress: '#F59E0B',
        waiting: '#8B5CF6',
        done: '#10B981',
      },
    },
  },
  plugins: [],
};
