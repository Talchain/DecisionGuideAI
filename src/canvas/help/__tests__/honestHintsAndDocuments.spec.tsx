/**
 * HINTS AND EMPTY-STATE COPY THAT A TESTER CAN ACT ON (29 Aug 2026).
 *
 * Three promises wider than the controls behind them, all on paths a Monday
 * tester reaches unaided. Each was confirmed at this tip before being changed.
 *
 * 1. THE LEGEND CLAIMED `Esc` STOPS A RUN. Nothing anywhere cancels a run, and
 *    the capability does not exist: `OutputsDock.tsx:3099` records that the
 *    Cancel button was DELIBERATELY REMOVED for exactly this reason — "a
 *    Cancel that cannot cancel". The legend was the second site making the
 *    promise the button was deleted for. Measured: `cancelRun|stopRun` occurs
 *    once in all of `src/` and that occurrence is the comment above; the
 *    contrast control `key === 'Escape'` appears in 72 files, so the probe was
 *    not blind — Escape is bound everywhere, just never to stopping a run.
 *    ⚠ THIS IS THE ONE THAT COSTS A TESTER MOST: fire a long run, want out,
 *    hammer Esc, conclude the product has frozen.
 *
 * 2. `Cmd/Ctrl + D` WAS DOCUMENTED AS A TOGGLE. `ReactFlowGraph`'s
 *    `showDocuments` only ever calls `setShowDocumentsDrawer(true)` — it has
 *    no close branch — so the second press, which is the first thing anyone
 *    tries, does nothing.
 *
 * 3. THE DOCUMENTS DRAWER SAID OLUMI WOULD CONSIDER THE FILES. It does not
 *    receive them. Measured with a contrast control in one run: `documents`
 *    occurs 0 times in `src/v5/buildPayload.ts`,
 *    `src/services/turn-request-builder.ts` and `src/adapters/cee/client.ts`,
 *    while `nodes` occurs 1 / 4 / 29 times in those SAME three files. Upload
 *    writes to `canvasStore.documents` and stops there. The drawer also
 *    advertised PDF while the reader is `await file.text()`, which turns a PDF
 *    into binary noise.
 *
 * These are source-level assertions for the same reason as
 * `collabParticipantRouteIsPublic.spec.tsx`: the property is what the copy
 * SAYS, and both files need heavy canvas context to render. Every assertion
 * carries a contrast control in the same file.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('keyboard legend promises only what is bound', () => {
  const legend = () => read('src/canvas/help/KeyboardLegend.tsx')

  it('does not claim Esc stops a run — no run-cancel capability exists', () => {
    const src = legend()
    expect(src).not.toMatch(/stop run/i)
    // CONTRAST CONTROL: the Esc entry is still there, describing what it does.
    expect(src).toMatch(/'Esc'/)
    expect(src).toMatch(/close active overlay/i)
  })

  it('does not call Cmd/Ctrl+D a toggle — the handler only opens', () => {
    const src = legend()
    expect(src).not.toMatch(/toggle documents/i)
    // CONTRAST: the binding is still documented, just honestly.
    expect(src).toMatch(/Cmd\/Ctrl \+ D/)
    expect(src).toMatch(/open documents/i)
  })

  it('POSITIVE CONTROL: the claims this file makes that ARE bound are intact', () => {
    const src = legend()
    expect(src).toMatch(/Run analysis/)
    expect(src).toMatch(/Cmd\/Ctrl \+ Enter/)
  })
})

describe('documents drawer says what actually happens to a file', () => {
  const drawer = () => read('src/canvas/components/DocumentsManager.tsx')

  it('does not claim Olumi considers the uploaded files', () => {
    const src = drawer()
    expect(src).not.toMatch(/Olumi should consider/i)
    // CONTRAST: the empty state still exists and still explains the drawer.
    expect(src).toMatch(/No documents/i)
  })

  it('does not advertise PDF, which the text reader cannot parse', () => {
    const src = drawer()
    expect(src).not.toContain('.pdf')
    expect(src).not.toMatch(/Supports: PDF/)
    // CONTRAST: the formats that DO work are still advertised and accepted.
    expect(src).toContain('.txt')
    expect(src).toMatch(/TXT, MD, CSV/)
  })
})
