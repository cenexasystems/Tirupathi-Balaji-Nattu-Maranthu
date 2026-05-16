/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain:    '#F7F6F2',
        cardBg:    '#FFF8E7',
        sage:      '#B2C7A5',
        sageDark:  '#7DAA8F',
        sageDeep:  '#5e8c72',
        sand:      '#EAD7B7',
        olive:     '#C7D3A4',
        textMain:  '#2C392A',
        textMuted: '#5F6D59',
        forestDark:'#2C392A',
        forestMid: '#3d5238',
      },
      fontFamily: {
        sans:      ['Inter', 'sans-serif'],
        headline:  ['Playfair Display', 'serif'],
      },
      boxShadow: {
        soft:   '0 4px 16px rgba(0,0,0,0.06)',
        hover:  '0 12px 32px rgba(0,0,0,0.10)',
        green:  '0 8px 20px rgba(125,170,143,0.35)',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'floatDelay': 'float 4s ease-in-out 1.5s infinite',
        'slideUp': 'slideUp 0.6s ease forwards',
        'fadeIn': 'fadeIn 0.5s ease forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
