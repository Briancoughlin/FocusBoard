# FocusBoard Demo Script

**Total time:** ~4 minutes  
**Audience:** ADHD community, product managers, anyone who context-switches too much  
**Tone:** Honest, personal, not salesy

---

## Before You Start

- Enable **Privacy Mode** (👁 eye icon in the header) if sharing publicly or on LinkedIn
- Make sure FocusBoard has synced recently — you want real data showing
- Have 5 browser tabs ready to open for the opening: Jira, Gmail, Calendar, Slack, GitHub
- The daily digest should appear naturally on first load — if not, click the 📰 newspaper icon

---

## The Script

---

### ACT 1 — The Problem (30 seconds)

*[Open a browser with 5 tabs — Jira, Gmail, Calendar, Slack, GitHub. Show them briefly.]*

> "This is my morning. Five tabs. And the moment I open Slack, I've lost my Jira context. The moment I check Gmail, I've lost my Slack thread. With ADHD, every context switch costs more than it looks — by 10am I've spent an hour switching and done maybe 20 minutes of actual work."

*[Close all tabs. Pause.]*

> "So I built something."

*[Open FocusBoard.]*

---

### ACT 2 — The Morning Digest (30 seconds)

*[The daily digest popup appears automatically. If not, click the 📰 newspaper icon.]*

> "First thing every morning, this appears. Not a notification — a summary. What's overdue. What's due today. What meetings I have. Everything that needs my attention, before I've opened a single other app."

*[Read through the digest naturally — don't rush it.]*

> "That's it. I know what my day looks like."

*[Click 'Let's go.']*

---

### ACT 3 — The Focus View (1 minute)

*[The Focus view loads — calendar on top, kanban below.]*

> "This is the Focus view. Calendar on top, my work below. Not everything — just what's relevant this week, sorted by urgency. Red at the top means overdue. Orange means due today. The rest falls into place."

*[Point to the urgency strips on the cards.]*

> "Notice these colour strips on the cards — they're also coded with patterns for anyone who's colourblind. Triangles for overdue, diamonds for today. Accessibility wasn't an afterthought."

*[Click on a calendar day — Tuesday or Wednesday.]*

> "Click a day and the kanban filters to just what's relevant for that day. Planning Tuesday? You see Tuesday's tasks."

*[Click the day again to deselect.]*

> "Click again — back to the full week."

---

### ACT 4 — The Sidebar (30 seconds)

*[Point to the right sidebar — GitHub, Slack, Gmail sections.]*

> "On the right — everything that needs my attention from other sources. GitHub CI notifications. Slack mentions. Gmail action items that Claude has already extracted for me."

*[Click a GitHub notification to dismiss it.]*

> "I haven't opened GitHub. I haven't opened Slack. I haven't opened Gmail. But I know what needs my attention in all three."

*[Pause.]*

> "That's the point. One screen."

---

### ACT 5 — Jira Integration (45 seconds)

*[Switch to the Backlog view. Show the epic dropdown.]*

> "Over 270 Jira tickets. I filter by the epic I'm actually working on right now."

*[Select an epic from the dropdown.]*

> "Now I see just my work for this initiative. Nothing else."

*[Drag a ticket from To Do to In Progress.]*

> "Watch what happens when I move this card."

*[The Jira comment prompt appears at the bottom right.]*

> "It updated Jira automatically. And it's asking me for a closing comment. I don't need to open Jira. I don't need to remember to update it. It just happens."

---

### ACT 6 — Quick Add (30 seconds)

*[Click the Quick Add button in the header.]*

> "Zoom meeting just ended. The AI generated an action item list."

*[Paste a short bullet list — can be fake for demo purposes.]*

```
- Review PRD before Thursday
- Follow up with engineering on timeline
- Share deck with stakeholders
```

*[Click Extract Tasks.]*

> "Three cards. In the board. Ready to be scheduled or moved to Jira."

*[Close the panel and show the new cards on the board.]*

---

### ACT 7 — The Close (30 seconds)

*[Come back to the Focus view. Let it sit for a moment.]*

> "Jira, Gmail, Google Calendar, Slack, GitHub — all in one place. Sorted by urgency. Updated automatically. With a closing comment prompt so nothing gets lost."

*[Pause.]*

> "I built this in three days. In a chat window with Claude. I can't write code. I'm a PM with ADHD who needed a tool that didn't exist, so I described what I needed and an AI built it."

*[Pause again — let that land.]*

> "That's the real story. Not just what the tool does — but what it means that someone like me could build it."

---

## Tips

**If demoing live (not recording):**
- Keep Privacy Mode on throughout
- Let the daily digest appear naturally — don't skip it
- Don't rush the Jira card move — let the comment prompt appear fully before explaining it
- The pause after "I can't write code" is important — don't fill it

**If recording for LinkedIn:**
- Record in the PWA window (no browser bar — looks more like a real app)
- Keep Privacy Mode on
- Add captions — ADHD audience will appreciate them
- Keep it under 3 minutes for LinkedIn autoplay

**If presenting to leadership/IT:**
- Lead with the security section of the README
- Show the encrypted config (don't need to explain the crypto — just "your credentials never leave your machine")
- Mention the 55 automated tests
- Skip the "I built this in chat" angle — lead with what it does

---

## Common Questions

**"Is it secure?"**
> "All credentials are encrypted with AES-256-GCM and tied to this machine. Nothing leaves the laptop except the API calls to Jira, Gmail, GitHub — the same calls your browser makes when you open those apps normally."

**"Can other people use it?"**
> "Yes — it's open source. The setup takes about 10 minutes. There's a one-command installer. See the README."

**"Does it work on Mac?"**
> "Mostly — Mac packaging is on the roadmap. For now it's Windows-native."

**"What about Slack?"**
> "Slack requires IT approval for a full integration. In the meantime it captures Windows notifications — so you still see mentions and DMs, just slightly differently."

**"Who built this?"**
> "I described what I needed. Claude wrote the code. It took three days."
