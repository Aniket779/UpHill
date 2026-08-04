/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['InterVariable', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        bg: '#FAFAFA',
        surface: '#FFFFFF',
        'surface-secondary': '#F4F4F5',
        'surface-tertiary': '#ECECEE',
        border: {
          DEFAULT: '#E4E4E7',
          strong: '#D4D4D8',
        },
        ink: {
          DEFAULT: '#18181B',
          secondary: '#52525B',
          tertiary: '#A1A1AA',
          inverse: '#FAFAFA',
        },
        accent: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          active: '#3730A3',
          soft: '#EEF2FF',
          border: '#C7D2FE',
        },
        ai: {
          DEFAULT: '#7C3AED',
          hover: '#6D28D9',
          soft: '#F5F3FF',
          border: '#DDD6FE',
        },
        success: {
          DEFAULT: '#16A34A',
          soft: '#F0FDF4',
          border: '#BBF7D0',
        },
        warning: {
          DEFAULT: '#D97706',
          soft: '#FFFBEB',
          border: '#FDE68A',
        },
        danger: {
          DEFAULT: '#DC2626',
          soft: '#FEF2F2',
          border: '#FECACA',
        },
        priority: {
          high: '#E11D48',
          'high-soft': '#FFF1F2',
          medium: '#D97706',
          'medium-soft': '#FFFBEB',
          low: '#71717A',
          'low-soft': '#F4F4F5',
        },
      },
      fontSize: {
        display: ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(24, 24, 27, 0.04)',
        popover: '0 4px 24px -4px rgba(24, 24, 27, 0.10), 0 1px 2px 0 rgba(24, 24, 27, 0.04)',
        modal: '0 12px 48px -8px rgba(24, 24, 27, 0.18)',
      },
      borderRadius: {
        card: '12px',
        control: '8px',
        chip: '6px',
      },
    },
  },
  plugins: [],
}
