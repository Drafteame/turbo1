/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Red Hat Display"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#fbfbfb',
          70: 'rgba(251,251,251,0.7)',
          50: 'rgba(251,251,251,0.5)',
          16: 'rgba(251,251,251,0.16)',
          12: 'rgba(251,251,251,0.12)',
        },
        bet: {
          bgStart: '#14083d',
          bgEnd: '#230c3e',
          border: '#4b20ff',
          accentStart: '#4b20ff',
          accentEnd: '#9730ff',
          surface: '#191919',
        },
      },
    },
  },
  plugins: [],
};
