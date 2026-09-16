/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Outfit', 'Plus Jakarta Sans', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Outfit', 'Inter', 'sans-serif'],
      },
      colors: {
        'luxury-black': '#121212',
        'luxury-card': '#1a1a1a',
        'luxury-border': '#2a2a2a',
        'emerald-panel': '#1b2e23',
        'slate-panel': '#1e2c38',
        'burgundy-panel': '#3b1c26',
        metafi: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          dark: '#0f172a',
          card: '#1e293b',
        },
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 20px -5px rgba(79, 70, 229, 0.3)',
      },
    },
  },
  plugins: [],
}
