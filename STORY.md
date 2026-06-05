# FocusBoard: A Story About Building the Tool You Actually Need

*How a PM with ADHD and an AI assistant spent a few days solving a problem that enterprise tooling never could.*

---

## Introduction

FocusBoard is a local-first productivity hub built for people with ADHD who work across multiple tools. It pulls together Jira tickets, Google Calendar events, GitHub pull requests, Slack notifications, and Gmail into a single screen — a Kanban board you can actually trust, sitting in a browser tab at `localhost:3001`, never touching the cloud.

It was built entirely in conversation with Claude. No agency. No dev shop. Just a PM who knew what he needed, and an AI that could write the code.

This is the story of how that happened.

---

## The Problem: Context Switching Is Kryptonite

If you work in a large tech company and you have ADHD, your workday probably looks something like this: you open Jira to check your sprint, a Slack ping pulls you away, you switch to Slack and see a thread that references a calendar invite, you open Calendar, notice a Zoom link, open Zoom, miss the original Jira context entirely, and forty minutes later you're not sure what you were doing.

The description of the problem was simple: *"I want something that is a single focus hub for my work where I can see everything at a glance without having to swap my actual focus."*

That sentence is the entire product brief. No elaborate spec. No stakeholder review. Just an honest description of a pain that anyone with ADHD — and honestly, plenty of people without it — will recognise immediately.

The existing tools weren't broken. Jira is a perfectly good issue tracker. Gmail works fine. Google Calendar does what it says. The problem was the switching itself — every context switch is a tax on working memory, and with ADHD that tax compounds fast. What was needed wasn't a better Jira. It was a single pane of glass where all the things that require attention lived together, surfaced by priority, so you could work through them without your brain having to hold the map.

---

## Phase 1: The Idea and the Tech Stack

The first conversation started with a question: *"Is it possible to build something that aggregates actions from email, Jira, Slack, and Calendar?"*

The answer was yes, but with a choice to make. There were two ways to approach it: a cloud-hosted app where data flows through external servers, or a local web app running entirely on the machine. Given that this would connect to corporate Jira, work email, and Slack — all with sensitive work data — the local approach was the right call. Everything on `localhost`. No data leaving the machine. API keys stored locally, encrypted.

The tech choices made:

- **Frontend**: React + Vite + TypeScript — fast dev server, good component model, type safety catches mistakes early
- **Backend**: Node.js + Express — simple proxy layer to keep API keys off the frontend
- **AI extraction**: Claude API — for pulling structured action items out of messy email threads

One principle guided every decision: if the machine is offline, or the VPN is down, FocusBoard should still show what it knows. Local-first isn't just a privacy choice — it's a resilience choice.

---

## Phase 2: The First Build

Claude built 26 files in one session. Frontend components, backend routes, integration handlers, config loading — the skeleton of the whole app. It was a big swing, and it mostly landed.

The first practical obstacle: Node.js wasn't installed. Not a bug — just a gap between "this is how to build it" and "this is what your machine needs." Node installed, npm ran, the dev server came up.

Then the first real wall appeared.

---

## Phase 3: The Corporate IT Wall

This experience will be familiar to anyone building internal tooling at a large company.

Standard Atlassian API tokens didn't work on the internal Jira instance. The response was blunt: *"Basic Authentication has been disabled."*

Fine. Try Personal Access Tokens, the newer Atlassian approach. Same result: *"Personal access tokens are disabled on this instance."*

It took investigation to discover that the organisation uses a third-party Jira plugin for API authentication. It generates Bearer tokens through a completely different UI, at a completely different URL, and requires membership in a specific user group.

On top of that: Jira is only reachable on the internal network via VPN. If the VPN client isn't connected, every Jira call silently fails.

Eventually it worked. But it took three different authentication approaches before the right one was found. That's not unusual for enterprise tooling — but it's worth naming, because it's exactly the kind of friction that kills personal productivity projects before they get anywhere.

---

## Phase 4: More Walls

The Jira situation turned out to be a preview of a broader pattern: IT policies at large organisations make it hard to build internal tooling, even for personal use.

