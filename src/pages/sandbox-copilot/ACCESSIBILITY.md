# Accessibility Guidelines - Copilot Variant

## Overview

The Copilot Variant has been built with accessibility in mind, following WCAG 2.1 Level AA guidelines where possible.

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

### Screen Reader Support

**ARIA Labels**:
- All buttons have descriptive labels
- Form inputs have associated labels
- Status messages are announced

**Semantic HTML**:
- Proper heading hierarchy (h1 → h2 → h3)
- Lists use `<ul>` and `<li>` tags
- Buttons use `<button>` elements

**Landmark Regions**:
- Top bar acts as navigation landmark
- Main content area is properly marked
- Side panel is a complementary landmark

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
2. **Announcements** - Live regions for status updates
3. **High contrast mode** - Explicit support for high contrast themes
4. **Reduced motion** - Respect `prefers-reduced-motion`

## Testing

### Manual Testing Checklist

- [ ] All interactive elements keyboard accessible
- [ ] Tab order is logical
- [ ] Focus visible on all elements
- [ ] Screen reader announces all content
- [ ] Color contrast passes WCAG AA
- [ ] Works at 200% zoom
- [ ] Works with keyboard only

### Automated Testing

Run accessibility tests:

```bash
npm run test:copilot
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
