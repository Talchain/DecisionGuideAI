# DecisionGuideAI - Claude Code Memory

This file contains project context and design system documentation for Claude Code.

## Project Overview

DecisionGuideAI is a decision modeling tool with an interactive canvas interface for building and analyzing decision graphs. The application uses React, TypeScript, Vite, and Tailwind CSS.

## Design System: Olumi (Two-Shade System v2.0)

### Philosophy

- **Brand-first**: Use brand palette colors, only stray when 100% necessary
- **Two shades per color**: Main (text/icons) + Light (backgrounds)
- **Borders via opacity**: Use main color at 30% opacity for borders
- **Single font**: Inter throughout the entire application

### Typography

**Font Family**: Inter (Google Fonts, weights 300-700)

**Text Colors**:
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-header` | #262626 | Headlines, emphasis |
| `--text-body` | #3F3F3E | Body text, paragraphs |
| `--text-light` | #908D8D | Muted text, captions |
| `--text-on-color` | #FFFFFF | Text on colored backgrounds |

**Tailwind Usage**:
```tsx
className="text-text-header"  // Headlines
className="text-text-body"    // Body text
className="text-text-light"   // Muted/caption
```

### Surfaces & Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-canvas` | #F4F0EA | App/canvas background |
| `--bg-panel` | #FEFEFE | Panel/card/node backgrounds |
| `--bg-panel-hover` | #FEF9F3 | Hover state backgrounds |
| `--border-default` | #EEE6D8 | Default borders, dividers |

**Tailwind Usage**:
```tsx
className="bg-canvas"         // App background
className="bg-panel"          // Panel/node background
className="bg-panel-hover"    // Hover state background
className="border-panel-border" // Default border
```

### Semantic Colors (Two-Shade System)

Each semantic color has exactly TWO shades:
- **DEFAULT**: Main color for text, icons, strong accents
- **light**: Light shade for backgrounds

| Color | Main | Light | Usage |
|-------|------|-------|-------|
| **Danger** | #EA7B4B | #FFB393 | Errors, risks, critical |
| **Success** | #67C89E | #B8E2D0 | Positive outcomes, confirmations |
| **Info** | #63ADCF | #BAD7E4 | Informational, decisions, navigation |
| **Warning** | #FFA656 | #FCC798 | Cautions, alerts (separate from danger) |

**Tailwind Usage**:
```tsx
// Text on white background
className="text-danger"       // Main color
className="text-success"
className="text-info"
className="text-warning"

// Light backgrounds
className="bg-danger-light"   // Light shade
className="bg-success-light"
className="bg-info-light"
className="bg-warning-light"

// Borders (use opacity or border-[color]/30)
className="border-danger/30"  // 30% opacity
```

**Component Pattern**:
```tsx
// Alert/badge pattern
<div className="bg-danger-light text-danger border border-danger/30 rounded-md px-3 py-2">
  Error message
</div>

// Success message
<div className="bg-success-light text-success border border-success/30 rounded-md px-3 py-2">
  Success!
</div>
```

### Node-Specific Colors

| Node Type | Main | Light | Usage |
|-----------|------|-------|-------|
| **Goal** | #F5C433 | #F4DB92 | Goals, primary actions |
| **Option** | #AAA7E4 | #DDDCF5 | Options, choices |
| **Factor** | #B0A899 | #EEE6D8 | Factors, influences |
| **Decision** | (uses Info) | | Decision nodes |
| **Outcome** | (uses Success) | | Outcome nodes |
| **Risk** | (uses Danger) | | Risk nodes |

**Tailwind Usage**:
```tsx
className="bg-goal-light text-goal"
className="bg-option-light text-option"
className="bg-factor-light text-factor"
```

### Interactive States

All interactive states are derived from main colors:

| State | Token Pattern |
|-------|---------------|
| Hover | `--{color}-hover` (10% darker) |
| Active | `--{color}-active` (20% darker) |
| Disabled | `--{color}-disabled` (40% opacity) |

**Tailwind Usage**:
```tsx
className="bg-primary hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled"
className="bg-danger hover:bg-danger-hover"
```

### Border Pattern

**DO NOT** add extra shades for borders. Use opacity instead:

```tsx
// ✅ Correct - use opacity
className="border border-danger/30"
className="border border-info/30"

// ❌ Incorrect - don't expect danger-200, info-200, etc.
className="border-danger-200"  // DOESN'T EXIST
```

### CSS Variables Reference

All colors are defined in `src/styles/brand.css`:

```css
/* Semantic colors */
--danger: #EA7B4B;
--danger-light: #FFB393;
--success: #67C89E;
--success-light: #B8E2D0;
--info: #63ADCF;
--info-light: #BAD7E4;
--warning: #FFA656;
--warning-light: #FCC798;

/* Node colors */
--goal: #F5C433;
--goal-light: #F4DB92;
--option: #AAA7E4;
--option-light: #DDDCF5;
--factor: #B0A899;
--factor-light: #EEE6D8;
```

### Legacy Aliases (For Migration)

These aliases exist for backward compatibility but should be replaced:

| Old | New |
|-----|-----|
| `ink-900` | `text-header` |
| `paper-50` | `panel` |
| `sand-200` | `panel-border` |
| `sun-500` | `goal` |
| `mint-500` | `success` |
| `sky-500` | `info` |
| `carrot-500` | `danger` |
| `lilac-400` | `option` |

