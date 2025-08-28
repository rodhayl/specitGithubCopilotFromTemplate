# Docu - AI Documentation Assistant

A powerful VS Code extension that provides AI-powered documentation assistance through GitHub Copilot Chat. Docu helps you create, manage, and maintain high-quality documentation using specialized AI agents and intelligent workflows.

## ✨ Features

- **🤖 Specialized AI Agents** - Six specialized agents for different phases of documentation workflow
- **📝 Smart Templates** - Built-in and customizable templates for various document types
- **🔄 Workflow Management** - Guided progression from PRD to requirements to design to implementation
- **⚡ Slash Commands** - Powerful command system for quick document operations
- **🛡️ Security & Privacy** - Comprehensive security measures and data protection
- **📊 Analytics & Debugging** - Built-in telemetry and diagnostic tools
- **🌐 Offline Support** - Graceful degradation when AI features are unavailable

## 🚀 Quick Start

1. **Install the Extension**
   - Install from VS Code Marketplace (coming soon)
   - Or install from VSIX file (see [Installation Guide](docs/installation.md))

2. **Setup GitHub Copilot**
   - Ensure GitHub Copilot is installed and authenticated
   - The extension uses Copilot's language models for AI features

3. **Open Chat**
   - Open GitHub Copilot Chat (`Ctrl+Shift+I` or `Cmd+Shift+I`)
   - Type `@docu` to start interacting with the assistant

4. **Create Your First Document**
   ```
   @docu /new "My Product Requirements" --template prd
   ```

## 🎯 Core Concepts

### AI Agents

Docu includes six specialized AI agents, each designed for specific phases of the documentation workflow:

| Agent | Phase | Purpose |
|-------|-------|---------|
| **PRD Creator** | PRD | Initial product concept exploration and PRD generation |
| **Brainstormer** | PRD | Ideation and concept expansion based on PRD context |
| **Requirements Gatherer** | Requirements | Systematic collection of business requirements using EARS format |
| **Solution Architect** | Design | Technical solution design and system architecture |
| **Specification Writer** | Implementation | Detailed technical specifications and implementation plans |
| **Quality Reviewer** | Implementation | Document validation and quality assurance |

### Workflow Phases

1. **PRD Phase** - Product concept and strategic planning
2. **Requirements Phase** - Detailed business requirements gathering
3. **Design Phase** - Technical architecture and solution design
4. **Implementation Phase** - Specifications and quality assurance

### Templates

- **Built-in Templates** - PRD, Requirements, Basic document templates
- **Custom Templates** - Create your own templates with variables and front-matter
- **Agent-Specific** - Templates can be restricted to specific agents

## 📖 Usage Guide

### Basic Commands

#### Create Documents
```bash
# Create a new document with default template
@docu /new "Document Title"

# Create with specific template
@docu /new "API Documentation" --template basic

# Create with custom path
@docu /new "User Guide" --path docs/user-guide.md
```

#### Manage Templates
```bash
# List all templates
@docu /templates list

# Show template details
@docu /templates show prd

# Create custom template
@docu /templates create my-template --interactive

# Validate template
@docu /templates validate my-template
```

#### Work with Agents
```bash
# List available agents
@docu /agent list

# Switch to specific agent
@docu /agent set requirements-gatherer

# Show current agent
@docu /agent current
```

#### Update Documents
```bash
# Update a section
@docu /update --file README.md --section "Installation" "New installation steps"

# Append to section
@docu /update --file docs/api.md --section "Authentication" --mode append "Additional auth info"
```

#### Review Documents
```bash
# Review with normal level
@docu /review --file requirements.md

# Strict review with auto-fix
@docu /review --file design.md --level strict --fix
```

### Workflow Examples

#### Complete PRD to Implementation Workflow

1. **Start with PRD Creation**
   ```bash
   @docu /agent set prd-creator
   @docu /new "Mobile App PRD" --template prd
   ```

2. **Expand Ideas**
   ```bash
   @docu /agent set brainstormer
   # Engage in conversation about the product concept
   ```

3. **Gather Requirements**
   ```bash
   @docu /agent set requirements-gatherer
   @docu /new "Mobile App Requirements" --template requirements
   ```

4. **Design Solution**
   ```bash
   @docu /agent set solution-architect
   @docu /new "Mobile App Design" --template basic
   ```

5. **Create Specifications**
   ```bash
   @docu /agent set specification-writer
   @docu /new "Mobile App Tasks" --template basic
   ```

