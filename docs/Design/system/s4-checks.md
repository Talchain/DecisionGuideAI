# Checks

Each rule needs a check that fails when the rule is broken. This page lists the checks that exist, what each one misses, and the rules that have none.

## Checks that run in CI

`ci.yml` runs these on every push. The specs run in its `test:coverage` step.

| Check | What it catches | What it misses |
|---|---|---|
| `pnpm run ci:guard:ds:enforce` | New breaches above `tools/ci-guards/ds-compliance-baseline.json`, in six gating classes. Two of them cover V12 (`v12-scale-tsx` and `v12-scale-css`): sizes off 12/14/18, weights off 400/500, serif and mono, `rgb()` literals, radius classes `xl` and up, and the glyphs ✎ ⓘ ✕ ✗. | Old breaches, because it is a ratchet. It also misses sizes that come from a token, such as `typography.panelMeta` at 11px. It does not check spacing, inline styles, `!important` or icons. Its V12 scope is `src/olumiView` and `src/olumiCore/team` only. Its radius allowance includes 14. |
| `pnpm run ci:guard:ds` | The same scan as above. | It always exits 0 on breaches, so it never blocks. Use the `enforce` form. |
| `pnpm run lint` | `brand-tokens/no-raw-colors` as an error, for `src/canvas/**/*.tsx` only. | Raw colours in `src/olumiView`. There is no rule against inline styles, `!important`, type size or icon size. |
| `pnpm run typecheck` | TypeScript errors, as a per-file ratchet. | It checks nothing about design. |
| `tests/ci-guards/semantic-colour-alpha.spec.ts` | An opacity-modified colour class, such as `border-info/30`, that emits no CSS. | |
| `tests/ci-guards/text-light-contrast.spec.ts` | `text-light` falling below 4.5:1 on its grounds, with a margin pinned. | Other text colours. |
| `src/canvas/__tests__/layers.spec.ts` | Changes to the z-index map. | Raw `z-[n]` literals elsewhere. |
| `src/olumiView/look/__tests__/oneIconSystem.spec.tsx` | Direct `lucide-react` imports in 37 named lane files, and icon sizes outside 14 and 16. | The other 13 lane files that import `lucide-react`. It also allows 16px. |
| `src/olumiView/look/__tests__/lookRecipes.spec.ts` | A blue text action in `olumiLook.css`. | Blue text actions written in a component file, such as the zoom notice. |
| `src/olumiView/port/__tests__/hoverRules.spec.tsx` | Native `title` on the Analysis and Reasoning tabs. | Every other surface. |
| Word checks in `restingRing.spec.tsx` and `viewTradeOffs.spec.tsx` | "best", "winner" and "recommend" on those two surfaces. | Every other surface. |

## Checks that are not run automatically

- `npm run visual` takes pixel baselines at 1280 by 800 and 1440 by 900. It does not cover the three sizes this system requires.
- The spacing census in the 22 Nov spacing audit was a one-off script.
- The real-board picture runs at 2000, 1232 and 1.33 belong to the UI lead's gate and are not part of CI.

## Rules with no check

- The spacing standard.
- Blue means Olumi only, and green is for actions.
- No inline styles and no `!important` in components.
- No native `title` (except on the two tabs above).
- Icons at 14px from the one registry (partly covered).
- One floating surface open at a time, across every surface.
- British English, sentence case and no em dashes.
- The older look keeps working.