**Slack**: Creating a Slack app requires IT approval. There's a request process. It's not a blocker forever, but it's a blocker right now.

**Zoom**: Same story. Creating a Zoom app integration requires IT approval.

**Google**: Creating Google Cloud projects under the corporate account isn't allowed. Had to set up a personal Google Cloud project, configure OAuth credentials there, and use that for Gmail and Calendar access.

**AI API**: The public API waitlist was hit. But an internal LLM gateway was available — by configuring the Anthropic SDK's `baseURL` to point there, the same API calls work through the organisation's approved infrastructure.

None of these were insurmountable. But each one required a detour, a workaround, or a discovery. The total time spent navigating IT and auth walls probably equalled the time spent building features.

---

## Phase 5: The Workarounds

Where the walls couldn't be climbed, tunnels were dug.

**Slack via email**: Slack can send email digests of channel activity and direct messages. By routing these to Gmail, the existing Gmail integration picks them up. Claude AI extracts the action items. It's not real-time, but it covers the most important things.

**Slack via Windows notifications**: A more interesting approach — a PowerShell script that uses the Windows Runtime API to watch for toast notifications from the Slack desktop app. When Slack fires a Windows notification, the watcher captures it and passes it to FocusBoard's backend. This worked, though Slack groups all its notifications into a single toast on Windows, which meant the watcher had to split concatenated titles on channel/sender boundaries to make them useful.

**Zoom**: No integration — just a paste workaround. Meeting AI summaries get copied into FocusBoard's Quick Add. It's manual, but it works.

The Slack situation in particular illustrates something real about building internal tooling at a large company: the official path is often locked, but there's usually a side door if you're willing to look for it.

---

## Phase 6: Feature Iteration

Once the integrations were working, the build shifted into feature iteration. Over many sessions, the app grew organically — use it, find the gap, fill the gap.

The features that got built, roughly in order:

