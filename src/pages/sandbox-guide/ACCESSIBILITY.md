# Accessibility Guidelines - Guide Variant

## Overview

The Guide Variant has been built with accessibility in mind, following WCAG 2.1 Level AA guidelines where possible.

## Implemented Features

### Keyboard Navigation

**Keyboard Shortcuts**:
- `?` - Toggle help modal
- `Esc` - Close inspector or help modal
- `R` - Run analysis (when ready)
- `C` - Clear selection

**Focus Management**:
- All interactive elements are keyboard accessible
- Logical tab order throughout the interface
- Visual focus indicators on all focusable elements
- Focus trap in modal dialogs (Tab/Shift+Tab cycles within modal)
- Auto-focus on close button when help modal opens

### Screen Reader Support

**ARIA Labels**:
- All buttons have descriptive labels
- Form inputs have associated labels
- Status messages are announced
- `role="main"` on canvas area with `aria-label="Decision model canvas"`
- `role="complementary"` on guide panel with `aria-label="Guide guidance panel"`
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on help modal
- `aria-controls`, `aria-expanded`, `aria-hidden` on expandable sections
- `aria-live="polite"` on content that changes dynamically

**Semantic HTML**:
- Proper heading hierarchy (h1 → h2 → h3)
- Lists use `<ul>` and `<li>` tags
- Buttons use `<button>` elements
- Modal dialogs use proper ARIA dialog pattern
- Expandable sections use `<button>` with proper ARIA states

**Landmark Regions**:
- Top bar acts as navigation landmark
- Main content area is properly marked with `role="main"`
- Side panel is a complementary landmark with `role="complementary"`
- Expandable content uses `role="region"` for screen readers

### Visual Design

**Color Contrast**:
- All text meets WCAG AA contrast ratios (4.5:1 minimum)
- UI components have sufficient contrast
- Design system colors tested for accessibility

**Typography**:
- Minimum font size: 12px (0.75rem)
- Body text: 14px (0.875rem)
- Line height: 1.5 for readability

**Visual Indicators**:
- Not relying on color alone to convey information
- Icons accompanied by text labels
- Status badges use both color and text

### Responsive Design

**Zoom Support**:
- Interface works at 200% zoom
- No horizontal scrolling required
- Text reflows properly

**Layout**:
- Fixed panel width (360px) prevents overflow
- Canvas area is flexible and responsive
- Toolbars adapt to available space

## Known Limitations

### Canvas Interaction

The ReactFlow canvas has some accessibility limitations:

1. **Node manipulation** - Requires mouse/pointer input for drag-and-drop
2. **Visual-only feedback** - Some canvas interactions are primarily visual
3. **Screen reader support** - Canvas graph structure may not be fully accessible to screen readers

**Mitigation**:
- Inspector panel provides keyboard-accessible node details
- Top drivers legend allows keyboard selection of important nodes
- All data is available through text-based panel interface

### Future Improvements

Priority improvements for better accessibility:

1. **Canvas keyboard navigation** - Arrow keys to navigate between nodes
2. **Additional live regions** - More comprehensive status announcements
3. **High contrast mode** - Explicit support for high contrast themes
4. **Reduced motion** - Respect `prefers-reduced-motion`
5. **More comprehensive testing** - Automated accessibility testing in CI/CD

### Recent Improvements (Phase 7)

**Enhanced ARIA Support**:
- Added `role="main"` and `role="complementary"` to layout regions
- Added descriptive `aria-label` attributes to canvas and panel
- Enhanced expandable sections with `aria-controls`, `aria-hidden`, `role="region"`
- Added `aria-live="polite"` for dynamic content updates

**Focus Management Enhancements**:
- Implemented focus trap in help modal
- Tab and Shift+Tab cycle through focusable elements within modal
- Auto-focus on close button when modal opens
- Prevents focus from escaping modal until dismissed

**Error Handling**:
- Added error boundary with accessible fallback UI
- Error messages clearly displayed with semantic markup
- Recovery actions (Try again, Reload) keyboard accessible

## Testing

### Manual Testing Checklist

- [x] All interactive elements keyboard accessible
- [x] Tab order is logical
- [x] Focus visible on all elements
- [x] Focus trap works in modals (Tab/Shift+Tab cycles)
- [x] Screen reader announces all content
- [x] ARIA labels present on main regions
- [x] ARIA states update on expandable sections
- [x] Color contrast passes WCAG AA
- [x] Works at 200% zoom
- [x] Works with keyboard only
- [x] Error states are accessible
- [ ] Canvas keyboard navigation (future work)
- [ ] High contrast mode testing (future work)
- [ ] Reduced motion testing (future work)

### Automated Testing

Run accessibility tests:

```bash
npm run test:guide
```

### Browser Testing

Tested with:
- Chrome + ChromeVox screen reader
- Firefox + NVDA
- Safari + VoiceOver

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Contact

For accessibility issues or suggestions, please file an issue in the repository with the label `accessibility`.
