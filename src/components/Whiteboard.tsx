// POC: Whiteboard stub so PoC builds don't fail if the real module isn't present.
import React from 'react';

export default function Whiteboard() {
  return (
    <div style={{
      padding: 12,
      border: '1px dashed #ccc',
      borderRadius: 8,
      background: '#fafafa',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
    }}>
      <div style={{fontWeight: 600, marginBottom: 6}}>Whiteboard (POC stub)</div>
      <div style={{fontSize: 14, color: '#444'}}>
        The real Whiteboard module isn't available in PoC mode. This stub exists to satisfy
        the build and keep the UI rendering. Replace/remove when the real component is ready.
      </div>
    </div>
  );
}
