# FocusBoard Roadmap

This document outlines the planned development direction for FocusBoard. It's a living document — priorities may shift based on user feedback and what the ADHD community actually needs.

---

## Current: v1.2.x — Production Stable

The core tool is working and production-ready. Jira, Gmail, Google Calendar, Slack (via Windows notifications), and GitHub are all connected. The focus is on stability and polish.

---

## Next: v1.3 — Personalisation

**Theme:** Make it yours

### Source Toggles
Enable/disable integrations from a simple settings screen. Don't use Slack? Turn it off. Don't have GitHub? Hide it. Only see what you've chosen to connect.

### Email Intelligence
- **Hover preview** — see the email snippet before deciding if it needs to be a card
- **Confidence scoring** — Claude rates how action-worthy each email is (●●● High, ●● Medium, ● Low)
- **"Not an action" button** — explicit feedback that teaches Claude your patterns over time
- **Personal noise filter** — learned from your "Not an action" clicks, reduces noise automatically

### VPN Detection
Friendly "Looks like you're not on VPN — Jira needs Netbird to connect" instead of a raw error banner.

### Friendly Startup
Human-readable startup messages instead of Node.js stack traces. For non-developers who just want it to work.

---

## v2.0 — Extensible

**Theme:** Build on it

### Plugin Architecture
A formal plugin interface so integrations can be added without touching core code.

```javascript
export default {
  id: 'discourse',
  name: 'Unity Discussions',
  settings: [...],
  async fetchTasks(config) { ... },
  async onTaskDone(task, config) { ... }
}
```

Drop a plugin file in, enable it in settings, done.

### Layout Presets
Named layouts instead of a fixed structure:
- **Focus** — current layout (calendar + kanban + sidebar)
- **Planner** — week calendar dominant
- **Minimal** — just the kanban
- **Custom** — save your current arrangement as a personal preset

### Discourse / Unity Discussions
First third-party plugin. Surfaces community posts needing staff response, mentions, flagged content. Particularly valuable for Community PMs.

---

## v2.1 — Distribution

**Theme:** Share it properly

### Standalone Executables
Single `.exe` (Windows) and binary (Mac) — no Node.js, no terminals, no git. Download, double-click, done.

Built with `@yao-pkg/pkg` and distributed via GitHub Releases. GitHub Actions builds both platforms automatically on every version tag.

### Mac Support
Full support for Apple Silicon (arm64) and Intel (x64) Macs. Gatekeeper workaround documented in release notes.

### Self-updating Executables
Download and replace the binary automatically when a new version is released. No manual intervention required.

---

## Future Considerations

These are ideas worth exploring once the core is stable. Not committed, not prioritised — just captured so they don't get lost.

### Integrations
- **Slack bot token** — full API access (pending IT approval at Unity)
- **Zoom API** — direct meeting summary import (pending IT approval)
- **Microsoft Teams** — alternative to Slack for non-Unity users
- **Linear** — alternative to Jira for startups and smaller teams
- **Notion** — task import/export
- **Outlook Calendar** — for Microsoft-heavy organisations

### Intelligence
- **Smarter Gmail filtering** — personalised noise reduction based on your feedback history
- **Meeting summary auto-import** — Zoom/Teams summaries pulled in automatically when available
- **Priority suggestions** — Claude suggests priority based on sender, subject patterns, and your history

### Collaboration (longer term)
- **Shared team view** — read-only board visible to your manager or team
- **Team digest** — weekly summary of what the team shipped
- **Handoff notes** — generate a handoff document when going on leave

### Accessibility
- **Keyboard-only navigation** — full drag-and-drop equivalent via keyboard
- **High contrast mode** — beyond the Windows theme integration
- **Screen reader testing** — verified with NVDA and Windows Narrator

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.

The best contributions right now:
1. **Bug reports** — use the 🐛 button in the app
2. **Plugin development** — once the plugin interface lands in v2.0
3. **Testing** — especially on Mac, and with screen readers

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for what's been shipped.
