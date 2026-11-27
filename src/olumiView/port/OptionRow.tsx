import type { ComponentProps, ReactNode } from 'react'
import { setFocusSubject, useFocusSubject } from '../focus/subject'
import { Hover } from '../look/Hover'
import { pressCard, ringFrom } from '../reasoning/tabRing'

type Props = Omit<ComponentProps<typeof Hover>, 'as' | 'type' | 'onClick'> & {
  id: string
  ring: string
  picture?: { label: ReactNode; value: ReactNode; track: ReactNode }
}

export function OptionRow({ id, ring, picture, children, className = '', ...props }: Props) {
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
    className={`rounded-sm text-left hover:bg-panel-hover aria-[current=true]:bg-panel-hover transition-colors duration-fast motion-reduce:transition-none ${picture === undefined ? className : 'grid w-full min-w-0 grid-cols-1 gap-1 px-1 py-1'}`}>
    {picture === undefined ? children : <>
      <span className="grid grid-cols-2 items-baseline gap-2" data-option-summary>
        <span className="min-w-0 break-words">{picture.label}</span>
        <span className="min-w-0 break-words text-right" data-option-value>{picture.value}</span>
      </span>
      {picture.track == null ? null : <span className="block min-w-0 w-full" data-option-track>{picture.track}</span>}
    </>}
  </Hover>
}
