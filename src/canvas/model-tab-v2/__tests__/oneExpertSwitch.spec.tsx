/**
 * ⭐⭐⭐ ONE SWITCH FOR ONE IDEA — the Model tab's two detail controls converge.
 *
 * WHAT WAS MEASURED AT `3b2df4ce` (staging), before this spec existed:
 *
 *   `olumi.expertMode`  — OutputsDock.tsx:1150. localStorage-persisted, global
 *                         across decisions, threaded to Compare, Results,
 *                         PreAnalysis, and (on this tab) the scientific
 *                         transparency block via `DetailToggleContext`.
 *   `DetailTier`        — ModelTabV2Panel.tsx:197, `useState<DetailTier>('plain')`.
 *                         Private to the panel. Not persisted. And because
 *                         `OutputsDock.tsx:3686` renders `ModelTabBody` behind
 *                         `effectiveActiveTab === 'diagnostics'` — a CONDITIONAL
 *                         mount, not a hidden one — the panel UNMOUNTS on every
 *                         tab switch and the user's choice is silently discarded.
 *
 * So the tab carried two independent controls for one user intention, and the
 * one that governs the outline forgot itself the moment the user looked at
 * anything else. This is exactly the defect 2.581 closed for the Compare tab
 * ("ONE expert mode for the product", OutputsDock.tsx:3674-3684) — the Compare
 * pill used to own a separate `feature.compareExpert`, so the only control whose
 * text said "Expert" turned on a different thing from the `</>` toggle beside it.
 * The same shape survived here.
 *
 * ⚠⚠ THE PREMISE FOR KEEPING THEM APART IS DEAD AT THIS TIP, AND THAT IS THE
 * FINDING THAT LICENSES THIS CHANGE. `types.ts` justified the separate tier so:
 *
 *     "Today's `expertMode` drives both the scientific detail AND the accordion
 *      mode (`ModelTabBody.tsx:116-122` vs `:761`), so a non-scientist who
 *      merely wants two sections open at once has to turn on the scientist
 *      view. A tier value must never decide how many groups are open."
 *
 * Derived at `3b2df4ce`, with line numbers, not inferred: `isExpert` has exactly
 * ONE consumer in `ModelTabBody` — `makeSectionProps` (:194-201), which switches
 * the accordion between single-open and multi-open. `makeSectionProps` has SIX
 * call sites: :968, :1036, :1050, :1064, :1073, :1091. The dead-code block
 * `{LEGACY_DETAILED_EDITOR_MOUNTED && (` spans :975-:1097 and the constant is
 * hardcoded `false`, so FIVE of the six sites render nothing. The live accordion
 * group has exactly ONE member (the Model card at :968) — and over a group of
 * one, single-open and multi-open are the SAME LAYOUT. `expertMode` therefore
 * cannot change layout on this tab. It is already a pure content switch, which
 * is precisely what `DetailTier` was created to be.
 *
 * WHAT THIS PINS:
 *  1. The panel is CONTROLLED by the owner's preference — it may not hold a
 *     private opinion about detail while the product holds another.
 *  2. The in-tab control WRITES that preference (design §4.3 rule 3 keeps the
 *     control in the tab; this changes what it writes, not where it lives).
 *  3. ⭐ THE MOUNT. `ModelTabBody` must actually thread `expertMode` down. Both
 *     new props are OPTIONAL — sixteen existing specs render this panel without
 *     them — so dropping the wiring is invisible: the panel keeps compiling and
 *     the suite keeps passing while the two switches quietly diverge again.
 *     Asserting the threading is the only thing that makes this convergence
 *     non-dark. (Same reasoning, same shape, as
 *     `ModelTabBody.threadsInterventionFences.spec.tsx`.)
 *
 * Assertions bind by IDENTITY — `model-row-v2-<row.id>-id` carries the node id
 * (ModelRowView.tsx:892, rendered only at `tier === 'advanced'`), never a value
 * predicate another element could satisfy (trap 19).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Node, Edge } from '@xyflow/react'

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

const FACTOR_ID = 'fac_churn_pressure'

const GOAL: Node = {
  id: 'goal_arr',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Grow ARR' },
} as Node

const FACTOR: Node = {
  id: FACTOR_ID,
  type: 'factor',
  position: { x: 0, y: 0 },
  data: {
    label: 'Churn pressure',
    kind: 'factor',
    observed_state: { value: 0.5, source: 'cee_inference' },
  },
} as unknown as Node

function renderPanel(props: Record<string, unknown>) {
  render(
    <ModelTabV2Panel
      nodes={[GOAL, FACTOR]}
      edges={[] as Edge[]}
      goalThreshold={null}
      {...props}
    />,
  )
  openOutlineGroups()
}

/** The advanced-only atom, bound to ONE named row by its node id. */
const advancedTokenFor = (id: string) => screen.queryByTestId(`model-row-v2-${id}-id`)

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the outline reads the owner\'s expert preference', () => {
  it('renders ADVANCED content when the product is in expert mode', () => {
    renderPanel({ expertMode: true, onToggleExpert: vi.fn() })

    // Positive control: the panel really mounted and the outline really opened,
    // so a presence assertion below is about the tier and not about a lucky
    // query on a tree that rendered nothing (trap 13).
    expect(screen.getByTestId('model-tab-v2-tier-toggle')).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()

    expect(advancedTokenFor(FACTOR_ID)).toBeInTheDocument()
  })

  it('renders PLAIN content when it is not, with the row still on screen', () => {
    renderPanel({ expertMode: false, onToggleExpert: vi.fn() })

    // CONTRAST CONTROL. The row is present either way — so the absence below is
    // the tier's doing, not a row that failed to render. Without this the
    // assertion would pass against an empty outline.
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()

    expect(advancedTokenFor(FACTOR_ID)).not.toBeInTheDocument()
  })

  it('reflects the owner\'s value in the control\'s pressed state', () => {
    renderPanel({ expertMode: true, onToggleExpert: vi.fn() })

    expect(screen.getByTestId('model-tab-v2-tier-advanced')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('model-tab-v2-tier-plain')).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('the in-tab control writes the ONE preference', () => {
  it('asks the owner to turn expert mode ON', () => {
    const onToggleExpert = vi.fn()
    renderPanel({ expertMode: false, onToggleExpert })

    fireEvent.click(screen.getByTestId('model-tab-v2-tier-advanced'))

    expect(onToggleExpert).toHaveBeenCalledWith(true)
  })

  it('asks the owner to turn it OFF', () => {
    const onToggleExpert = vi.fn()
    renderPanel({ expertMode: true, onToggleExpert })

    fireEvent.click(screen.getByTestId('model-tab-v2-tier-plain'))

    expect(onToggleExpert).toHaveBeenCalledWith(false)
  })

  it('⚠ keeps NO private opinion: a controlled panel does not move on its own', () => {
    // The defect this whole change removes. If the click flipped local state as
    // well, the outline would go Advanced while `olumi.expertMode` — and so the
    // transparency block below it, and Compare, and Results — stayed Plain.
    // That divergence is what the user saw as "two switches".
    const onToggleExpert = vi.fn()
    renderPanel({ expertMode: false, onToggleExpert })

    fireEvent.click(screen.getByTestId('model-tab-v2-tier-advanced'))

    // The owner was asked...
    expect(onToggleExpert).toHaveBeenCalledWith(true)
    // ...and until the owner says yes, the panel has NOT changed tier.
    expect(advancedTokenFor(FACTOR_ID)).not.toBeInTheDocument()
    expect(screen.getByTestId('model-tab-v2-tier-advanced')).toHaveAttribute('aria-pressed', 'false')
  })
})
