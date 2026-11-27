export const Card = () => <Widget style={{
  paddingInline: 12,
  marginTop: -3,
  gap: 8,
  width: 100,
}} />

declare const Widget: (props: { style: React.CSSProperties }) => JSX.Element
