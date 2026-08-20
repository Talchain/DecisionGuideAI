/**
 * vetBlockedReason — THE ONE PLACE A BLOCKED-RUN REASON IS MADE SAFE TO RENDER.
 *
 * It was a module-private function inside `pre-analysis-v3/footer/PanelFooter.tsx`
 * while exactly one surface rendered the reason. A second surface now renders the
 * same string (the readiness bar the shell hosts on the Olumi tab), and a second
 * COPY of this rule is how two surfaces come to show two different sentences for
 * one state — the defect class `composeBlockedReason.ts` exists to end, and the
 * one its own header records happening to an option label.
 *
 * So it moved here rather than being duplicated, and `PanelFooter` now imports
 * it. There is one owner; both consumers read it.
 *
 * ── WHAT IT DOES, AND WHY THE THREE ARMS DIFFER ────────────────────────────
 * `blockedReason` can carry CEE-authored readiness prose (via OutputsDock's run
 * tooltip), so foreign strings get the same runtime glossary guard every other
 * CEE-rendered string in the panel gets.
 *
 * ⚠ …EXCEPT when it is COMPOSED copy (`composeBlockedReason.ts`), which is built
 * from vetted parts: a DGAI sentence frame plus the user's OWN option label.
 * `guardCeeText` prefers IN-PLACE SUBSTITUTION and enforces terms the label vet
 * does not, so it rewrote a label the user typed — an option named "Move billing
 * to edge computing" rendered as "…to connection computing" while the unguarded
 * ⌘Enter toast and dock tooltip showed the real one. Two surfaces, two option
 * names, one state. (`ceeTextGuard`'s own header agrees: substitution applies to
 * coaching text, "NEVER to option/factor/risk labels — those are shared graph
 * data".)
 *
 * So composed copy is VETTED, never rewritten; if the vet fails the WHOLE
 * sentence degrades to the non-committal fallback. Foreign strings keep the
 * guard's contract unchanged.
 */

import { guardCeeText } from '../components/pre-analysis-v3/signals/ceeTextGuard'
import { BLOCKED_REASON_COPY, classifyBlockedReason } from './composeBlockedReason'

/**
 * The last-resort subline. It must make NO factual claim about the model — it
 * is reached exactly when we do not know the cause.
 *
 * ⚠ REFERENCED, NOT RE-TYPED, and `FOOTER_COPY.notReadySubFallback` references
 * the same constant for the same reason. Three names, one string.
 */
export const BLOCKED_REASON_FALLBACK = BLOCKED_REASON_COPY.unspecified

/** Pure and total. Returns a string that is always safe to render. */
export function vetBlockedReason(blockedReason: string): string {
  switch (classifyBlockedReason(blockedReason)) {
    case 'composed-safe':
      return blockedReason
    case 'composed-unsafe':
      return BLOCKED_REASON_FALLBACK
    default:
      return guardCeeText(blockedReason, BLOCKED_REASON_FALLBACK).text
  }
}
