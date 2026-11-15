/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './index.html',
    './explorer.html',
    './signin.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--bg-canvas) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        foreground: 'rgb(var(--fg-primary) / <alpha-value>)',
        secondary: 'rgb(var(--fg-secondary) / <alpha-value>)',
        muted: 'rgb(var(--fg-muted) / <alpha-value>)',
        border: 'rgb(var(--border-subtle) / <alpha-value>)',
        celestial: {
          canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
          deep: 'rgb(var(--bg-deep) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          primary: 'rgb(var(--fg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--fg-secondary) / <alpha-value>)',
          muted: 'rgb(var(--fg-muted) / <alpha-value>)',
          border: 'rgb(var(--border-subtle) / <alpha-value>)',
          sky: 'rgb(var(--accent-sky) / <alpha-value>)',
          lilac: 'rgb(var(--accent-lilac) / <alpha-value>)',
          'btn-fg': 'rgb(var(--accent-btn-fg) / <alpha-value>)',
          night: '#101827',
          abyss: '#090E18',
          twilight: '#334B70',
          starlight: '#EAF4FF',
          silver: '#D4DBE6',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
