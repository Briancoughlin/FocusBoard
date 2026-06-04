# FocusBoard: A Story About Building the Tool You Actually Need

*How a PM with ADHD and an AI assistant spent a few weeks solving a problem that enterprise tooling never could.*

---

## Introduction

FocusBoard is a local-first productivity hub built specifically for one person: Brian Coughlin, a Product Manager at Unity Technologies who has ADHD. It pulls together Jira tickets, Google Calendar events, GitHub pull requests, Slack notifications, and Gmail into a single screen — a Kanban board you can actually trust, sitting in a browser tab at `localhost:3000`, never touching the cloud.

It was built entirely in conversation with Claude. No agency. No dev shop. Just a PM who knew what he needed, and an AI that could write the code.

This is the story of how that happened.

---

## The Problem: Context Switching Is Kryptonite

If you work in a large tech company and you have ADHD, your workday probably looks something like this: you open Jira to check your sprint, a Slack ping pulls you away, you switch to Slack and see a thread that references a calendar invite, you open Calendar, notice a Zoom link, open Zoom, miss the original Jira context entirely, and forty minutes later you're not sure what you were doing.

Brian described it simply: *"I want something that is a single focus hub for my work where I can see everything at a glance without having to swap my actual focus."*

That sentence is the entire product brief. No elaborate spec. No stakeholder review. Just an honest description of a pain that anyone with ADHD — and honestly, plenty of people without it — will recognise immediately.

The existing tools weren't broken. Jira is a perfectly good issue tracker. Gmail works fine. Google Calendar does what it says. The problem was the switching itself — every context switch is a tax on working memory, and with ADHD that tax compounds fast. What Brian needed wasn't a better Jira. He needed a single pane of glass where all the things that require his attention lived together, surfaced by priority, so he could work through them without his brain having to hold the map.

---

## Phase 1: The Idea and the Tech Stack

The first conversation started with a question: *"Is it possible to build something that aggregates actions from email, Jira, Slack, and Calendar?"*

The answer was yes, but with a choice to make. There were two ways to approach it: a cloud-hosted app where data flows through external servers, or a local web app running entirely on the machine. Given that this would connect to Unity's internal Jira, corporate email, and Slack — all with sensitive work data — the local approach was the right call. Everything on `localhost`. No data leaving the machine. API keys stored locally, encrypted.

Brian was happy to let Claude pick the tech. The choices made:

- **Frontend**: React + Vite + TypeScript — fast dev server, good component model, type safety catches mistakes early
- **Backend**: Node.js + Express — simple proxy layer to keep API keys off the frontend
- **AI extraction**: Anthropic Claude API — for pulling structured action items out of messy email threads

One principle guided every decision: if Brian's machine is offline, or Unity's VPN is down, FocusBoard should still show what it knows. Local-first isn't just a privacy choice — it's a resilience choice.

---

## Phase 2: The First Build

Claude built 26 files in one session. Frontend components, backend routes, integration handlers, config loading — the skeleton of the whole app. It was a big swing, and it mostly landed.

The first practical obstacle: Brian didn't have Node.js installed. Not a bug — just a gap between "this is how to build it" and "this is what your machine needs." Node installed, npm ran, the dev server came up.

Then the first real wall appeared.

---

## Phase 3: The Unity Jira Wall

Standard Atlassian API tokens — the kind you generate at `id.atlassian.com` — don't work on Unity's Jira instance. The response was blunt: *"Basic Authentication has been disabled."*

Fine. Try Personal Access Tokens, the newer Atlassian approach. Same result: *"Personal access tokens are disabled on this instance."*

This is a genuinely frustrating moment. The documentation exists, the approach is standard, and Unity's IT configuration had simply locked both doors. It took investigation — looking at Unity's internal Confluence, poking at the Jira instance headers, eventually finding the right page — to discover that Unity uses a third-party plugin called `de.resolution.apitokenauth`. It generates Bearer tokens through a completely different UI, at a completely different URL, and requires membership in the `Engine All` group.

