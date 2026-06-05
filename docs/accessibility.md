# FocusBoard Accessibility

FocusBoard is built with accessibility as a core consideration, not an afterthought. This document explains the specific choices made and known limitations.

---

## Screen Reader Support

All interactive elements have descriptive ARIA labels so screen readers can announce them correctly.

- **Buttons** — every button has an `aria-label` describing its action, not just its icon
- **Dialogs** — all modals use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the dialog title
- **Navigation** — the main nav uses `aria-current="page"` on the active tab
- **Tab lists** — source filter tabs use `role="tablist"` and `role="tab"` with `aria-selected`
- **Status regions** — the trophy counter uses `aria-live="polite"` so completions are announced
- **Collapsible sections** — sidebar sections use `aria-expanded` to communicate collapsed state
- **Articles** — task cards use `role="article"` with `aria-label` containing the task title

### Known limitation
The drag-and-drop kanban interaction requires a pointing device. Keyboard-only drag-and-drop is not currently supported. This is on the roadmap for a future release.

---

## Colourblind Accessibility

FocusBoard uses colour as a signal in several places. Every colour signal has a secondary non-colour indicator so the interface is usable without colour perception.

### Urgency strips on task cards

The coloured strip at the top of each card indicates urgency. Each level uses both colour AND a distinctive pattern:

| Urgency | Colour | Pattern | Text badge |
|---|---|---|---|
| Overdue | 🔴 Red | `▲▲▲` triangles | 🔥 "Overdue" badge |
| Due today | 🟠 Orange | `◆◆◆` diamonds | 🔥 "Due today" badge |
| Due soon | 🟡 Yellow | `···` dots | (none — low urgency) |
| Normal | None | None | None |

Someone with deuteranopia (red-green colourblindness, affecting ~8% of men) who cannot distinguish the red from orange strips can still identify urgency level from the pattern symbols. The text badges provide a third signal.

### Source badges

Each integration source has a coloured pill badge (blue for Jira, red for Gmail, etc.). Every badge also contains the source name as text — the colour is decorative, the text carries the meaning.

### Status indicators

The ✅/❌ connection status icons in Settings are accompanied by text descriptions. Green/red is not the only signal.

### CI notifications in sidebar

CI pass/fail notifications use ✅ and ❌ emoji alongside colour-coded backgrounds, ensuring the status is clear without relying on colour alone.

---

## Keyboard Navigation

- All buttons and interactive elements are keyboard focusable
- Sidebar section headers support Enter and Space to toggle collapse
- Modal dialogs trap focus correctly
- The drag handle resize control has keyboard-accessible ARIA attributes

---

## Colour Contrast

FocusBoard follows Windows system theme (dark/light mode and accent colour). When using the manual theme override, colour contrast is the user's responsibility. The default blue accent (`#0078d4`) meets WCAG AA contrast requirements against white backgrounds.

---

## Testing

Accessibility attributes have been implemented but not yet formally tested with assistive technology. The following are on the roadmap:

- [ ] NVDA screen reader testing (Windows)
- [ ] Windows Narrator testing
- [ ] Axe automated accessibility audit
- [ ] Colourblind simulation testing (Coblis or browser DevTools)

If you find an accessibility issue, please [report it](https://github.com/Briancoughlin/FocusBoard/issues) using the 🐛 bug report button in the app.

---

## WCAG Conformance

FocusBoard aims for WCAG 2.1 Level AA conformance. Current status:

| Criterion | Status | Notes |
|---|---|---|
| 1.1.1 Non-text content | ✅ | All icons have aria-labels |
| 1.3.1 Info and relationships | ✅ | Semantic roles used throughout |
| 1.4.1 Use of colour | ✅ | Pattern + text alongside every colour signal |
| 1.4.3 Contrast | ⚠️ | Met for defaults, user-controlled for custom themes |
| 2.1.1 Keyboard | ⚠️ | Most controls keyboard accessible; drag-and-drop is not |
| 2.4.3 Focus order | ✅ | Logical tab order throughout |
| 4.1.2 Name, role, value | ✅ | ARIA labels on all interactive elements |
