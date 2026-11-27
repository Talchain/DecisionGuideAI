import { controls } from '../../styles/controls'
import { useState } from 'react'
import type { View, ViewModel } from '../client'
import { optionCards } from '../layout'
import { Hover } from '../look/Hover'
import { pressCard, ringFrom } from '../reasoning/tabRing'
import { figureRange } from '../v12/contract'
import { useHasShowCamera } from '../v12/showInWorkspace/cameraPort'
import { recordReach, showRecord } from '../v12/showInWorkspace/show'
import { cardOf, findOutOf } from './pick'
import { TYPE } from './type'
import { FindOutRanking, type Whose } from './WhatMovesIt'

const ESTIMATE_AUTHORS: readonly Whose[] = ['olumi', 'mixed']

type MissingInput = { aim: string | null; text: string; at: string; refs: string[] }

export function missingInputsOf(model: ViewModel): MissingInput[] {
  const groups = new Map<string, MissingInput>()
  for (const card of optionCards(model)) {
    card.rows.forEach((row, j) => {
      if (row.kind !== 'none' || !row.next_test || row.aim_role === 'reference') return
      const key = JSON.stringify([row.aim_id, row.next_test])
      let group = groups.get(key)
      if (group === undefined) {
        group = { aim: row.aim_id, text: row.next_test, at: `${card.id}.rows.${j}`, refs: [] }
        groups.set(key, group)
      }
      for (const { ref, role } of row.blocked_by ?? []) {
        if (role === 'figure' && !group.refs.includes(ref)) group.refs.push(ref)
      }
    })
  }
  return [...groups.values()]
}

export function estimateChangesOf(view: View) {
  const { model, proposal } = view
  if (model === null) return []
  return (proposal?.changes ?? []).flatMap((change, i) => {
    if (change.top) return []
    const card = cardOf(model, change.id)
    if (card?.family !== 'quantity' || card.change?.kind !== 'added' || figureRange(card) === null) return []
    const by = card.author?.by
    return by === 'olumi' || by === 'mixed' ? [{ i, card }] : []
  })
}

export const NOT_RANKED_YET = 'Not ranked yet'

type Place = 'pending' | 'asks'

function checkFirstOf(view: View, place: Place) {
  const { model } = view
  const run = model?.run ?? null
  const { aims } = findOutOf(run)
  const ranked = aims.reduce((count, { aim }) =>
    count + aim.figures.filter(({ whose }) => ESTIMATE_AUTHORS.includes(whose)).length, 0)
  const inputs = aims.length === 0 && model !== null ? missingInputsOf(model) : []
  const estimates = aims.length === 0 && place === 'pending' ? estimateChangesOf(view) : []
  return { run, ranked, inputs, estimates, count: ranked + inputs.length + estimates.length }
}

export function checkFirstCount(view: View, place: Place): number {
  return checkFirstOf(view, place).count
}

export function CheckFirst({ view, place }: { view: View; place: Place }) {
  const [, redraw] = useState(0)
  const canvas = useHasShowCamera()
  const { run, ranked, inputs, estimates, count } = checkFirstOf(view, place)
  const { model } = view
  if (model === null || count === 0) return null
  return (
    <div data-testid="check-first" data-check-first={place}>
      {ranked > 0 ? <FindOutRanking run={run} only={ESTIMATE_AUTHORS} edit={place === 'asks'} /> : null}
      {inputs.map(({ at, text, refs }) => {
        const target = refs.length === 1 ? cardOf(model, refs[0]) : null
        const reach = target === null || !canvas ? null : recordReach(target.id)
        if (target === null || reach === null) return <p key={at} className={`${TYPE.meta} m-0 text-text-body`} data-check-first-input="" data-view={`${at}.next_test`}>{text}</p>
        const { id } = target
        const ring = () => ringFrom('check-first', [id])
        const clear = () => ringFrom('check-first', [])
        return (
          <Hover key={at} as="button" type="button" words={undefined}
            className={`${controls.chipText} block text-left text-text-body underline-offset-2 hover:underline`}
            data-check-first-target={id} data-view={`${at}.next_test`}
            onClick={() => {
              const now = recordReach(id)
              if (now === 'show') void showRecord(id)
              else if (now === 'card') pressCard(id)
              else redraw((n) => n + 1)
            }}
            onFocus={ring} onMouseEnter={ring} onBlur={clear} onMouseLeave={clear}>{text}</Hover>
        )
      })}
      {estimates.length === 0 ? null : (
        <>
          <p className={`${TYPE.meta} m-0 text-text-light`} data-testid="check-first-unranked">{NOT_RANKED_YET}</p>
          <ul className="m-0 list-none space-y-1 p-0">
            {estimates.map(({ i, card }) => (
              <li key={i} className={`${TYPE.meta} text-text-body`}>
                <span data-view={`${card.id}.heading`}>{card.heading}</span>
                <span className="ok-an-detail" data-view={`${card.id}.figure.text`}>{card.figure?.text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
