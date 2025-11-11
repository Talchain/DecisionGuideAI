# Legacy Token Migration Guide

## Overview
This document provides guidance for migrating from legacy `--olumi-*` CSS variables to Olumi Design System v1.2 tokens.

---

## Token Mapping

### Primary/Interactive Colors

| Legacy Token | Olumi v1.2 Token | Hex Value | Notes |
|--------------|------------------|-----------|-------|
| `--olumi-primary` | `--semantic-info` | `#63ADCF` (sky-500) | Used for selections, primary actions |
| `--olumi-primary-600` | `--info-hover` | `#73B5D9` | Hover state |
| `--olumi-primary-700` | `--info-active` | `#5C9BB8` (sky-600) | Active state |

### Status Colors

| Legacy Token | Olumi v1.2 Token | Hex Value | Notes |
|--------------|------------------|-----------|-------|
| `--olumi-success` | `--semantic-success` | `#67C89E` (mint-500) | High confidence, success states |
| `--olumi-warning` | `--semantic-warning` | `#F5C433` (sun-500) | Medium confidence, warnings |
| `--olumi-danger` | `--semantic-danger` | `#EA7B4B` (carrot-500) | Low confidence, errors |

---

## Migration Patterns

### Pattern 1: Inline Styles with Fallbacks

**Before:**
```tsx
style={{ color: 'var(--olumi-primary, #5B6CFF)' }}
```

**After:**
```tsx
style={{ color: 'var(--semantic-info)' }}
```

### Pattern 2: Hover/Active States

**Before:**
```tsx
onMouseEnter={(e) => e.currentTarget.style.color = 'var(--olumi-primary-700)'}
onMouseLeave={(e) => e.currentTarget.style.color = 'var(--olumi-primary)'}
```

**After:**
```tsx
onMouseEnter={(e) => e.currentTarget.style.color = 'var(--info-active)'}
onMouseLeave={(e) => e.currentTarget.style.color = 'var(--semantic-info)'}
```

### Pattern 3: Conditional Styles

**Before:**
```tsx
style={{
  borderColor: validation.valid
    ? 'var(--olumi-success, #4CAF50)'
    : 'var(--olumi-warning, #F7C948)'
}}
```

**After:**
```tsx
style={{
  borderColor: validation.valid
    ? 'var(--semantic-success)'
    : 'var(--semantic-warning)'
}}
```

### Pattern 4: Background Colors with Alpha

**Before:**
```tsx
backgroundColor: 'rgba(91, 108, 255, 0.1)' // --olumi-primary with alpha
```

**After (Option A - Use Tailwind):**
```tsx
className="bg-info/10"
```

**After (Option B - Inline CSS):**
```tsx
style={{ backgroundColor: 'rgba(99, 173, 207, 0.1)' }} // sky-500 with alpha
```

---

## Files Requiring Migration

### High Priority (Core UI)
- ✅ `src/canvas/theme/edges.ts` - **MIGRATED (PR4)**
- ✅ `src/canvas/theme/nodes.ts` - **MIGRATED (PR4)**
- ✅ `src/canvas/ui/NodeInspector.tsx` - **MIGRATED (PR5)** - 5 instances
- ✅ `src/canvas/ui/EdgeInspector.tsx` - **MIGRATED (PR5)** - 11 instances
- ✅ `src/canvas/highlight/HighlightLayer.tsx` - **MIGRATED (PR5)** - 2 instances
- ✅ `src/canvas/components/ActionsRow.tsx` - **MIGRATED (PR5)** - 1 instance

### Medium Priority (Panel Components)
- ✅ `src/canvas/panels/ResultsPanel.tsx` - **MIGRATED (PR5)** - 6 instances
- ✅ `src/canvas/panels/TemplatesPanel.tsx` - **MIGRATED (PR5)** - 8 instances
- ✅ `src/canvas/panels/TemplateCard.tsx` - **MIGRATED (PR5)** - 7 instances
- ✅ `src/canvas/panels/TemplateAbout.tsx` - **MIGRATED (PR5)** - 4 instances
- ✅ `src/canvas/panels/TemplatesPanel.module.css` - **MIGRATED (PR5)** - 17 instances

### Low Priority (Utility Components)
- ✅ `src/canvas/components/RunHistory.tsx` - **MIGRATED (PR5)** - 11 instances
- ✅ `src/canvas/components/RangeChips.tsx` - **MIGRATED (PR5)** - 3 instances
- ✅ `src/canvas/components/KPIHeadline.tsx` - **MIGRATED (PR5)** - 1 instance
- ✅ `src/canvas/components/DriverChips.tsx` - **MIGRATED (PR5)** - 9 instances
- ✅ `src/canvas/components/ConfirmDialog.tsx` - **MIGRATED (PR5)** - 4 instances
- ✅ `src/canvas/components/ConfidenceBadge.tsx` - **MIGRATED (PR5)** - 3 instances
- ✅ `src/canvas/components/Tooltip.tsx` - **MIGRATED (PR5)** - 3 instances
- ✅ `src/canvas/components/ReconnectBanner.tsx` - **MIGRATED (PR5)** - 1 instance
- ✅ `src/canvas/components/FirstRunHint.tsx` - **MIGRATED (PR5)** - 5 instances

