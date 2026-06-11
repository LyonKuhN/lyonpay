/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0B0E',
        surface: '#15151A',
        surfaceHighlight: '#1F1F26',
        primary: '#FFD700', // Gold/Neon accent
        accentGreen: '#00FFA3',
        accentRed: '#FF4D4D',
        textPrimary: '#FFFFFF',
        textSecondary: '#A1A1AA'
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
