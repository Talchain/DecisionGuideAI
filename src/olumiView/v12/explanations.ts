import { createElement, useMemo, type ReactElement, type ReactNode } from 'react'
import { typography } from '../../styles/typography'
import { shownModel, useViewStore } from '../store'
import type { View, ViewModel, ViewRun } from '../client'
import { FigureEdit } from '../FigureEdit'
import { AnsweredList } from '../reasoning/AnswerBox'
import { examinedOf } from '../reasoning/answer'
import { useWhatIf } from '../whatif'
import { isForThisPage, useMe } from '../../olumiCore/me'
import { linkOf } from '../../olumiCore/team/EvidencePanel'
import { ownViewPending } from '../../olumiCore/ownViewFirst'
import type { LoopSteps } from './charts/LoopDots'

// Both tabs and the foot row use the same record IDs and joins.
type Rest = ViewRun['rests'][number]
export const AUTHOR_LABELS = { olumi: 'Olumi’s', theirs: 'People’s', mixed: 'Both' } as const

type Passage = { id: string; title: ReactNode; content: ReactNode }
export type ExplanationRecord = { id: string; title: string; titlePath?: string; passages: Passage[] }

type ViewText = { text: string; path: string }

const words = (value: ViewText) => createElement('span', { key: value.path, 'data-view': value.path }, value.text)

function joined(values: readonly (string | ViewText | ReactElement | null)[]): ReactNode[] {
  return values.filter((value): value is string | ViewText | ReactElement => value !== null)
    .flatMap((value, index) => {
      const part = typeof value === 'string' || !('path' in value) ? value : words(value)
      return index === 0 ? [part] : [' · ', part]
    })
}

const paragraph = (content: ReactNode, path?: string, key = path) =>
  createElement('p', { key, className: `ok-loop-copy ${typography.viewPanelBody}`, 'data-view': path }, content)

export const figuresOf = (r: Rest) => (r.figures ?? []).map((f, j) => ({ f, j }))
  .filter(({ f }) => Number.isFinite(f.share))
  .sort((a, b) => b.f.share - a.f.share)
export const groupsOf = (run: ViewRun | null) => (run?.rests ?? []).map((r, k) => ({ r, k })).filter(({ r }) => r.line !== '')
// The older answer reader expects strings. A current View is allowed to omit the
// question or supplied words while still providing a finding and source turn.
function examinationView(view: View | null): View | null {
  if (!Array.isArray(view?.reasoning?.examined)) return view
  return { ...view, reasoning: { examined: view.reasoning.examined.map((x) => ({
    ...x, question: x.question ?? '', supplied: { ...x.supplied, text: x.supplied.text ?? '' },
  })) } }
}

export const statusId = (status: string, group?: Rest) => group && status === 'next' ? JSON.stringify([status, group.aim]) : status
export const figurePassage = (group: Rest) => JSON.stringify(['share', group.id])
export const groupPassage = (group: Rest) => JSON.stringify(['rest', group.id])

export function useExplanationScope(model: ViewModel | null): string {
  const view = useViewStore((s) => s.view)
  const past = useViewStore((s) => s.at)
  const sid = useViewStore((s) => s.sid)
  const whatIf = useWhatIf((s) => s.shown)
  const tried = model && whatIf !== null && whatIf.sid === sid && whatIf.base === model.edit_base ? whatIf : null
  return JSON.stringify([view?.id, view?.you_id, view?.version?.id, past, view?.proposal?.id, tried?.quantity, tried?.typed])
}

export function loopOf(model: ViewModel, view: View | null, record: string, group?: Rest) {
  const card = model.cards.find((c) => c.id === record)
  const premises = card?.premises ?? []
  const authorship = card?.author
  const basis = card?.rests_on ?? []
  const evidence = (view?.evidence ?? []).map((e, i) => ({ e, path: `evidence.${i}` }))
    .filter(({ e }) => e.concerns.includes(record))
  const history = examinedOf(examinationView(view)).filter((x) => x.about === record)
  const run = model.run
  const next = (run?.find_out ?? []).flatMap((entry, i) => {
    if (group !== undefined && entry.aim !== group.aim) return []
    const path = `run.find_out.${i}`
    return entry.figures.flatMap((figure, j) => figure.id === record
      ? [{ entry, figure, path, figurePath: `${path}.figures.${j}` }] : [])
  })
  const cautions = card?.worth_checking ?? []
  const steps: LoopSteps = [premises.length > 0 || basis.length > 0 || authorship != null, evidence.length > 0, history.length > 0, next.length > 0]
  return { card, premises, authorship, basis, evidence, history, next, cautions, steps }
}

