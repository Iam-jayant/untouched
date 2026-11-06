# Untouched Design System
## Complete Color Palette, Typography, and Component Library

---

## 🎨 Color Palette

### Base Colors (OKLCH)

```css
/* Dark Theme Base */
--background: oklch(0.06 0.008 260);        /* #090A0F - Deep space black */
--foreground: oklch(0.94 0.005 90);         /* #F5F5F5 - Pure white text */
--card: oklch(0.09 0.008 260);              /* #12141D - Elevated card surface */
--card-foreground: oklch(0.94 0.005 90);    /* White text on cards */

/* Interactive Elements */
--primary: oklch(0.94 0.005 90);            /* White - Primary actions */
--primary-foreground: oklch(0.06 0.008 260); /* Dark text on white */
--secondary: oklch(0.12 0.008 260);         /* #1A1D28 - Secondary surfaces */
--muted: oklch(0.12 0.008 260);             /* Muted backgrounds */
--muted-foreground: oklch(0.55 0.015 90);   /* #8B8F9F - Muted text */

/* Borders & Inputs */
--border: oklch(0.18 0.008 260);            /* #2A2E3F - Subtle borders */
--input: oklch(0.14 0.008 260);             /* Input backgrounds */
--ring: oklch(0.94 0.005 90);               /* Focus rings */

/* Accents */
--accent: oklch(0.14 0.01 260);             /* Accent backgrounds */
--destructive: oklch(0.577 0.245 27.325);   /* Red for errors */
```

### Semantic Colors (HEX)

#### Principal Protection (Green)
```css
--emerald-500: #10B981;     /* Primary green - safe principal */
--emerald-600: #059669;     /* Darker green - borders/hover */
--emerald-400: #34D399;     /* Lighter green - highlights */

/* Usage */
bg-emerald-500/10           /* 10% opacity background */
border-emerald-500/30       /* 30% opacity border */
text-emerald-400            /* Text color */
```

#### Yield Battery (Cyan/Blue)
```css
--cyan-500: #06B6D4;        /* Electric cyan */
--blue-500: #3B82F6;        /* Primary blue */
--blue-400: #60A5FA;        /* Light blue */

/* Gradient */
bg-gradient-to-r from-cyan-500 to-blue-500
```

#### Step-Up Alert (Amber)
```css
--amber-500: #F59E0B;       /* Warning amber */
--amber-400: #FCD34D;       /* Light amber */
--amber-600: #D97706;       /* Dark amber */
```

#### Blocked/Error (Red)
```css
--red-500: #EF4444;         /* Error red */
--red-400: #F87171;         /* Light red */
--red-600: #DC2626;         /* Dark red */
```

#### Accent Gradient Colors
```css
--pink: #eca8d6;            /* Soft pink - accent color */
--purple: #a78bfa;          /* Purple - gradient */
--cyan: #67e8f9;            /* Bright cyan - gradient */
--yellow: #fbbf24;          /* Gold yellow - gradient */

/* Word Gradient Animation */
linear-gradient(45deg, #eca8d6, #a78bfa, #67e8f9, #fbbf24, #eca8d6)
```

### White Opacity Scale

```css
white/5     /* 5% - Subtle card backgrounds */
white/10    /* 10% - Borders, dividers */
white/20    /* 20% - Hover states */
white/30    /* 30% - Active borders */
white/40    /* 40% - Secondary text */
white/50    /* 50% - Muted text */
white/60    /* 60% - Labels */
white/80    /* 80% - Body text */
white       /* 100% - Primary text */
```

### Background Layers

```css
/* Layer 0: Base */
bg-black                    /* #000000 - Pure black */
bg-[#090A0F]                /* Deep space background */

/* Layer 1: Elevated Cards */
bg-[#12141D]                /* Card surface */
bg-[oklch(0.09_0.01_260)]   /* How-it-works section */

/* Layer 2: Interactive */
bg-white/5                  /* Hover backgrounds */
bg-white/10                 /* Input backgrounds */

/* Layer 3: Accents */
bg-gradient-to-br from-emerald-500/10 to-transparent
```

---

## 🔤 Typography

### Font Families

```css
/* Sans Serif - Body & UI */
--font-instrument: 'Instrument Sans', system-ui, sans-serif;
font-sans

/* Serif - Display & Large Numbers */
--font-instrument-serif: 'Instrument Serif', Georgia, serif;
font-display

/* Monospace - Code & Data */
--font-jetbrains-mono: 'JetBrains Mono', monospace;
font-mono
```

### Font Scales

#### Display Text (Instrument Serif)
```css
text-[128px]        /* Hero headings, large stats (Desktop) */
text-7xl            /* 72px - Section headings */
text-6xl            /* 60px - Large headings */
text-5xl            /* 48px - Card headings */
text-4xl            /* 36px - Sub-headings */
```

#### Body Text (Instrument Sans)
```css
text-xl             /* 20px - Large body */
text-lg             /* 18px - Body text */
text-base           /* 16px - Default body */
text-sm             /* 14px - Small text */
text-xs             /* 12px - Captions, labels */
text-[10px]         /* Micro text */
```

#### Code/Data (JetBrains Mono)
```css
font-mono tabular-nums      /* For numbers that update */
text-sm font-mono           /* API keys, hashes */
text-xs font-mono           /* Timestamps, small data */
```

### Font Weights

```css
font-normal         /* 400 - Body text */
font-medium         /* 500 - UI elements */
font-semibold       /* 600 - Emphasis */
font-bold           /* 700 - Headings */
```

### Leading & Tracking

