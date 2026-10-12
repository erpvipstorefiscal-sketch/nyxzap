/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nyx: {
          950: '#0B0C10',
          900: '#12141D',
          850: '#181B26',
          800: '#202434',
          700: '#2E344A',
          600: '#434A65'
        },
        surface: {
          base: '#0B0C10',
          card: '#12141D',
          hover: '#181B26',
          border: 'rgba(255, 255, 255, 0.07)',
          'border-strong': 'rgba(255, 255, 255, 0.12)'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'elevated': '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 2px 6px -1px rgba(0, 0, 0, 0.3)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'primary-glow': '0 0 20px -4px rgba(99, 102, 241, 0.35)'
      }
    },
  },
  plugins: [],
}
