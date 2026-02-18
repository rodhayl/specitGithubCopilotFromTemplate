# Docu Extension Documentation

Welcome to the comprehensive documentation for the Docu VS Code extension. This directory contains all user-facing documentation for installing, configuring, and using Docu.

## 📚 Documentation Structure

### Getting Started

- **[Installation](installation.md)** - How to install and set up Docu
- **[Quick Start](quick-start.md)** - 5-minute guide to get up and running
- **[Complete Tutorial](complete-tutorial.md)** - In-depth tutorial covering all features

### Core Documentation

- **[Agent Guide](agents.md)** - Comprehensive guide to all 6 AI agents
- **[Command Reference](command-reference.md)** - Complete command documentation
- **[Template Management](template-management.md)** - Working with document templates
- **[Compilation Guide](compilation-guide.md)** - Development and compilation instructions

### Help & Support

- **[FAQ](faq.md)** - Frequently asked questions
- **[Troubleshooting](troubleshooting.md)** - Solutions to common issues
- **[Video Tutorial Script](video-tutorial-script.md)** - Script for video walkthroughs

## 🚀 Quick Navigation

**New Users:**
1. Start with [Installation](installation.md)
2. Follow the [Quick Start](quick-start.md)
3. Explore [Agent Guide](agents.md)

**Experienced Users:**
- [Command Reference](command-reference.md) - All commands
- [Template Management](template-management.md) - Custom templates
- [FAQ](faq.md) - Common questions

**Developers:**
- [Compilation Guide](compilation-guide.md) - Build from source
- [Contributing Guidelines](../CONTRIBUTING.md) - How to contribute

## 📖 Key Concepts

### Agents

Docu includes 6 specialized AI agents for different documentation phases:

1. **PRD Creator** - Product requirements documents
2. **Brainstormer** - Ideation and concept exploration
3. **Requirements Gatherer** - Structured requirements collection
4. **Solution Architect** - Technical design and architecture
5. **Specification Writer** - Implementation specifications
6. **Quality Reviewer** - Document validation and review

Learn more in the [Agent Guide](agents.md).

### Templates

Templates provide structure for your documentation:

- **Built-in Templates** - PRD, Requirements, Basic
- **Custom Templates** - Create your own in `.vscode/docu/templates/`
- **Variables** - Dynamic content with template variables
- **Front Matter** - Metadata and configuration

Learn more in [Template Management](template-management.md).

### Commands

Docu provides powerful slash commands:

- `/new` - Create new documents
- `/agent` - Manage AI agents
- `/templates` - Work with templates
- `/review` - Quality assurance
- `/help` - Get help

See [Command Reference](command-reference.md) for complete list.

## 🔍 Finding Information

**Looking for...**

- **How to install?** → [Installation](installation.md)
- **How to create a PRD?** → [Quick Start](quick-start.md) or [Agent Guide](agents.md)
- **Command not working?** → [Troubleshooting](troubleshooting.md)
- **Custom templates?** → [Template Management](template-management.md)
- **Agent capabilities?** → [Agent Guide](agents.md)
- **Common errors?** → [FAQ](faq.md)

## 📝 Documentation Best Practices

When using Docu, follow these documentation practices:

### DO:
- ✅ Use CHANGELOG.md for tracking changes (one line per change)
- ✅ Update README.md for user-facing changes
- ✅ Use git commit messages for detailed implementation notes
- ✅ Add code comments and JSDoc for technical details
- ✅ Keep documentation current and accurate

### DON'T:
- ❌ Create implementation reports or completion summaries
- ❌ Create separate code review documents
- ❌ Create status or progress documents in the repository

See [Agent Guide - Documentation Management](agents.md#documentation-management-important) for detailed best practices.

## 🏗️ Directory Structure

```
docs/
├── README.md                    # This file - documentation overview
├── agents.md                    # Complete agent guide
├── command-reference.md         # All commands documented
├── compilation-guide.md         # Build and development guide
├── complete-tutorial.md         # In-depth tutorial
├── faq.md                       # Frequently asked questions
├── installation.md              # Installation instructions
├── quick-start.md               # Quick start guide
├── template-management.md       # Template documentation
├── testing.md                   # Testing guide (single source of truth)
├── troubleshooting.md           # Problem solving guide
└── video-tutorial-script.md     # Video walkthrough script
```

## 🤝 Contributing

Found an issue with the documentation? Want to improve it?

1. Check [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines
2. Open an issue or pull request
3. Follow the documentation best practices above

## 📦 External Resources

- **GitHub Repository**: [github.com/your-username/vscode-docu-extension](https://github.com/your-username/vscode-docu-extension)
- **VS Code Marketplace**: [marketplace.visualstudio.com](https://marketplace.visualstudio.com)
- **Issue Tracker**: [github.com/your-username/vscode-docu-extension/issues](https://github.com/your-username/vscode-docu-extension/issues)

## 📄 License

See [LICENSE.md](../LICENSE.md) for licensing information.

---

**Next Steps:**
- New to Docu? Start with [Quick Start](quick-start.md)
- Want to learn agents? Read [Agent Guide](agents.md)
- Need help? Check [FAQ](faq.md) and [Troubleshooting](troubleshooting.md)
- Building from source? See [Compilation Guide](compilation-guide.md)
