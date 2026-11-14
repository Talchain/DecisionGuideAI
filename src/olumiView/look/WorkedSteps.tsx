/** Calculation notes are the View's typed operands. No formula or operand is inferred from graph links or prose. */
import type { View, ViewCard } from '../client'
import { FigureEdit } from '../FigureEdit'

type Worked = NonNullable<ViewCard['worked']>
type Operand = Worked['steps'][number]
export const WORKED_OUT = 'How it is worked out'
const methods: Record<Worked['form'], string> = {
  sum: 'Add and subtract the signed terms', product: 'Multiply the terms; divide where marked',
  stock: 'Starting figure + inflows − outflows', effect: 'Starting figure + each input × its effect',
}
/** Geometry is used only to navigate to the card; the definition itself comes from card.worked. */
export function workedStepsOf(view: View, id: string): { relation: { id: string; label: string }; steps: Worked['steps'] }[] {
  const w = view.model?.cards.find(c => c.id === id)?.worked
  return w ? [{ relation: { id, label: WORKED_OUT }, steps: w.steps }] : []
}
// Older Views identify a derived figure through a typed sized link, solely for its quiet status face. They supply no calculation notes.
export const isWorkedOut = (view: View, id: string): boolean => view.model?.cards.find(c => c.id === id)?.worked != null || (view.model?.links.some(l => l.to === id && l.kind !== 'reason' && l.effect != null) ?? false)

function Input({ operand, option }: { operand: Operand | NonNullable<Operand['coefficient']>; option?: string }) {
  const setting = option === undefined ? null : operand.figure.options.find(x => x.option === option) ?? null
  const author = setting === null ? operand.author : setting.author, edit = setting === null ? operand.edit : setting.edit, id = setting?.id ?? operand.id
  return <div className="ok-operand" data-operand={operand.id}>
    <span className="ok-step-name">{operand.label}</span>{' '}<b title={setting?.title ?? operand.figure.title}>{setting?.text ?? operand.figure.text}</b>
    <span className={author?.by === 'olumi' ? 'ok-by-olumi' : 'ok-by'} data-testid="worked-author"> · {author?.text || 'Authorship not recorded'}</span>
    {edit == null ? null : <span className="ok-edit"><FigureEdit id={id} edit={edit} place="view-step" glyph="✎" label="Change figure" words={false} /></span>}
  </div>
}
export function WorkedSteps({ view, id, option, mine }: { view: View; id: string; option?: string; mine?: ReadonlySet<string> }): JSX.Element | null {
  const card = view.model?.cards.find(c => c.id === id), worked = card?.worked
  if (card == null || worked == null) return null
  return <details className="ok-steps nodrag nowheel" data-view={`${id}.worked`} data-testid="worked-notes">
    <summary>{WORKED_OUT}</summary>
    <div className="ok-worked-content">
      <p className="ok-worked-method" data-testid="worked-method" data-form={worked.form}>{methods[worked.form]}</p>
      <p>{card.heading}</p>
      <ol>{worked.steps.map((step, i) => <li key={`${step.id}:${i}`} data-step={step.role} data-step-from={step.id} data-step-own={mine?.has(step.id) || step.figure.options.some(f => f.option === option && mine?.has(f.id)) ? '' : undefined}>
        <span className="ok-step-operation">{step.role === 'base' ? 'Starting figure' : step.role === 'in' ? '+' : step.role === 'out' ? '−' : step.sign === -1 ? '−' : step.power === -1 ? '÷' : worked.form === 'product' ? '×' : '+'}</span>
        <Input operand={step} option={option} />
        {step.coefficient == null ? null : <div className="ok-coefficient"><span>×</span><Input operand={step.coefficient} option={option} /></div>}
      </li>)}</ol>
    </div>
  </details>
}
