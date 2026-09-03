/**
 * ⭐ THE INSPECTOR'S WIN-PROBABILITY CAPTION — THE ASSERTION A COMMENT SAID
 * ALREADY EXISTED.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * `metricNounVocabulary.canvas.spec.ts` sweeps `src/canvas/nodes` and states
 * its scope honestly: panels are not swept, because the inspector renders
 * long-form prose where a bare-literal ban would fire on legitimate sentences.
 * It then said, of the fourth retired word:
 *
 *     "The inspector's caption is pinned by its own render assertion instead."
 *
 * **There was no such assertion.** The round-2 review of #1160 settled it by
 * mutation rather than by grep: reverting `OptionPanel.tsx` to the retired
 * "Chance of leading" SURVIVED 129 test files / 1612 tests, all green, with the
 * reviewer's contrast controls firing. `Chance of leading` had exactly three
 * occurrences in `src/` — the register, that comment, and a NEGATIVE assertion
 * about a different surface.
 *
 * ⛔ THAT IS CLAUDE.md TRAP 14 INSIDE THE CHANGE WRITTEN TO ABOLISH IT: an
 * honest gap in a comment is fine; a false claim of coverage is worse than
 * silence, because it teaches the next reader to stop looking. The comment has
 * been corrected AND the assertion it described now exists — this file. The
 * gap was real, so the fix is the test, not just the wording.
 *
 * ── HOW THIS BINDS ───────────────────────────────────────────────────────
 * · ⭐ MOUNTS `InspectorModal`, THE DEPLOYED PATH, never `OptionPanel`
 *   directly — the chain `ReactFlowGraph.tsx` opens on a node double-click
 *   (`InspectorModal` → v2 branch → `InspectorRouter` → `OptionPanel`). A spec
 *   that renders the panel directly stays green whatever the router does, and
 *   this estate has shipped that defect twice (trap 3b).
 * · ⭐ `winRate` IS DERIVED, NOT MOCKED. The store is seeded with a real
 *   `option_probabilities` report and `useNodeDisplayMetadata` reads it, so the
 *   hero this asserts on is the one a run actually produces. A caption pinned
 *   on a hand-mocked metadata object would prove the string exists in the file,
 *   which is what the source sweep already does and is not the gap.
 * · ⭐ EVERY ABSENCE HAS A PRECONDITION PINNED IN-TEST. "The retired phrase is
 *   not on screen" is satisfied by an inspector that failed to open, by a hero
 *   that did not render, and by a typo in the query. So each absence assertion
 *   is preceded by the POSITIVE it depends on — the figure is on screen and the
 *   live noun captions it — and the retired-phrase sweep runs against the same
 *   `textContent` the positive was read from (trap 13).
 * · The caption is compared to `METRIC_NOUN.ahead` BY REFERENCE. Writing
 *   "Ahead" literally here would create the second authority the register
 *   exists to abolish; `metricVocabulary.spec.ts` already pins the register's
 *   own value with `toBe`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'

import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'
import { METRIC_NOUN, RETIRED_METRIC_NOUNS } from '../../../nodes/shared/metricVocabulary'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare `{ useViewport }` factory silently removes every other
// @xyflow/react export the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const INSPECTOR_SHELL = '[role="region"][aria-label="Inspector panel"]'

const OPTION_ID = 'opt-phased'
const OPTION_LABEL = 'Phased migration'
const RIVAL_ID = 'opt-full'
const RIVAL_LABEL = 'Full switch'

/** The retired inspector caption, read from the register rather than re-typed. */
const RETIRED_INSPECTOR_CAPTION = 'Chance of leading'

function optionNode(id: string, label: string) {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label, provenance: 'ai_inferred', interventions: {} },
  }
}

/**
 * A completed run in which this option leads.
 *
 * `useNodeDisplayMetadata:542` reads `win_probability` off
 * `report.option_probabilities[nodeId]` and suppresses it when the status is
 * `'failed'`, so the status is set to the arm that PRODUCES a figure —
 * otherwise the hero never mounts and every assertion below is vacuous.
 */
