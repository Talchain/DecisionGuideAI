# Olumi Design Guidelines
*Version 1.2 • Production-Ready Design System*

**Sharper thinking. Better outcomes. Stronger teams.**

---

## 🎯 Core Principles

### Design Philosophy
- **Clear** • Remove complexity, not capability
- **Pragmatic** • Every decision has a clear rationale
- **Optimistic** • Positive, forward-looking interface
- **Human** • Technology that enhances, not replaces

### Voice & Tone
- British English (always "and", never "&")
- Conversational but professional
- Encouraging without being patronising
- Data-driven but accessible

---

## 🎨 Visual Identity

### Typography
**Primary:** League Spartan  
**Weights:** 600 (Headings) • 400 (Body)  
**Fallback:** `system-ui, -apple-system, Segoe UI, Roboto, Arial`

#### Type Scale
```css
H1: 48-64px / 1.10    /* Hero statements */
H2: 32-40px / 1.15    /* Section headers */
H3: 24-28px / 1.20    /* Card titles */
H4: 20-22px / 1.40    /* Subheadings */
Body: 16px / 1.55     /* Content */
Label: 14px / 1.30    /* UI labels */
```

#### Usage Guidelines
- Max line length: 65-75 characters
- Minimum font size: 14px (accessibility)
- Use sentence case for UI labels
- Use title case sparingly (only main navigation)

---

## 🎨 Color System

### Design Ratios
**70%** Neutrals • **20%** Brand • **10%** Accents

### Base Palette

#### Neutrals
| Token | Hex | Usage |
|-------|-----|-------|
| `ink-900` | #262626 | Primary text, icons |
| `canvas-25` | #F4F0EA | App background |
| `paper-50` | #FEF9F3 | Cards, panels |
| `sand-200` | #E1D8C7 | Dividers, muted elements |

#### Brand Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `sun-500` | #F5C433 | Primary actions, highlights |
| `mint-500` | #67C89E | Success, positive states |
| `sky-500` | #63ADCF | Information, data, links |
| `carrot-500` | #EA7B4B | Warnings, destructive actions |
| `lilac-400` | #9E9AF1 | Secondary accents |

#### Supporting Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `sky-200` | #BFE3F4 | Subtle backgrounds, charts |
| `periwinkle-200` | #C9D9FF | Secondary fills |
| `banana-200` | #FFE497 | Soft highlights |
| `mint-400` | #62B28F | Alternative success |
| `sky-600` | #5C9BB8 | Stronger data accent |

### Semantic Tokens
```css
/* Core semantics */
--semantic-primary: var(--sun-500);
--semantic-success: var(--mint-500);
--semantic-info: var(--sky-500);
--semantic-warning: var(--banana-200);
--semantic-danger: var(--carrot-500);

/* Interactive states */
--primary-hover: #F7CB4D;
--primary-active: #E5B523;
--primary-disabled: rgba(245,196,51,0.40);
```

### Color Rules
✅ **DO**
- Use semantic tokens in components
- Test with color blindness simulators
- Provide non-color indicators (icons, patterns)