```css
/* Display text */
leading-[0.85]      /* Tight for large display */
leading-[0.9]       /* Display headings */
leading-[0.92]      /* Hero text */
tracking-tight      /* Display tracking */

/* Body text */
leading-relaxed     /* 1.625 - Comfortable reading */
tracking-wider      /* Uppercase labels */
```

---

## 🎯 Component Patterns

### Cards

#### Base Card
```tsx
<div className="relative bg-black border border-white/10 rounded-lg p-8 overflow-hidden">
  {children}
</div>
```

#### Card with Gradient Accent
```tsx
<div className="relative bg-black border border-emerald-500/30 rounded-lg p-6 overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
  <div className="relative z-10">
    {children}
  </div>
</div>
```

### Buttons

#### Primary Button
```tsx
className="px-4 py-3 bg-white text-black hover:bg-white/90 rounded font-medium transition-colors"
```

#### Secondary Button
```tsx
className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded transition-colors"
```

#### Accent Button (Emerald)
```tsx
className="px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 font-medium transition-colors"
```

#### Icon Button
```tsx
className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors"
```

### Stats Display

```tsx
<div>
  <span className="text-xs text-white/40 font-mono uppercase tracking-wider">
    LABEL
  </span>
  <div className="text-5xl font-display mt-2">
    $50.00
  </div>
  <span className="text-sm text-white/50">
    Description text
  </span>
</div>
```

### Status Pills

```tsx
<div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs font-mono">
  Label: <span className="text-emerald-400">Value</span>
</div>
```

### Battery Indicator

```tsx
<div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
  <div 
    className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full transition-all duration-500"
    style={{ width: `${percent}%` }}
  />
</div>
```

---

## 🎭 Animation

### Transitions

```css
/* Quick */
transition-colors duration-200

/* Standard */
transition-all duration-300
transition-colors duration-300

/* Smooth */
transition-all duration-500
transition-transform duration-500

/* Elegant */
transition-all duration-700
```

### Hover Effects

```css
hover:bg-white/90               /* Button hover */
hover:border-white/30           /* Card hover */
hover:translate-x-2             /* Slide right */
hover:translate-y-[-4px]        /* Lift up */
```

### Loading States

```css
animate-pulse                   /* Pulsing indicator */
animate-spin                    /* Spinner */
```

### Custom Animations

```css
/* Progress bar */
@keyframes progress {
  from { width: 0%; }
  to { width: 100%; }
}

/* Gradient shift */
@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

---

## 📐 Spacing Scale

```css
/* Padding */
p-2     /* 8px */
p-3     /* 12px */
p-4     /* 16px */
p-6     /* 24px */
p-8     /* 32px */
p-12    /* 48px */

/* Gaps */
gap-2   /* 8px */
gap-3   /* 12px */
gap-4   /* 16px */
gap-6   /* 24px */
gap-8   /* 32px */

/* Section Padding */
py-12   /* 48px vertical */
py-24   /* 96px vertical */
py-32   /* 128px vertical */
```

---

## 🎨 Usage Examples

### Principal Card (Mobile)
```tsx
<div className="relative bg-black border border-emerald-500/30 rounded-lg p-6 overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
  <div className="relative z-10">
    <span className="text-emerald-400 text-sm font-mono uppercase tracking-wider">
      SAFE PRINCIPAL
    </span>
    <div className="text-5xl font-display text-white mt-2 mb-2">
      $50.00
    </div>
    <div className="text-sm text-emerald-400/70">
      Never touched • Earning 5.0% APY
    </div>
  </div>
</div>
```

### Navigation Bar
```tsx
<nav className="relative z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
  <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
    <div className="flex items-center justify-between h-20">
      <span className="text-2xl font-display">UNTOUCHED</span>
      {/* ... */}
    </div>
  </div>
</nav>
```

---

## 🔍 Color Usage Guide

### When to Use Each Color

| Color | Use Case | Examples |
|-------|----------|----------|
| **Emerald** | Protected, safe, locked assets | Principal vault, savings, protected funds |
| **Cyan** | Active, flowing, rechargeable | Yield battery, API credit, energy |
| **Amber** | Warning, needs attention | Step-up approval, pending actions |
| **Red** | Error, blocked, denied | Failed transactions, blocked prompts |
| **Pink (#eca8d6)** | Accent, interactive highlights | Progress bars, active states, check marks |
| **White/10** | Subtle boundaries | Card borders, dividers |
| **White/40-50** | Secondary information | Labels, descriptions, metadata |

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
sm:   /* 640px */
md:   /* 768px */
lg:   /* 1024px */
xl:   /* 1280px */
2xl:  /* 1536px */

/* Max width container */
max-w-[1400px] mx-auto px-6 lg:px-12
```

---

## ✅ Accessibility

### Contrast Ratios
- White text on black: **21:1** (WCAG AAA)
- White/60 on black: **7.5:1** (WCAG AA Large)
- Emerald-400 on black: **6.2:1** (WCAG AA)
- Cyan-400 on black: **5.8:1** (WCAG AA)

### Focus States
```css
focus:outline-none focus:ring-2 focus:ring-white/50
```

---

## 🎯 Quick Reference

### Common Class Combinations

```tsx
// Section Container
"max-w-[1400px] mx-auto px-6 lg:px-12 py-24"

// Card
"bg-black border border-white/10 rounded-lg p-8"

// Display Number
"text-5xl font-display tabular-nums"

// Label
"text-xs text-white/40 font-mono uppercase tracking-wider"

// Button
"px-4 py-3 bg-white text-black rounded font-medium hover:bg-white/90 transition-colors"

// Gradient Overlay
"absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none"
```
