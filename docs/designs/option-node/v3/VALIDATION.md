# V3 validation record

Recorded on 8 September 2026 for `codex/option-node-v3-refinements`, based on
staging `25164b1e`. Scope and expected behaviour are in
[DESIGN-SPEC.md](DESIGN-SPEC.md).

## Automated checks

| Check | Result |
|---|---|
| Initial node, action and menu regression group | 175 tests passed across 7 files. |
| Follow-up context-menu and tooltip group | 45 passed across 3 files; 35 repeat the initial group, 10 are additional menu tests. |
| Inspector rename, reachability, authority and review-fix group | 55 passed across 4 files. |
| Final shared-tooltip change | All 6 preview/tooltip tests passed on the final code. |
| Unique targeted coverage across the above groups | 240 tests across 12 files. Repeated tests are counted once. |
| Repository typecheck gate | Passed coverage and per-file ratchet: 4247 of 4287 tracked TypeScript files loaded, 40 declared out of scope; 2104 existing diagnostics against baseline 2152, none added. Baseline unchanged. |
| Full lint and hooks ratchet | Passed: 0 errors, 1163 existing warnings; 225 known hook violations match the baseline. |
| Additional lint on the final tooltip and inspector edits | Passed. |

The inspector group initially could not collect because the test process lacked
the repository's dummy local Supabase settings. Supplying those settings made
all 55 tests run and pass; no production configuration was changed. One repeat
of the tooltip suite hit its five-second test timeout under local load; a
fresh run passed all six in 1.14 seconds. No timeout was increased and no
assertion was removed.

The full repository test suite was not run locally. The normal pre-push gate
also checks critical data-flow smoke tests, dependencies and design-system
drift; its outcome belongs to the push record, not the counts above.

## Browser checks

The eight captures and their check descriptions are in
[IMPLEMENTATION.md](IMPLEMENTATION.md#browser-evidence). They cover an actual
connected application graph, action/body preview precedence, hoverable
tooltips, keyboard disclosure, Challenge opening an unsent draft, the details
menu route, a long inspector title, viewport-edge positioning and real zoom.

The local application used a captured headcount starter through
`applyDraftResult`, checked-in Netlify feature declarations and offline API
routes. Checks ran at 1440 × 900 and 1280 × 800, at 50% and 100% zoom.
No real user scenario or external AI request was used.

## Evidence boundary

Application code and local interaction checks exist. These checks do not
establish staging deployment, live AI response quality, a two-person journey,
new reasoning-signal coverage or the complete V3 vision. The existing control
size still reduces with canvas zoom. Deployment acceptance must identify the
served build and repeat the relevant interactions there.