function seedCompletedRun() {
  useCanvasStore.setState({
    nodes: [optionNode(OPTION_ID, OPTION_LABEL), optionNode(RIVAL_ID, RIVAL_LABEL)] as never[],
    edges: [],
    results: {
      status: 'complete',
      report: {
        option_probabilities: {
          [OPTION_ID]: { win_probability: 0.62, status: 'ok' },
          [RIVAL_ID]: { win_probability: 0.38, status: 'ok' },
        },
        option_comparison: [
          { option_id: OPTION_ID, win_probability: 0.62, label: OPTION_LABEL },
          { option_id: RIVAL_ID, win_probability: 0.38, label: RIVAL_LABEL },
        ],
      },
    },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

/** Mounts the DEPLOYED inspector chain and PROVES IT OPENED before returning. */
function openInspector(nodeId: string) {
  const utils = render(<InspectorModal nodeId={nodeId} edgeId={null} onClose={vi.fn()} />)
  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  expect(
    utils.container.querySelector(INSPECTOR_SHELL),
    'PRECONDITION: the InspectorShell must have rendered inside it',
  ).not.toBeNull()
  return { ...utils, dialog: dialog as HTMLElement }
}

beforeEach(() => {
  vi.clearAllMocks()
  seedCompletedRun()
})

describe("the option inspector captions the win probability with the canvas's noun", () => {
  it('⭐ the caption beside the figure IS METRIC_NOUN.ahead, on the deployed mount path', () => {
    const { dialog } = openInspector(OPTION_ID)

    // PRECONDITION 1 — the OPTION panel is what opened, identified by
    // `OptionPanel`'s OWN markup rather than by anything this test rendered
    // (trap 3b). `getByText(OPTION_LABEL)` was the first spelling and threw:
    // the label is rendered twice, in the header and in the comparison row.
    expect(
      dialog.querySelector('[data-panel-group="impact"]'),
      "PRECONDITION: OptionPanel's own impact group must be on screen",
    ).not.toBeNull()
    expect(
      within(dialog).getAllByText(OPTION_LABEL).length,
      'PRECONDITION: the inspector opened on the option this test seeded',
    ).toBeGreaterThan(0)

    // ⭐ THE CAPTION, AND THE FIGURE IT CAPTIONS, BOUND BY ADJACENCY.
    //
    // ⚠ `getByText('62%')` was the first spelling and it is WRONG here: the
    // pane renders that figure TWICE — once in the hero and once in the
    // comparison row beneath it — so the query resolved to whichever came
    // first and the assertion would have been about a different element than
    // the one it names (trap 19). Going the other way is unambiguous: the
    // caption is unique, and the hero's own markup puts the figure
    // IMMEDIATELY BEFORE it. That ordering is the claim — a caption that stops
    // sitting beside its number is exactly as broken as a caption with the
    // wrong word in it.
    const caption = within(dialog).getByText(METRIC_NOUN.ahead)
    expect(
      caption.previousElementSibling?.textContent?.trim(),
      `"${METRIC_NOUN.ahead}" is on screen but is not captioning the win-probability figure`,
    ).toBe('62%')
  })

  it('⭐ the retired "Chance of leading" is nowhere on the option inspector', () => {
    const { dialog } = openInspector(OPTION_ID)

    // The same precondition, restated in THIS test: an absence assertion in a
    // test whose surface never mounted is the vacuity trap 13 exists for, and
    // it is not inherited from the test above.
    expect(
      within(dialog).getByText(METRIC_NOUN.ahead).previousElementSibling?.textContent?.trim(),
      'PRECONDITION: the win-probability hero must be on screen for this absence to mean anything',
    ).toBe('62%')

    const copy = dialog.textContent ?? ''
    // CONTRAST CONTROL: the instrument can see this surface's text at all —
    // and specifically the live noun, so a blank read cannot pass as a clean one.
    expect(copy, 'the inspector read as empty — this absence assertion is vacuous').toContain(
      METRIC_NOUN.ahead,
    )
    expect(copy).toContain('62%')

    expect(copy, 'the retired inspector caption is back on screen').not.toContain(
      RETIRED_INSPECTOR_CAPTION,
    )
  })

  it('the retired phrase this pins is the one the register retired', () => {
    // Binds the literal above to the register, so a rename in one place cannot
    // leave this file silently guarding a string nothing renders any more.
    expect(RETIRED_METRIC_NOUNS as readonly string[]).toContain(RETIRED_INSPECTOR_CAPTION)
    expect(Object.values(METRIC_NOUN) as string[]).not.toContain(RETIRED_INSPECTOR_CAPTION)
  })
})
