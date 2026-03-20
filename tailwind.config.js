/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.html', './public/**/*.js'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        charcoal: 'var(--color-charcoal)',
        lavender: 'var(--color-lavender)',
        blush: 'var(--color-blush)',
        magenta: 'var(--color-magenta)',
        'wedding-bg': 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        subtle: 'var(--color-bg-subtle)',
        'pre-bg': 'var(--color-pre-bg)',
        'pre-text': 'var(--color-pre-text)',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
