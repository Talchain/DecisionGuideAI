/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        'bounce-ease': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      // Panel design system tokens
      colors: {
        border: {
          subtle: '#EAEFF5',
        },
        divider: '#EDF2F7',
        panel: {
          bg: '#FFFFFF',
        },
      },
      boxShadow: {
        panel: '0 6px 30px rgba(16,24,40,0.06)',
      },
      borderRadius: {
        xl2: '1rem', // rounded-2xl alias for consistency
      },
    },
  },
  plugins: [],
};