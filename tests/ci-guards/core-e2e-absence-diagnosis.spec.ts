// tests/ci-guards/core-e2e-absence-diagnosis.spec.ts
// =============================================================================
// THE GUARD ON SYSTEM E'S EXPLANATION OF ITS OWN FAILURES.
// =============================================================================
//
// System E's composer wait does not merely fail — it NAMES A CAUSE. That makes it a
// claim, and an unpinned claim about causation is the most expensive kind of wrong
// this estate produces: a SPECIFIC explanation is believed and acted on, where a vague
// one is merely unhelpful. The locator message this replaced ("element(s) not found",
// 60000ms) sent a reader after a timeout margin that was never the problem and cost a
// lane a full round on 2026-09-01.
//
// ⚠⚠ THE FIRST VERSION OF THAT REPLACEMENT WAS WRONG IN THE SAME WAY, POINTED THE
// OTHER WAY, AND WENT OUT UNPINNED WITH "unguarded at rest" RECORDED AS AN ACCEPTED
// LIMITATION. It was not a limitation; it was the missing half of the change. All
// three defects below were found by a reviewer EXECUTING the code, and every one of
// them is a case this file would have caught before it ever reached CI:
//
//   1. `if (stuckLoading || undelivered.length || failedAssets.length)` — ANY ONE of
//      three weak signals asserted asset delivery. A rendered page with an absent
//      composer and one unrelated aborted script printed "THIS LOOKS LIKE ASSET
//      DELIVERY" and "The app is still showing 'null', which is a Suspense fallback".
//      Three false sentences about a genuine product failure.
//   2. A bare fallback with NO nameable asset still blamed Netlify's `/assets/`, while
//      the same PR's own stated limitation said the cause was undiagnosed. The watch
//      sees script/stylesheet only, so a fetch/XHR stall is invisible to it BY
//      CONSTRUCTION — which is exactly why a bare fallback may not be attributed.
//   3. `undelivered()` had no age threshold. The code recorded `Date.now()` on every
//      request and then discarded it. Measured in the corpus that motivated the whole
//      change: the PRODUCT failure `33555675895` — a run that successfully laid out 19
//      nodes — held two `/assets/*.js` open at trace close, 447ms and 80ms old. An
//      age-blind reading shouts ASSET DELIVERY at a healthy layout.
//
// WHY THIS FILE AND NOT A CORE SPEC. `e2e/core`'s completeness guard rejects any spec
// that is not a Core acceptance criterion, and adding one would corrupt the "3 of 9"
// accounting. `core-completeness-guard.spec.ts` already imports `e2e/core/lib` from the
// required suite for precisely this reason, so the precedent is established: the
// browser-free half of a browser instrument is pinned here, where it runs on every PR
// in milliseconds against no deployed target.
//
// ⚠ THE MEASURED CONSTANTS BELOW ARE A CORPUS, NOT DECORATION. `ASSET_STALL_MS` sits
// between them; a change that moves it past either end breaks a named case here rather
// than silently re-opening defect 3.

import { describe, expect, it } from 'vitest'

import {
  ASSET_STALL_MS,
  classifyComposerAbsence,
  findModuleLoadFailure,
  MODULE_LOAD_FAILURE_PHRASES,
  selectStalled,
  type ComposerAbsenceInput,
} from '../../e2e/core/lib/harness'

// ── the corpus, from the artefacts of the ten measured failures ──────────────
/** Observed IN-FLIGHT noise on runs that were NOT asset failures (run 33555675895). */
const NOISE_AGES_MS = [447, 80]
/** Observed REAL stall: open from ~5s into the run to the 60s timeout (run 33556631726). */
const REAL_STALL_MS = 55_000
/** A chunk from the real failure's trace — every other request in it returned 200. */
const STALLED_CHUNK = 'https://x--olumi.netlify.app/assets/ReactFlowGraph-CdifbDa0.js'

const base: ComposerAbsenceInput = {
  where: 'the guest entry',
  timeoutMs: 60_000,
  statusTexts: [],
  renderedChars: 0,
  bodyHead: '',
  bodyText: '',
  url: 'https://x--olumi.netlify.app/#/canvas',
  stalledAssets: [],
  failedAssets: [],
}

/**
 * A page that has rendered past its fallback — the shape of a real product failure.
 * MEASURED against the deployed build: the guest landing is 313 chars with zero
 * `role="status"`.
 */
