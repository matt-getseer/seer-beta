/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontSize: {
      xs: '10px',
      sm: '11px',
      base: '13px',
      lg: '15px',
      xl: '17px',
      '2xl': '19px',
      '3xl': '23px',
      '4xl': '28px',
      '5xl': '35px',
      '6xl': '42px',
      '7xl': '52px',
      '8xl': '64px',
      '9xl': '78px',
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
