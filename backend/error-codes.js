/**
 * @file error-codes.js
 * Machine-readable error codes for FocusBoard log entries.
 *
 * Every significant error in the backend logs includes one of these codes
 * in the `code` field so log analysis, alerting, and bug reports can
 * identify error categories without parsing message strings.
 *
 * Format: COMPONENT_CONDITION
 * Usage:  logger.error('Jira auth failed', { code: E.JIRA_AUTH_FAILED, ... })
 */

export const E = {
  // ── Jira ─────────────────────────────────────────────────────────────────
  JIRA_CONFIG_MISSING:    'JIRA_CONFIG_MISSING',     // jiraUrl / jiraToken not set
  JIRA_AUTH_FAILED:       'JIRA_AUTH_FAILED',        // 401 / 403 from Jira API
  JIRA_VPN_REQUIRED:      'JIRA_VPN_REQUIRED',       // network error — likely not on VPN
  JIRA_SERVER_ERROR:      'JIRA_SERVER_ERROR',        // 5xx from Jira API
  JIRA_EPIC_FETCH_FAILED: 'JIRA_EPIC_FETCH_FAILED',  // epic name lookup failed (non-fatal)
  JIRA_CREATE_FAILED:     'JIRA_CREATE_FAILED',      // failed to create a Jira ticket

  // ── Google (Gmail / Calendar) ─────────────────────────────────────────────
  GOOGLE_CONFIG_MISSING:  'GOOGLE_CONFIG_MISSING',   // client ID / secret not set
  GOOGLE_AUTH_EXPIRED:    'GOOGLE_AUTH_EXPIRED',     // access token expired, refresh failed
  GOOGLE_AUTH_FAILED:     'GOOGLE_AUTH_FAILED',      // OAuth error (not expired)
  GOOGLE_API_ERROR:       'GOOGLE_API_ERROR',        // generic Google API error
  GMAIL_EXTRACT_FAILED:   'GMAIL_EXTRACT_FAILED',    // Claude extraction error
  GMAIL_FEEDBACK_FAILED:  'GMAIL_FEEDBACK_FAILED',   // feedback write error

  // ── GitHub ────────────────────────────────────────────────────────────────
  GITHUB_CONFIG_MISSING:  'GITHUB_CONFIG_MISSING',   // githubToken not set
  GITHUB_AUTH_FAILED:     'GITHUB_AUTH_FAILED',      // 401 from GitHub API
  GITHUB_API_ERROR:       'GITHUB_API_ERROR',        // generic GitHub API error

  // ── Slack ─────────────────────────────────────────────────────────────────
  SLACK_CONFIG_MISSING:   'SLACK_CONFIG_MISSING',    // token / workspace URL not set
  SLACK_AUTH_FAILED:      'SLACK_AUTH_FAILED',       // 401 from Slack API
  SLACK_API_ERROR:        'SLACK_API_ERROR',         // generic Slack API error

  // ── Anthropic / Claude ────────────────────────────────────────────────────
  ANTHROPIC_KEY_MISSING:  'ANTHROPIC_KEY_MISSING',   // anthropicKey not configured
  ANTHROPIC_API_ERROR:    'ANTHROPIC_API_ERROR',     // Claude API call failed
  ANTHROPIC_PARSE_ERROR:  'ANTHROPIC_PARSE_ERROR',   // Claude response not valid JSON

  // ── Server / infrastructure ───────────────────────────────────────────────
  SERVER_PORT_IN_USE:     'SERVER_PORT_IN_USE',      // EADDRINUSE on startup
  SERVER_NETWORK_ERROR:   'SERVER_NETWORK_ERROR',    // ECONNRESET / ETIMEDOUT on socket
  SERVER_UNCAUGHT:        'SERVER_UNCAUGHT',         // uncaught exception
  SERVER_UNHANDLED:       'SERVER_UNHANDLED',        // unhandled promise rejection

  // ── Config ────────────────────────────────────────────────────────────────
  CONFIG_DECRYPT_FAILED:  'CONFIG_DECRYPT_FAILED',   // AES decryption failed
  CONFIG_WRITE_FAILED:    'CONFIG_WRITE_FAILED',     // couldn't write config.json
  CONFIG_READ_FAILED:     'CONFIG_READ_FAILED',      // couldn't read config.json

  // ── Docker ────────────────────────────────────────────────────────────────
  DOCKER_KEY_MISSING:     'DOCKER_KEY_MISSING',      // FOCUSBOARD_DOCKER=true but no key

  // ── Backup ────────────────────────────────────────────────────────────────
  BACKUP_FAILED:          'BACKUP_FAILED',           // nightly backup write failed
  RESTORE_FAILED:         'RESTORE_FAILED',          // backup restore failed

  // ── Watchdog ──────────────────────────────────────────────────────────────
  WATCHDOG_RESTART_FAILED: 'WATCHDOG_RESTART_FAILED', // PowerShell restart command failed
};
