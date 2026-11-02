/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07110d', 900: '#10241b', 800: '#1a3a2c', 700: '#24543f' },
        mint: { 50: '#f3faf6', 100: '#e5f6ec', 400: '#3dbe86', 600: '#127a4d' },
        gold: { 300: '#e4c99a', 500: '#b8894a' },
        paper: '#f7f4ee',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        card: '0 16px 40px -28px rgba(12, 31, 23, 0.45)',
      },
    },
  },
  plugins: [],
};
