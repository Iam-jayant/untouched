import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Custom Untouched design tokens
        untouched: {
          bg: {
            primary: '#090A0F',
            card: '#12141D',
            elevated: '#1A1D28',
          },
          border: {
            primary: '#1E2230',
            subtle: '#2A2E3F',
          },
          green: {
            DEFAULT: '#10B981',
            dark: '#059669',
            light: '#34D399',
          },
          blue: {
            DEFAULT: '#3B82F6',
            cyan: '#06B6D4',
            light: '#60A5FA',
          },
          amber: {
            DEFAULT: '#F59E0B',
            light: '#FCD34D',
          },
          red: {
            DEFAULT: '#EF4444',
            light: '#F87171',
          },
          gray: {
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            300: '#D1D5DB',
            400: '#9CA3AF',
            500: '#6B7280',
            600: '#4B5563',
            700: '#374151',
            800: '#1F2937',
            900: '#111827',
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-instrument)', 'sans-serif'],
        display: ['var(--font-instrument-serif)', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      fontFeatureSettings: {
        'tnum': 'tnum',
      },
    },
  },
  plugins: [],
} satisfies Config;
