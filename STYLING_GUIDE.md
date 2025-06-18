# Cliparr Styling & Accessibility Guide

## Overview
This guide ensures consistent styling, accessibility, and keyboard navigation throughout the Cliparr application. All components must follow these standards to provide a modern, accessible user experience.

## 🎨 Design System

### Color Palette
- **Primary Blue**: `#3b82f6` (focus states, active elements)
- **Primary Blue Dark**: `#1d4ed8` (hover states)
- **Secondary Gray**: `#4b5563` (secondary buttons, inactive states)
- **Danger Red**: `#dc2626` (delete actions, errors)
- **Success Green**: `#16a34a` (success states)
- **Warning Yellow**: `#ca8a04` (warnings)

### Typography
- **Primary Font**: System font stack (San Francisco, Segoe UI, etc.)
- **Font Weights**: 400 (normal), 600 (semibold), 700 (bold)
- **Line Heights**: 1.5 for body text, 1.2 for headings

### Spacing
- **Base Unit**: 4px
- **Common Spacings**: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
- **Container Padding**: 16px-24px
- **Component Margins**: 8px-16px

## ♿ Accessibility Standards

### Focus Management
- **Focus Indicator**: 2px solid `#3b82f6` with 2px offset
- **Focus Ring**: Additional 4px box-shadow for buttons
- **Focus Order**: Logical tab order following visual layout
- **Skip Links**: Available for main content navigation

### ARIA Labels & Descriptions
- **Interactive Elements**: Must have descriptive `aria-label` or visible text
- **Form Controls**: Associated with labels using `htmlFor` or `aria-labelledby`
- **Status Messages**: Use `aria-live` for dynamic content updates
- **Landmarks**: Proper use of `main`, `nav`, `aside`, `header`, `footer`

### Color & Contrast
- **Minimum Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Color Independence**: Information not conveyed by color alone
- **High Contrast Mode**: Support for `prefers-contrast: high`

### Motion & Animation
- **Reduced Motion**: Respect `prefers-reduced-motion: reduce`
- **Animation Duration**: 200ms for interactive elements
- **Smooth Transitions**: Use `transition: all 0.2s ease`

## ⌨️ Keyboard Navigation

### Navigation Patterns
- **Tab Order**: Logical progression through interactive elements
- **Arrow Keys**: Navigate lists, grids, and form controls
- **Enter/Space**: Activate buttons and interactive elements
- **Escape**: Close modals, cancel actions
- **Home/End**: Navigate to first/last item in lists

### Keyboard Shortcuts
- **Navigation**: `H` (Home), `S` (Settings), `I` (Import)
- **Actions**: `Ctrl+A` (Select All), `Delete` (Delete Selected)
- **Search**: `Ctrl+F` or `Ctrl+K` (Focus Search)
- **Table Navigation**: Arrow keys, Home, End, Page Up/Down

### Focus Traps
- **Modals**: Focus trapped within modal content
- **Dropdowns**: Focus returns to trigger when closed
- **Forms**: Logical tab order within form sections

## 🎯 Interactive Elements

### Buttons
```css
/* Primary Button */
.btn-primary {
  background-color: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background-color: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}
```

### Form Controls
```css
/* Input Fields */
input, select, textarea {
  border: 1px solid #4b5563;
  border-radius: 4px;
  padding: 8px 12px;
  background-color: #1f2937;
  color: white;
  transition: all 0.2s ease;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

### Checkboxes & Radio Buttons
```css
/* Custom Checkbox */
input[type="checkbox"],
input[type="radio"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

input[type="checkbox"]:focus-visible,
input[type="radio"]:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}
```

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 641px - 1024px
- **Desktop**: > 1024px

### Mobile-First Approach
```css
/* Base styles (mobile) */
.component {
  padding: 16px;
  flex-direction: column;
}

/* Tablet and up */
@media (min-width: 641px) {
  .component {
    padding: 24px;
    flex-direction: row;
  }
}

/* Desktop and up */
@media (min-width: 1025px) {
  .component {
    padding: 32px;
  }
}
```

### Touch Targets
- **Minimum Size**: 44px × 44px for touch targets
- **Spacing**: 8px minimum between interactive elements
- **Hit Areas**: Extend beyond visual boundaries when possible

## 🎭 Component States

### Loading States
```css
.loading {
  opacity: 0.7;
  pointer-events: none;
  position: relative;
}

.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border: 2px solid #f3f4f6;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

### Disabled States
```css
.disabled {
  opacity: 0.5;
  pointer-events: none;
  cursor: not-allowed;
}
```

### Active States
```css
.active {
  background-color: #3b82f6;
  color: white;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
```

## 🧩 Component Patterns

### Cards
```css
.card {
  background-color: #1f2937;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
```

### Tables
```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #374151;
}

.table tr:hover {
  background-color: rgba(75, 85, 99, 0.1);
  transform: translateX(2px);
  transition: all 0.2s ease;
}

.table tr:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
  background-color: rgba(59, 130, 246, 0.1);
}
```

### Modals
```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 24px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}
```

## 🔧 Utility Classes

### Focus Utilities
```css
.focus-visible {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px !important;
}

.focus-trap {
  outline: none;
}
```

### Screen Reader Utilities
```css
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
```

### Responsive Utilities
```css
.mobile-stack {
  flex-direction: column;
}

.mobile-full-width {
  width: 100%;
}

.mobile-text-center {
  text-align: center;
}
```

## 🧪 Testing Checklist

### Accessibility Testing
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible and clear
- [ ] ARIA labels and descriptions are present
- [ ] Color contrast meets WCAG standards
- [ ] Screen reader compatibility verified
- [ ] Reduced motion preferences respected

### Keyboard Navigation Testing
- [ ] Tab order is logical and intuitive
- [ ] Arrow keys work for list/grid navigation
- [ ] Enter/Space activate appropriate elements
- [ ] Escape closes modals and cancels actions
- [ ] Focus traps work in modals
- [ ] Skip links function correctly

### Responsive Testing
- [ ] Mobile layout is usable and accessible
- [ ] Touch targets are appropriately sized
- [ ] Content doesn't overflow on small screens
- [ ] Navigation works on all screen sizes
- [ ] Text remains readable at all sizes

### Performance Testing
- [ ] Animations are smooth (60fps)
- [ ] No layout shifts during interactions
- [ ] Loading states provide clear feedback
- [ ] Transitions are optimized for performance

## 📚 Resources

### Tools
- **Color Contrast**: WebAIM Contrast Checker
- **Accessibility**: axe DevTools, Lighthouse
- **Keyboard Testing**: Manual testing with keyboard only
- **Screen Reader**: NVDA, JAWS, VoiceOver

### Standards
- **WCAG 2.1 AA**: Web Content Accessibility Guidelines
- **ARIA**: Accessible Rich Internet Applications
- **Section 508**: Federal accessibility requirements

### Documentation
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM Guidelines](https://webaim.org/standards/wcag/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

---

**Remember**: Accessibility is not a feature—it's a fundamental requirement. Every component should be designed with accessibility in mind from the start. 