6. **Quality Review**
   ```bash
   @docu /agent set quality-reviewer
   @docu /review --file requirements.md --level strict
   ```

## ⚙️ Configuration

### Extension Settings

Configure Docu through VS Code settings (`Ctrl+,` → search "docu"):

#### General Settings
- `docu.defaultDirectory` - Default directory for new documents
- `docu.defaultAgent` - Default agent to use on startup
- `docu.templateDirectory` - Directory for custom templates
- `docu.autoSaveDocuments` - Auto-save created documents

#### Logging Settings
- `docu.logging.level` - Log level (debug, info, warn, error, none)
- `docu.logging.enableConsole` - Enable console logging
- `docu.logging.enableOutputChannel` - Enable output channel logging
- `docu.logging.enableFile` - Enable file logging

#### Telemetry Settings
- `docu.telemetry.enabled` - Enable telemetry collection
- `docu.telemetry.collectUsageData` - Collect usage statistics
- `docu.telemetry.collectPerformanceData` - Collect performance metrics
- `docu.telemetry.anonymizeData` - Anonymize collected data

### Custom Templates

Create custom templates in `.vscode/docu/templates/`:

```yaml
---
id: my-custom-template
name: My Custom Template
description: A template for my specific use case
variables:
  - name: title
    description: Document title
    required: true
    type: string
  - name: author
    description: Document author
    required: false
    type: string
    defaultValue: Unknown
agentRestrictions:
  - requirements-gatherer
---

# {{title}}

**Author:** {{author}}  
**Created:** {{currentDate}}

## Overview

{{overview}}

## Details

{{details}}
```

## 🛠️ Advanced Features

### Security & Privacy

- **Workspace Isolation** - All operations restricted to current workspace
- **Path Validation** - Prevents directory traversal attacks
- **Input Sanitization** - Removes potentially malicious content
- **Data Anonymization** - Telemetry data is anonymized by default

### Offline Support

When GitHub Copilot is unavailable, Docu provides:
- Basic file operations
- Template processing
- Document structure management
- Fallback content generation

### Debugging & Diagnostics

Access debugging tools through the Command Palette:

- `Docu: Show Diagnostics` - View system diagnostics panel
- `Docu: Export Diagnostics` - Export diagnostic report
- `Docu: Show Output Channel` - View extension logs
- `Docu: Clear Logs` - Clear all logs
- `Docu: Toggle Debug Mode` - Enable/disable debug logging

## 🏗️ Development

### Prerequisites

- VS Code 1.97.0 or higher
- Node.js 20.x or higher
- GitHub Copilot subscription

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Compile TypeScript: `npm run compile`
4. Run tests: `npm test`
5. Press `F5` to launch extension development host

### Building

```bash
# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm test

# Package extension
npm run package
```

## 📚 Documentation

### Getting Started
- [Quick Start Guide](docs/quick-start.md) - Get up and running in 5 minutes
- [Complete Tutorial](docs/complete-tutorial.md) - Comprehensive step-by-step guide
- [Installation Guide](docs/installation.md) - Detailed installation instructions
- [Compilation Guide](docs/compilation-guide.md) - Building from source code
- [FAQ](docs/faq.md) - Frequently asked questions and answers
- [Command Reference](docs/command-reference.md) - Complete command syntax guide

### Core Features
- [Agent Guide](docs/agents.md) - Detailed agent documentation
- [Template Management](docs/template-management.md) - Complete template system guide
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

### Examples and Workflows
- [Example Workflows](examples/) - Complete workflow examples
- [Demo Project](examples/demo-project/) - Smart Home Dashboard demo
- [API Documentation Workflow](examples/workflows/api-documentation.md)
- [Requirements Gathering Workflow](examples/workflows/requirements-gathering.md)
- [Feature Development Workflow](examples/workflows/feature-development.md)

### Development
- [Testing Guide](docs/testing.md) - Testing and development information

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues** - Report bugs and request features on [GitHub Issues](https://github.com/docu/vscode-docu-extension/issues)
- **Discussions** - Join the conversation on [GitHub Discussions](https://github.com/docu/vscode-docu-extension/discussions)
- **Documentation** - Check our comprehensive [documentation](docs/)

## 🙏 Acknowledgments

- Built on the excellent [VS Code Extension Template](https://github.com/maxeonyx/vscode-extension-template)
- Powered by [GitHub Copilot](https://github.com/features/copilot)
- Inspired by [Kiro](https://kiro.ai) workflow methodology

---

**Made with ❤️ for the developer community**