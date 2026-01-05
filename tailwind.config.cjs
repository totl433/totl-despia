module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1C8376',
          dark: '#156b60',
          50: '#e6f3f0',
          100: '#d7e6e3',
          500: '#1C8376',
          600: '#156b60',
          700: '#116f59',
        },
      },
      fontFamily: {
        sans: ['Gramatika', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}