/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
      },
      borderRadius: {
        card: '12px',
        btn: '10px',
        input: '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.12)',
        'card-lg': '0 4px 6px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08)',
        'btn': '0 2px 4px rgba(0,0,0,0.1)',
        'btn-hover': '0 4px 14px rgba(0,0,0,0.18)',
      },
      fontSize: {
        h1: ['28px', { fontWeight: '700' }],
        h2: ['22px', { fontWeight: '600' }],
        h3: ['18px', { fontWeight: '600' }],
        body: ['15px', { fontWeight: '400' }],
        caption: ['13px', { fontWeight: '400' }],
        small: ['11px', { fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};
