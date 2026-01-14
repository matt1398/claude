/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Surface colors for dark mode
        surface: {
          DEFAULT: '#18181b', // zinc-900 - main background
          raised: '#27272a',  // zinc-800 - cards, panels
          overlay: '#3f3f46', // zinc-700 - modals, dropdowns
        },
        // Border colors
        border: {
          DEFAULT: '#3f3f46', // zinc-700 - primary borders
          subtle: '#27272a',  // zinc-800 - subtle dividers
          emphasis: '#52525b', // zinc-600 - emphasized borders
        },
        // Text colors
        text: {
          DEFAULT: '#fafafa',    // zinc-50 - primary text
          secondary: '#a1a1aa',  // zinc-400 - secondary text
          muted: '#71717a',      // zinc-500 - muted/placeholder
        },
        // Semantic colors (only for status, not containers)
        semantic: {
          success: '#22c55e',  // green-500
          error: '#ef4444',    // red-500
          warning: '#f59e0b',  // amber-500
          info: '#3b82f6',     // blue-500
        },
        // Legacy aliases for backward compatibility (gradual migration)
        'claude-dark': {
          bg: '#18181b',
          surface: '#27272a',
          border: '#3f3f46',
          text: '#fafafa',
          'text-secondary': '#a1a1aa'
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
}