**PR5 Migration Summary:**
- **Total files migrated**: 19 files
- **Total token instances replaced**: 99 instances
- **Automated migration**: Used `scripts/migrate-olumi-tokens.mjs`
- **Legacy token occurrences**: 0 (100% complete)

---

## Deprecation Timeline

### Phase 1: Immediate (PR4)
- ✅ Create Olumi v1.2 token system
- ✅ Update Tailwind configuration
- ✅ Migrate core canvas components (toolbar, panels, validation)
- ✅ Update theme files (edges.ts, nodes.ts)
- ✅ Document migration guide

### Phase 2: Token Migration (PR5) ✅ COMPLETE
- ✅ Migrate all UI inspector components (NodeInspector, EdgeInspector)
- ✅ Migrate panel components (TemplatesPanel, ResultsPanel, etc.)
- ✅ Migrate utility components (Tooltip, FirstRunHint, etc.)
- ✅ Remove legacy `--olumi-*` variables from index.css
- ✅ Remove legacy panel tokens from tailwind.config.js
- ✅ Add ESLint rule `brand-tokens/no-raw-colors`
- ✅ Add CI grep check for legacy tokens
- ✅ Create automated migration script

### Phase 3: Cleanup (Future)
- Migrate remaining hard-coded colors in poc/, plc/, lib/, and routes/ directories
- Add visual regression tests for color consistency
- Update design system documentation with color usage examples

---

## Guardrails

To prevent backsliding and ensure consistent use of Olumi v1.2 tokens, we've implemented the following guardrails:

### ESLint Rule: `brand-tokens/no-raw-colors`

**Location**: `eslint-rules/no-raw-colors.js`

**What it catches**:
- Hard-coded hex colors (`#AABBCC`, `#ABC`)
- RGB/RGBA colors (`rgb(...)`, `rgba(...)`)
- HSL/HSLA colors (`hsl(...)`, `hsla(...)`)
- Legacy Olumi tokens (`var(--olumi-*)`)

**How to run**:
```bash
npm run lint
```

**Example violation**:
```tsx
// ❌ Hard-coded hex color
style={{ color: '#63ADCF' }}

// ✅ Use Olumi token
style={{ color: 'var(--semantic-info)' }}
```

### CI Grep Check

**Location**: `.github/workflows/ci.yml`

**What it checks**:
- No legacy `var(--olumi-*)` tokens in src/ (excluding poc/, plc/)
- Runs on every PR to main branch
- Fails build if violations found

**How to test locally**:
```bash
grep -r -n 'var(--olumi-' src/ \
  --include="*.tsx" --include="*.ts" --include="*.css" \
  --exclude-dir=poc --exclude-dir=plc
```

Expected output: (no results)

### Automated Migration Script

**Location**: `scripts/migrate-olumi-tokens.mjs`

**Purpose**: Bulk migration of legacy tokens to Olumi v1.2

**Usage**:
```bash
node scripts/migrate-olumi-tokens.mjs
```

**What it does**:
- Scans all `.tsx`, `.ts`, and `.css` files in src/
- Replaces legacy token patterns with Olumi v1.2 equivalents
- Reports changes made per file

**Example output**:
```
✅ src/canvas/ui/NodeInspector.tsx: 5 tokens migrated
✅ src/canvas/ui/EdgeInspector.tsx: 11 tokens migrated
...
✨ Migration complete!
📊 Files modified: 19
🔄 Total tokens migrated: 99
```

---

## How to Add a New Color

Before adding a new color, always check if an existing Olumi v1.2 token can be used. The design system provides a comprehensive palette.

### Step 1: Verify Need

Ask yourself:
1. Can I use an existing semantic token? (`--semantic-info`, `--semantic-success`, etc.)
2. Can I use a brand color token? (`--sky-500`, `--mint-500`, etc.)
3. Can I use a neutral token? (`--ink-900`, `--sand-200`, etc.)
4. Is this for a visualization or special case?

**90% of the time**, an existing token will work.

### Step 2: Add to brand.css

If you truly need a new color, add it to `src/styles/brand.css`:

```css
:root {
  /* Brand Colors */
  --new-color-500: #ABCDEF; /* Base shade */
  --new-color-400: #lighter; /* Lighter variant */
  --new-color-600: #darker;  /* Darker variant */
}
```

