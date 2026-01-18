/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // =================================================================
        // LINEAR-STYLE DESIGN SYSTEM
        // Premium dark mode with rich backgrounds and micro-borders
        // =================================================================

        // Theme-aware surface colors - LAYERED DEPTH SYSTEM
        surface: {
          DEFAULT: 'var(--color-surface)',         // #0E0F11 - Sidebar/header (deepest)
          content: 'var(--color-surface-content)', // #161719 - Main content area
          raised: 'var(--color-surface-raised)',   // #1F2124 - Cards, bubbles
          overlay: 'var(--color-surface-overlay)', // #232529 - Code blocks, modals (highest)
        },

        // Theme-aware border colors - Micro-border system (key Linear aesthetic)
        border: {
          DEFAULT: 'var(--color-border)',        // rgba(255,255,255,0.08)
          subtle: 'var(--color-border-subtle)',  // rgba(255,255,255,0.05)
          emphasis: 'var(--color-border-emphasis)', // rgba(255,255,255,0.12)
        },

        // Theme-aware text colors - Three-tier hierarchy
        text: {
          DEFAULT: 'var(--color-text)',          // #EDEDED - Primary
          secondary: 'var(--color-text-secondary)', // #8A8F98 - Secondary
          muted: 'var(--color-text-muted)',      // #5C6370 - Tertiary/disabled
        },

        // Semantic colors - Desaturated, professional palette
        semantic: {
          success: '#7EC699',  // Soft green
          error: '#E06C75',    // Soft red
          warning: '#D4A373',  // Warm amber
          info: '#7AA2D4',     // Soft blue
        },

        // Accent colors - Minimal and desaturated
        accent: {
          primary: '#7AA2D4',   // Soft blue - primary actions
          secondary: '#B39DDB', // Soft purple - secondary highlights
          warm: '#D4A373',      // Warm amber - attention/highlights
          gold: '#C9A84C',      // Desaturated gold - special emphasis
        },

        // Linear-specific raw colors - LAYERED DEPTH SYSTEM
        linear: {
          bg: {
            DEFAULT: '#0E0F11',      // Layer 0: Sidebar/header
            content: '#161719',       // Layer 1: Main content area
            raised: '#1F2124',        // Layer 2: Cards, bubbles
            overlay: '#232529',       // Layer 3: Code blocks, modals
            hover: 'rgba(255, 255, 255, 0.05)',
            active: 'rgba(255, 255, 255, 0.08)',
          },
          border: {
            DEFAULT: 'rgba(255, 255, 255, 0.10)',
            subtle: 'rgba(255, 255, 255, 0.06)',
            emphasis: 'rgba(255, 255, 255, 0.14)',
          },
          text: {
            primary: '#EDEDED',
            secondary: '#9DA3AE',
            muted: '#6B7280',
            disabled: '#4B5563',
          },
        },

        // Theme-aware colors using CSS variables (legacy alias)
        'claude-dark': {
          bg: 'var(--color-surface)',
          surface: 'var(--color-surface-raised)',
          border: 'var(--color-border)',
          text: 'var(--color-text)',
          'text-secondary': 'var(--color-text-secondary)'
        }
      },

      // Box shadow alternatives using micro-borders
      boxShadow: {
        'linear-sm': '0 0 0 1px rgba(255, 255, 255, 0.05)',
        'linear': '0 0 0 1px rgba(255, 255, 255, 0.08)',
        'linear-md': '0 0 0 1px rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.2)',
        'linear-lg': '0 0 0 1px rgba(255, 255, 255, 0.08), 0 4px 12px rgba(0, 0, 0, 0.3)',
        'linear-focus': '0 0 0 2px rgba(122, 162, 212, 0.4)',
        'linear-error': '0 0 0 2px rgba(224, 108, 117, 0.4)',
      },

      // Backdrop blur for glassmorphism effects
      backdropBlur: {
        'linear': '12px',
      },

      // Animation for subtle interactions
      animation: {
        'linear-fade-in': 'linearFadeIn 0.15s ease-out',
        'linear-slide-up': 'linearSlideUp 0.2s ease-out',
      },

      keyframes: {
        linearFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        linearSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    }
  },
  plugins: [
    require('@tailwindcss/typography')
  ]
}
