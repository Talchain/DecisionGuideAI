type Classed = (props: { className: string }) => JSX.Element

declare const HoverButton: Classed
declare const Hover: (props: { as?: 'button'; className: string }) => JSX.Element
declare const OkIconButton: Classed
declare const Button: (props: { size?: 'sm' | 'md' | 'chip' }) => JSX.Element
declare const MenuItem: Classed
declare const controls: { chipText: string; chipIcon: string }
declare const VIEW_CHIP_CLASS: string
declare const TOOLBAR_ICON: string
declare const MENU_ROW: string

export const buttons = <>
  <button className={controls.chipText} />
  <HoverButton className={VIEW_CHIP_CLASS} />
  <Hover as="button" className={TOOLBAR_ICON} />
  <OkIconButton className={controls.chipIcon} />
  <Button size="chip" />
  <MenuItem className={MENU_ROW} />
  <div className="h-[30px]" />
  <Hover className="min-h-8" />
  <button className="relative after:h-11 [&>svg]:h-4 sm:[&_svg]:size-4 [&>span[data-icon]]:min-h-4" />
</>
