/**
 * Mentra Tailwind preset
 *
 * Design tokens extracted from theme.webp:
 *   - Pure-black canvas with raised dark cards
 *   - Inverse white cards for emphasis
 *   - Large rounded corners (20px)
 *   - Light typography, heavy display numbers
 *   - Minimal accent (white + a small "online" green)
 *
 * Consumed by:
 *   - apps/web/tailwind.config.js
 *   - packages/ui/tailwind.config.js (storybook-style isolated builds, later)
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Canvas
        canvas: {
          DEFAULT: '#0a0a0a', // page background
          deep: '#050505', // deepest layer behind everything
        },
        // Surface = elevated cards / panels
        surface: {
          DEFAULT: '#141414', // primary card
          raised: '#1a1a1a', // hover / second-tier card
          sunken: '#0f0f0f', // input fields, inset areas
          inverse: '#ffffff', // white-filled emphasis cards
        },
        // Borders / dividers
        border: {
          subtle: '#1f1f1f',
          DEFAULT: '#262626',
          strong: '#333333',
        },
        // Text
        ink: {
          DEFAULT: '#f5f5f5', // primary on dark
          muted: '#a3a3a3', // secondary on dark
          faint: '#6b6b6b', // tertiary / labels
          inverse: '#0a0a0a', // primary on white cards
          'inverse-muted': '#525252',
        },
        // Accents (used very sparingly)
        accent: {
          green: '#22c55e', // online / success
          amber: '#f59e0b', // warning
          red: '#ef4444', // error
          blue: '#3b82f6', // info / link (used minimally)
        },
        // Chart palette
        chart: {
          1: '#ffffff',
          2: '#a3a3a3',
          3: '#525252',
          4: '#22c55e',
          5: '#3b82f6',
        },
      },
      maxWidth: {
        '8xl': '88rem', // 1408px — wide app content width
        '9xl': '96rem', // 1536px
      },
      borderRadius: {
        // Cards in theme.webp have a very generous radius
        xs: '6px',
        sm: '10px',
        DEFAULT: '14px',
        md: '16px',
        lg: '20px',
        xl: '24px',
        '2xl': '28px',
        '3xl': '32px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Match the heavy display numbers in theme.webp
        'display-xl': ['56px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg': ['44px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-md': ['32px', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-sm': ['24px', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
      letterSpacing: {
        tightish: '-0.01em',
        tighter2: '-0.025em',
      },
      boxShadow: {
        // Subtle inner glow on raised cards
        card: '0 0 0 1px rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.6)',
        'card-hover':
          '0 0 0 1px rgba(255,255,255,0.08), 0 8px 24px -8px rgba(0,0,0,0.8)',
        'inset-subtle': 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      spacing: {
        // Card paddings mirror the theme's generous breathing room
        card: '24px',
        'card-lg': '32px',
      },
      backgroundImage: {
        // Subtle dotted texture used in theme (chart background)
        'dot-grid':
          'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '16px 16px',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