On top of that: the Jira instance is only reachable on the Unity internal network, which means Netbird (Unity's VPN client) has to be running. If Netbird isn't connected, every Jira call silently fails.

Eventually it worked. But it took three different authentication approaches before the right one was found. That's not unusual for enterprise tooling — but it's worth naming, because it's exactly the kind of friction that kills personal productivity projects before they get anywhere.

---

## Phase 4: The Walls Everywhere

The Jira situation turned out to be a preview of a broader pattern: Unity's IT policies make it hard to build internal tooling, even for personal use.

**Slack**: Creating a Slack app requires IT approval. There's a request process. It takes time. It's not a blocker forever, but it's a blocker right now.

**Zoom**: Same story. Creating a Zoom app integration requires IT approval.

**Google**: Unity doesn't allow employees to create Google Cloud projects under the corporate account. Had to set up a personal Google Cloud project, configure OAuth credentials there, and use that for Gmail and Calendar access.

**Anthropic API**: The public API waitlist was hit. This would have been a hard stop — the AI extraction feature is core to making email useful. But Unity has an internal LLM gateway called U-AI, running at `https://uai-litellm.internal.unity.com`. By configuring the Anthropic SDK's `baseURL` to point there, the same API calls work through Unity's approved infrastructure.

None of these were insurmountable. But each one required a detour, a workaround, or a discovery. The total time spent navigating IT/auth walls probably equalled the time spent building features.

---

## Phase 5: The Workarounds

Where the walls couldn't be climbed, tunnels were dug.

**Slack via email**: Slack can send email digests of channel activity and direct messages. By routing these to Gmail, the existing Gmail integration picks them up. Claude AI extracts the action items. It's not real-time, but it covers the most important things.

**Slack via Windows notifications**: A more interesting approach — a PowerShell script that uses the Windows Runtime API to watch for toast notifications from the Slack desktop app. When Slack fires a Windows notification, the watcher captures it and passes it to FocusBoard's backend. This worked, though Slack groups all its notifications into a single toast on Windows, which meant the watcher had to split concatenated titles on channel/sender boundaries to make them useful.

**Zoom**: No integration — just a paste workaround. Meeting AI summaries (from Zoom's built-in AI) get copied into FocusBoard's Quick Add. It's manual, but Zoom meetings aren't usually where action items live in a structured way anyway.

**U-AI gateway**: Configured as the Anthropic base URL. Works transparently — the same code, same API calls, just routed through Unity's internal proxy instead of api.anthropic.com.

The Slack situation in particular illustrates something real about building internal tooling at a large company: the official path is often locked, but there's usually a side door if you're willing to look for it.

---

## Phase 6: Feature Iteration

Once the integrations were working, the build shifted into feature iteration. Over many sessions, the app grew organically — Brian would use it, notice something missing or wrong, and the next session would address it.

The features that got built, roughly in order:

- **Kanban board** with drag-and-drop columns (To Do / In Progress / Done / Won't Do)
- **Focus view** — a split-pane layout with the calendar on the left and the Kanban on the right, for days when you just need to see what's on your plate
- **Source filter tabs**, later renamed to Backlog — filter cards by origin (Jira, Gmail, GitHub, etc.)
- **Urgency sorting** — overdue items surface first, then today, then soon, then normal priority
- **Daily digest** — a morning popup that summarises what's on the agenda before the day starts
- **Dark/light mode** following the Windows system theme, including Windows accent colour theming
- **Epic filter** for Jira — hide noise, focus on the epic you're actually working on
- **Fix version** displayed on Jira cards
- **Calendar day filtering** — click a day, see only the tasks relevant to it
- **Drag-to-schedule** — drag a card onto a calendar day to schedule it
- **Pin to Focus** — send any card to the Focus view for the day
- **Won't Do status** — a first-class way to dismiss cards that aren't going to happen
- **Jira write-back** — moving a card to Done updates the Jira ticket status
- **Jira ticket creation** from non-Jira cards — promote a Gmail action item to a real Jira ticket without leaving FocusBoard
- **Closing comment prompt** — when marking a Jira ticket done, prompt for a closing comment
- **AI standup report generator** — one click, and Claude summarises what you've done and what's next, ready to paste into Slack
- **GitHub integration** — pull requests and CI notifications alongside Jira work
- **Slack channel ID mapper** — maps human-readable channel names to Slack's internal IDs

Each of these was a conversation. "Can we add X?" — yes, here's how, here's the code. That rhythm — use it, find the gap, fill the gap — produced a tool that fits Brian's actual workflow rather than a hypothetical one.

---

## Phase 7: Production Hardening

A tool you actually depend on needs to be reliable. The final phase was less about features and more about making the whole thing robust.

- **PWA support** — manifest and service worker so it can be pinned like a native app
- **Auto-start at Windows login** — a scheduled task runs the backend on boot, so FocusBoard is just there when the machine wakes up
- **AES-256-GCM encrypted config** — API keys and tokens stored encrypted, with the key derived from the machine's hostname and username. Moving the config file to another machine won't decrypt it.
- **Session cookie auth** — the local server is password-protected so other users on the network can't access it
- **Google token auto-refresh** — OAuth tokens expire; the backend now handles refresh automatically
- **Offline detection** — when VPN or network drops, FocusBoard shows stale data clearly rather than silently failing
- **Structured JSON logging** — useful when debugging integration failures
- **43 targeted tests** covering the core integration and state logic
- **ESLint + pre-commit hooks** — code quality gates
- **Dependabot auto-merge** for security patches
- **Auto-update system** via GitHub Releases — when a new version is published, FocusBoard prompts to update

The encrypted config in particular had a painful debugging session attached to it. After encryption was added, all six backend routes were still reading the plain JSON file — a classic case of adding a feature to the loading code but not propagating it to every call site. It took a systematic pass through every route to find and fix all six.

---

## The Harder Bugs

A few bugs deserve specific mention because they were instructive rather than just annoying.

**The drag offset bug**: Draggable cards in the calendar view were misaligned — the card appeared offset from the cursor during drag. The root cause was a combination of scroll position and bounding rect calculations interacting badly with the calendar's CSS layout. After several attempts to fix the maths, the decision was made to replace drag with a hover "schedule" button. Sometimes the right fix is a different interaction model entirely.

**The crash loop**: FocusBoard would intermittently fail with "can't reach page" errors. The symptom was clear; the cause wasn't. Eventually traced to port 3000 being occupied on restart — the previous process hadn't fully exited before the new one tried to bind. Fixed with an `EADDRINUSE` error handler that either kills the occupying process or increments to the next available port.

**Slack notification grouping**: Windows aggregates all notifications from Slack into a single toast notification, which meant the Windows notification watcher was receiving concatenated titles like "Alice in #general · Bob in #engineering." Had to split these on channel/sender boundaries to produce useful separate action items.

None of these were catastrophic. All of them were educational.

---

## Technical Architecture

```
Browser (localhost:3000)
    |
    | React + Vite + TypeScript
    |
    v
Express Backend (localhost:3001)
    |
    +-- /api/jira      --> Unity Jira (Bearer token, Netbird VPN required)
    +-- /api/gmail     --> Google Gmail API (OAuth2, personal GCP project)
    +-- /api/calendar  --> Google Calendar API (same OAuth2 token)
    +-- /api/github    --> GitHub API (personal access token)
    +-- /api/ai        --> U-AI LiteLLM gateway (internal Unity LLM proxy)
    +-- /api/slack     --> Windows notification watcher (PowerShell bridge)
    |
    Config: AES-256-GCM encrypted JSON (key = hostname + username)
    Logs:   Structured JSON to local file
    Auth:   Session cookie (password set on first run)
```

Everything runs on the machine. No external services receive data except the APIs being called (Jira, Google, GitHub) and Unity's internal U-AI gateway. The frontend never sees API keys — everything is proxied through the Express backend.

---

## Key Decisions

**Local-first**: The single biggest architectural choice. It means no deployment, no cloud costs, no data leaving the machine. It also means no mobile access and no sharing with colleagues — acceptable tradeoffs for a personal tool handling work data.

**No state management library**: React's built-in `useState` and `useCallback` handle all state. For a single-user app with no real-time sync, Redux or Zustand would add complexity without adding value.

**Backend as proxy**: Every API call goes through the Express backend. This keeps secrets off the frontend, allows server-side caching, and means the frontend doesn't need to know anything about auth mechanisms — which matters when those mechanisms are unusual (like Unity's Bearer token plugin).

**AES-256-GCM with machine-bound key derivation**: The config file is useless if exfiltrated — it can't be decrypted on another machine. This is a meaningful security property for a file that contains OAuth tokens and API keys.

**AI extraction over structured APIs**: Rather than trying to parse Jira filters or Gmail labels into action items, Claude reads the raw content and extracts what matters. This is slower and costs API calls, but it handles the messiness of real data far better than any rule-based approach.

---

## What's Next

Three directions are worth exploring:

**Electron packaging**: Wrapping FocusBoard in Electron would make it a proper desktop app — an icon in the system tray, no browser required, system notifications, better Windows integration. The backend would bundle inside the Electron main process.

**A proper Slack integration**: The IT approval process for Slack apps takes time but isn't impossible. A real Slack integration would replace the email digest and Windows notification workarounds with a proper event stream — channel messages, DMs, and @mentions surfaced directly.

**Sharing with the Unity ADHD community**: Brian estimated 10–50 Unity colleagues might benefit from something like this. The setup is currently too technical for non-developers, but with a proper installer and a guided first-run flow, it could be shared. That's a different kind of project — building for others always is — but it would be a meaningful one.

---

## Lessons Learned

**The IT wall problem is real and under-discussed.** Building internal tooling at large companies is genuinely hard, not because the technology is hard but because every integration hits an approval process or a non-standard configuration. The skills required aren't just engineering — they're archaeology (find the internal Confluence page that explains the auth plugin), diplomacy (submit the IT request and wait), and creativity (find the workaround when the official path is closed). Brian had all three.

**Local-first is underrated.** Every integration that would have required cloud credentials, cloud storage, or cloud deployment was simpler because nothing needed to leave the machine. The security conversation was simple because there was nothing to secure externally. This tradeoff is right for a lot of personal productivity tooling and is made less often than it should be.

**Building in conversation produces different software.** The feature list wasn't designed upfront — it emerged from use. Features that seemed important in theory (a complex filter system) turned out to matter less than features discovered through friction (the closing comment prompt, the Won't Do status). Software built to be used by the person building it, through an iterative conversation with an AI that can write the code, converges on genuine usefulness faster than most traditional processes.

**The crash is always somewhere you didn't look.** The port conflict bug, the encrypted config not propagating, the drag offset — all of these were in places that seemed like they were already handled. Defensive coding (EADDRINUSE handler, propagating new patterns to all call sites, testing interaction edge cases) matters even in personal tools, maybe especially in personal tools, because there's no support team when it breaks.

**An honest description of the problem is the entire spec.** *"A single focus hub for my work where I can see everything at a glance without having to swap my actual focus."* That sentence, once built into a tool that actually does it, is genuinely useful. Not perfect. Not finished. But useful — and that's what matters.

---

*Built between January and June 2026. All code runs locally. No data leaves the machine.*