export function loopValues(loop: ReturnType<typeof loopOf>) {
  const { card, premises, authorship, basis, evidence, history, next, cautions } = loop
  const considered = evidence.filter(({ e }) => e.considered != null).length
  const assumptionCount = premises.length ? `${premises.length} ${premises.length === 1 ? 'premise' : 'premises'}`
    : basis.length ? `${basis.length} underlying figures` : null
  const assumption = joined([authorship?.text ? { text: authorship.text, path: `${card!.id}.author.text` } : null, assumptionCount])
  const firstNext = next[0]
  const caution = cautions[0]
  return [
    assumption.length ? assumption : 'No assumption recorded',
    evidence.length ? `${evidence.length} linked · ${considered} considered` : 'No evidence linked',
    history.length ? `${history.length} ${history.length === 1 ? 'answer' : 'answers'} recorded` : 'Still open',
    firstNext ? (firstNext.figure.line ? words({ text: firstNext.figure.line, path: `${firstNext.figurePath}.line` }) : null)
      : caution ? words({ text: caution.title, path: `${card!.id}.worth_checking.0.title` }) : 'No next action recorded',
  ] as const
}

function explanationRecords(model: ViewModel, source: View): ExplanationRecord[] {
  const view = examinationView(source) ?? source
  const groups = groupsOf(model.run ?? null)
  const records: ExplanationRecord[] = []
  const heading = (id: string, fallbackPath: string): ViewText => {
    const card = model.cards.find((c) => c.id === id)
    return card ? { text: card.heading, path: `${card.id}.heading` } : { text: id, path: fallbackPath }
  }

  for (const card of model.cards) {
    const loop = loopOf(model, view, card.id)
    const related = groups.filter(({ r }) => figuresOf(r).some(({ f }) => f.id === card.id))
    const passages: Passage[] = []
    if (related.length || loop.steps.some(Boolean) || loop.cautions.length) {
      const [assumed, evidence, examined] = loopValues(loop)
      const authorField = loop.authorship?.title ? 'title' : 'text'
      passages.push(
        { id: 'assumption', title: 'Assumption', content: [
          loop.authorship && paragraph(loop.authorship[authorField], `${card.id}.author.${authorField}`),
          ...loop.premises.map((p, i) => {
            const path = `${card.id}.premises.${i}`
            return createElement('div', { key: p.id ?? i },
              paragraph(joined([
                p.title ? { text: p.title, path: `${path}.title` } : null,
                p.olumi?.title ? { text: p.olumi.title, path: `${path}.olumi.title` } : null,
              ])),
              paragraph(p.text, `${path}.text`))
          }),
          ...loop.basis.map((b, i) => {
            const path = `${card.id}.rests_on.${i}`
            return paragraph(joined([
              b.label != null ? { text: b.label, path: `${path}.label` } : heading(b.id, `${path}.id`),
              b.author != null ? { text: b.author, path: `${path}.author` } : AUTHOR_LABELS[b.whose],
            ]), undefined, path)
          }),
          loop.steps[0] ? null : paragraph(assumed, undefined, 'no-assumption'),
        ] },
        { id: 'evidence', title: 'Evidence', content: loop.steps[1] ? loop.evidence.map(({ e, path }) => {
          const link = linkOf(e.link ?? e.source)
          const sourceField = e.source ? 'source' : 'link'
          return createElement('div', { key: e.id },
            paragraph(joined([
              e.by ? { text: e.by, path: `${path}.by` } : null,
              e.stance_text ? { text: e.stance_text, path: `${path}.stance_text` } : null,
              e.considered?.by ? createElement('span', { key: 'considered' }, 'Considered by ',
                words({ text: e.considered.by, path: `${path}.considered.by` })) : null,
            ])),
            paragraph(e.text, `${path}.text`),
            e.bears_on_text && paragraph(e.bears_on_text, `${path}.bears_on_text`),
            link ? createElement('a', {
              href: link, target: '_blank', rel: 'noopener noreferrer',
              className: `ok-loop-control ok-loop-source ${typography.viewPanelBody}`,
              'data-view': `${path}.${sourceField}`,
            }, e[sourceField]) : e.source && paragraph(e.source, `${path}.source`),
            e.chain?.map((item, i) => paragraph(joined([
              item.text ? { text: item.text, path: `${path}.chain.${i}.text` } : null,
              item.status ? { text: item.status, path: `${path}.chain.${i}.status` } : null,
            ]), undefined, `${path}.chain.${i}`)),
            e.considered?.why && paragraph(e.considered.why.text, `${path}.considered.why.text`))
        }) : paragraph(evidence) },
        { id: 'examined', title: 'Examined', content: loop.steps[2] ? createElement(AnsweredList, {
          model, view: { ...view, reasoning: { examined: (view.reasoning?.examined ?? []).filter((x) => x.about === card.id) } },
        }) : paragraph(examined) },
      )
      const addNext = (group?: { r: Rest; k: number }) => {
        const scoped = group === undefined ? loop : loopOf(model, view, card.id, group.r)
        passages.push({
          id: statusId('next', group?.r),
          title: group === undefined ? 'Next' : joined(['Next', heading(group.r.aim, `run.rests.${group.k}.aim`)]),
          content: [
            scoped.next.length ? scoped.next.map(({ entry, figure, path, figurePath }) =>
              createElement('div', { key: figurePath },
                paragraph(entry.line, `${path}.line`),
                paragraph(joined([
                  figure.line ? { text: figure.line, path: `${figurePath}.line` } : null,
                  figure.estimate_text ? { text: figure.estimate_text, path: `${figurePath}.estimate_text` } : null,
                ])),
                figure.give && createElement(FigureEdit, { id: card.id, edit: figure.give.edit, place: 'reasoning-next' })))
              : paragraph('No next action recorded', undefined, 'no-next'),
            scoped.cautions.length ? createElement('section', { key: 'cautions', 'aria-label': 'Olumi’s cautions' },
              createElement('p', { className: typography.viewPanelHeading }, 'Olumi’s cautions'),
              scoped.cautions.map((c, i) => {
                const path = `${card.id}.worth_checking.${i}`
                return createElement('div', { key: `${c.code}:${i}` }, paragraph(c.title, `${path}.title`), paragraph(c.text, `${path}.text`))
              })) : null,
          ],
        })
      }
      const aims = new Set<string>()
      for (const group of related) {
        if (aims.has(group.r.aim)) continue
        aims.add(group.r.aim)
        addNext(group)
      }
      if (aims.size === 0) addNext()
    }
    if (card.challenged || card.detail || card.reason) passages.push({
      id: 'challenge', title: 'What to examine', content: [
        card.reason && createElement('p', { key: 'reason', className: typography.viewPanelBody, 'data-view': `${card.id}.reason` }, card.reason),
        card.detail && createElement('p', { key: 'detail', className: typography.viewPanelBody, 'data-view': `${card.id}.detail` }, card.detail),
      ],
    })
    for (const { r, k } of groups) {
      const path = `run.rests.${k}`
      const aim = heading(r.aim, `${path}.aim`)
      const sentencePath = `${path}.${r.hover ? 'hover' : 'line'}`
      const sentence = r.hover || r.line
      if (r.option === card.id) passages.push({
        id: groupPassage(r), title: joined(['Share of uncertainty', aim]),
        content: createElement('p', { className: typography.viewPanelBody, 'data-view': sentencePath }, sentence),
      })
      const figure = figuresOf(r).find(({ f }) => f.id === card.id)
      if (figure) {
        const { f, j } = figure
        const figurePath = `${path}.figures.${j}`
        passages.push({
          id: figurePassage(r), title: joined(['Share of uncertainty', heading(r.option, `${path}.option`), aim]),
          content: [
            f.mark && paragraph(f.mark.title, `${figurePath}.mark.title`),
            paragraph(f.line || f.text, `${figurePath}.${f.line ? 'line' : 'text'}`),
            paragraph(sentence, sentencePath),
          ],
        })
      }
    }
    if (passages.length) records.push({ id: card.id, title: card.heading, titlePath: `${card.id}.heading`, passages })
  }
  const methods = model.sharpen ?? []
  methods.forEach((method, i) => {
    if (!method.rationale && !method.emphasis) return
    const path = `sharpen.${i}`
    records.push({
      id: method.id, title: method.lead || method.emphasis, titlePath: `${path}.${method.lead ? 'lead' : 'emphasis'}`,
      passages: [{ id: 'method', title: 'Why examine this', content: [
        method.lead && method.emphasis && paragraph(method.emphasis, `${path}.emphasis`),
        method.rationale && paragraph(method.rationale, `${path}.rationale`),
      ] }],
    })
  })
  const unlinked = (view.reasoning?.examined ?? []).filter((x) => !model.cards.some((c) => c.id === x.about))
  if (examinedOf({ reasoning: { examined: unlinked } }).length) records.push({
    id: 'answer-history', title: 'Answer history',
    passages: [{ id: 'examined', title: 'Examined', content: createElement(AnsweredList, {
      model, view: { ...view, reasoning: { examined: unlinked } },
    }) }],
  })
  return records
}

export function useExplanationModel(): ViewModel | null {
  const model = useViewStore(shownModel)
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  return view !== null && isForThisPage(view, me) && !ownViewPending(view) ? model : null
}

export function useModelExplanations() {
  const model = useExplanationModel()
  const view = useViewStore((s) => s.view)
  const scope = useExplanationScope(model)
  const records = useMemo(() => model && view ? explanationRecords(model, view) : [], [model, view])
  return { scope, records }
}
