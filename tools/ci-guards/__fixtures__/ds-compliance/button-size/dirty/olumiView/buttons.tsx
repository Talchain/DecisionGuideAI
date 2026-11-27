type Classed = (props: { className: string }) => JSX.Element

declare const HoverButton: Classed
declare const Hover: (props: { as?: 'button'; className: string }) => JSX.Element
declare const OkIconButton: Classed
declare const Button: (props: { size?: 'sm' | 'md' | 'chip' }) => JSX.Element
declare const MenuItem: Classed
declare const clsx: (className: string, variants: Record<string, boolean>) => string
declare const roomy: boolean

const localClass = 'inline-flex min-h-8'

export const buttons = <>
  <button className="min-h-[32px]" />
  <HoverButton className={localClass} />
  <Hover as={'button'} className="h-[30px]" />
  <OkIconButton className={clsx('size-8', { 'sm:min-h-9': roomy })} />
  <Button size="md" />
  <Button />
  <button className="[&:hover]:h-8" />
  <MenuItem className="[min-height:32px]" />
</>
