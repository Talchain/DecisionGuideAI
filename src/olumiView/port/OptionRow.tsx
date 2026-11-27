import type { ComponentProps, ReactNode } from 'react'
import { setFocusSubject, useFocusSubject } from '../focus/subject'
import { Hover } from '../look/Hover'
import { pressCard, ringFrom } from '../reasoning/tabRing'

type Props = Omit<ComponentProps<typeof Hover>, 'as' | 'type' | 'onClick' | 'children'> & {
  id: string
  ring: string
  label: ReactNode
  value: ReactNode
  track?: ReactNode
}

export function OptionRow({ id, ring, label, value, track, className = '', ...props }: Props) {
  const subject = useFocusSubject()
  const current = subject?.kind === 'option' && subject.source === 'canvas' && subject.id === id
  const light = () => ringFrom(ring, [id])
  const clear = () => ringFrom(ring, [])

  return <Hover {...props} as="button" type="button" aria-current={current || undefined}
    onClick={() => {
      pressCard(id)
      setFocusSubject({ kind: 'option', id, cards: [id], source: 'panel' })
    }}
    onMouseEnter={light} onMouseLeave={clear} onFocus={light} onBlur={clear}
    className={`-mx-1 block w-[calc(100%+0.5rem)] space-y-1 rounded-sm px-1 py-1 text-left hover:bg-panel-hover aria-[current=true]:bg-panel-hover transition-colors duration-fast motion-reduce:transition-none ${className}`}>
    <span className="grid grid-cols-2 items-baseline gap-x-2" data-option-summary="">
      <span className="min-w-0">{label}</span>
      <span className="min-w-0 max-w-full break-words text-right" data-option-value="">{value}</span>
    </span>
    {track == null ? null : <span className="block w-full" data-option-track="">{track}</span>}
  </Hover>
}
