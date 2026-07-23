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
        // Canvas — white page
        canvas: {
          DEFAULT: '#ffffff', // page background
          deep: '#f6f8fb', // deepest layer behind everything
        },
        // Surface = elevated cards / panels
        surface: {
          DEFAULT: '#ffffff', // primary card
          raised: '#f8fafc', // hover / second-tier card / chips
          sunken: '#f1f5f9', // input fields, inset areas
          inverse: '#0f172a', // dark-filled emphasis (primary buttons)
        },
        // Borders / dividers
        border: {
          subtle: '#eef1f5',
          DEFAULT: '#e2e8f0',
          strong: '#cbd5e1',
        },
        // Text
        ink: {
          DEFAULT: '#0f172a', // primary on light
          muted: '#475569', // secondary on light
          faint: '#94a3b8', // tertiary / labels
          inverse: '#ffffff', // primary on dark emphasis surfaces
          'inverse-muted': '#cbd5e1',
        },
        // Accents (used very sparingly)
        accent: {
          green: '#16a34a', // online / success
          amber: '#d97706', // warning
          red: '#dc2626', // error
          blue: '#2563eb', // info / link (used minimally)
        },
        // Chart palette
        chart: {
          1: '#0f172a',
          2: '#475569',
          3: '#94a3b8',
          4: '#16a34a',
          5: '#2563eb',
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
        // Soft, low-contrast shadows tuned for a light canvas
        card: '0 0 0 1px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.06)',
        'card-hover':
          '0 0 0 1px rgba(15,23,42,0.06), 0 8px 24px -8px rgba(15,23,42,0.18)',
        'inset-subtle': 'inset 0 1px 0 rgba(255,255,255,0.7)',
      },
      spacing: {
        // Card paddings mirror the theme's generous breathing room
        card: '24px',
        'card-lg': '32px',
      },
      backgroundImage: {
        // Subtle dotted texture used in theme (chart background)
        'dot-grid':
          'radial-gradient(circle, rgba(15,23,42,0.06) 1px, transparent 1px)',
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
