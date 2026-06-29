# FocusBoard Executable Packaging — Technical Brief

Reference document for building standalone Windows (.exe) and Mac binaries.

---

## Decision: `@yao-pkg/pkg`

**Why not the alternatives:**
- `pkg` (Vercel) — archived, do not use
- `nexe` — stalled, Node 20 support incomplete
- Node SEA — built-in but requires CJS rewrite + custom static file middleware

**Why `@yao-pkg/pkg`:**
- Community fork of vercel/pkg, actively maintained
- Node 20 supported
- `express.static()` works with zero changes (transparent fs patching)
- Assets embedded via `package.json` config, served from snapshot filesystem

---

## Implementation Plan

### Step 1 — Add pkg config to `backend/package.json`

```json
"pkg": {
  "assets": ["../frontend/dist/**/*"],
  "targets": ["node20-win-x64", "node20-mac-x64"]
}
```

### Step 2 — Bundle ESM → CJS before packaging

FocusBoard uses `"type": "module"` (ESM). pkg requires CJS. Add a build step:

```bash
npx esbuild backend/server.js --bundle --platform=node --format=cjs --outfile=build/server.cjs
```

Then pkg the bundle:
```bash
npx @yao-pkg/pkg build/server.cjs --targets node20-win-x64 --output focusboard-win.exe
```

### Step 3 — Fix config.json path

Inside the exe, `__dirname` resolves to the snapshot (virtual) filesystem.
`config.json` must live on the REAL filesystem beside the exe.

Change config path resolution from:
```js
path.join(__dirname, 'config.json')
```
To:
```js
// Use real exe location, not snapshot path
const CONFIG_PATH = process.pkg
  ? path.join(path.dirname(process.execPath), 'config.json')
  : path.join(__dirname, 'config.json');
```

Same applies to `backend/data/` and `backend/logs/`.

### Step 4 — Auto-update: browser redirect (v1, simple)

Change `POST /api/update/apply` to return a redirect URL rather than pulling code.
The frontend already shows the release URL — user clicks through to download new exe.

Self-replace (v2, harder) is a follow-up — Windows locks running exes, needs a side-process workaround.

---

## GitHub Actions Workflow

New file: `.github/workflows/build-executables.yml`

```yaml
name: Build Executables

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    name: Build ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: node20-win-x64
            artifact: focusboard-win-x64.exe
          - os: macos-latest
            target: node20-mac-arm64
            artifact: focusboard-mac-arm64
          - os: macos-13
            target: node20-mac-x64
            artifact: focusboard-mac-x64

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install backend deps
        run: npm install
        working-directory: backend

      - name: Install frontend deps and build
        run: npm install && npm run build
        working-directory: frontend

      - name: Bundle backend ESM → CJS
        run: npx esbuild backend/server.js --bundle --platform=node --format=cjs --outfile=build/server.cjs

      - name: Package executable
        run: npx @yao-pkg/pkg build/server.cjs --targets ${{ matrix.target }} --output ${{ matrix.artifact }}

      - name: Upload to GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: ${{ matrix.artifact }}
```

The existing `release.yml` creates the release. This workflow adds binaries to it. Both run on the same tag push — `softprops/action-gh-release` upserts.

---

## Mac Distribution

Without code signing, Gatekeeper blocks the binary on first run.

**Workaround for users (document in release notes):**

Option A — Right-click → Open (no Terminal needed)

Option B — Remove quarantine attribute:
```bash
xattr -d com.apple.quarantine ./focusboard-mac-arm64
```

Full notarization ($99/year Apple Developer account) is overkill for an internal tool.

---

## Alternative: Docker

Docker deserves serious consideration alongside the exe approach — it may actually be faster and safer for initial distribution.

### Why Docker might be the right first move

**Pros:**
- **No Node.js required** — Docker handles the runtime, user just needs Docker Desktop
- **Identical on Windows and Mac** — one `docker-compose.yml` works everywhere
- **No port conflict crashes** — container restarts cleanly, isolated from host network changes
- **No scheduled task complexity** — Docker Desktop auto-starts containers at login
- **Easy updates** — `docker pull` gets the latest image, no rebuild needed
- **Already familiar to technical users** — developers likely have Docker installed

**Cons:**
- Docker Desktop has a licence cost for commercial use (free for personal/small business)
- Adds ~4GB overhead for Docker Desktop if not already installed
- Windows notifications (Slack watcher) harder to access from inside a container

### What a Docker setup would look like

`docker-compose.yml`:
```yaml
version: '3.8'
services:
  focusboard:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./backend/config.json:/app/backend/config.json
      - ./backend/data:/app/backend/data
      - ./backend/logs:/app/backend/logs
    restart: unless-stopped
```

`Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production
COPY frontend/dist ./frontend/dist
COPY backend ./backend
EXPOSE 3001
CMD ["node", "backend/server.js"]
```

User setup:
```bash
git clone https://github.com/Briancoughlin/FocusBoard
cd focusboard
npm run build --prefix frontend
docker-compose up -d
```

Open http://localhost:3001. Done.

### Publish to GitHub Container Registry (free)

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    push: true
    tags: ghcr.io/briancoughlin/focusboard:latest
```

Users then just run:
```bash
docker run -p 3001:3001 -v $(pwd)/data:/app/backend/data ghcr.io/briancoughlin/focusboard:latest
```

No git clone needed at all.

### Docker vs exe — which first?

| | Docker | exe (pkg) |
|---|---|---|
| Setup complexity | Medium | Low |
| Works on Mac | ✅ Native | ⚠️ Needs signing workaround |
| Works on Windows | ✅ | ✅ |
| Network resilience | ✅ Better isolation | ⚠️ Crashes on network change |
| Slack notifications | ❌ Hard from container | ✅ Native |
| Non-technical users | ⚠️ Needs Docker Desktop | ✅ Double-click |
| Licence cost | ⚠️ Docker Desktop commercial | ✅ Free |
| Updates | ✅ docker pull | ⚠️ Complex self-replace |

**Recommendation:**
- **Docker first** — faster to ship, more reliable, great for technical users
- **exe later** — once Docker proves the concept, wrap it for the broader ADHD community

---

## Key Gotchas

1. **ESM bundling is mandatory** — esbuild step before pkg, always
2. **config.json must be on real filesystem** — use `process.execPath` not `__dirname`
3. **data/ and logs/ same** — must resolve to real filesystem paths
4. **Windows exe is locked while running** — self-replace update needs a side-process helper
5. **Binary size ~80-100MB** — normal, embeds Node runtime
6. **`node-windows` service module** — exclude install-service.js from bundle, it's a developer-only script
7. **Mac: ship both arm64 (M1/M2) and x64 (Intel/Rosetta)** — use macos-latest + macos-13 runners

---

## Files to change when implementing

- `backend/server.js` — fix CONFIG_PATH, data/ and logs/ paths
- `backend/package.json` — add pkg config and build script
- `backend/routes/update.js` — change apply to browser redirect
- `.github/workflows/build-executables.yml` — new file
- `setup.ps1` — update for exe-based install (no npm install/build)
- `README.md` — add exe download instructions
