# Shared Components - Design System Library

This directory contains reusable UI components that form the guide variant's design system. All components follow consistent patterns for styling, accessibility, and behavior.

## Quick Reference

| Component | Purpose | Variants | Props |
|-----------|---------|----------|-------|
| [Badge](#badge) | Status indicators | 5 variants | `variant`, `children` |
| [Button](#button) | Interactive buttons | 4 variants, 3 sizes | `variant`, `size`, `onClick`, `disabled` |
| [Card](#card) | Container component | - | `children`, `className` |
| [ExpandableSection](#expandablesection) | Progressive disclosure | - | `title`, `defaultOpen`, `children` |
| [MetricRow](#metricrow) | Labeled metrics | - | `label`, `value` |
| [HelpModal](#helpmodal) | Keyboard shortcuts | - | `isOpen`, `onClose` |
| [GuideErrorBoundary](#guideerrorboundary) | Error handling | - | `children`, `fallback` |

## Components

### Badge

**File**: `Badge.tsx`
**Purpose**: Display status, category, or state with color-coded visual indicator

#### Variants

| Variant | Use Case | Color | Example |
|---------|----------|-------|---------|
| `success` | Positive outcomes, completion | Green | "Complete", "Ready" |
| `warning` | Cautions, attention needed | Yellow | "Incomplete", "Review" |
| `error` | Errors, critical issues | Red | "Blocked", "Invalid" |
| `info` | Informational, neutral | Blue | "Building", "Analyzing" |
| `neutral` | Default, no semantic meaning | Gray | "Draft", "Pending" |

#### Props

```typescript
interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: React.ReactNode
  className?: string
}
```

#### Usage

```tsx
import { Badge } from '../shared/Badge'

// Success badge
<Badge variant="success">Ready to run</Badge>

// Warning badge
<Badge variant="warning">Incomplete graph</Badge>

// Error badge
<Badge variant="error">Blocked</Badge>

// Info badge
<Badge variant="info">Analyzing...</Badge>

// Neutral badge
<Badge variant="neutral">Draft</Badge>
```

#### Styling

- Small, rounded pills with padding
- Bold text for emphasis
- Accessible color contrast (WCAG AA)
- Consistent with design system

---

### Button

**File**: `Button.tsx`
**Purpose**: Interactive button for user actions

#### Variants

| Variant | Use Case | Style |
|---------|----------|-------|
| `primary` | Primary actions (Run, Save) | Solid fill, high contrast |
| `secondary` | Secondary actions (Cancel) | Less emphasis |
| `outline` | Tertiary actions (Clear) | Border only, transparent |
| `ghost` | Minimal actions (Close, Help) | No border, transparent |

#### Sizes

| Size | Use Case | Height |
|------|----------|--------|
| `sm` | Compact UIs, toolbars | 32px |
| `md` | Standard buttons | 40px |
| `lg` | Primary CTAs | 48px |

#### Props

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
}
```

#### Usage

```tsx
import { Button } from '../shared/Button'

// Primary button (default size: md)
<Button variant="primary" onClick={handleRun}>
  Run Analysis
</Button>

// Secondary button
<Button variant="secondary" onClick={handleCancel}>
  Cancel
</Button>

// Outline button, small size
<Button variant="outline" size="sm" onClick={handleClear}>
  Clear
</Button>

// Ghost button for help
<Button variant="ghost" size="sm" onClick={handleHelp}>
  ?
</Button>

// Disabled button
<Button variant="primary" disabled onClick={handleRun}>
  Run Analysis
</Button>
```

#### Accessibility

- Semantic `<button>` element
- Keyboard accessible (Enter, Space)
- Disabled state prevents interaction
- Focus indicator visible

---

### Card

**File**: `Card.tsx`
**Purpose**: Container component for grouping related content

#### Props

```typescript
interface CardProps {
  children: React.ReactNode
  className?: string
}
```

#### Usage

```tsx
import { Card } from '../shared/Card'

// Basic card
<Card>
  <div className="p-4">
    Content goes here
  </div>
</Card>

// Card with custom styling
<Card className="bg-mist-50">
  <div className="p-6">
    Custom background
  </div>
</Card>
```

#### Styling

- Rounded corners (`rounded-lg`)
- Border (`border-storm-200`)
- White background (override with className)
- Subtle shadow for depth

---

### ExpandableSection

**File**: `ExpandableSection.tsx`
**Purpose**: Progressive disclosure pattern - hide content behind "expand" control

#### Props

```typescript
interface ExpandableSectionProps {
  title: string | React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}
```

#### Usage

```tsx
import { ExpandableSection } from '../shared/ExpandableSection'

// Default collapsed
<ExpandableSection title="Show more drivers">
  {hiddenDrivers.map(driver => (
    <div key={driver.node_id}>{driver.label}</div>
  ))}
</ExpandableSection>

// Default open
<ExpandableSection title="Details" defaultOpen={true}>
  <p>Always visible on load</p>
</ExpandableSection>

// Custom title element
<ExpandableSection
  title={
    <div className="flex items-center gap-2">
      <span>Advanced Settings</span>
      <Badge variant="info">3 options</Badge>
    </div>
  }
>
  {/* Content */}
</ExpandableSection>
```

#### Behavior

- Click title to expand/collapse
- Smooth rotation animation on chevron icon
- Content slides in/out

#### Accessibility

- `aria-expanded` state on button
- `aria-controls` links button to content
- `role="region"` on content area
- `aria-live="polite"` announces state changes
- `aria-hidden="true"` on decorative icon

#### Design Pattern

Use for progressive disclosure:
- Show top 3 items, hide rest behind expandable
- Max 7 items visible without expand
- Clear indication of hidden content count

---

### MetricRow

**File**: `MetricRow.tsx`
**Purpose**: Display labeled metrics in consistent format

#### Props

```typescript
interface MetricRowProps {
  label: string
  value: string | number | React.ReactNode
  className?: string
}
```

#### Usage

```tsx
import { MetricRow } from '../shared/MetricRow'

// Simple metric
<MetricRow label="Confidence" value="High (85%)" />

// Numeric metric
<MetricRow label="Node Count" value={nodes.length} />

// Custom value element
<MetricRow
  label="Status"
  value={<Badge variant="success">Complete</Badge>}
/>
```

#### Styling

- Label on left, value on right
- Gray label (`text-storm-600`)
- Bold value (`font-semibold`)
- Consistent spacing

---

### HelpModal

**File**: `HelpModal.tsx`
**Purpose**: Display keyboard shortcuts and help content

#### Props

```typescript
interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}
```

#### Usage

```tsx
import { HelpModal } from '../shared/HelpModal'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'

function MyComponent() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts()

  return (
    <>
      <Button onClick={() => setShowHelp(true)}>Help</Button>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  )
}
```

#### Features

- **Keyboard Shortcuts Reference**: Lists all shortcuts from `useKeyboardShortcuts`
- **Quick Tips**: Usage tips for guide variant
- **Focus Management**: Auto-focus close button on open
- **Focus Trap**: Tab/Shift+Tab cycles within modal
- **Backdrop**: Semi-transparent overlay with blur
- **Accessible**: Full ARIA dialog pattern

#### Accessibility

- `role="dialog"` with `aria-modal="true"`
- `aria-labelledby` links to modal title
- Focus trap prevents escape
- Esc key closes modal
- Auto-focus on close button

---

### GuideErrorBoundary

**File**: `GuideErrorBoundary.tsx`
**Purpose**: Catch rendering errors and display fallback UI

#### Props

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}
```

#### Usage

```tsx
import { GuideErrorBoundary } from '../shared/GuideErrorBoundary'

// Default fallback UI
<GuideErrorBoundary>
  <GuidePanel stage={journeyStage} />
</GuideErrorBoundary>

// Custom fallback
<GuideErrorBoundary
  fallback={
    <div className="p-6">
      <p>Custom error message</p>
    </div>
  }
>
  <RiskyComponent />
</GuideErrorBoundary>
```

#### Features

- **Default Fallback**: User-friendly error UI with recovery actions
- **Error Details**: Shows error stack in development mode only
- **Recovery Actions**: "Try again" button resets error state
- **Reload Option**: "Reload page" button for severe errors
- **Error Logging**: Logs to console in dev, ready for production error tracking (Sentry, etc.)

#### Class Component

Error boundaries must be class components (React requirement):

```typescript
export class GuideErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Guide Error Boundary caught:', error, errorInfo)
  }

  // ... render method
}
```

#### When to Use

Wrap components that:
- Fetch external data
- Render dynamic content from stores
- Have complex state logic
- Could throw errors in edge cases

---

## Design System Guidelines

### Colors

All components use the design system color palette:

**Neutrals**:
- `charcoal-900` - Primary text
- `charcoal-700` - Secondary text
- `storm-600` - Tertiary text
- `storm-200` - Borders
- `mist-50` - Backgrounds

**Semantic**:
- `analytical-500/600` - Primary actions, drivers
- `practical-600` - Success states
- `creative-600` - Info states
- `critical-600` - Error states
- `caution-600` - Warning states

### Typography

**Font Sizes**:
- `text-xs` (12px) - Small labels, captions
- `text-sm` (14px) - Body text, descriptions
- `text-base` (16px) - Default text
- `text-lg` (18px) - Subheadings
- `text-xl` (20px) - Headings
- `text-2xl` (24px) - Large headings

**Font Weights**:
- `font-normal` (400) - Body text
- `font-medium` (500) - Emphasis
- `font-semibold` (600) - Headings
- `font-bold` (700) - Strong emphasis

### Spacing

**Padding** (`p-`):
- `p-2` (8px) - Tight spacing
- `p-3` (12px) - Compact spacing
- `p-4` (16px) - Default spacing
- `p-6` (24px) - Generous spacing

**Gaps** (`gap-`):
- `gap-1` (4px) - Minimal
- `gap-2` (8px) - Tight
- `gap-3` (12px) - Default
- `gap-4` (16px) - Generous

**Vertical Spacing** (`space-y-`):
- `space-y-2` (8px) - Tight lists
- `space-y-4` (16px) - Default sections
- `space-y-6` (24px) - Generous sections

### Borders

- `border` - 1px solid border
- `border-storm-200` - Default border color
- `rounded` - 4px radius (small elements)
- `rounded-md` - 6px radius (medium elements)
- `rounded-lg` - 8px radius (large elements, cards)

### Accessibility

All components follow WCAG 2.1 Level AA guidelines:

**Keyboard Navigation**:
- All interactive elements keyboard accessible
- Logical tab order
- Visible focus indicators

**Screen Readers**:
- Semantic HTML elements
- ARIA labels where needed
- ARIA states (expanded, hidden, etc.)
- Screen reader announcements (aria-live)

**Color Contrast**:
- 4.5:1 minimum for normal text
- 3:1 minimum for large text
- 3:1 minimum for UI components

**Focus Management**:
- Focus traps in modals
- Auto-focus on key elements
- Restore focus on close

---

## Usage Patterns

### Progressive Disclosure

Show max 7 items, hide rest:

```tsx
const visibleItems = items.slice(0, 3)
const hiddenItems = items.slice(3)

return (
  <>
    {visibleItems.map(item => <ItemComponent key={item.id} {...item} />)}

    {hiddenItems.length > 0 && (
      <ExpandableSection title={`Show ${hiddenItems.length} more`}>
        {hiddenItems.map(item => <ItemComponent key={item.id} {...item} />)}
      </ExpandableSection>
    )}
  </>
)
```

### Status Badges

Use semantic variants:

```tsx
// Derive variant from status
const getBadgeVariant = (status: string) => {
  switch (status) {
    case 'complete': return 'success'
    case 'running': return 'info'
    case 'error': return 'error'
    case 'incomplete': return 'warning'
    default: return 'neutral'
  }
}

<Badge variant={getBadgeVariant(status)}>{status}</Badge>
```

### Action Buttons

Follow priority hierarchy:

```tsx
<div className="flex gap-2">
  {/* Primary action (one per screen) */}
  <Button variant="primary" onClick={handlePrimaryAction}>
    Run Analysis
  </Button>

  {/* Secondary actions */}
  <Button variant="outline" onClick={handleSecondaryAction}>
    Clear
  </Button>

  {/* Tertiary actions */}
  <Button variant="ghost" onClick={handleTertiaryAction}>
    Help
  </Button>
</div>
```

---

## Adding New Shared Components

### Checklist

- [ ] Create component file in `components/shared/`
- [ ] Add JSDoc comments with @param, @returns, @example
- [ ] Follow design system (colors, spacing, typography)
- [ ] Implement accessibility (ARIA, keyboard, focus)
- [ ] Export from `components/shared/index.ts` (barrel export)
- [ ] Add to this README with:
  - Purpose
  - Props interface
  - Usage examples
  - Variants (if applicable)
  - Accessibility notes
- [ ] Write unit tests (if complex logic)
- [ ] Test keyboard navigation
- [ ] Test with screen reader

### Template

```tsx
/**
 * Your Component
 *
 * Brief description of purpose
 *
 * @param prop1 - Description
 * @param prop2 - Description
 * @returns Rendered component
 *
 * @example
 * <YourComponent prop1="value" prop2={123} />
 */

import React from 'react'

export interface YourComponentProps {
  prop1: string
  prop2: number
  children?: React.ReactNode
  className?: string
}

export function YourComponent({
  prop1,
  prop2,
  children,
  className = '',
}: YourComponentProps): JSX.Element {
  return (
    <div className={`your-base-classes ${className}`}>
      {/* Component implementation */}
    </div>
  )
}
```

---

## File Inventory

| File | Lines | Exports | Purpose |
|------|-------|---------|---------|
| `Badge.tsx` | ~50 | Badge, BadgeProps | Status indicators |
| `Button.tsx` | ~70 | Button, ButtonProps | Interactive buttons |
| `Card.tsx` | ~20 | Card, CardProps | Container component |
| `ExpandableSection.tsx` | ~55 | ExpandableSection, ExpandableSectionProps | Progressive disclosure |
| `MetricRow.tsx` | ~30 | MetricRow, MetricRowProps | Labeled metrics |
| `HelpModal.tsx` | ~125 | HelpModal, HelpModalProps | Keyboard shortcuts modal |
| `GuideErrorBoundary.tsx` | ~90 | GuideErrorBoundary | Error boundary |

**Total**: ~440 lines across 7 components

---

## Related Documentation

- [../../GETTING_STARTED.md](../../GETTING_STARTED.md) - Getting started guide
- [../../ACCESSIBILITY.md](../../ACCESSIBILITY.md) - Accessibility guidelines
- [../../STATUS.md](../../STATUS.md) - Project status
- [../panel/states/README.md](../panel/states/README.md) - Panel states documentation

---

**Questions?** Check [GETTING_STARTED.md](../../GETTING_STARTED.md) or file an issue with label `design-system`.
