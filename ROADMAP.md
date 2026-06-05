# FocusBoard Roadmap

This document outlines the planned development direction for FocusBoard. It's a living document — priorities may shift based on user feedback and what the ADHD community actually needs.

---

## Current: v1.3 — Personalisation ✅ Shipped

**Theme:** Make it yours

### ✅ Source Toggles
Enable/disable integrations from Settings → Integrations. Each source has a toggle in its header. Disabled sources are skipped entirely during sync — faster and quieter. Credentials are always preserved.

### ✅ Email Intelligence
- **Hover preview** — see the raw email snippet before deciding if it needs to be a card
- **Confidence scoring** — Claude rates how action-worthy each email is (●●● High, ●●○ Medium, ●○○ Low)
- **"Not an action" button** — explicit feedback that teaches Claude your patterns over time
- **Personal noise filter** — learned from "Not an action" clicks, injected into Claude's prompt to reduce noise automatically

### ✅ VPN Detection
Friendly amber 🔒 banner when Jira is unreachable: "Jira is unreachable — are you on VPN or Netbird?" with a one-click sync retry.

### ✅ Friendly Startup
Human-readable terminal output: ⚡ banner, integration status (✓ / ○ not configured / ○ disabled), actionable warnings, no JSON stack traces.

---

## Next: v1.4 — Distribution

**Theme:** Share it properly

### Docker (fastest path)
A `docker-compose.yml` and `Dockerfile` that lets anyone run FocusBoard with zero Node.js setup. Published to GitHub Container Registry. One command to run, one command to update.

Best for: technical colleagues, anyone already using Docker.

### Standalone Executables
Single `.exe` (Windows) and binary (Mac) — no Node.js, no terminals, no git. Download, double-click, done.

Built with `@yao-pkg/pkg` and distributed via GitHub Releases. GitHub Actions builds both platforms automatically on every version tag.

Best for: non-technical users, the broader ADHD community.

### Mac Support
Full support for Apple Silicon (arm64) and Intel (x64) Macs. Docker handles this natively. Exe approach needs a Gatekeeper workaround (documented in release notes).

### Self-updating
- Docker: `docker pull` gets the latest image automatically
- Exe: download and replace binary from GitHub Release

---

## v2.0 — Extensible

**Theme:** Build on it

*Note: the Discourse / Unity Discussions plugin is blocked until after the platform migration is complete.*

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

**Blocked on:** Unity platform migration completing first.

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
- **Keyboard-only drag-and-drop** — full kanban navigation without a pointing device
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
