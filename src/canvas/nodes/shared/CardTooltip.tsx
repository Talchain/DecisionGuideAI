import type { ComponentProps, ReactElement, ReactNode, Ref } from 'react'
import Tooltip from '../../../components/Tooltip'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { Hover } from '../../../olumiView/look/Hover'

type AnchorProps = Omit<ComponentProps<typeof Hover>, 'as' | 'anchorRef' | 'words' | 'focusable'> & { ref?: Ref<HTMLElement> }

/** Keep the card's existing hover anchor and focus stop in both looks. */
export function CardTooltip({ children, words, delay, olderContent = words }: {
  children: ReactElement<AnchorProps, 'span' | 'button'>
  words: string | undefined
  delay?: number
  olderContent?: ReactNode
}) {
  if (!isOlumiCoreLane()) return <Tooltip asChild delay={delay} content={olderContent}>{children}</Tooltip>
  const { title: _title, ref: _ref, ...props } = children.props
  return <Hover as={children.type} words={words} focusable={false} {...props}
    anchorRef={(children as ReactElement<AnchorProps> & { ref?: Ref<HTMLElement> }).ref} />
}
