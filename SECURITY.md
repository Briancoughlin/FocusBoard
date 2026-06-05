# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.2.x   | ✅ Current |
| < 1.2   | ❌ Please upgrade |

## Reporting a Vulnerability

FocusBoard stores API credentials and connects to work systems. Security issues are taken seriously.

**Please do not report security vulnerabilities as public GitHub issues.**

Instead, report them privately via one of these methods:

1. **GitHub Private Vulnerability Reporting** — use the "Report a vulnerability" button on the [Security tab](https://github.com/Briancoughlin/FocusBoard/security/advisories/new)
2. **Email** — brian.coughlin@unity3d.com

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix if you have one

### What to expect

- Acknowledgement within 48 hours
- Assessment and fix timeline within 7 days for critical issues
- Credit in the changelog if you'd like it

## Security Design

FocusBoard is designed with security in mind:

- All credentials encrypted with AES-256-GCM, tied to the local machine
- No data sent to external servers beyond the APIs you configure
- Session cookie auth on the local API
- Secret scanning runs on every commit via GitHub Actions
- Dependency vulnerabilities scanned weekly via Dependabot

See the [README](README.md#-security) for the full security overview.
