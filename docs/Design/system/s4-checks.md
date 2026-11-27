# Checks

Each rule needs a check that fails when the rule is broken. This page lists the checks that exist, what each one misses, and the rules that have none.

## Checks that run in CI

`ci.yml` runs these on pushes to `main` and pull requests targeting `main`. The specs run in its `test:coverage` step.

| Check | What it catches | What it misses |
|---|---|---|
| `pnpm run ci:guard:ds:enforce` | New breaches above `tools/ci-guards/ds-compliance-baseline.json`, across the gating classes. Two of them cover V12 type and colour (`v12-scale-tsx` and `v12-scale-css`): sizes off 12/14/18, weights off 400/500, serif and mono, `rgb()` literals, radius classes `xl` and up, and the glyphs ✎ ⓘ ✕ ✗. | Old breaches, because it is a ratchet. It also misses sizes that come from a token, such as `typography.panelMeta` at 11px. The type and colour rules cover `src/olumiView` and `src/olumiCore/team`. Their radius allowance includes 14. |
| `v12-spacing` (in the same guard) | New breaches of the [spacing standard](s8-spacing.md) in the V12 scope and `src/canvas/nodes`, excluding tests. It checks class utilities, numeric style props and static declarations in CSS files and TSX stylesheet templates. | Existing breaches, class strings or style objects passed through local identifiers such as `className={spacing}` and `style={cardStyle}`, conditional branches and computed literal keys in style objects, exponent-notation CSS lengths such as `2e2px`, and runtime spacing. |
| `v12-inline-style`, `v12-important-css` and `v12-important-utility` (in the same guard) | New explicit DOM style props in TSX, `!important` in CSS and TSX stylesheet text, and Tailwind important modifiers in TSX class strings under `src/olumiView` and `src/olumiCore/team`, excluding tests. | Existing breaches and inline style objects containing only explicit CSS custom properties. |
| `pnpm run ci:guard:ds` | The same scan as above. | It always exits 0 on breaches, so it never blocks. Use the `enforce` form. |
| `pnpm run lint` | `brand-tokens/no-raw-colors` as an error, for `src/canvas/**/*.tsx` only. | Raw colours in `src/olumiView`. The lint rule covers colour only. |
| `pnpm run typecheck` | TypeScript errors, as a per-file ratchet. | It checks nothing about design. |
| `tests/ci-guards/semantic-colour-alpha.spec.ts` | An opacity-modified colour class, such as `border-info/30`, that emits no CSS. | |
| `tests/ci-guards/text-light-contrast.spec.ts` | `text-light` falling below 4.5:1 on its grounds, with a margin pinned. | Other text colours. |
| `src/canvas/__tests__/layers.spec.ts` | Changes to the z-index map. | Raw `z-[n]` literals elsewhere. |
| `src/olumiView/look/__tests__/oneIconSystem.spec.tsx` | Direct `lucide-react` imports in 37 named lane files, and icon sizes outside 14 and 16. | The other 13 lane files that import `lucide-react`. It also allows 16px. |
| `src/olumiView/look/__tests__/lookRecipes.spec.ts` | A blue text action in `olumiLook.css`. | Blue text actions written in a component file, such as the zoom notice. |
| `src/olumiView/port/__tests__/hoverRules.spec.tsx` | Native `title` on the Analysis and Reasoning tabs. | Every other surface. |
| `src/olumiView/v12/__tests__/faceTextBudget.spec.tsx` (also in `test:full` via `ci:all`) | Excess words at rest on fixture Simple cards, with a separate title allowance. Caps above the measured fixture maxima also fail. A planted figure sentence exercises the check. | Other card families and states outside the [fixture list](s7-faces-and-charts.md#conformance), including FACE-whatif and FACE-tips. |
| Word checks in `restingRing.spec.tsx` and `viewTradeOffs.spec.tsx` | "best", "winner" and "recommend" on those two surfaces. | Every other surface. |

## Checks that are not run automatically

| Check | What it catches | What it misses |
|---|---|---|
| `pnpm run ci:guard:forms` (in `ci:all`, which `ci.yml` does not run; run by the UI lead's gate) | Unregistered literal form IDs, missing chart root IDs, chart primitives outside registered and legacy files, link role key drift, and unregistered dash literals. | Visible words, an inline HTML or CSS chart built from unregistered parts, or whether a string is Core's verbatim. New primitives inside a legacy file (including `olumiLook.css`). Its SVG rule also matches inline icons, so the legacy list holds icon files too: a new inline SVG icon fails it, which pushes icons to the registry. |

- `npm run visual` takes pixel baselines at 1280 by 800 and 1440 by 900. It does not cover the three sizes this system requires.
- The spacing census in the 22 Nov spacing audit was a one-off script.
- The real-board picture runs at 2000, 1232 and 1.33 belong to the UI lead's gate and are not part of CI.

## Rules with no check

- Blue means Olumi only, and green is for actions.
- No native `title` (except on the two tabs above).
- Icons at 14px from the one registry (partly covered).
- One floating surface open at a time, across every surface.
- British English, sentence case and no em dashes.
- The older look keeps working.
