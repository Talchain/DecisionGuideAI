export const bad = <section
  className={`${typography.panelMeta} ${typography.chatBody} ${typography.body} ${typography.h3} ${typography.display} hover:!underline text-primary ring-info/50 p-4`}
  style={{ color: 'inherit' }}
  title="Native label"
/>

// Neither comments nor component props should count as DOM violations.
export const clean = <Widget title="Component label" style={custom} className={typography.viewPanelBody} />
export const carrier = <div style={{ '--track': value } as React.CSSProperties} />
// <div style={{ color: 'inherit' }} title="Only a comment" className="!underline" />

declare const typography: Record<string, string>