- **Kanban board** with drag-and-drop columns (To Do / In Progress / Waiting / Done / Won't Do)
- **Focus view** — a split-pane layout with the week calendar on top and the Kanban below
- **Source filter tabs** — filter cards by origin (Jira, Gmail, GitHub, etc.)
- **Urgency sorting** — overdue items surface first, then today, then soon, then normal priority
- **Colourblind-safe urgency indicators** — pattern symbols (▲▲▲/◆◆◆/···) alongside colour strips
- **Daily digest** — a morning popup summarising what's on the agenda
- **Dark/light mode** following the Windows system theme
- **Epic filter** for Jira — focus on the epic you're actually working on
- **Calendar day filtering** — click a day, see only the tasks relevant to it
- **Drag-to-schedule** — drag a card onto a calendar day to schedule it
- **Pin to Focus** — send any card to the Focus view for the day
- **Won't Do status** — a first-class way to dismiss cards that aren't going to happen
- **Jira write-back** — moving a card to Done updates the Jira ticket status
- **Jira ticket creation** from non-Jira cards — promote a Gmail action item to a real Jira ticket
- **Closing comment prompt** — when marking a Jira ticket done, prompt for a closing comment
- **AI standup report generator** — one click generates an executive-ready progress summary
- **GitHub integration** — pull requests and CI notifications alongside Jira work
- **Bug report button** — 🐛 creates a GitHub issue with server logs and user action trail automatically

Each of these was a conversation. "Can we add X?" — yes, here's how, here's the code. That rhythm — use it, find the gap, fill the gap — produced a tool that fits the actual workflow rather than a hypothetical one.

---

## Phase 7: Production Hardening

A tool you actually depend on needs to be reliable.

- **PWA support** — install as a native-feeling desktop app
- **Auto-start at Windows login** — scheduled task runs the backend on boot
- **AES-256-GCM encrypted config** — API keys stored encrypted, key derived from the machine. Moving the config file to another machine won't decrypt it.
- **Session cookie auth** — the local server is protected from other network users
- **Google token auto-refresh** — OAuth tokens expire; the backend handles refresh automatically
- **Offline detection** — when network drops, shows stale data clearly rather than silently failing
- **Task cache** — board loads instantly from last sync, no blank screen on startup
- **Structured JSON logging** — useful when debugging integration failures
- **55 automated tests** covering core integration and state logic
- **Automated accessibility testing** — axe-core runs on every CI push
- **ESLint + pre-commit hooks** — code quality gates that run before every commit
- **Dependabot auto-merge** for security patches
- **Auto-update system** via GitHub Releases

---

## The Harder Bugs

A few bugs deserve specific mention because they were instructive.

**The drag offset bug**: Draggable cards in the calendar view were misaligned during drag. After several attempts to fix the coordinate maths, the decision was made to replace drag with a hover "schedule" button. Sometimes the right fix is a different interaction model entirely.

**The crash loop**: FocusBoard would intermittently fail with "can't reach page" errors. Eventually traced to port conflict on restart — the previous process hadn't fully exited before the new one tried to bind. Fixed with an `EADDRINUSE` handler and proper restart logic.

**Config encryption not propagating**: After AES-256-GCM encryption was added to the config loading code, all six backend routes were still reading the plain JSON file. A systematic pass through every route was needed to propagate the change. Classic case of adding a feature but not updating all call sites.

**Slack notification grouping**: Windows aggregates all Slack notifications into a single toast, which meant the watcher received concatenated titles. Had to split these on channel/sender boundaries to produce useful separate action items.

None of these were catastrophic. All of them were educational.

---

## Technical Architecture

```
Browser (localhost:3001)
    |
    | React + Vite + TypeScript
    |
    v
Express Backend (localhost:3001)
    |
    +-- /api/jira       --> Jira REST API (Bearer token, VPN required)
    +-- /api/gmail      --> Google Gmail API (OAuth2)
    +-- /api/calendar   --> Google Calendar API (same OAuth2 token)
    +-- /api/github     --> GitHub API (personal access token)
    +-- /api/report     --> Claude API / internal LLM gateway
    +-- /api/slack      --> Windows notification watcher (PowerShell bridge)
    |
    Config: AES-256-GCM encrypted JSON (key = hostname + username)
    Cache:  Task cache JSON (instant startup)
    Logs:   Structured JSON to local file (7-day rotation)
    Auth:   Session cookie (auto-granted on localhost)
```

Everything runs on the machine. No external services receive data except the APIs being called directly.

---

## Key Decisions

**Local-first**: The single biggest architectural choice. No deployment, no cloud costs, no data leaving the machine. The security conversation was simple because there was nothing to secure externally.

**No state management library**: React's built-in `useState` and `useCallback` handle all state. For a single-user app, Redux or Zustand would add complexity without adding value.

**Backend as proxy**: Every API call goes through the Express backend. This keeps secrets off the frontend and means the frontend doesn't need to know anything about auth mechanisms — which matters when those mechanisms are unusual.

**AI extraction over structured parsing**: Rather than trying to parse Jira filters or Gmail labels into action items, Claude reads raw content and extracts what matters. This handles the messiness of real data far better than any rule-based approach.

**Accessibility from the start**: Colourblind-safe urgency indicators, comprehensive ARIA labels, semantic roles throughout. Not added at the end — baked in from the beginning.

---

## The Real Story

Here's what's actually remarkable about this project:

A non-technical person with ADHD, using AI as their developer, built a production-ready application with encrypted security, automated tests, CI/CD pipeline, multiple live API integrations, and auto-updates. In three days. Without writing a single line of code themselves.

That's not "AI replacing developers." That's AI enabling people who couldn't previously build things to build things.

The skills required weren't technical. They were:
- **Describing a problem clearly** — "a single focus hub where I can see everything at a glance"
- **Making product decisions** — "tabs not swimlanes", "won't do should sit under done"
- **Catching what's wrong** — noticing when something felt off even without knowing why
- **Keeping the quality bar high** — "I want it to be as watertight as I can make it"

The code was Claude's. The product was Brian's.

---

## What's Next

See [ROADMAP.md](ROADMAP.md) for the full picture. In brief:

- **v1.3**: Source toggles, email intelligence, layout presets
- **v2.0**: Plugin architecture, Discourse/community integration
- **v2.1**: Standalone executable (Windows + Mac), proper distribution

---

*Built in June 2026. All code runs locally. No data leaves the machine.*
