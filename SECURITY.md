# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in this extension, please **do not** open a public GitHub issue.

Instead, please report it via one of the following methods:

1. **GitHub Private Vulnerability Reporting** — Use the [Security tab](../../security/advisories/new) in this repository.
2. **Email** — Contact the maintainers directly through the repository profile.

### What to Include

When reporting a vulnerability, please include:

- A clear description of the vulnerability and the potential impact
- Steps to reproduce the issue
- Any relevant VS Code / extension version information
- Proof-of-concept code (if available)

### Response Timeline

- **Acknowledgement**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Resolution or mitigation**: Depends on severity, typically within 30 days for critical issues

### Scope

This extension interacts with:
- The VS Code extension API
- GitHub Copilot Chat API (read-only, no credential storage)
- Local file system (workspace files only, based on user commands)

It does **not**:
- Store or transmit user credentials
- Make external network requests outside of the VS Code LM API
- Have access to systems outside the current VS Code workspace
