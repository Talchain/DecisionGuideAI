/**
 * v10's chip for a reply's next move (core's `chat[].answer.next.move`), which Olumi's note on the canvas mounts (dgai-on-core): every
 * move core's goldens name has a chip unless it names no one move (`other_method`); a press hands back the move's prefix and sends nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render } from '@testing-library/react'
import { V10_MOVES, V10MoveChip } from '../V10MethodChips'

const DIR = path.resolve('src/olumiView/golden')
const moves = new Set<string>()
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.view.json'))) {
  const v = JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as { chat?: { answer: { next: { move?: string } } | null }[] }
  for (const t of v.chat ?? []) if (t.answer?.next.move) moves.add(t.answer.next.move)
}

describe('v10 move chips', () => {
  it('every move core names in its goldens has a chip, except other_method, which names no one move', () => {
    expect(moves.size).toBeGreaterThan(0) // the probe reads real moves
    for (const m of moves) expect(m in V10_MOVES, m).toBe(m !== 'other_method')
  })

  it('the chips cover exactly core\'s moves (olumi-core src/contract/form.ts MOVES at 685e725), other_method aside', () => {
    const CORE_MOVES = ['widen_options', 'outside_view', 'pre_mortem', 'what_would_change_your_mind', 'define_success', 'gather_evidence', 'other_method']
    expect(Object.keys(V10_MOVES).sort()).toEqual(CORE_MOVES.filter((m) => m !== 'other_method').sort())
  })

  it('a press hands back the move\'s prefix and sends nothing; an unknown move or other_method draws no chip', () => {
    const onPick = vi.fn()
    const { container } = render(<V10MoveChip move="pre_mortem" onPick={onPick} />)
    const chip = container.querySelector<HTMLButtonElement>('[data-testid="v10-move-pre_mortem"]')!
    expect(chip.textContent).toBe(V10_MOVES.pre_mortem.label)
    fireEvent.click(chip)
    expect(onPick).toHaveBeenCalledWith(V10_MOVES.pre_mortem.prefix)
    for (const m of ['other_method', 'not_a_move', null, undefined]) expect(render(<V10MoveChip move={m} onPick={onPick} />).container.innerHTML).toBe('')
  })
})
