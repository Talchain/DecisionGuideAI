/**
 * v10's chip for a reply's next move (core's `chat[].answer.next.move` and `next.label`), which poc-core-server mounts on Olumi's note:
 * the icon by move, core's label verbatim, nothing for a move with no chip, and a press that carries no text (the caller sends
 * { move, at }).
 */
import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render } from '@testing-library/react'
import { V10_MOVE_ICONS, V10MoveChip } from '../V10MethodChips'

const DIR = path.resolve('src/olumiView/golden')
const nexts: { move: string; label: string }[] = []
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.view.json'))) {
  const v = JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as { chat?: { answer: { next: { move?: string; label: string } } | null }[] }
  for (const t of v.chat ?? []) if (t.answer?.next.move) nexts.push({ move: t.answer.next.move, label: t.answer.next.label })
}

describe('v10 move chips', () => {
  it('the icons cover exactly core\'s moves (olumi-core src/contract/form.ts MOVES at 685e725), other_method aside', () => {
    const CORE_MOVES = ['widen_options', 'outside_view', 'pre_mortem', 'what_would_change_your_mind', 'define_success', 'gather_evidence', 'other_method']
    expect(Object.keys(V10_MOVE_ICONS).sort()).toEqual(CORE_MOVES.filter((m) => m !== 'other_method').sort())
  })

  it('each next step in core\'s goldens draws core\'s own label verbatim, and a press calls onPress with no text', () => {
    expect(nexts.length).toBeGreaterThan(0) // the probe reads real next steps
    for (const { move, label } of nexts) {
      const onPress = vi.fn()
      const chip = render(<V10MoveChip move={move} label={label} onPress={onPress} />).container.querySelector<HTMLButtonElement>(`[data-testid="v10-move-${move}"]`)
      if (move === 'other_method') { expect(chip).toBeNull(); continue }
      expect(chip!.textContent, move).toBe(label)
      fireEvent.click(chip!)
      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onPress.mock.calls[0]).toEqual([])
    }
  })

  it('a move with no chip (other_method, unknown, missing) draws nothing', () => {
    for (const m of ['other_method', 'not_a_move', null, undefined]) expect(render(<V10MoveChip move={m} label="x" onPress={() => {}} />).container.innerHTML).toBe('')
  })
})
