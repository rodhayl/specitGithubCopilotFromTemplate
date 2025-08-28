# Installation Guide

This guide provides detailed instructions for installing and setting up the Docu VS Code extension.

## Prerequisites

Before installing Docu, ensure you have:

### Required
- **VS Code 1.97.0 or higher** - [Download VS Code](https://code.visualstudio.com/)
- **GitHub Copilot subscription** - [Get GitHub Copilot](https://github.com/features/copilot)
- **GitHub Copilot extension** - Install from VS Code Marketplace

### Recommended
- **Node.js 20.x or higher** - For development and building from source
- **Git** - For version control and template management

## Installation Methods

### Method 1: VS Code Marketplace (Recommended)

*Coming soon - extension will be available on the VS Code Marketplace*

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Docu - AI Documentation Assistant"
4. Click "Install"

### Method 2: VSIX Package

1. **Download the VSIX file**
   - Download `vscode-docu-extension-0.1.0.vsix` from the releases page
   - Or build from source (see [Building from Source](#building-from-source))

2. **Install via VS Code**
   - Open VS Code
   - Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
   - Type "Extensions: Install from VSIX..."
   - Select the downloaded VSIX file
   - Restart VS Code when prompted

3. **Install via Command Line**
   ```bash
   code --install-extension vscode-docu-extension-0.1.0.vsix
   ```

### Method 3: Building from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/docu/vscode-docu-extension.git
   cd vscode-docu-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile TypeScript**
   ```bash
   npm run compile
   ```

4. **Run tests (optional)**
   ```bash
   npm test
   ```

5. **Package the extension**
   ```bash
   npm run package
   ```
   This creates `vscode-docu-extension-0.1.0.vsix`

6. **Install the package**
   ```bash
   code --install-extension vscode-docu-extension-0.1.0.vsix
   ```

## GitHub Copilot Setup

Docu requires GitHub Copilot to function properly. Follow these steps:

### 1. Install GitHub Copilot Extension

1. Open VS Code Extensions view
2. Search for "GitHub Copilot"
3. Install the official GitHub Copilot extension
4. Restart VS Code

### 2. Authenticate with GitHub

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "GitHub Copilot: Sign In"
3. Follow the authentication flow
4. Authorize VS Code to access your GitHub account

### 3. Verify Copilot Status

1. Open Command Palette
2. Type "GitHub Copilot: Check Status"
3. Ensure status shows "Ready" or "Active"

### 4. Enable Chat Features

1. Ensure you have access to GitHub Copilot Chat
2. Open Copilot Chat (`Ctrl+Shift+I` or `Cmd+Shift+I`)
3. Verify the chat interface opens

## Verification

After installation, verify Docu is working correctly:

### 1. Check Extension Status

1. Open Extensions view (`Ctrl+Shift+X`)
2. Search for "Docu"
3. Verify the extension is installed and enabled
4. Check for any error messages

### 2. Test Chat Participant

1. Open GitHub Copilot Chat (`Ctrl+Shift+I`)
2. Type `@docu` and press space
3. You should see Docu respond with available commands
4. Try a simple command: `@docu /agent list`

### 3. Check Output Channel

1. Open Output panel (`Ctrl+Shift+U`)
2. Select "Docu Extension" from the dropdown
3. Look for initialization messages
4. Check for any error messages

### 4. Test Basic Functionality

Create a test document:
```
@docu /new "Test Document" --template basic
```

If successful, you should see:
- Confirmation message in chat
- New document created in your workspace
- Clickable link to open the document

## Configuration

### Initial Configuration

After installation, configure Docu for your workspace:

1. **Open Settings**
   - `Ctrl+,` (Windows/Linux) or `Cmd+,` (Mac)
   - Search for "docu"

2. **Set Default Directory**
   ```json
   "docu.defaultDirectory": "docs"
   ```

3. **Choose Default Agent**
   ```json
   "docu.defaultAgent": "prd-creator"
   ```

4. **Configure Template Directory**
   ```json
   "docu.templateDirectory": ".vscode/docu/templates"
   ```

### Workspace Configuration

Create `.vscode/settings.json` in your workspace:

```json
{
  "docu.defaultDirectory": "documentation",
  "docu.defaultAgent": "requirements-gatherer",
  "docu.autoSaveDocuments": true,
  "docu.showWorkflowProgress": true,
  "docu.logging.level": "info",
  "docu.telemetry.enabled": true
}
```

### Template Directory Setup

Create the template directory structure:

```bash
mkdir -p .vscode/docu/templates
```

Add a custom template (optional):

```yaml
# .vscode/docu/templates/my-template.md
---
id: my-template
name: My Custom Template
description: A custom template for my team
variables:
  - name: title
    description: Document title
    required: true
    type: string
---

# {{title}}

Created: {{currentDate}}
Author: {{author}}

## Overview

Add your content here...
```

## Troubleshooting

### Common Issues

#### Extension Not Loading

**Symptoms:** Extension appears in list but doesn't respond to `@docu`

**Solutions:**
1. Restart VS Code
2. Check GitHub Copilot is authenticated
3. Verify VS Code version (1.97.0+)
4. Check Output channel for errors

#### Chat Participant Not Found

**Symptoms:** `@docu` not recognized in chat

**Solutions:**
1. Ensure GitHub Copilot Chat is enabled
2. Restart VS Code
3. Reinstall the extension
4. Check extension is activated in Extensions view

#### Permission Errors

**Symptoms:** Cannot create files or directories

**Solutions:**
1. Check workspace folder permissions
2. Ensure VS Code has write access
3. Try different default directory
4. Run VS Code as administrator (Windows)

#### Template Errors

**Symptoms:** Template validation fails or templates not found

**Solutions:**
1. Check template directory path in settings
2. Verify template YAML syntax
3. Ensure template files have correct extensions (.md, .yaml, .yml)
4. Check template variable definitions

### Getting Help

If you encounter issues:

1. **Check Diagnostics**
   - Command Palette → "Docu: Show Diagnostics"
   - Review system information and error logs

2. **Export Diagnostics**
   - Command Palette → "Docu: Export Diagnostics"
   - Share the diagnostic report when reporting issues

3. **Enable Debug Logging**
   - Set `docu.logging.level` to `debug`
   - Command Palette → "Docu: Show Output Channel"
   - Review detailed logs

4. **Report Issues**
   - [GitHub Issues](https://github.com/docu/vscode-docu-extension/issues)
   - Include diagnostic report and steps to reproduce

## Uninstallation

To remove Docu:

### Via VS Code

1. Open Extensions view (`Ctrl+Shift+X`)
2. Find "Docu - AI Documentation Assistant"
3. Click the gear icon → "Uninstall"
4. Restart VS Code

### Via Command Line

```bash
code --uninstall-extension docu.vscode-docu-extension
```

### Clean Up

Remove configuration and templates (optional):

```bash
# Remove workspace configuration
rm .vscode/settings.json

# Remove custom templates
rm -rf .vscode/docu

# Remove global settings (if any)
# Location varies by OS - check VS Code documentation
```

## Next Steps

After successful installation:

1. **Read the [Usage Guide](../README.md#usage-guide)** - Learn basic commands
2. **Explore [Template Management](template-management.md)** - Create custom templates
3. **Review [Agent Guide](agents.md)** - Understand AI agents
4. **Check [Configuration Reference](configuration.md)** - Advanced settings

## Updates

### Automatic Updates

If installed from VS Code Marketplace, updates are automatic.

### Manual Updates

For VSIX installations:

1. Download new VSIX file
2. Uninstall current version
3. Install new VSIX file
4. Restart VS Code

### Version Compatibility

- Check release notes for breaking changes
- Update configuration if needed
- Test functionality after updates

---

**Need help?** Check our [Troubleshooting Guide](troubleshooting.md) or [open an issue](https://github.com/docu/vscode-docu-extension/issues).