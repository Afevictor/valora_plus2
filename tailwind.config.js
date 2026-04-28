/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa', // Bright Blue 400
          500: '#3b82f6', // Vibrant Blue 500
          600: '#2563eb', // Electric Blue 600
          900: '#1e3a8a', // Deep Blue 900
        }
      }
    },
  },
  plugins: [],
}
