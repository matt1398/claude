/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Claude Code dark theme colors
        'claude-dark': {
          bg: '#1a1a1a',
          surface: '#2d2d2d',
          border: '#404040',
          text: '#e5e5e5',
          'text-secondary': '#a3a3a3'
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
}
