# Typography System

## Overview

The Olumi typography system provides a consistent, type-safe scale for all text across the application. All ad-hoc font sizes have been replaced with semantic constants defined in `src/styles/typography.ts`.

## Design Principles

1. **Consistency**: All text uses predefined sizes from the typography scale
2. **Semantic naming**: Names reflect purpose (e.g., `label`, `caption`) rather than size
3. **Type safety**: TypeScript ensures only valid typography keys are used
4. **Branded aesthetics**: League Spartan for headings, Inter for body text

## Typography Scale

### Headings (League Spartan)

```typescript
h1: 'text-4xl font-semibold font-heading leading-tight'      // 36px - Page titles
h2: 'text-2xl font-semibold font-heading leading-tight'      // 24px - Section headers
h3: 'text-xl font-semibold font-heading leading-snug'        // 20px - Subsection headers
h4: 'text-lg font-medium font-heading leading-snug'          // 18px - Card headers
```

### Body Text (Inter)

```typescript
bodyLarge: 'text-base font-body leading-relaxed'             // 16px - Emphasized content
body: 'text-sm font-body leading-relaxed'                    // 14px - Default body text
bodySmall: 'text-xs font-body leading-normal'                // 12px - Supporting text
```

### UI Elements (Inter)

```typescript
button: 'text-sm font-medium font-body leading-none'         // 14px - Buttons
label: 'text-sm font-medium font-body leading-normal'        // 14px - Form labels, headers
caption: 'text-xs font-body leading-normal'                  // 12px - Captions, metadata
```

### Special (Inter)

```typescript
code: 'text-xs font-mono leading-normal'                     // 12px - Monospace text
nodeTitle: 'text-sm font-semibold font-body leading-tight'   // 14px - Graph node titles
nodeLabel: 'text-xs font-body leading-tight'                 // 12px - Graph node labels
```

## Usage

### Basic Usage

```tsx
import { typography } from '../styles/typography'

function MyComponent() {
  return (
    <div>
      <h2 className={typography.h2}>Section Title</h2>
      <p className={typography.body}>This is body text.</p>
      <span className={typography.caption}>12:34 PM</span>
    </div>
  )
}
```

### With Additional Classes

Use the `typo()` helper from `src/lib/ui.ts` to combine typography with additional classes:

```tsx
import { typo } from '../lib/ui'

function MyComponent() {
  return (
    <div>
      <h3 className={typo('h3', 'mb-4 text-sky-600')}>
        Decision Review
      </h3>
      <button className={typo('button', 'px-4 py-2 bg-blue-600 text-white')}>
        Submit
      </button>
    </div>
  )
}
```

### Template Literals (for dynamic classes)

```tsx
<div className={`${typography.label} text-ink-900 uppercase tracking-wide`}>
  Settings
</div>
```

## Migration Guide

### Before (Ad-hoc sizes)

```tsx
// ❌ Don't use arbitrary sizes
<p className="text-[11px] text-gray-600">Old way</p>
<button className="text-xs font-medium">Click me</button>
<h2 className="text-sm font-semibold">Header</h2>
```

### After (Typography scale)

```tsx
// ✅ Use typography constants
<p className={`${typography.code} text-ink-900/80`}>New way</p>
<button className={`${typography.caption} font-medium`}>Click me</button>
<h2 className={typography.label}>Header</h2>
```

## Color Pairing

Typography should be paired with Olumi's branded color tokens:

### Text Colors

- **Primary text**: `text-ink-900`
- **Secondary text**: `text-ink-900/80`
- **Tertiary text**: `text-ink-900/70`
- **Disabled text**: `text-ink-900/60`
- **Links**: `text-sky-600`
- **Errors**: `text-carrot-600` or `text-sun-700`
- **Success**: `text-green-600`
- **Warnings**: `text-sun-800`

### Background Colors

- **Default**: `bg-paper-50` or `bg-white`
- **Subtle**: `bg-sand-50`
- **Borders**: `border-sand-200`, `border-sand-300`
- **Loading skeletons**: `bg-sand-200`
- **Errors**: `bg-carrot-50`, `bg-sun-50`

## Components Updated

The following components have been migrated to the typography system:

- ✅ [DecisionReviewPanel.tsx](../src/canvas/components/DecisionReviewPanel.tsx)
- ✅ [InputsDock.tsx](../src/canvas/components/InputsDock.tsx) (29 instances)
- ✅ [OutputsDock.tsx](../src/canvas/components/OutputsDock.tsx) (20 instances)
- ⚠️ [ResultsPanel.tsx](../src/canvas/panels/ResultsPanel.tsx) (partial - legacy component)

## Best Practices

### DO ✅

- **Use semantic names**: Choose typography based on purpose, not appearance
  - Use `typography.label` for form labels and section headers
  - Use `typography.caption` for timestamps, metadata, and small UI text
  - Use `typography.code` for monospace content (hashes, IDs, technical data)

- **Combine with brand colors**: Use Olumi color tokens (`ink-900`, `sand-200`, `sky-600`)
  - `${typography.caption} text-ink-900/70` (caption with tertiary text color)
  - `${typography.label} text-ink-900` (label with primary text color)

- **Use the helper for convenience**:
  ```tsx
  typo('button', 'px-4 py-2 bg-blue-600 text-white')
  ```

### DON'T ❌

- **Don't use arbitrary font sizes**:
  - ❌ `className="text-[11px]"`
  - ❌ `className="text-[13px]"`

- **Don't use generic gray colors**:
  - ❌ `text-gray-600` → Use `text-ink-900/80`
  - ❌ `text-gray-500` → Use `text-ink-900/70`
  - ❌ `bg-gray-100` → Use `bg-sand-100`

- **Don't mix font families manually**:
  - ❌ `className="font-heading text-sm"` (League Spartan is for headings only)
  - ✅ Use predefined heading constants: `typography.h2`, `typography.h3`, etc.

## Type Safety

The typography system is fully typed:

```typescript
// ✅ Valid
const myClass = typography.h2  // Works
const anotherClass = typo('label', 'mb-2')  // Works

// ❌ Invalid (TypeScript error)
const invalid = typography.h5  // Error: Property 'h5' does not exist
const badHelper = typo('invalidKey', 'mb-2')  // Error: Argument not assignable
```

## Font Configuration

Fonts are loaded via Google Fonts in `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=League+Spartan:wght@400;600&display=swap');
```

**Fallback stack:**
- **Headings**: `'League Spartan', system-ui, -apple-system, ..., sans-serif`
- **Body**: `'Inter', system-ui, -apple-system, ..., sans-serif`

## Testing

After making typography changes:

1. **Run TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

2. **Visual regression testing**:
   - Check all components in Storybook
   - Verify text hierarchy and readability
   - Ensure proper line heights and spacing

3. **Accessibility**:
   - Minimum 12px font size for body text
   - Sufficient color contrast (WCAG AA: 4.5:1 for normal text)
   - Proper semantic HTML with typography

## Future Enhancements

- [ ] Extend typography to graph node labels
- [ ] Add responsive font sizes for mobile viewports
- [ ] Create Storybook stories for typography showcase
- [ ] Audit remaining components (HelpMenu, DraftForm, etc.)
