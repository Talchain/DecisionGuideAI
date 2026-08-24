/**
 * Headless aiPanelV2 host for guidance invalidation on a local structural edit.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE THE CAPABILITY WAS DARK FOR EVERY REAL USER, AND
 * THE WHOLE SUITE STAYED GREEN. `clearGuidanceItems()` had exactly ONE
 * production caller — `useGraphEditEvents.ts:293` — and that hook's only host is
 * `DraftChat`, which `ReactFlowGraph.tsx:2484` mounts ONLY when `aiPanelV2` is
 * OFF. The flag is ON for every fresh user by `flags.ts:358` `defaultValue: true` — and it is the DEFAULT, not the
 * staging entry, that carries this claim. `netlify.toml:57` sits under
 * `[context.staging.environment]`, which applies ONLY to staging builds
 * (production inherits from `[build.environment]` alone), so citing it proves
 * STAGING and not "every deployed context" — an overclaim this comment made
 * until review caught it.
 * So a user could restructure their model while coaching minted against the
 * PREVIOUS model stayed on screen — the guidance strip, the on-canvas node
 * coaching markers and every inspector coaching section — until the next
 * assistant turn happened to replace the whole list.
 *
 * This is the same two-host shape the estate already uses for
 * `PanelApplyDrainHost` and `StructuralDeleteDrainHost`, and it is a SEPARATE
 * component from both so that no file's name becomes a lie about what it hosts.
 *
 * ⭐ WHAT THIS HOST DELIBERATELY DOES NOT DO, and why the lane stopped here
 * before: it does NOT re-host `useGraphEditEvents`. Doing that would fix the
 * coaching defect and, as a side effect, switch on `direct_graph_edit` wire
 * emission for every user — CEE would begin receiving a system event no flag-ON
 * user currently sends. That is a wire-behaviour change wearing a UX fix's
 * clothes, and it is a separate decision with a separate blast radius. So this
 * host consumes `useGuidanceInvalidationOnEdit`, which takes no transport and
 * imports none. The absence of the wire is enforced by source inspection in
 * `guidanceInvalidationReachability.production.spec.tsx`, not by this comment.
 *
 * It needs no `ConversationContext`: it reads the canvas store and clears the
 * guidance store, nothing else. It is mounted inside `MaybeConversationProvider`
 * anyway, because that is where the flag-ON host set lives and where the
 * derived reachability walk looks for it.
 */

import { useGuidanceInvalidationOnEdit } from './useGraphEditEvents'

export function GuidanceInvalidationHost(): null {
  useGuidanceInvalidationOnEdit()
  return null
}