**Naming convention**:
- Use descriptive names (`--rose`, `--amber`, not `--color1`)
- Include shade numbers (50-900 scale)
- Follow Tailwind color naming patterns

### Step 3: Add to Tailwind Config

Update `tailwind.config.js` to expose the color:

```javascript
colors: {
  newcolor: {
    400: 'var(--new-color-400)',
    500: 'var(--new-color-500)',
    600: 'var(--new-color-600)',
  },
}
```

### Step 4: Document Usage

Add to this file's "Token Mapping" section:

```markdown
| New Color | Token | Hex | Use Case |
|-----------|-------|-----|----------|
| `--new-color-500` | `--new-color-500` | `#ABCDEF` | Specific use case description |
```

### Step 5: Get Approval

Before merging:
1. **Design review** - Confirm color fits brand guidelines
2. **Accessibility check** - Verify WCAG AA contrast ratios
3. **PR review** - Document why existing tokens weren't sufficient

### Example: Adding a Chart Color

```typescript
// ❌ Don't do this
<Bar fill="#8B5CF6" />

// ✅ Do this: Add to brand.css first
:root {
  --chart-purple-500: #8B5CF6;
}

// Then use in component
<Bar fill="var(--chart-purple-500)" />
```

---

## Why Migrate?

### 1. Brand Consistency
The old `--olumi-*` tokens used colors that don't match the Olumi Design Guidelines v1.2:
- Old primary: `#5B6CFF` (purple-blue, not in palette)
- Old success: `#20C997` (teal, not in palette)
- Old danger: `#FF6B6B` (bright red, not in palette)

New Olumi v1.2 uses official brand colors:
- New info: `#63ADCF` (sky-500, official brand blue)
- New success: `#67C89E` (mint-500, official brand green)
- New danger: `#EA7B4B` (carrot-500, official brand orange)

### 2. Semantic Clarity
- `--olumi-primary` → ambiguous meaning
- `--semantic-info` → clear purpose (informational, data-related actions)

### 3. Design System Alignment
Olumi v1.2 provides:
- Full 50-900 color scales for each semantic color
- Interactive state tokens (hover, active, disabled)
- WCAG AA compliant contrast ratios
- Consistent spacing, shadows, and timing values

---

## Testing Checklist

After migrating a component:
- [ ] Visual regression test - colors match Olumi brand
- [ ] Hover states work correctly
- [ ] Active/focus states have proper visual feedback
- [ ] Contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] No console warnings about missing CSS variables
- [ ] TypeScript compilation passes
- [ ] E2E tests pass

---

## Code Review Checklist

When reviewing PRs with token migrations:
- [ ] No new `--olumi-*` variables introduced
- [ ] All inline styles use `var(--semantic-*)` or `var(--{color}-{shade})`
- [ ] Tailwind classes used where possible (better than inline styles)
- [ ] Hover/active states use proper Olumi v1.2 state tokens
- [ ] Comments explain non-obvious color choices
- [ ] Migration pattern matches this guide

---

## Escape Hatches

### When to Keep Inline Styles
Use inline styles with CSS variables when:
1. **Dynamic colors** based on runtime data (e.g., user preferences)
2. **Third-party library integration** that requires inline styles
3. **Performance-critical animations** that benefit from direct DOM manipulation

**Always prefer Tailwind classes** for static colors.

### When to Use Custom Colors
Only use non-Olumi colors for:
1. **Visualizations** (charts, graphs) where brand colors are insufficient
2. **Accessibility overlays** (e.g., high contrast mode, focus indicators)
3. **Third-party content** (e.g., embedded iframes, external widgets)

**Document all exceptions** with comments explaining why Olumi tokens can't be used.

---

## Resources

- [Olumi Design Guidelines v1.2](./Design/Olumi_Design_Guidelines_v1.2.md)
- [PR4 Brand Tokenization](./PR4_BRAND_TOKENIZATION.md)
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Tailwind CSS Variables](https://tailwindcss.com/docs/customizing-colors#using-css-variables)

---

## Questions?

- **Why is info (sky-500) used instead of primary (sun-500)?**
  - `primary` (sun-500, #F5C433) is yellow/gold, used for highlights and warnings
  - `info` (sky-500, #63ADCF) is blue, better suited for selections and interactive elements
  - Old `--olumi-primary` was blue (#5B6CFF), so `info` is the closest semantic match

- **Can I still use the old tokens during migration?**
  - Yes, but they should be treated as deprecated
  - Add `// TODO: migrate to Olumi v1.2 tokens` comments
  - Plan migration in next sprint

- **What if I need a color not in the Olumi palette?**
  - First, check if an existing semantic token fits the use case
  - If truly needed, document in `brand.css` with clear rationale
  - Get design team approval before adding new colors

---

**Last Updated**: PR5 - Brand Token Migration + Guardrails
**Status**: Phase 2 Complete (100% Legacy Token Migration)
