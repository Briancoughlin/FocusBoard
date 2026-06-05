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

## Privacy Mode

The 👁 eye icon in the header blurs all on-screen content instantly. This is useful for demos, screen recordings, or any situation where you need to share your screen without exposing task titles, message previews, or credential status.

Clicking the icon again removes the blur. The blur is applied via CSS and does not affect assistive technologies — screen readers can still read content while the visual blur is active. This behaviour is intentional: Privacy Mode is a visual-only feature for sighted observers, not a security or access-control mechanism.

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

## Automated Testing

The following accessibility checks run automatically on every commit via GitHub Actions CI:

### axe-core audit
The industry-standard `@axe-core/cli` tool scans the live app on every push and flags violations including:
- Missing ARIA labels on interactive elements
- Invalid ARIA roles or attributes
- Colour contrast failures (based on computed styles)
- Missing form labels
- Incorrect heading hierarchy

Run it locally (requires server running on port 3001):
```powershell
cd frontend && npm run test:a11y
```

### Unit tests for accessibility-critical logic (43 frontend tests total)
`frontend/src/tests/accessibility.test.ts` covers:

- **Colourblind indicator correctness** — verifies the right urgency pattern (▲▲▲/◆◆◆/···) shows for each level. If overdue logic breaks, the wrong pattern would appear on the wrong card.
- **Urgency sort order** — overdue always sorts before today, today before soon. Wrong order = wrong priority signals for ADHD users.
- **Source badge label integrity** — all source types have valid values so text labels never go missing.

### What automated testing cannot catch
- Screen reader announcement quality and flow
- Keyboard navigation feel and logic
- Colourblind perception (requires simulation or real users)
- Cognitive accessibility (information density, reading level)

The following still require manual testing:

- [ ] NVDA screen reader testing (Windows)
- [ ] Windows Narrator testing
- [ ] Colourblind simulation (Coblis or browser DevTools accessibility panel)

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
