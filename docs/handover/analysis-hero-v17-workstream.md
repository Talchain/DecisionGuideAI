# AnalysisHeroV17 workstream — handover

**Status as of 2026-05-13:** Rounds 1-7 complete and deployed to staging. Awaiting Paul's visual sign-off on staging before promotion to production (which requires a flag-default decision — see §10). Staging HEAD: `f5546fd1`. Branch in flight: `claude/serene-bell-8a7861`.

This handover is for a fresh Claude Code instance picking up this workstream cold. It assumes you've read `CLAUDE.md` and the session-start preamble has been run. Everything below is *additional* context.

---

## 1. What this workstream is

The **v17 Analysis hero** is a new top-of-card section on the post-analysis Analysis tab in `ResultsBody`. It replaces the top section of the legacy `DecisionConfidencePanel` with a decision-strengthening UI based on a prototype Paul shared in early May 2026. The action-card body below the hero is **shared** with the legacy panel via an extracted component (`TriageActionCardsBody`). When the v17 flag is on, `AnalysisHeroV17` renders **instead of** `DecisionConfidencePanel`; when off, the legacy panel still renders. Both compose the same `TriageActionCardsBody` underneath.

The implementation is staged behind the feature flag `analysisHeroV17`. There is also an **opt-in comparison mode** (`analysisHeroCompare`, off by default, URL-bootable via `?analysisHeroCompare=1`) that renders BOTH heroes for side-by-side internal review.

### Why it matters
Paul's manual review of the staging UI surfaced eight specific issues in the first hero render (the round-4 "polish pass"). Three subsequent rounds of external review feedback (rounds 5-7) closed defects ranging from auto-send leaks in the composed body to banned-term smuggling via user-supplied factor labels. The current state is "production-ready pending visual sign-off" — but the code path is intentionally off-by-default in production until that sign-off lands.

---

## 2. Source-of-truth documents (read these first if you need depth)

| Doc | Purpose |
|---|---|
| `docs/investigations/analysis-hero-v17.md` | The Phase-0 investigation. Sections §9-§11 define the VM shape, state selection, row precedence, footer CTA map. Note: §11.4 has a **dated update header** explaining that Fix 9 superseded the original auto-send rule. |
| `docs/brief-analysis-hero-v17-implementation.md` | The implementation brief built from the investigation. §3 step 1 defines the extract-and-substitute pattern. Step 6 (post-update note) and step 8 (glossary scanner) are still the binding rules. |
| `V5 / Analysis tab data contract v1.3` | Lives at `/Users/paulslee/Downloads/v5-analysis-tab-data-contract-v1_3 (1).md`. §0.4 + §3 govern which intents map to `Needs handler` (Pre-mortem, Outside view, Devils-advocacy) versus `start_guided_chat`. The Also-line + Actions menu in §11.4 of the investigation must respect this contract. |
| `docs/design/Olumi_Design_System_v4.md` + `DESIGN_SYSTEM.md` | Three-channel design system (shapes/colour/icons). Hero must follow these — no `bg-{colour}-light` on cards, no filled pills, etc. |

The **Olumi Communication Glossary v1** is canonical for banned terms. The list lives in code at `src/components/results/analysisHeroV17/glossaryCheck.ts` (production fallback gate) and is mirrored at `src/test/glossaryBannedTerms.ts` (test-side scanner). They MUST stay in lock-step — if you add a term in production, mirror it in the test asset and vice versa. See the header comment of `glossaryCheck.ts`.

---

## 3. Architecture: extract-and-substitute, not in-place rewrite

```
ResultsBody
  ├── if analysisHeroV17 flag ON  → AnalysisHeroV17 ───┐
  └── if flag OFF                 → DecisionConfidencePanel ──┤
                                                              ├─→ TriageActionCardsBody (SHARED)
                                                              │      ├── ResultChecks (TargetProbabilityBars)
                                                              │      ├── T1FlipRiskCallout
                                                              │      ├── ConditionalWinnerCards
                                                              │      ├── (triage queue — SUPPRESSED in v17)
                                                              │      ├── T1DominantNudge
                                                              │      └── T1ChecksFooter (Winner/Robust/Evidence glyphs + MissingKnowledgePrompt)
```

### Key invariant: the body is a true shared dependency

