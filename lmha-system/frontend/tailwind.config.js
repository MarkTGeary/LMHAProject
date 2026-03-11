/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'tablet': '1.125rem',
      },
      minHeight: {
        'touch': '48px',
      },
    },
  },
  plugins: [],
}
