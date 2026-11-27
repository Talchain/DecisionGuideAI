// p-[7px] and gap-px are off-contract.
/* These are also ignored in a block comment.
   <Widget style={{ gap: 8 }} className="mx-7" />
*/
export const Card = () => <Widget
  data-id="m-7"
  className="p-0 m-1 ps-1.5 pr-2.5 pb-3 p-4 gap-2 gap-5 gap-6 space-x-8 space-y-10 md:gap-12 -mt-16 p-[var(--space-3)] hover:gap-x-[calc(var(--space-2)*var(--o-s))]"
  style={{ paddingInline: 'var(--space-3)', marginTop: 0, gap: 0, rowGap: 'var(--space-1)' }}
/>

declare const Widget: (props: { className: string; style: React.CSSProperties }) => JSX.Element