### Utilities (Non-Brand)

These are necessary utilities, not brand colors:

```css
--white: #FFFFFF;
--black: #000000;
--backdrop: rgba(0, 0, 0, 0.5);
```

### Quick Reference Card

| Need | Tailwind Class |
|------|----------------|
| Error text | `text-danger` |
| Error background | `bg-danger-light` |
| Error border | `border-danger/30` |
| Success text | `text-success` |
| Success background | `bg-success-light` |
| Warning text | `text-warning` |
| Warning background | `bg-warning-light` |
| Info text | `text-info` |
| Info background | `bg-info-light` |
| Primary button | `bg-primary hover:bg-primary-hover` |
| Body text | `text-text-body` |
| Muted text | `text-text-light` |
| Panel background | `bg-panel` |
| Default border | `border-panel-border` |

## Key Files

- `src/styles/brand.css` - CSS custom properties (source of truth)
- `tailwind.config.js` - Tailwind color mappings
- `src/canvas/nodes/colors.ts` - Node color classes
- `src/canvas/theme/nodes.ts` - Node theme tokens
- `src/styles/typography.ts` - Typography tokens

## Commands

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc -p tsconfig.ci.json --noEmit)
```

## Deployment

- Always push to `staging`. Never push to `main` without explicit confirmation.
- Run `bash scripts/pre-push-validate.sh` before every push.
- Always execute `git push` and verify it succeeded. Do not just summarise commands — run them.

### Deployment verification protocol

When asked to deploy or merge to staging:

1. Confirm the target branch is `staging` — never push to `main` without explicit user confirmation
2. Before committing, run `git status` and `git diff --staged` to verify ONLY intended changes are staged
3. If there are uncommitted changes from previous sessions, flag them and get user approval before including
4. Actually execute every git command — do not present commands as a summary without running them
5. After push, verify it succeeded by checking the output

Never bundle unrelated uncommitted changes into a deployment commit.

## Git workflow

- Run `git status` and `git diff --staged` before committing.
- No simultaneous Claude Code sessions on this repository.
- Flag unexpected uncommitted changes at session start.

## Session preamble

At the start of every session, before any other work:

```bash
# 1. Branch and recent history
git branch --show-current && git log --oneline -5 && git status

# 2. Check for stale .js files shadowing .ts/.tsx sources
find src -name '*.js' -o -name '*.jsx' | while read f; do
  for ext in .ts .tsx; do
    tsf="${f%.*}$ext"
    [ -f "$tsf" ] && echo "STALE: $f"
  done
done

# 3. Check for uncommitted changes or stash entries
git stash list
```

Report the output. If stale `.js` files are found, flag them — they cause silent shadowing bugs where Vite resolves the `.js` file instead of the `.ts` source. If unexpected uncommitted changes or stash entries exist, flag them before proceeding.

Confirm the branch is correct for the task before starting any work.

## Testing

- After any code changes, run the full test suite, typecheck, and build before committing:
  ```bash
  npm test
  npm run typecheck
  npm run build
  ```
- Report the exact number of passing/failing tests.

## Debugging

- UI is a passthrough for display — it must not transform meaning (flip signs, default missing values, clamp ranges). If you see incorrect data displayed, the bug is upstream (PLoT or CEE), not in the UI.
- Three temporary semantic transforms exist (`UI-SEM-001/002/003`) pending migration to PLoT. Do not add new ones.
- Check for stale `.js` files co-located with `.ts`/`.tsx` source files in `src/`. Vite may resolve the wrong file. Check for and remove stale `.js` files when debugging unexpected behaviour.
- This is a React app — check for stale component state, missing dependency arrays in hooks, and incorrect memoisation when debugging rendering issues.

### Data flow tracing (mandatory before any fix)

Before implementing any bug fix or feature that touches data flowing between components or services:

1. Where does the data originate? (API response? Local state? URL params? PLoT SSE stream?)
2. List every transform/adapter layer it passes through (with file paths)
3. Where is it consumed in the UI?
4. Are there alternate code paths? (loading states, error states, empty states)

Only after the trace is documented, implement fixes at ALL affected layers. Do not fix one layer and assume others are correct.

## Code review analysis

When asked to address code review feedback:

1. Read ALL feedback items first before making any changes
2. For each item, determine independently:
   - Is the feedback valid and does it require a code change?
   - Is it already handled by existing code?
   - Is it incorrect or based on a misunderstanding of the architecture?
3. State your reasoning for each determination before making changes
4. Do not make changes just to appease reviewers if the existing code is correct
5. Group changes by affected file to minimise unnecessary edits

## Task completion checklist

Before reporting ANY task as complete, run and show the output of all checks:

```bash
# 1. Correct branch?
git branch --show-current

# 2. Clean state? (no accidental uncommitted changes)
git status

# 3. Recent commits match the work just done?
git log --oneline -5

# 4. All tests pass?
npm test

# 5. TypeScript compiles cleanly?
npm run typecheck

# 6. Build succeeds?
npm run build
```

If any check fails, fix it before reporting completion. Do not report "done" with failing tests or uncommitted changes unless explicitly discussed with the user.
