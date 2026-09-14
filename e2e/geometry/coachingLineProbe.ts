/**
 * COACHING-LINE DENSITY — browser-side probe for #1450's compact lines.
 *
 * ⚠ WHY A MODULE AND NOT `page.evaluate` SOURCE. `page.evaluate` source is
 * never processed by Vite, so bare specifiers (`react`, and every `src/…`
 * import below) fail to resolve in the page. A module under the Vite root IS
 * transformed, so it can mount the REAL `ChatThread` → `MessageBubble` →
 * `InlineBlocks` → `CoachingLine` with the REAL stylesheet, which is the only
 * way to make a geometry claim at all (CLAUDE.md trap 3: jsdom cannot prove
 * content is on screen, and a 0x0 element is "present" and useless).
 *
 * ⚠⚠ THE CONTENT IS A DATED LIVE CAPTURE, READ-ONLY, AND IT IS NOT ADAPTED BY
 * HAND. `live-analysis-turn-walkA-2026-08-04.json` is fed to the SHIPPED
 * adapters (`adaptTypedReviewCardBlock` / `adaptTypedCoachingBlock` /
 * `adaptTypedEvidenceBlock`), which each reject a raw block whose wire type is
 * not theirs. A self-authored fixture would encode this author's model of the
 * producer and would flatter every number below — the exact trap that made an
 * earlier HTML prototype of this change measure its own CSS rather than the
 * product's. The capture is never written to.
 *
 * Not collected by any test config: it exports a function and asserts nothing.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ChatThread } from '../../src/canvas/conversation/zones/ChatThread'
import {
  adaptTypedReviewCardBlock,
  adaptTypedCoachingBlock,
  adaptTypedEvidenceBlock,
} from '../../src/v5/phase3TypedBlocks'
import capture from '../../src/v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'
import type { ConversationMessage } from '../../src/canvas/conversation/types'

/**
 * The real dock width. Taken from the committed visual reference
 * `e2e/visual/references/linux/olumi-tab--1280x800.png`, which is clipped to
 * `[data-testid="outputs-dock"]` and is 416px wide — not from the design doc,
 * and not from the screenshot's apparent width.
 */
const DOCK_W = 416
const settle = () => new Promise((r) => setTimeout(r, 400))

export interface LineBox {
  testid: string | null
  h: number
  w: number
  y: number
  /** A human could actually click this box. */
  hitTestable: boolean
  /** The title's own span overflows its line box — a clip, measured not guessed. */
  titleClipped: boolean
  titleText: string | null
  /** The summary's own markup, so a missing chip is diagnosed, not inferred. */
  summaryHtml: string | null
  /**
   * The native disclosure triangle, which `list-style:none` is meant to remove.
   * `null` when the element is not a `<details>` at all — an earlier revision
   * returned `false`/`true` unconditionally and reported "3 markers shown" for
   * the flag-OFF arm, which contains ZERO `<details>`. A pseudo-element query
   * against an element that has no such pseudo-element answers about the
   * element, not about the marker.
   */
  markerShown: boolean | null
}

export interface DensityReading {
  /** Every rendered block box in the assistant turn, in document order. */
  blocks: LineBox[]
  /** Compact lines specifically (absent entirely when the flag is off). */
  lines: LineBox[]
  /** Top of the first coaching point, relative to the top of the message. */
  firstPointOffset: number | null
  /** Floor-to-ceiling height of the assistant turn. */
  turnHeight: number
  /** How much of the turn is visible in a 772px-tall dock without scrolling. */
  visibleBlockCount: number
  errs: string[]
}

function boxOf(el: HTMLElement): LineBox {
  const r = el.getBoundingClientRect()
  const hit =
    r.width > 0 && r.height > 0
      ? document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(6, r.height / 2))
      : null
  // Bind the title by its own role in the summary, never by index: the summary
  // also carries an icon and a category chip and either could satisfy a
  // positional predicate.
  const titleEl = el.querySelector('summary > span:last-child') as HTMLElement | null
  const summaryEl = el.tagName === 'DETAILS' ? el.querySelector('summary') : null
  const marker = summaryEl ? getComputedStyle(summaryEl, '::-webkit-details-marker') : null
  return {
    testid: el.getAttribute('data-testid'),
    h: Math.round(r.height),
    w: Math.round(r.width),
    y: Math.round(r.top),
    hitTestable: hit !== null && el.contains(hit),
    titleClipped: titleEl ? titleEl.scrollWidth > titleEl.clientWidth + 1 : false,
    titleText: titleEl?.textContent?.trim() ?? null,
    summaryHtml: summaryEl ? summaryEl.outerHTML.slice(0, 420) : null,
    markerShown: marker ? marker.display !== 'none' : null,
  }
}

