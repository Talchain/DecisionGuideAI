# Accessibility Announcements Guide

**Purpose**: ARIA-friendly screen reader announcements for Scenario Sandbox UI integration.

## 🔊 Core Event Announcements

### First Token Received
**Announcement**: "Results streaming"
**Trigger**: On first SSE token event after connection
**Rationale**: Confirms to screen reader users that analysis has begun and content is arriving
**ARIA Attribute**: `aria-live="polite"`
**Max Words**: 2

### Cancel Success
**Announcement**: "Stream cancelled"
**Trigger**: After receiving 202 response from cancel endpoint
**Rationale**: Confirms the user's stop action was successful
**ARIA Attribute**: `aria-live="assertive"`
**Max Words**: 2

### Resume Connection
**Announcement**: "Connection restored, continuing"
**Trigger**: When EventSource reconnects with Last-Event-ID
**Rationale**: Reassures user that their session has resumed properly
**ARIA Attribute**: `aria-live="polite"`
**Max Words**: 3

### Report Available
**Announcement**: "Report available"
**Trigger**: When report drawer/modal opens successfully
**Rationale**: Alerts screen reader users that new content is ready to explore
**ARIA Attribute**: `aria-live="polite"`
**Max Words**: 2

### Visual Complexity Toggle
**Announcement**: "Reduced visual complexity"
**Trigger**: When "Hide weaker links" toggle is activated
**Rationale**: Explains the UI change for users who rely on audio feedback
**ARIA Attribute**: `aria-live="polite"`
**Max Words**: 3

## 🎯 Implementation Patterns

### React Example
```jsx
function AccessibilityAnnouncer({ announcement }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      role="status"
    >
      {announcement}
    </div>
  );
}

// Usage with state
const [announcement, setAnnouncement] = useState('');

// On first token
eventSource.onmessage = (event) => {
  if (!hasReceivedFirstToken) {
    setAnnouncement('Results streaming');
    setHasReceivedFirstToken(true);
  }
};
```

### Vanilla JavaScript Example
```javascript
class AccessibilityManager {
  constructor() {
    this.announcer = document.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-atomic', 'true');
    this.announcer.className = 'sr-only';
    document.body.appendChild(this.announcer);
  }

  announce(message) {
    this.announcer.textContent = message;
    // Clear after announcement
    setTimeout(() => {
      this.announcer.textContent = '';
    }, 1000);
  }
}

// Usage
const a11y = new AccessibilityManager();
a11y.announce('Results streaming');
```

## 📱 Additional Accessibility Considerations

### Focus Management
- **After Cancel**: Move focus to Resume button if available
- **After Resume**: Return focus to streaming content area
- **Report Opens**: Move focus to report heading or first interactive element
- **Modal Closes**: Return focus to trigger button

### Keyboard Navigation
- **Space/Enter**: Activate primary actions (Start, Stop, Resume)
- **Escape**: Close modals/drawers and return focus
- **Tab Order**: Logical flow through controls

### Screen Reader Labels
```html
<!-- Stream controls -->
<button aria-label="Start analysis of current scenario">
  Start
</button>

<button
  aria-label="Stop analysis, can be resumed later"
  aria-describedby="cancel-help"
>
  Stop
</button>
<div id="cancel-help" class="sr-only">
  You can resume from where you left off
</div>

<!-- Progress indicator -->
<div
  role="progressbar"
  aria-label="Analysis progress"
  aria-valuenow="65"
  aria-valuemin="0"
  aria-valuemax="100"
>
  65% complete
</div>

<!-- Report trigger -->
<button
  aria-label="View structured recommendations"
  aria-describedby="report-count"
>
  Report
</button>
<span id="report-count" class="sr-only">
  4 options analysed
</span>
```

## 🧪 Testing Announcements

### Screen Reader Testing
```javascript
// Test announcement queue
function testAnnouncements() {
  const announcements = [
    'Results streaming',
    'Stream cancelled',
    'Connection restored, continuing',
    'Report available'
  ];

  announcements.forEach((msg, index) => {
    setTimeout(() => {
      a11y.announce(msg);
      console.log(`Announced: ${msg}`);
    }, index * 2000);
  });
}
```

### Manual Validation
1. **Enable Screen Reader**: Test with NVDA (Windows), JAWS (Windows), or VoiceOver (macOS)
2. **Navigate by Tab**: Ensure logical flow through controls
3. **Trigger Events**: Start analysis and verify announcements
4. **Test Interruption**: Cancel and resume to validate state announcements

## 🎨 Styling for Screen Readers

### CSS Classes
```css
/* Hide from visual display but keep for screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Focus indicators for keyboard navigation */
.focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .status-indicator {
    border: 2px solid;
  }
}
```

## 🔧 Integration Checklist

### Required ARIA Attributes
- [ ] `aria-live` regions for dynamic announcements
- [ ] `aria-label` on all interactive controls
- [ ] `role="progressbar"` for stream progress
- [ ] `role="status"` for connection state
- [ ] `aria-describedby` for additional help text

### Announcement Triggers
- [ ] First token received → "Results streaming"
- [ ] Cancel successful → "Stream cancelled"
- [ ] Resume connected → "Connection restored, continuing"
- [ ] Report opened → "Report available"
- [ ] Complexity toggle → "Reduced visual complexity"

### Keyboard Support
- [ ] Tab navigation through all controls
- [ ] Space/Enter activate buttons
- [ ] Escape closes modals
- [ ] Focus visible indicators
- [ ] Focus management on state changes

## 🌐 Internationalisation Notes

### British English Variations
- Use "cancelled" not "canceled"
- Use "optimising" not "optimizing"
- Use "colour" not "color"
- Prefer "whilst" over "while" in formal contexts

### Cultural Considerations
- Keep announcements culturally neutral
- Avoid idioms or colloquialisms
- Use simple, direct language
- Consider right-to-left reading patterns for future expansion

## 📋 Testing Script

### 5-Minute Accessibility Test
1. **Enable Screen Reader** (VoiceOver: Cmd+F5)
2. **Tab Through Controls** - verify logical order
3. **Start Analysis** - listen for "Results streaming"
4. **Cancel Stream** - listen for "Stream cancelled"
5. **Resume Stream** - listen for "Connection restored, continuing"
6. **Open Report** - listen for "Report available"
7. **Toggle Complexity** - listen for "Reduced visual complexity"

### Expected Behaviour
- ✅ Clear, concise announcements (≤3 words)
- ✅ Announcements don't interrupt each other
- ✅ Focus moves logically after actions
- ✅ All controls have descriptive labels
- ✅ Progress is communicated clearly

---

**Compliance**: WCAG 2.1 AA level
**Screen Readers**: NVDA, JAWS, VoiceOver compatible
**Testing**: Manual validation recommended before deployment