❌ **DON'T**
- Use pure black (#000000)
- Use raw hex values in components
- Rely on color alone for meaning

---

## 📐 Layout & Spacing

### Grid System
- **Columns:** 12
- **Max width:** 1200-1280px
- **Gutters:** 24px
- **Margins:** 16px (mobile) • 24px (tablet) • 32px (desktop)

### Spacing Scale
```css
4px  • 8px  • 12px • 16px • 20px
24px • 32px • 40px • 48px • 56px • 64px
```

### Breakpoints
| Name | Width | Usage |
|------|-------|-------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktops |
| `xl` | 1280px | Wide screens |

### Surface Hierarchy
1. **App background** → `canvas-25`
2. **Content cards** → `paper-50`
3. **Interactive elements** → Various
4. **Overlays** → `paper-50` + shadow-3

---

## 🧩 Components

### Buttons

#### Primary Button
```css
background: var(--semantic-primary);
color: white;
padding: 12px 24px;
border-radius: 999px;
font-weight: 600;
box-shadow: var(--shadow-1);
```

**States:**
- Hover: `--primary-hover` + translateY(-1px)
- Active: `--primary-active` + translateY(0)
- Disabled: `--primary-disabled` + no shadow
- Focus: 2px ring `--focus-color`

#### Secondary Button
```css
background: transparent;
border: 1px solid rgba(38,38,38,0.16);
color: var(--text-primary);
```

#### Destructive Button
```css
background: var(--semantic-danger);
color: white;
/* Same interaction states as primary */
```

### Input Fields

```css
min-height: 44px;
padding: 12px 16px;
background: var(--surface-card);
border: 1px solid rgba(38,38,38,0.16);
border-radius: 12px;
```

**States:**
- Focus: 2px ring `--focus-color`
- Error: Border + helper text `--semantic-danger`
- Disabled: Opacity 0.5
- Success: Border `--semantic-success`

### Cards

```css
background: var(--surface-card);
border-radius: 20px;
padding: 24px;
box-shadow: var(--shadow-1);
```

**Variants:**
- **Interactive:** Hover → shadow-2 + translateY(-2px)
- **Selected:** 2px border `--semantic-info`
- **Analysis:** 3px top border in semantic color

### Navigation

#### App Bar
- Height: 64px
- Background: `--surface-app`
- Logo left, actions right
- Active item: 2px underline `--semantic-info`

#### Tabs
- Height: 44px
- Selected: Pill background rgba(99,173,207,0.15)
- Transition: 200ms ease

### Badges & Pills

```css
padding: 4px 12px;
border-radius: 999px;
font-size: 14px;
font-weight: 500;
```

**Semantic Variants:**
- Success: `--semantic-success` bg, white text
- Info: `--semantic-info` bg, white text
- Warning: `--semantic-warning` bg, dark text
- Danger: `--semantic-danger` bg, white text

---

## 📊 Data Visualization

### Chart Colors (Ordered)
```css
--chart-1: var(--sky-500);     /* Primary series */
--chart-2: var(--mint-500);    /* Secondary */
--chart-3: var(--sun-500);     /* Highlight */
--chart-4: var(--lilac-400);   /* Comparison */
--chart-5: var(--sky-600);     /* Additional */
--chart-6: var(--periwinkle-200);
--chart-7: var(--mint-400);
--chart-8: var(--banana-200);
```

### Chart Guidelines
- **Uncertainty bands:** `--sky-200` at 30% opacity
- **Target lines:** Dashed, `--semantic-primary`
- **Thresholds:** Dotted, `--semantic-danger`
- **Gridlines:** `--sand-200` at 50% opacity

### Accessibility
- Never rely on color alone
- Add patterns for critical distinctions
- Include data labels on hover/tap
- Provide table view alternative

---

## ✨ Motion & Interaction

### Timing
```css
--duration-instant: 100ms;   /* Hover states */
--duration-fast: 200ms;      /* Micro-interactions */
--duration-base: 300ms;      /* Panels, modals */
--duration-slow: 400ms;      /* Page transitions */
```

### Easing
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0.0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
```

### Interaction Patterns
- **Hover:** Subtle elevation + color shift
- **Click:** Scale(0.98) for 100ms
- **Focus:** Visible ring, never remove outline
- **Loading:** Skeleton pulse or spinner
- **Success:** Brief green flash + check icon

### Respect Preferences
```css
@media (prefers-reduced-motion: reduce) {
  * { 
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 🎯 Decision-Specific UI

### Confidence Indicators
```css
/* Visual encoding */
High (70-100%):   --semantic-success, solid line
Medium (40-69%):  --semantic-info, dashed line  
Low (0-39%):      --sand-200, dotted line
```

### Decision States
| State | Border | Background | Icon |
|-------|--------|------------|------|
| Draft | 2px `--sand-200` | White | Pencil |
| Active | 2px `--sky-500` | Light blue tint | Play |
| Complete | 2px `--mint-500` | Light green tint | Check |
| Blocked | 2px `--carrot-500` | Light red tint | Alert |

### Progress Indicators
```css
/* Track */
background: rgba(38,38,38,0.10);
height: 8px;
border-radius: 4px;

/* Bar */
background: var(--semantic-primary);
transition: width 300ms ease-out;
```

---

## 🔒 Accessibility

### Requirements
- **WCAG AA** minimum contrast (4.5:1 text, 3:1 UI)
- **Touch targets:** Minimum 44×44px
- **Focus indicators:** Always visible
- **Screen reader:** Semantic HTML + ARIA labels
- **Keyboard:** Full navigation support

### Testing Checklist
- [ ] Tab through entire interface
- [ ] Test with screen reader (NVDA/JAWS)
- [ ] Check color contrast ratios
- [ ] Verify at 200% zoom
- [ ] Test with keyboard only
- [ ] Validate HTML semantics

---

## 💻 Implementation

### CSS Architecture
```css
/* 1. Design tokens */
@import 'tokens/variables.css';

/* 2. Base styles */
@import 'base/reset.css';
@import 'base/typography.css';

/* 3. Components */
@import 'components/button.css';
@import 'components/card.css';

/* 4. Utilities */
@import 'utilities/spacing.css';
```

### Component Structure
```tsx
// Button.tsx
import styles from './Button.module.css';
import { cn } from '@/utils/classnames';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
}

export const Button = ({ 
  variant = 'primary',
  size = 'md',
  ...props 
}: ButtonProps) => {
  return (
    <button 
      className={cn(
        styles.button,
        styles[variant],
        styles[size]
      )}
      {...props}
    />
  );
};
```

### Token Usage
```css
/* ✅ CORRECT */
.button {
  background: var(--semantic-primary);
  color: var(--text-primary);
}

/* ❌ WRONG */
.button {
  background: #F5C433; /* Never use raw hex */
  color: #262626;
}
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install @olumi/tokens @olumi/components
npm install -D stylelint husky lint-staged
```

### 2. Setup Tokens
```javascript
// tokens.config.js
import { tokens } from '@olumi/tokens';
export default tokens;
```

### 3. Configure Linting
```json
// .stylelintrc.json
{
  "rules": {
    "declaration-property-value-no-unknown": true,
    "color-no-hex": true,
    "custom-property-pattern": "^--[a-z]"
  }
}
```

### 4. Add Pre-commit Hooks
```json
// package.json
{
  "lint-staged": {
    "*.css": ["stylelint --fix"],
    "*.{ts,tsx}": ["eslint --fix"]
  }
}
```

### 5. Start Building
```tsx
import { Button, Card, Input } from '@olumi/components';

export default function App() {
  return (
    <Card>
      <h2>Make a Decision</h2>
      <Input placeholder="Describe your situation" />
      <Button variant="primary">
        Get Started
      </Button>
    </Card>
  );
}
```

---

## 📋 Quick Reference

### Component Sizing
| Size | Button | Input | Card Padding |
|------|--------|-------|--------------|
| sm | 8px 16px | 36px | 16px |
| md | 12px 24px | 44px | 24px |
| lg | 16px 32px | 52px | 32px |

### Shadow Scale
```css
shadow-0: none
shadow-1: 0 1px 2px rgba(38,38,38,0.06)
shadow-2: 0 4px 12px rgba(38,38,38,0.10)
shadow-3: 0 8px 24px rgba(38,38,38,0.14)
```

### Border Radius
```css
sm: 8px    /* Inputs, small buttons */
md: 12px   /* Cards, modals */
lg: 20px   /* Large cards, panels */
pill: 999px /* Pills, round buttons */
```

### Z-Index Scale
```css
base: 0
dropdown: 100
sticky: 200
modal: 300
popover: 400
toast: 500
```

---

## ✅ Checklist for Designers

Before handoff, ensure:
- [ ] All colors use design tokens
- [ ] Text meets WCAG AA contrast
- [ ] Touch targets ≥ 44px
- [ ] Focus states designed
- [ ] Loading states included
- [ ] Error states defined
- [ ] Empty states considered
- [ ] Responsive behavior documented

---

## ✅ Checklist for Developers

Before committing, ensure:
- [ ] No raw hex values in CSS
- [ ] Semantic HTML used
- [ ] ARIA labels added
- [ ] Keyboard navigation works
- [ ] Focus trap in modals
- [ ] Animations respect reduce-motion
- [ ] Components have loading states
- [ ] Error boundaries implemented

---

## 📚 Resources

### Tools
- [Figma Tokens Plugin](https://www.figma.com/community/plugin/843461159747178978)
- [Stark (Accessibility)](https://www.getstark.co/)
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Documentation
- [Component Storybook](#) 
- [Token Reference](#)
- [Figma Library](#)

### Support
- Design System Team: design-system@olumi.ai
- Slack: #design-system
- Office Hours: Thursdays 2-3pm

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2 | Dec 2024 | Production-ready system with semantic tokens |
| 1.1 | Nov 2024 | Added League Spartan, refined palette |
| 1.0 | Oct 2024 | Initial guidelines |

---

*These guidelines are living documentation. Propose changes via GitHub or discuss in #design-system on Slack.*

**Remember: Every design decision should help users make better decisions with confidence.**
