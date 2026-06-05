/**
 * @file startup.js
 * Human-readable terminal output for FocusBoard startup.
 * Uses ANSI colour codes — no external dependencies.
 * Only writes to stdout; the structured JSON logger still handles log files.
 */

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const WHITE  = '\x1b[37m';
const BG_BLUE = '\x1b[44m';

function line(text = '') {
  process.stdout.write(text + '\n');
}

export function printBanner(port, nodeVersion) {
  line();
  line(`${BOLD}${BLUE}  ╔══════════════════════════════════════╗${RESET}`);
  line(`${BOLD}${BLUE}  ║  ${WHITE}⚡ FocusBoard${RESET}${BOLD}${BLUE}                         ║${RESET}`);
  line(`${BOLD}${BLUE}  ║  ${DIM}ADHD Task Aggregator${RESET}${BOLD}${BLUE}                  ║${RESET}`);
  line(`${BOLD}${BLUE}  ╚══════════════════════════════════════╝${RESET}`);
  line();
  line(`  ${GREEN}✓${RESET}  Server running at ${BOLD}${CYAN}http://localhost:${port}${RESET}`);
  line(`  ${DIM}   Node ${nodeVersion}${RESET}`);
  line();
}

export function printIntegrationStatus({ jira, google, github, anthropic, slack, features = {} }) {
  line(`  ${BOLD}Integrations${RESET}`);

  const integrations = [
    { key: 'jira',     label: 'Jira',           ok: jira },
    { key: 'gmail',    label: 'Gmail',           ok: google },
    { key: 'calendar', label: 'Calendar',        ok: google },
    { key: 'github',   label: 'GitHub',          ok: github },
    { key: 'slack',    label: 'Slack',           ok: slack },
    { key: 'aiDigest', label: 'Claude AI',       ok: anthropic },
  ];

  for (const { key, label, ok } of integrations) {
    const disabled = features[key] === false;
    if (disabled) {
      line(`  ${DIM}  ○  ${label} — disabled${RESET}`);
    } else if (ok) {
      line(`  ${GREEN}  ✓  ${label}${RESET}`);
    } else {
      line(`  ${YELLOW}  ○  ${label} — not configured${RESET}`);
    }
  }
  line();
}

export function printWarning(message) {
  line(`  ${YELLOW}⚠${RESET}  ${message}`);
}

export function printError(message) {
  line(`  ${RED}✗${RESET}  ${message}`);
}

export function printInfo(message) {
  line(`  ${DIM}ℹ  ${message}${RESET}`);
}

export function printReady() {
  line(`  ${GREEN}${BOLD}Ready.${RESET}  Open ${CYAN}http://localhost:3001${RESET} in your browser.`);
  line(`  ${DIM}  Press Ctrl+C to stop.${RESET}`);
  line();
}

export function printRetrying(port, seconds) {
  line(`  ${YELLOW}⟳${RESET}  Port ${port} in use — retrying in ${seconds}s...`);
}

export function printCrash(err) {
  line();
  line(`  ${RED}${BOLD}✗  FocusBoard crashed${RESET}`);
  line(`  ${DIM}${err.message}${RESET}`);
  if (err.code) line(`  ${DIM}Error code: ${err.code}${RESET}`);
  line(`  ${DIM}Check backend/logs/ for details.${RESET}`);
  line();
}
