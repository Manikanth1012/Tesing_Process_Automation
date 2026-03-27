/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark background layers
        bg: {
          DEFAULT: '#070c18',
          2: '#0d1426',
          3: '#111b35',
        },
        // Brand / primary — cyan
        brand: {
          50: 'rgba(0,212,255,0.06)',
          100: 'rgba(0,212,255,0.12)',
          200: 'rgba(0,212,255,0.25)',
          300: '#7ee8fa',
          400: '#3dd9f5',
          500: '#00d4ff',
          600: '#00b8d9',
          700: '#008fa8',
          900: '#004d5c',
        },
        // Semantic
        success: { DEFAULT: '#3dd68c', dim: 'rgba(61,214,140,0.15)' },
        warning: { DEFAULT: '#f4a261', dim: 'rgba(244,162,97,0.15)' },
        danger:  { DEFAULT: '#ff6b6b', dim: 'rgba(255,107,107,0.12)' },
        accent:  { DEFAULT: '#b388ff', dim: 'rgba(179,136,255,0.12)' },
        // Text
        t1: '#e8f4f8',
        t2: '#8ca8c0',
        t3: '#4a6580',
        // Border
        border: 'rgba(0,212,255,0.12)',
        'border-hi': 'rgba(0,212,255,0.28)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
        display: ['"Syne"', '"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
