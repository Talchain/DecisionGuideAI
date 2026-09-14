/**
 * THE CAVEAT REACHES THE SCREEN.
 *
 * ⭐ WHY THIS FILE EXISTS AND WHY IT IS NOT OPTIONAL. Paul ruled on 8 Sep 2026:
 * *keep the highlight, add a visible caveat.* The applicator's spec proves the
 * caveat is DELIVERED to the attention channel. It cannot prove the user can
 * READ it — and this estate's most expensive defect class is a capability that
 * is computed, transported, and never rendered. Between DELIVERED and VISIBLE
 * sits exactly one component, and this is it.
 *
 * The load-bearing case is the SECOND one: before this change the card returned
 * `null` whenever there was no `note`, and the applicator's caveat rides a hold
 * that carries no note at all on the ordinary path. The card would have drawn
 * the mark, dimmed the canvas around it, and said nothing — the original defect,
 * reproduced one layer down.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import type { OlumiAttentionCaveat, OlumiAttentionNote } from '../../utils/olumiAttention'

vi.mock('@xyflow/react', () => ({
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) =>
    selector({ transform: [0, 0, 1] }),
}))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({
  openAskOlumi: vi.fn(),
}))

const ANCHOR = 'opt_mac'

const caveat: OlumiAttentionCaveat = {
  text: 'Marked because it scored highest so far — not because Olumi is putting it forward.',
  sourceLine: 'Two options are within the resolution of this run.',
}

const note: OlumiAttentionNote = {
  move: 'challenge',
  title: 'This link is doing a lot of work',
  body: 'The ranking flips if this weakens.',
}

function hold(next: {
  note?: OlumiAttentionNote | null
  caveat?: OlumiAttentionCaveat | null
}) {
  useCanvasStore.setState({
    nodes: [{ id: ANCHOR, type: 'option', position: { x: 0, y: 0 }, data: {} } as never],
    edges: [],
    olumiAttention: {
      nodeIds: [ANCHOR],
      edgeIds: [],
      note: next.note ?? null,
      caveat: next.caveat ?? null,
      turnId: null,
      modelVersion: null,
    },
  })
}

const CAVEAT_TESTID = `${OLUMI_ATTENTION_CARD_TESTID}-caveat`
const REASON_TESTID = `${OLUMI_ATTENTION_CARD_TESTID}-caveat-reason`

describe('OlumiAttentionCard — a caveat is visible', () => {
  beforeEach(() => {
    cleanup()
    useCanvasStore.setState({ olumiAttention: null })
  })

  it('⭐ A CAVEAT WITH NO NOTE STILL RENDERS — the card is not gated on coaching', () => {
    hold({ caveat })
    render(<OlumiAttentionCard />)

    // PRECONDITION PINNED IN-TEST: this hold really does carry no note, so a
    // rendered card below is the caveat's doing and not a note sneaking in.
    expect(useCanvasStore.getState().olumiAttention?.note).toBeNull()

    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)).toBeTruthy()
    expect(screen.getByTestId(CAVEAT_TESTID).textContent).toBe(caveat.text)
  })

  it("the producer's own reason renders verbatim beneath it", () => {
    hold({ caveat })
    render(<OlumiAttentionCard />)
    expect(screen.getByTestId(REASON_TESTID).textContent).toBe(caveat.sourceLine)
  })

  it('a caveat with no reason renders the caveat and no empty reason line', () => {
    hold({ caveat: { text: caveat.text } })
    render(<OlumiAttentionCard />)
    expect(screen.getByTestId(CAVEAT_TESTID).textContent).toBe(caveat.text)
    expect(screen.queryByTestId(REASON_TESTID)).toBeNull()
  })

  it('BOTH AT ONCE: coaching and caveat are rendered as separate lines', () => {
    hold({ note, caveat })
    render(<OlumiAttentionCard />)
    // The note's body and the caveat are DIFFERENT elements. Folding the
    // disclosure into the coaching channel is the defect the split exists to
    // prevent, and it would look identical to a reader of the rendered text.
    expect(screen.getByTestId(CAVEAT_TESTID).textContent).toBe(caveat.text)
    expect(screen.getByText(note.body)).toBeTruthy()
    expect(screen.getByText(note.title)).toBeTruthy()
  })

  /*
   * ⭐ THE OPPOSITE-DIRECTION TWIN. A card that showed a caveat line on every
   * hold would hedge coaching the product IS entitled to give — a different
   * defect, and one the assertions above cannot see on their own.
   */
  it('NO CAVEAT: a note-only hold renders the card with no caveat line at all', () => {
    hold({ note })
    render(<OlumiAttentionCard />)
    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)).toBeTruthy()
    expect(screen.queryByTestId(CAVEAT_TESTID)).toBeNull()
    expect(screen.queryByTestId(REASON_TESTID)).toBeNull()
  })

  it('NEITHER: a hold with no note and no caveat renders nothing, exactly as before', () => {
    hold({})
    render(<OlumiAttentionCard />)
    expect(screen.queryByTestId(OLUMI_ATTENTION_CARD_TESTID)).toBeNull()
  })
})
