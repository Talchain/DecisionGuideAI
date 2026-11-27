import type { ComponentProps } from 'react'
import { setFocusSubject, useFocusSubject } from '../focus/subject'
import { Hover } from '../look/Hover'
import { pressCard, ringFrom } from '../reasoning/tabRing'

export const RESULT_ROW_GRID = '-mx-1 grid w-[calc(100%+0.5rem)] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,10rem)] gap-x-2 px-1 py-1'

type Props = Omit<ComponentProps<typeof Hover>, 'as' | 'type' | 'onClick'> & { id: string; ring: string }

export function OptionRow({ id, ring, className = '', ...props }: Props) {
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
    className={`rounded-sm text-left hover:bg-panel-hover aria-[current=true]:bg-panel-hover transition-colors duration-fast motion-reduce:transition-none ${className}`} />
}
