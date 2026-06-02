/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
