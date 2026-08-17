/**
 * COLLAB — IS THE CITATION MOUNTED, on the surfaces the deployed flags render.
 *
 * ── WHY THIS SUITE IS A SOURCE ASSERTION AND NOT A RENDER TEST ────────────
 * `citedEvidenceReadback.spec.tsx` proves the resolution and the copy. It cannot
 * prove the component has a PRODUCT CALL SITE — and that is the failure mode this
 * whole slice exists to reverse: CEE has written `evidence_event_id` since
 * 0.41.0, the write path is wire-witnessed, and it reached no user because
 * nothing read it back. A green resolution suite over a component with zero call
 * sites is exactly the shape of "we build more than we plug in".
 *
 * The estate has shipped this defect twice in one feature already (row 2.466's
 * grounding badge, then its negative twin at 2.491): every render test and every
 * mutant passed while pointing at a component the deployed flags do not mount.
 * So this asserts the MOUNT PATH itself, by name, in the files a DOM census of
 * real captures shows are live.
 *
 * ── THE THREE PANELS ARE THE MOUNTED SURFACES ─────────────────────────────
 * `FactorObservablePanel`, `FactorControllablePanel` and `FactorExternalPanel`
 * are where `useParticipantName` was mounted for D1 and where the attribution
 * pill renders today. They are named in the row that diagnosed this gap
 * (`FactorExternalPanel.tsx:83`, `FactorControllablePanel.tsx:119`,
 * `FactorObservablePanel.tsx:81`). The citation must reach the same three, or it
 * is dark on whichever one it misses.
 *
 * ── ⚠ A SOURCE GREP IS A WEAK INSTRUMENT AND IS USED DELIBERATELY NARROWLY ─
 * It proves a call site EXISTS in a file; it cannot prove that file renders for a
 * user. It is the right instrument for exactly one claim — "this component is not
 * orphaned" — and this suite makes no broader one. The rung above it is a browser
 * witness on the deployed build, which no unit suite can supply.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const PANEL_DIR = join(process.cwd(), 'src/canvas/ui/inspector-v2/panels')

const MOUNTED_PANELS = [
  'FactorObservablePanel.tsx',
  'FactorControllablePanel.tsx',
  'FactorExternalPanel.tsx',
] as const

function panelSource(file: string): string {
  return readFileSync(join(PANEL_DIR, file), 'utf8')
}

describe('the citation has a product call site on every mounted factor panel', () => {
  for (const file of MOUNTED_PANELS) {
    it(`${file} resolves the citation AND renders the component`, () => {
      const src = panelSource(file)

      // The positive control for this instrument: the file must contain the D1
      // name resolution it is already known to carry. If this fails, the grep is
      // reading the wrong file and every other assertion here is worthless
      // (trap 13e — a probe needs a contrast that is expected to be PRESENT).
      expect(src, `${file}: instrument control failed — wrong file?`).toContain(
        'useParticipantName(',
      )

      expect(src).toContain('useCitedEvidence(')
      expect(src).toContain('<CitedEvidenceNote')
    })

    it(`${file} feeds the citation hook the SAME wire object as the name hook`, () => {
      const src = panelSource(file)

      /**
       * ⚠ BOUND TO THE ARGUMENT, NOT JUST THE CALL. Both hooks must read
       * `observed_state.elicited_from` — the one object CEE stamps. A citation
       * hook fed anything else (a node id, a target, a hand-built object) would
       * resolve against the wrong round and render another factor's evidence
       * here, which is a fabrication rather than an absence.
       */
      expect(src).toMatch(/useCitedEvidence\(\s*obs\?\.elicited_from/)
      expect(src).toMatch(/useParticipantName\(\s*obs\?\.elicited_from/)
    })
  }

  it('⭐ the mount list is not silently short — every panel using the name hook also cites', () => {
    /**
     * The completeness check a per-file assertion cannot make. Deriving the list
     * from the directory rather than from the constant above means a FOURTH
     * factor panel added later, wired for attribution but not for the citation,
     * turns this red instead of shipping dark — the hand-maintained-mirror
     * defect, closed by derivation.
     */
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    const panels = readdirSync(PANEL_DIR).filter((f) => f.endsWith('.tsx'))
    expect(panels.length).toBeGreaterThan(0)

    const attributing = panels.filter((f) => panelSource(f).includes('useParticipantName('))
    // Control: the set must be non-empty, or the filter proves nothing.
    expect(attributing.length).toBeGreaterThanOrEqual(MOUNTED_PANELS.length)

    const missingCitation = attributing.filter((f) => !panelSource(f).includes('useCitedEvidence('))
    expect(
      missingCitation,
      `these panels resolve a panel attribution but never its citation: ${missingCitation.join(', ')}`,
    ).toEqual([])
  })
})
