# DecisionGuideAI - Project Instructions

Project context and conventions for Claude Code.

## Project Overview

DecisionGuideAI is a decision modeling tool with an interactive canvas interface for building and analyzing decision graphs. Built with React, TypeScript, Vite, and Tailwind CSS.

## Design System

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the full Olumi two-shade color system, Tailwind classes, and component patterns. Key rules:

- Two shades per color: main (text/icons) + light (backgrounds)
- Borders via opacity (`border-danger/30`), never extra shade tokens
- Font: Inter throughout
- New code should use semantic names (`text-info`, `bg-success-light`), not legacy aliases (`sky-500`, `mint-500`)

## Architecture: CEE → UI → PLoT Data Flow

- CEE response → `adaptDraftResponse()` (cee/client.ts) → DraftChat node mapping → canvas store → V2 adapter (`transformNodeToV2`, `extractObservedState`) → `normaliseGraphIds` → PLoT request
- **Naming convention**: CEE/PLoT use `observed_state` (snake_case); canvas nodes use `observedState` (camelCase)
- DraftChat.tsx maps `observed_state` → `observedState` when creating canvas nodes
- V2 adapter maps `observedState` → `observed_state` when building PLoT request

### Key adapter files

- `src/adapters/plot/v2/adapter.ts` — V2 request builder (transformNodeToV2, extractObservedState)
- `src/adapters/plot/v2/types.ts` — V2Node, V2ObservedState, V2RunRequest interfaces
- `src/adapters/cee/types.ts` — CEEAnalysisReady, CEEOptionV3 interfaces
- `src/canvas/components/DraftChat.tsx` — CEE response → canvas node mapping
- `src/utils/nodeIdNormalisation.ts` — ID normalisation (uses spread, preserves fields)

### Patterns

- `transformNodeToV2` uses a **blocklist** (V2_NODE_BLOCKLIST) to exclude RF internals while passing through all CEE fields
- `extractObservedState` **spreads** original observedState then overlays computed defaults (std, baseline only when missing)
- DraftChat uses destructure + spread: `const { id, kind, ..., ...rest } = n` to preserve unknown fields

## Commands

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc -p tsconfig.ci.json --noEmit)
npm test             # Run tests (vitest run --reporter=verbose)
npm run test:full    # Full suite with increased memory (NODE_OPTIONS=--max-old-space-size=4096)
```

## Git & Deployment

- Always push to `staging`. Never push to `main` without explicit user confirmation.
- Run `bash scripts/pre-push-validate.sh` before every push.
- Run `git status` and `git diff --staged` before committing to verify only intended changes are staged.
- If there are uncommitted changes from previous sessions, flag them and get user approval before including.
- Actually execute every git command — do not present commands as a summary without running them.
- After push, verify it succeeded by checking the output.
- Never bundle unrelated uncommitted changes into a deployment commit.
- No simultaneous Claude Code sessions on this repository.

## Session Preamble

At the start of every session, before any other work:

```bash
# 1. Branch, recent history, and working tree state
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

Report the output. Stale `.js` files cause silent shadowing bugs where Vite resolves the `.js` file instead of the `.ts` source. Flag unexpected uncommitted changes or stash entries before proceeding. Confirm the branch is correct for the task.

## Testing — Three-Tier Process

Testing uses a tiered approach to avoid crushing the local machine. The full suite
(500+ files, 6,600+ tests) causes Worker OOM at 4 GB and takes ~15 min locally.
CI is the real safety net — it runs the full suite with sharded runners and 7 GB RAM.

### Tier 1: Smoke (after every code change)

Run **only** after making changes, before reporting the task as done.
Targets changed files and their direct dependents — fast and light.

```bash
npm run typecheck                              # ~60-90s, catches type errors
npx vitest run --changed --bail=1              # only tests affected by changes
```

If `--changed` finds no related tests, skip the vitest step — typecheck alone is sufficient.
Report: "Typecheck passed. N related tests passed." (or "No related tests for this change.")

### Tier 2: Pre-commit validation

Run before committing. Still lightweight — no full test suite.

```bash
npm run typecheck
npm run lint
```

### Tier 3: Full gate (before pushing to staging only)

Run **only** when the user explicitly says to push to staging.
The pre-push hook (`scripts/pre-push-validate.sh`) handles this automatically.
Do NOT run `npm test` or `npm run build` manually before pushing — the hook does it.

```bash
git push origin staging    # triggers pre-push hook which runs full suite
```

If the user asks to run the full suite outside of a push, use:
```bash
npm run test:full          # 4 GB heap, --bail=1
npm run build
```

### Important rules

- **Never run `npm test` (full suite) after every code change** — it OOMs and wastes time.
- **Never run typecheck + full tests in parallel** — doubles peak RAM and causes OOM.
- The pre-push hook runs checks sequentially to stay within memory limits.
- CI (GitHub Actions) is the authoritative gate — it runs the full suite, E2E, coverage,
  bundle policy, and security scans. Local testing is a fast feedback loop, not a replacement.

## Debugging

- UI is a passthrough for display — it must not transform meaning (flip signs, default missing values, clamp ranges). If you see incorrect data displayed, the bug is upstream (PLoT or CEE), not in the UI.
- Three temporary semantic transforms exist (`UI-SEM-001/002/003`) pending migration to PLoT. Do not add new ones.
- Check for stale `.js` files co-located with `.ts`/`.tsx` source files in `src/` when debugging unexpected behaviour.
- This is a React app — check for stale component state, missing dependency arrays in hooks, and incorrect memoisation when debugging rendering issues.

### Data flow tracing (mandatory before any fix)

Before implementing any bug fix or feature that touches data flowing between components or services:

1. Where does the data originate? (API response? Local state? URL params? PLoT SSE stream?)
2. List every transform/adapter layer it passes through (with file paths)
3. Where is it consumed in the UI?
4. Are there alternate code paths? (loading states, error states, empty states)

Only after the trace is documented, implement fixes at ALL affected layers.

## Code Review Analysis

When asked to address code review feedback:

1. Read ALL feedback items first before making any changes
2. For each item, determine independently:
   - Is the feedback valid and does it require a code change?
   - Is it already handled by existing code?
   - Is it incorrect or based on a misunderstanding of the architecture?
3. State your reasoning for each determination before making changes
4. Do not make changes just to appease reviewers if the existing code is correct
5. Group changes by affected file to minimise unnecessary edits

## Task Completion Checklist

Before reporting ANY task as complete, run the **Tier 1 smoke checks** (not the full suite):

```bash
git branch --show-current                      # Correct branch?
git status                                     # Clean state?
npm run typecheck                              # TypeScript compiles?
npx vitest run --changed --bail=1              # Related tests pass?
```

If typecheck or related tests fail, fix before reporting completion.
Do NOT run `npm test` (full suite) or `npm run build` here — those run in the pre-push hook
when the user decides to push, and again in CI. See "Testing — Three-Tier Process" above.