const LANDING =
  'Strategic reasoning Olumi turns messy strategic work into a living visual model ' +
  'while keeping your judgement visible. This is an invite-only pilot.'
const rendered = {
  statusTexts: [] as string[],
  renderedChars: 313,
  bodyHead: LANDING,
  bodyText: LANDING,
}

/**
 * ⭐ THE REAL CORPUS FIXTURE, verbatim from run 33571760150's uploaded page snapshot —
 * one of the five failures this suite labels asset delivery. NOTE WHAT IT LACKS: any
 * `role="status"` at all, because a REJECTED lazy import REPLACES the Suspense
 * fallback. Reproduced against the deployed build by aborting
 * `**\/assets/ReactFlowGraph-*.css`: 318 chars, zero status regions, same filename.
 */
const ERROR_BOUNDARY_TEXT =
  'Something went wrong The canvas encountered an unexpected error ' +
  'Unable to preload CSS for /assets/ReactFlowGraph-CD2a-IkG.css ' +
  'Show technical details Reload editor Copy debug info Report issue ' +
  'Dismiss and continue (not recommended) We could not save your most recent changes.'
const errorBoundary = {
  statusTexts: [] as string[],
  renderedChars: 318,
  bodyHead: ERROR_BOUNDARY_TEXT.slice(0, 300),
  bodyText: ERROR_BOUNDARY_TEXT,
}

