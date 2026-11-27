export const Card = () => <div className="p-[12px] hover:md:-ms-[3px] [&>span]:gap-x-[2px] space-y-[0.5rem]" />
export const Other = ({ id }: { id: string }) => <Widget
  class={`flex ${id === 'm-7' ? 'px-[6px]' : ''}`}
  className={cn('gap-y-[3px]', clsx({ 'space-x-[7px]': id === 'm-9' }))}
/>

declare const Widget: (props: { class: string; className: string }) => JSX.Element
declare const cn: (...classes: string[]) => string
declare const clsx: (classes: Record<string, boolean>) => string
