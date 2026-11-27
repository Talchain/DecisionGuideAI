import type { View } from '../../client'
import type { Difference } from '../../../olumiCore/team/differences'
import { AVATAR, LABEL, META } from '../../../olumiCore/team/ui'
import { typography } from '../../../styles/typography'
import { Hover } from '../../look/Hover'
import { DifferAxis } from '../scale/DifferAxis'

export { sideSpans, axisOf, at } from '../scale/DifferAxis'

const TRACK = 'block h-2 w-full overflow-visible'
const initial = (name: string) => (Array.from(name)[0] ?? '').toUpperCase()

export function FigureSides(props: { view: View; d: Difference; at: string }): JSX.Element {
  return <DifferAxis {...props} />
}

/** What each person's figure does to each option's chance of meeting the aim: per option, one bar per holder on a 0–100% track, labelled
 *  with core's own text; a withheld chance draws no bar, only core's words for it. Core's figure with the model's own value follows as words. */
export function ChanceBars({ d, heading, modelHeading, at: id }: { d: Difference; heading: string; modelHeading: string; at: string }): JSX.Element | null {
  if (d.options.length === 0) return null
  const holder = (hid: string) => d.sides.find((s) => s.holder_id === hid)?.holder ?? ''
  return (
    <div className="grid gap-2" data-testid={`${id}-options`}>
      <p className={LABEL}>{heading}</p>
      {d.options.map((o) => (
        <div key={o.option} className="grid gap-1" data-difference-option={o.option}>
          <p className={`${typography.viewPanelBody} m-0 break-words text-text-header`}>{o.label}
            {o.model !== '' && <span className={`${META} ml-1.5`} data-difference-model="">· {modelHeading} {o.model}</span>}</p>
          {o.chances.map((c) => (
            <Hover as="p" key={c.holder_id} className={`${META} m-0 grid grid-cols-[22px_1fr_auto] items-center gap-2`} data-difference-chance={c.holder_id} words={c.withheld?.reason}>
              <span aria-hidden="true" className={AVATAR}>{initial(holder(c.holder_id))}</span>
              <span className="sr-only">{holder(c.holder_id)}</span>
              {c.chance === null
                ? <span className="text-text-light" data-chance-withheld="" />
                : (
                  <svg viewBox="0 0 100 8" preserveAspectRatio="none" className={TRACK} aria-hidden="true" data-chance={c.chance}>
                    <rect x="0" y="1" width="100" height="6" rx="1" className="fill-current text-panel-border" />
                    <rect x="0" y="1" width={Math.min(100, Math.max(0, c.chance * 100))} height="6" rx="1" className="fill-current text-text-header" />
                  </svg>
                )}
              <span className="tabular-nums text-text-body">{c.text}</span>
            </Hover>
          ))}
        </div>
      ))}
    </div>
  )
}