describe('System E · the composer-absence verdict', () => {
  describe('defect 1 — a weak signal alone must never assert asset delivery', () => {
    it('a rendered page with one unrelated FAILED asset is a PRODUCT failure', () => {
      const { verdict, message } = classifyComposerAbsence({
        ...base, ...rendered,
        failedAssets: [{ url: 'https://cdn.example/unrelated.js', reason: 'net::ERR_ABORTED' }],
      })
      expect(verdict).toBe('product')
      expect(message).toContain('PRODUCT FAILURE')
      expect(message).not.toContain('ASSET DELIVERY')
    })

    it('a rendered page with a STALLED asset is still a PRODUCT failure', () => {
      const { verdict, message } = classifyComposerAbsence({
        ...base, ...rendered,
        stalledAssets: [{ url: STALLED_CHUNK, ageMs: REAL_STALL_MS }],
      })
      expect(verdict).toBe('product')
      expect(message).not.toContain('ASSET DELIVERY')
    })

    it('never claims a fallback is on screen when none is — the literal "null" bug', () => {
      const { message } = classifyComposerAbsence({
        ...base, ...rendered,
        failedAssets: [{ url: 'https://cdn.example/unrelated.js', reason: 'net::ERR_ABORTED' }],
      })
      expect(message).not.toContain('Suspense fallback')
      expect(message).not.toMatch(/showing "?null"?/)
      expect(message).not.toMatch(/showing "undefined"/)
    })

    it('does not DISCARD the asset information — it demotes it to a footnote', () => {
      const { message } = classifyComposerAbsence({
        ...base, ...rendered,
        failedAssets: [{ url: 'https://cdn.example/unrelated.js', reason: 'net::ERR_ABORTED' }],
      })
      expect(message).toContain('unrelated.js')
      expect(message).toContain('NOT the verdict')
    })
  })

  describe('defect 2 — a fallback with nothing nameable may not be attributed', () => {
    const bareFallback = { ...base, statusTexts: ['Loading Canvas...'], renderedChars: 18 }

    it('is reported as CAUSE UNIDENTIFIED, not as asset delivery', () => {
      const { verdict, message } = classifyComposerAbsence(bareFallback)
      expect(verdict).toBe('stalled-cause-unidentified')
      expect(message).toContain('CAUSE UNIDENTIFIED')
      expect(message).not.toContain('ASSET DELIVERY')
    })

    it('does not point at /assets/ or the deploy when it can name nothing', () => {
      const { message } = classifyComposerAbsence(bareFallback)
      expect(message).not.toContain('/assets/')
      expect(message).not.toMatch(/serves its own/i)
    })

    it('states the script/stylesheet blind spot rather than implying full coverage', () => {
      const { message } = classifyComposerAbsence(bareFallback)
      expect(message).toMatch(/fetch\/XHR is invisible/i)
    })

    it('is NOT downgraded to a product failure either — it stays undetermined', () => {
      const { verdict } = classifyComposerAbsence(bareFallback)
      expect(verdict).not.toBe('product')
    })
  })

  describe('defect 3 — the age threshold, which the first version discarded', () => {
    const now = 1_000_000

    it('excludes the measured in-flight noise (447ms and 80ms)', () => {
      const open = NOISE_AGES_MS.map((age, n) => ({ url: `a${n}.js`, startedAt: now - age }))
      expect(selectStalled(open, now, ASSET_STALL_MS)).toEqual([])
    })

    it('includes the measured real stall (~55s)', () => {
      const open = [{ url: STALLED_CHUNK, startedAt: now - REAL_STALL_MS }]
      const got = selectStalled(open, now, ASSET_STALL_MS)
      expect(got).toHaveLength(1)
      expect(got[0].url).toBe(STALLED_CHUNK)
    })

    it('separates the two in one mixed population, newest-noise excluded', () => {
      const open = [
        ...NOISE_AGES_MS.map((age, n) => ({ url: `noise${n}.js`, startedAt: now - age })),
        { url: STALLED_CHUNK, startedAt: now - REAL_STALL_MS },
      ]
      expect(selectStalled(open, now, ASSET_STALL_MS).map((a) => a.url)).toEqual([STALLED_CHUNK])
    })

    // ⚠ THIS PINS THE INTERVAL, NOT THE VALUE. 500, 30_000 and 50_000 all leave this
    // suite green, so 10_000 is CHOSEN within a measured window (N=3), not derived.
    it('keeps ASSET_STALL_MS strictly inside the measured interval (447, 55000)', () => {
      expect(ASSET_STALL_MS).toBeGreaterThan(Math.max(...NOISE_AGES_MS))
      expect(ASSET_STALL_MS).toBeLessThan(REAL_STALL_MS)
    })

    it('an age-blind threshold of 0 would misclassify the noise — the defect, pinned', () => {
      const open = NOISE_AGES_MS.map((age, n) => ({ url: `a${n}.js`, startedAt: now - age }))
      expect(selectStalled(open, now, 0)).toHaveLength(NOISE_AGES_MS.length)
    })
  })

  describe('the positive case still fires, and names the asset', () => {
    it('fallback PLUS a named stalled asset is asset delivery', () => {
      const { verdict, message } = classifyComposerAbsence({
        ...base,
        statusTexts: ['Loading Canvas...'],
        renderedChars: 18,
        stalledAssets: [{ url: STALLED_CHUNK, ageMs: REAL_STALL_MS }],
      })
      expect(verdict).toBe('asset-delivery')
      expect(message).toContain('ASSET DELIVERY')
      expect(message).toContain('Loading Canvas...')
      expect(message).toContain(STALLED_CHUNK)
    })

    it('does not overclaim WHY the fetch failed — that is undiagnosed', () => {
      const { message } = classifyComposerAbsence({
        ...base,
        statusTexts: ['Loading Scenario...'],
        stalledAssets: [{ url: STALLED_CHUNK, ageMs: REAL_STALL_MS }],
      })
      expect(message).toMatch(/NOT diagnosed by this instrument/i)
    })
  })


  // ── defect 4 ────────────────────────────────────────────────────────────────
  // `product` was reached from the ABSENCE of a fallback — the very rule this file
  // enforces, violated in its own third branch. A REJECTED import replaces the
  // fallback, so EVERY rejected-import failure routed to `product` by construction.
  describe('defect 4 — the app\'s own error boundary is NAMED evidence', () => {
    it('run 33571760150, verbatim, is ASSET DELIVERY and not product', () => {
      const { verdict, message } = classifyComposerAbsence({ ...base, ...errorBoundary })
      expect(verdict).toBe('asset-delivery')
      expect(message).toContain('Unable to preload CSS for /assets/ReactFlowGraph-CD2a-IkG.css')
      expect(message).not.toContain('PRODUCT FAILURE')
    })

    it('never claims the app "rendered past its fallback" when the import rejected', () => {
      const { message } = classifyComposerAbsence({ ...base, ...errorBoundary })
      expect(message).not.toMatch(/rendered past its fallback/i)
      expect(message).not.toMatch(/did not prevent the composer mounting/i)
    })

    it('fires with NO watch evidence at all — the boundary alone is enough', () => {
      const { verdict } = classifyComposerAbsence({
        ...base, ...errorBoundary, stalledAssets: [], failedAssets: [],
      })
      expect(verdict).toBe('asset-delivery')
    })

    it('explains WHY no loading status is on screen, rather than ignoring it', () => {
      const { message } = classifyComposerAbsence({ ...base, ...errorBoundary })
      expect(message).toMatch(/REPLACES the Suspense fallback/i)
    })

    it('scans the FULL body text, not the 300-char head', () => {
      const buried = `${'x'.repeat(400)} Failed to fetch dynamically imported module: /assets/a.js`
      const { verdict } = classifyComposerAbsence({
        ...base, statusTexts: [], renderedChars: buried.length,
        bodyHead: buried.slice(0, 300), bodyText: buried,
      })
      expect(verdict).toBe('asset-delivery')
    })

    it('a GENERIC error boundary is still a PRODUCT failure — the other direction', () => {
      const generic = 'Something went wrong The canvas encountered an unexpected error Reload editor'
      const { verdict } = classifyComposerAbsence({
        ...base, statusTexts: [], renderedChars: generic.length,
        bodyHead: generic, bodyText: generic,
      })
      expect(verdict).toBe('product')
    })

    it('the phrase list matches its observed member and rejects the generic sentence', () => {
      expect(findModuleLoadFailure(ERROR_BOUNDARY_TEXT))
        .toBe('Unable to preload CSS for /assets/ReactFlowGraph-CD2a-IkG.css')
      expect(findModuleLoadFailure('The canvas encountered an unexpected error')).toBeNull()
      expect(findModuleLoadFailure(LANDING)).toBeNull()
      expect(MODULE_LOAD_FAILURE_PHRASES.length).toBeGreaterThan(0)
    })
  })

  // ── the fourth verdict ──────────────────────────────────────────────────────
  describe('a blank or unreadable page is INDETERMINATE, never product', () => {
    it('0 chars with nothing nameable asserts no cause', () => {
      const { verdict, message } = classifyComposerAbsence({ ...base })
      expect(verdict).toBe('indeterminate')
      expect(message).toContain('INDETERMINATE')
      expect(message).not.toContain('PRODUCT FAILURE')
      expect(message).not.toContain('ASSET DELIVERY')
    })

    it('never emits the self-contradiction "the page IS rendered (0 chars)"', () => {
      const { message } = classifyComposerAbsence({ ...base })
      expect(message).not.toMatch(/page IS rendered \(0 chars\)/i)
      expect(message).not.toMatch(/rendered 0 chars of content/i)
    })

    it('0 chars WITH nameable assets is asset delivery — the app never booted', () => {
      const { verdict } = classifyComposerAbsence({
        ...base, stalledAssets: [{ url: STALLED_CHUNK, ageMs: REAL_STALL_MS }],
      })
      expect(verdict).toBe('asset-delivery')
    })

    it('an unreadable page state does not become a product failure', () => {
      const { verdict } = classifyComposerAbsence({
        ...base, bodyHead: '(page state unreadable)', bodyText: undefined, renderedChars: 0,
      })
      expect(verdict).toBe('indeterminate')
    })
  })

  describe('the discrimination itself', () => {
    // ⚠ A classifier returning any CONSTANT satisfies every single-verdict assertion
    // above. Only the three-way spread proves it is discriminating at all.
    it('yields four DIFFERENT verdicts for the four shapes', () => {
      const product = classifyComposerAbsence({ ...base, ...rendered }).verdict
      const unknown = classifyComposerAbsence({
        ...base, statusTexts: ['Loading Canvas...'],
      }).verdict
      const asset = classifyComposerAbsence({
        ...base,
        statusTexts: ['Loading Canvas...'],
        stalledAssets: [{ url: STALLED_CHUNK, ageMs: REAL_STALL_MS }],
      }).verdict
      const blank = classifyComposerAbsence({ ...base }).verdict
      expect(new Set([product, unknown, asset, blank]).size).toBe(4)
    })

    it('finds the fallback among several status regions, not only the first', () => {
      const { verdict } = classifyComposerAbsence({
        ...base,
        statusTexts: ['Saving…', 'Loading Canvas...'],
        stalledAssets: [{ url: STALLED_CHUNK, ageMs: REAL_STALL_MS }],
      })
      expect(verdict).toBe('asset-delivery')
    })

    it('a status region that is not a loading fallback does not count as one', () => {
      const { verdict } = classifyComposerAbsence({
        ...base, ...rendered,
        statusTexts: ['Analysis available'],
        stalledAssets: [{ url: STALLED_CHUNK, ageMs: REAL_STALL_MS }],
      })
      expect(verdict).toBe('product')
    })
  })
})