/** Feed each raw wire block to the adapter that owns its type; keep what survives. */
function adaptCapture(): unknown[] {
  const raw = (capture as { blocks?: unknown[] }).blocks ?? []
  const out: unknown[] = []
  for (const b of raw) {
    const typed =
      adaptTypedReviewCardBlock(b) ?? adaptTypedCoachingBlock(b) ?? adaptTypedEvidenceBlock(b)
    if (typed) out.push(typed)
  }
  return out
}

/**
 * @param keep leave the mounted host in the page so the caller can photograph
 *   it. The pseudo-element query for the disclosure marker is NOT trustworthy
 *   on modern Chromium (`::-webkit-details-marker` is legacy; the live marker
 *   is `::marker`, suppressed by `list-style:none`), so whether a triangle is
 *   actually drawn is settled by LOOKING, not by `getComputedStyle`.
 */
export async function measureCoachingDensity(
  compact: boolean,
  keep = false,
): Promise<DensityReading> {
  // The flag is read at RENDER time by `InlineBlocks.renderEntry` and
  // `makeFlag` re-reads localStorage on every call (no memoisation), so
  // setting it here genuinely selects the arm.
  try {
    localStorage.setItem('feature.compactCoachingLines', compact ? 'true' : 'false')
  } catch {
    /* a storage failure must not read as a passing measurement — see errs */
  }

  const host = document.createElement('div')
  host.id = 'measure-host'
  host.style.cssText =
    `position:fixed;top:0;left:0;width:${DOCK_W}px;height:772px;` +
    'display:flex;flex-direction:column;z-index:99999;background:#fff;overflow:auto'
  document.body.appendChild(host)

  const blocks = adaptCapture()
  const messages = [
    { id: 'u1', role: 'user', content: 'Which pricing option should we go with?' },
    {
      id: 'a1',
      role: 'assistant',
      content: (capture as { assistant_text?: string }).assistant_text ?? '',
      isStreaming: false,
      blocks,
    },
  ] as unknown as ConversationMessage[]

  const props = {
    messages,
    isThinking: false,
    longRunningHint: null,
    nodeCount: 12,
    patchBlockStates: new Map(),
    patchRejections: new Map(),
    onChipClick: async () => {},
    onPatchAccept: () => {},
    onPatchDismiss: () => {},
    onFeedback: () => {},
    onRetry: () => {},
    compact: true,
  } as unknown as React.ComponentProps<typeof ChatThread>

  const errs: string[] = []
  const origErr = console.error
  console.error = (...a: unknown[]) => {
    errs.push(String(a[0]).slice(0, 300))
    origErr(...a)
  }

  const root = createRoot(host)
  root.render(createElement(ChatThread, props))
  await settle()
  await settle()

  const bubble = host.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
  // ⚠ SCROLL-CORRECTED, and that correction is load-bearing. An earlier
  // revision measured `getBoundingClientRect().top` against the scroll
  // CONTAINER's fixed top, so a shorter turn (which scrolls less) reported its
  // first point as FARTHER down — the compact arm read 315px against the full
  // arm's 184px, the opposite of the truth. Offsets below are taken in the
  // container's own scrolled coordinates, where scroll position cancels.
  const scrollTop = bubble?.scrollTop ?? 0
  const turnTop = (bubble?.getBoundingClientRect().top ?? 0) - scrollTop

  const lineEls = [...host.querySelectorAll('details[data-testid^="coaching-line-"]')] as HTMLElement[]
  const blockEls = [...host.querySelectorAll('[data-block-id]')] as HTMLElement[]

  const lines = lineEls.map(boxOf)
  const blockBoxes = blockEls.map(boxOf)

  const firstPoint = lineEls[0] ?? blockEls[0] ?? null
  const dockBottom = host.getBoundingClientRect().bottom

  const reading: DensityReading = {
    blocks: blockBoxes,
    lines,
    firstPointOffset: firstPoint
      ? Math.round(firstPoint.getBoundingClientRect().top - turnTop)
      : null,
    // The THREAD is the scroller, not the host: an earlier revision read
    // `host.scrollHeight` and got exactly the host's fixed 772px in both arms —
    // a constant, which is the signature of measuring the wrong box.
    turnHeight: Math.round(bubble?.scrollHeight ?? host.scrollHeight),
    // A box counts as visible only if its WHOLE height is inside the dock.
    visibleBlockCount: (lineEls.length > 0 ? lineEls : blockEls).filter((el) => {
      const r = el.getBoundingClientRect()
      return r.height > 0 && r.top >= (bubble?.getBoundingClientRect().top ?? 0) - 1
        && r.bottom <= dockBottom + 1
    }).length,
    errs: errs.slice(0, 6),
  }

  console.error = origErr
  if (!keep) {
    root.unmount()
    host.remove()
  }
  return reading
}

/** Open the Nth compact line, so a photograph can show the disclosure working. */
export async function openLine(n: number): Promise<boolean> {
  const el = document.querySelectorAll('#measure-host details[data-testid^="coaching-line-"]')[n] as
    | HTMLDetailsElement
    | undefined
  if (!el) return false
  el.open = true
  await settle()
  return true
}
