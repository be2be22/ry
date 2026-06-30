/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        bg: {
          900: '#0a0b14',
          800: '#10121e',
          700: '#171a28',
          600: '#1f2231',
        },
        accent: {
          violet: '#8b5cf6',
          cyan: '#06b6d4',
        },
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
        'gradient-accent-soft':
          'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(6,182,212,0.15) 100%)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.7)' },
          '50%': { boxShadow: '0 0 0 6px rgba(16, 185, 129, 0)' },
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