`TriageActionCardsBody` is rendered by BOTH heroes. It accepts a `useV17Copy?: boolean` prop (default `false`). When `false`, the body renders exactly as the legacy `DecisionConfidencePanel` always did — verified by the existing `DecisionConfidencePanel.*.spec.tsx` suites which assert the legacy copy unchanged. When `true`, the body applies v17-specific glossary-safe copy at four named surfaces (enumerated in the prop's JSDoc).

**Do not** add v17-specific behaviour to the body without gating it behind `useV17Copy`. The legacy spec suite is the regression net — any non-gated v17 behaviour will fail those tests.

### The composer (`AnalysisHeroV17.tsx`) is thin

The composer subscribes to the guidance store ONLY for `_prefillChat !== null` (a boolean derivation, not the function itself). The actual prefill call uses `useGuidanceStore.getState()._prefillChat` at dispatch time. This avoids re-renders on every guidance-store update.

It also **accepts but does not forward** `onSendMessage` and `aiAffordance` — see §4.

### The view-model is built once, consumed without further derivation

`buildAnalysisHeroViewModel.ts` returns an `AnalysisHeroVM` with everything pre-resolved: state, dimension segments, meta pills, key question, row list, also-links, footer checks, footer CTA. The components consume the VM and render. **No state selection, fallback resolution, or copy mutation should live in JSX.** This is the rule the brief established at step 6.

---

## 4. Critical invariants (do not violate)

These are rules established across the seven rounds. Violating any of them will trigger a review failure.

### 4.1 Zero auto-send paths in the v17 hero

Every CTA, row action, key-question chip, and Also-line link in the v17 hero **must** route through `_prefillChat`, never `_sendMessage`. This was Fix 9 of the round-4 polish pass (commit `5a610832`) and the no-auto-send rule was tightened in round-5 (commit `c0eb5075`) when the reviewer found that forwarding `onSendMessage`/`aiAffordance` into the composed body silently re-introduced auto-send paths via the dominant-nudge Research chip and the `MissingKnowledgePrompt` AI affordance.

**Mechanisms enforcing this:**
- `AnalysisHeroV17` destructures `onSendMessage: _onSendMessage, aiAffordance: _aiAffordance` and does NOT pass them to `<TriageActionCardsBody>`. The underscore-prefix tells ESLint they're intentionally unused.
- `T1DominantNudge` suppresses its Research chip when `useV17Copy === true` (the chip dispatches `onSendMessage`).
- `dispatchAction.ts` row dispatcher only knows about `prefillChat`, `onFocusNode`, `onConfirm`. There is no `sendMessage` parameter.
- `HeroFooter`'s reflect-state CTA (the historical auto-send path) now uses `kind: 'challenge-result'` but dispatches via `prefillChat`. The label is "Test the result".

If you ever see `_sendMessage(` actually being CALLED (not just imported or referenced in a comment) anywhere in the v17 hero tree, that's a defect. Imported-but-unused is fine — the import is intentional future-fallback per the comment in `dispatchAction.ts`.

### 4.2 The raw-vs-safe label rule

User-supplied labels (factor names, option names, etc.) **must** appear verbatim only in places that are *dedicated identity fields displayed AS user data*. Everywhere else — generated prose, `aria-label`, `title`, button text — they must route through `safeInterpolatedLabel` from `analysisHeroV17/glossaryCheck.ts`.

**Currently applied (gated on `useV17Copy`):**
| Component | Identity field (raw) | Generated copy (gated) |
|---|---|---|
| `T1DominantNudge` | The bold `<span>{dominantLabel}</span>` inside "Dominant factor: X" | `aria-label`, `title`, Validate-button `aria-label` |
| `T1FlipRiskCallout` | (none — all label interpolations are in prose) | `<strong>{fromLabel}</strong>` and `<strong>{altWinnerLabel}</strong>` in the "If X shifts, Y could overtake" prose; Validate-button text |
| `ConditionalWinnerCards` | (none — all label interpolations are in prose) | `factor_label` in "When X exceeds N…"; chosen `alt` winner_label; both `Above:`/`Below:` bucket `winner_label`s; header tooltip + sr-only text |

The `safeInterpolatedLabel(raw, fallback)` helper returns `raw` if it's glossary-safe and `fallback` otherwise. Per-slot fallback choices live with each call site; pick fallbacks that read naturally in the surrounding prose (e.g. `"this factor"`, `"the next option"`, `"the other option"`).

**Test-side enforcement:** `src/components/results/analysisHeroV17/__tests__/bodyLabelSafety.spec.tsx` renders the composed body with banned-term labels (`"Recommendation analysis"`, `"Winner option B"`, `"Best choice path"`, `"Winning approach"`) and asserts (a) zero banned terms in any v17-mode `aria-label`/`title`/visible-text (excluding the dominant-nudge identity span), and (b) raw labels DO appear verbatim in legacy mode. Run this whenever you touch the body sub-components.

### 4.3 Glossary scanner: production + test must agree

`analysisHeroV17/glossaryCheck.ts` exports the canonical `ANALYSIS_HERO_BANNED_TERMS` array. The test scanner at `src/test/glossaryBannedTerms.ts` re-exports the same list. **Production code imports from `glossaryCheck.ts`; tests import from `glossaryBannedTerms.ts`** — that asymmetry is intentional (production must not depend on a test asset; see the brief §3 step 8). If you add a banned term, update the canonical list in `glossaryCheck.ts` and the mirror re-exports automatically.

### 4.4 Don't rewrite user data

`safeInterpolatedLabel` returns the raw label if it's safe — only swaps for a fallback when the label trips the matcher. The user's actual factor labels are never mutated for storage or in the canonical view-model. The user-data preservation rule is also why row titles in `HeroInputRows` show the user's exact label even when the row's chat prompt uses a fallback.

### 4.5 V5 contract: don't surface `Needs handler` intents

`run_pre_mortem`, `run_outside_view`, `run_devils_advocacy` are all `Needs handler` per V5 contract v1.3 §0.4. Until V5 registers handlers, the UI must either hide them or render a disabled CTA. **Currently hidden** in:
- Also-line: `buildAlsoLinks` filters them out before the array reaches `HeroFooter`. The footer then applies the minimum-items rule (`< 2 → hide entirely`).
- Actions menu: the two menu items that mapped to these intents (`Run a pre-mortem`, `Use the outside view`) are removed. `Challenge the current result` was renamed to `Test the result` and re-treated as `start_guided_chat`.

Do not re-add these without contract evidence that V5 has registered handlers.

### 4.6 Three-tier testing

This project enforces the three-tier testing rule strictly (CLAUDE.md "Testing — Three-Tier Process"). After code changes:
- **Tier 1**: `npm run typecheck` + `npx vitest run --changed --bail=1`
- **Tier 2** (before commit): + `npm run lint`
- **Tier 3** (only before pushing): `git push origin staging` — the pre-push hook handles the rest

**Never** run `npm test` (full suite) after every code change. It OOMs the machine. CI runs the full suite post-push.

---

## 5. File map (where stuff lives)

### v17 hero (the fork)
```
src/components/results/
├── AnalysisHeroV17.tsx                       # Composer — thin, accepts props compatible with DecisionConfidencePanel
├── TriageActionCardsBody.tsx                 # SHARED body — accepts useV17Copy prop
├── ConditionalWinnerCards.tsx                # SHARED sub-component — accepts useV17Copy prop (added round 7)
├── ResultsBody.tsx                           # Selects AnalysisHeroV17 vs DecisionConfidencePanel based on flag
└── analysisHeroV17/
    ├── analysisHeroVM.types.ts               # AnalysisHeroVM shape, HeroState, RowCategory, RowAction, FooterCtaKind
    ├── buildAnalysisHeroViewModel.ts         # The one builder: data + signals + state → VM
    ├── rowRanking.ts                         # Deterministic row ordering, action sets, reason copy
    ├── glossaryCheck.ts                      # Canonical banned-term list + safeInterpolatedLabel helper
    ├── canvasSignals.ts                      # Structure / Coverage signal derivation (node type guards)
    ├── dispatchAction.ts                     # Row-action dispatcher factory (prefill/focus/confirm only)
    ├── HeroActionRow.tsx                     # Right-aligned icon cluster on each row (gap-1)
    ├── HeroActionsMenu.tsx                   # Top-right "Actions ▾" — 4 items (hidden when chat closed)
    ├── HeroFooter.tsx                        # Hint, also-line, footer-checks, state-dependent CTA
    ├── HeroInputRows.tsx                     # Top 3 visible + 3 hidden disclosure
    ├── HeroKeyQuestion.tsx                   # Key-question card with chip strip (chips hidden when chat closed)
    └── __tests__/
        ├── accessibility.spec.tsx            # Pill labels, aria, focus order
        ├── bodyLabelSafety.spec.tsx          # *** rounds 6+7 *** rendered-DOM glossary scan with banned labels
        ├── buildAnalysisHeroViewModel.spec.ts# VM-builder unit tests
        ├── canvasSignals.spec.ts             # Signal derivation tests
        ├── chatClosedRender.spec.tsx         # Fix 6 chat-closed mode tests
        ├── glossaryCompliance.spec.tsx       # Source + VM + DOM banned-term scan
        ├── p1Fixes.spec.tsx                  # Round-1-2-3 P1 regression tests (flipped through rounds)
        ├── rowRanking.spec.ts                # Row order / category / action determinism
        └── stateSelection.spec.ts            # State machine: weak/moderate/reflect/strong selection
```

### Legacy (still in use, do not touch unless v17 is promoted to default-on)
```
src/components/results/
├── DecisionConfidencePanel.tsx               # Legacy top section + composes TriageActionCardsBody
└── __tests__/DecisionConfidencePanel.*       # Regression net for legacy rendering
```

### Wires
```
src/flags.ts                                   # analysisHeroV17 flag config (OFF by default)
src/canvas/stores/guidanceStore.ts             # _prefillChat / _sendMessage wires registered by ConversationPanel
```

---

## 6. The 7 rounds, in chronological order

This is the narrative arc of how the workstream got to its current state. Useful when you encounter a comment referencing "Fix 9" or "P1.4 Round-5" and want to know what it means.

### Round 1-3 (pre-handover): scaffolding + initial review feedback
- Phase-0 investigation report written (`docs/investigations/analysis-hero-v17.md`)
- Implementation brief written (`docs/brief-analysis-hero-v17-implementation.md`)
- Extract-and-substitute landed: `TriageActionCardsBody` extracted from `DecisionConfidencePanel`; `AnalysisHeroV17` composer built; `useV17Copy` flag introduced for the footer "Winner"/"No winner" copy difference.
- Three rounds of P1 review feedback closed — including the canonical glossary check sharing pattern and the `bodyLabelSafety` design.

### Round 4 — Polish pass (commit `5a610832`)
Paul's first manual test on staging surfaced 8 specific issues from screenshots. Plan-mode produced 9 numbered fixes. All 9 landed in one commit:

1. **Header verified-count copy**: `"0 of 4 verified"` → `"No inputs verified"` / `"N inputs verified"`. Also removed the duplicate contribution-line below the strip (`ContributionLine.text` is now always null; type kept @deprecated for back-compat).
2. **Meta-pill copy alignment**: `Evidence thin/limited/adequate` → `Evidence limited/moderate/adequate`. Stability pills: `Result fragile/moderate/Stable result/Highly stable` → `Fragile result/Moderate stability/Stable result/Highly stable`.
3. **Row copy: kill duplication + truncation**. Fragile-edge row's reason became `"Highest-priority assumption. Most likely to change which option leads."` (no longer repeats the result-context line). Evidence-gap fallback tightened. Coverage row tightened.
4. **Row action ordering**: positions 1-2 are now always `ai` + `discuss` across every row category. Counts still vary intentionally; ORDER is now standardised.
5. **Icon spacing**: `HeroActionRow` gap-0.5 → gap-1; `HeroInputRow` gap-2 → gap-3.
6. **Chat-closed mode**: when `_prefillChat` is null (chat minimised — the common post-analysis state), prefill-dependent surfaces HIDE entirely (not disable). Rows: only Edit + Confirm remain. Menu trigger: gone. Key-question chips: gone. Also-line: gone. Footer CTA: hidden for weak/reflect/strong; moderate stays with the softer label "Focus key estimate" because the focus side-effect remains useful without chat.
7. **Also-line contract alignment + minimum-items rule**: filter out `Needs handler` items, then hide if fewer than 2 remain. For weak/moderate/reflect, only `Main connection` survives the filter → line hidden. Strong unchanged (3 safe items).
8. **Actions menu contract alignment**: removed `Run a pre-mortem` and `Use the outside view`; renamed `Challenge the current result` to `Test the result` (re-treated as `start_guided_chat`).
9. **Reflect-state CTA**: relabelled `Challenge result` → `Test the result`. **Dropped auto-send.** This is the largest behaviour change in the polish pass and the root of the "zero auto-send paths" invariant.

### Round 5 — Review feedback (commit `c0eb5075`)
The reviewer found four P1s + three stale-comment improvements:
- **P1.1**: AnalysisHeroV17 was still forwarding `onSendMessage` + `aiAffordance` into the composed body, which re-introduced auto-send via the dominant-nudge Research chip and the `MissingKnowledgePrompt` AI affordance. Fixed by underscore-prefix destructure (props accepted for interface compatibility, intentionally ignored).
- **P1.2**: Threaded `useV17Copy` to `T1DominantNudge` so its static "the recommendation could change" sentence becomes "the leading option could change" and the auto-send Research chip is suppressed.
- **P1.3**: Removed `defaultValue: true` from `analysisHeroV17` flag config — production-leak risk. Local enable is now one console command.
- **P1.4**: Rebase onto origin/staging.
- Three stale comments fixed across `analysisHeroVM.types.ts`, `dispatchAction.ts`, `HeroInputRows.tsx`, `buildAnalysisHeroViewModel.ts`.

### Round 6 — Label-safety (commit `8a60da83`)
Reviewer caught that round 5 only handled STATIC template strings. User-supplied labels could still smuggle banned terms into generated copy. Fixed:
- Threaded `useV17Copy` to `T1FlipRiskCallout` (was previously legacy-only).
- Routed every label interpolation in `T1DominantNudge` aria/title and `T1FlipRiskCallout` prose/button through `safeInterpolatedLabel`.
- Preserved raw labels in the visible identity spans (rule: user data shown AS user data stays verbatim).
- New test file `bodyLabelSafety.spec.tsx` with 6 rendered-DOM tests.
- Stale-comment cleanup: `AnalysisHeroV17Props.onSendMessage`/`aiAffordance` comments + `TriageActionCardsBody.useV17Copy` JSDoc.

### Round 7 — Sub-component coverage gap (commit `d3443744`)
Reviewer noticed `ConditionalWinnerCards` is rendered by the body in v17 mode but had no v17-safe copy path of its own. Fixed:
- Threaded `useV17Copy` to `ConditionalWinnerCards`.
- Static header rewrite + 4 label interpolations gated.
- Extended `bodyLabelSafety` fixture with `conditionalWinners` containing banned labels. New whole-body visible-text sweep test.

### Round 7 self-review + doc reconciliation (commit `f5546fd1`)
Final self-assessment surfaced stale docs claiming `reflect auto-sends`. Updated investigation §11.3, §11.4, §15.8, §17 follow-up #5 + brief §6 with dated forward-reference notes (preserved historical content; annotated where current code diverges).

---

## 7. The flag — current state and the production-promotion decision

**`src/flags.ts`** (lines ~290-307):
```ts
analysisHeroV17: {
  envKey: 'VITE_FEATURE_ANALYSIS_HERO_V17',
  storageKey: 'feature.analysisHeroV17',
  // NO defaultValue: true — falls through to false
},
```

### Enable for local dev
One browser console command:
```js
localStorage.setItem('feature.analysisHeroV17', '1')
```

### Enable for staging
Set `VITE_FEATURE_ANALYSIS_HERO_V17=1` at the staging build step (Netlify env var).

### Production decision PENDING Paul's visual sign-off
Paul's plan explicitly contained a close-out reminder: "Before promoting any build that includes this branch to production: open `src/flags.ts` and either (a) remove `defaultValue: true` (done), or (b) leave the line but configure the production build env to set `VITE_FEATURE_ANALYSIS_HERO_V17=0` explicitly." Currently we're at option (a) — flag is OFF for production. If/when Paul approves the v17 hero for general release, you'll likely need to either re-add `defaultValue: true` (with the comment removed) OR set the production env var to `1`. Don't make this change without Paul's explicit go-ahead.

---

## 8. Known issues / pre-existing failures (not caused by this workstream)

When running tests post-rebase you may see one failure:

> `src/canvas/conversation/__tests__/useConversation.hook.spec.ts > V5 graph re-fetch on analyse response > fetches graph from DB and populates canvas when analyse response arrives with empty canvas` — assertion: `expected "spy" to be called with arguments: [...]; Number of calls: 0`

This is a V5-migration-stranded test that came in via the rebase onto staging. **Confirmed pre-existing** in round-5 by stashing this workstream's changes and re-running — failure persists. Same class as the documented `stamps graph_hash_at_proposal` failure in user memory. Do NOT try to fix it as part of this workstream — it's a separate V5 architecture issue tracked at `~/.../memory/MEMORY.md` and `open_followups_ci_v5.md`. The pre-push fast gate does not run this test, and CI infrastructure has its own pnpm migration problems that surface earlier.

Other known-broken tests excluded from the local run (in `vitest.config.ts`):
- `DecisionQualityChecks.spec.tsx` — references removed "Sharpen your thinking" header
- `ConfidenceSection.voi.spec.tsx` — "Could change the recommendation" topAction path
- `no-message-render.spec.ts` — ChallengeSection renders critique `.message`
- 29 files total

Do not regress on these but do not try to fix as part of this workstream.

### CI status
All GitHub Actions workflows currently fail at the install step due to an incomplete pnpm migration (per memory note 2026-04-30). Local pre-push gate is the working safety net. The post-push CI run will likely fail at install, but the deploy itself is driven by Netlify's own build pipeline (separate from GH Actions). Verify deploy via Netlify's UI, not the CI run.

---

## 9. Where Paul is likely to push next

Based on the plan's "explicitly out of scope" list and Paul's recent direction:

### Most likely next requests (in scope-order)
1. **Visual sign-off after staging deploy lands.** Paul will manually test the staging UI with `VITE_FEATURE_ANALYSIS_HERO_V17=1` set (or with the localStorage override). Expect either more fixes (round 8?) or approval to promote to production.
2. **Lower-section dedupe.** The hero currently sits ABOVE existing post-analysis sections that overlap (flip-risk card, dominant-factor card in `DriversSection`, etc.). Plan §"Out of scope" lists this as a follow-up. The V5 contract §0.3 says to use `signal_id` for dedupe. This will be a separate brief.
3. **`DecisionConfidencePanel` retirement.** Once v17 is approved, the legacy panel's outer wrapper can be removed, leaving `TriageActionCardsBody` as the canonical body. Small, surgical, easy to revert.
4. **`TriageActionCardsBody` glossary cleanup OUTSIDE the v17 flag.** Right now only the four `useV17Copy`-gated surfaces are glossary-safe; the legacy panel still has the banned-term copy. After v17 is the default, the gates can be removed and the safe copy applied unconditionally.

### Deferred / blocked on external work
- Pre-mortem / Outside view / Devils-advocacy intents in the Also-line and Actions menu — blocked on V5 ExerciseBlock + handler registration.
- Chat-store refactor to expose minimise/expand — would unlock click-to-open-then-prefill for the hero, replacing the current "hide when chat closed" UX.
- CI pnpm sweep phase 2 (residual `npm`/`npx` in 11 package.json scripts + `validate-prepush.sh`).
- V5-migration-stranded `useConversation.hook.spec.ts` failure.

---

## 10. How to onboard fast (a 15-minute checklist)

1. **Read this handover** (you're here).
2. **`git log --oneline 27153431..HEAD`** — see the 5 commits delivered.
3. **Run the session preamble from CLAUDE.md** — confirm branch state, no stale .js, no surprising stash entries.
4. **Skim `docs/investigations/analysis-hero-v17.md` §11.4** (the updated CTA map) and **`docs/brief-analysis-hero-v17-implementation.md` §3** (extract-and-substitute, glossary scanner).
5. **Read the four key v17 files end-to-end:**
   - `src/components/results/AnalysisHeroV17.tsx` (composer, ~290 lines)
   - `src/components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts` (VM builder)
   - `src/components/results/analysisHeroV17/rowRanking.ts` (precedence + actions)
   - `src/components/results/analysisHeroV17/glossaryCheck.ts` (the canonical gate)
6. **Read the test file `bodyLabelSafety.spec.tsx` end-to-end.** It's the single best summary of the v17-vs-legacy contract.
7. **Run the smoke gate:**
   ```bash
   npm run typecheck
   npx vitest run src/components/results/analysisHeroV17 src/components/results/__tests__/DecisionConfidencePanel.polishD4.spec.tsx
   ```
   You should see 250+ passing tests. If anything is red, that's your starting point — STOP and investigate before doing anything else.
8. **Note the worktree path.** This work lives in a git worktree at `~/Documents/GitHub/DecisionGuideAI/.claude/worktrees/serene-bell-8a7861`. The main repo is at `~/Documents/GitHub/DecisionGuideAI`. Worktrees share the .git directory — pre-push hooks are wired via the shared common dir.

---

## 11. Pitfalls I hit (so you don't)

- **The `_sendMessage` wire is still imported in the composer.** Don't try to "clean up" by removing it — the comment explicitly says it's kept as a future fallback. If you remove it and ESLint passes, you'll have to add it back the moment any auto-send path is wanted.
- **`suppressTriageQueue` is the v17 hero's escape hatch for the body's main queue.** That's how the same body file renders differently in v17 vs legacy. Don't add another sibling boolean — extend `useV17Copy` if you need more v17-specific behaviour.
- **`cleanFactorLabel` runs BEFORE `safeInterpolatedLabel` in `T1DominantNudge`.** That order matters: `cleanFactorLabel` only strips encoding patterns like `(0/1)`; the glossary gate runs on the cleaned label. Don't swap the order — encoding patterns shouldn't trip the banned-term regex anyway, but the cleaned label is what the user sees in identity contexts.
- **Banned-term lookup is case-insensitive AND word-boundary-aware for single tokens.** So `"telegraph"` will NOT match `"graph"` because the regex builder word-boundaries single-word entries. But `"Recommendation analysis"` WILL match the banned `"recommendation"` because it's a substring with word boundaries. Test new banned terms via `containsBannedTerm` directly before assuming a label will be caught.
- **Don't run `npm test` after every change.** Use `--changed` instead. Memory is precious — 4 GB heap by default; bumped to 6 GB for `test:full`; CI uses 7 GB.
- **Don't push to main.** Always push to staging. The CLAUDE.md rule is strict.

---

## 12. Quick-reference command cheatsheet

```bash
# Smoke (after every code change)
npm run typecheck
npx vitest run --changed --bail=1

# Targeted v17 suite (most useful one)
npx vitest run src/components/results/analysisHeroV17

# Legacy regression net (run if you touch TriageActionCardsBody or a sub-component)
npx vitest run \
  src/components/results/__tests__/DecisionConfidencePanel.polishD4.spec.tsx \
  src/components/results/__tests__/DecisionConfidencePanel.t1D2c.spec.tsx \
  src/components/results/__tests__/DecisionConfidencePanel.t1Structure.spec.tsx \
  src/components/results/__tests__/DecisionConfidencePanel.hotfix5_8b.spec.tsx \
  src/components/results/__tests__/ConditionalWinnerCards.direction.spec.tsx

# Lint just the touched files
npx eslint <files...>

# Push to staging (triggers pre-push fast gate + Netlify deploy)
git push origin claude/serene-bell-8a7861:staging

# Sanity-check what's ahead of staging
git log --oneline origin/staging..HEAD

# Enable v17 locally
# In browser console:
localStorage.setItem('feature.analysisHeroV17', '1')
```

---

## 13. Open questions you may inherit

1. **Production flag default after Paul approves.** Will Paul want `defaultValue: true` re-added on the way to v17 being the only path, or will he keep it env-driven? Either is fine — confirm before changing.
2. **Conditional scenarios fallback wording.** The Round-7 reviewer's Finding 2 (low-severity UX) noted that `T1FlipRiskCallout` uses `"the next option"` while `ConditionalWinnerCards` uses `"the other option"`. I judged both acceptable in their respective prose contexts and left as-is. If Paul flags this in the visual review, unify them — there's no architectural reason to keep them different.
3. **Lower-section dedupe scope.** When this brief lands, the question will be: drop the legacy flip-risk card and dominant-factor card from `DriversSection` outright, or just hide them when the v17 flag is on? The "hide-when-flag-on" path is safer (preserves legacy parity) but accumulates more conditional logic. The "drop outright" path requires confidence that the v17 hero plus the body's flip-risk callout + dominant nudge cover the same ground. My recommendation: hide-when-flag-on for the migration window, drop after v17 is the default.

---

Good luck. The workstream is in a clean, tested, deployed state. Your job is to keep the invariants intact while Paul finishes his visual review, then either close out the workstream or pick up whatever round-8 feedback comes next.

— Outgoing instance, 2026-05-13
