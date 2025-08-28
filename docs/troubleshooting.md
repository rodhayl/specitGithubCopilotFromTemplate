# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Docu VS Code extension.

## 🔧 Quick Diagnostics

Before diving into specific issues, run these quick diagnostic checks:

### 1. Check Extension Status
```bash
# Open Command Palette (Ctrl+Shift+P)
> Extensions: Show Installed Extensions
# Find "Docu - AI Documentation Assistant" and verify it's enabled
```

### 2. View Diagnostics Panel
```bash
# Open Command Palette
> Docu: Show Diagnostics
```

### 3. Check Output Channel
```bash
# Open Command Palette
> Docu: Show Output Channel
# Review logs for error messages
```

### 4. Verify GitHub Copilot
```bash
# Open Command Palette
> GitHub Copilot: Check Status
# Ensure status shows "Ready" or "Active"
```

## 🚨 Common Issues

### Extension Not Loading

**Symptoms:**
- Extension appears in Extensions list but doesn't respond
- `@docu` not recognized in chat
- No response to commands

**Causes & Solutions:**

#### 1. VS Code Version Compatibility
**Check:** VS Code version 1.97.0 or higher required
```bash
# Check VS Code version
> Help: About
```
**Solution:** Update VS Code to latest version

#### 2. Extension Not Activated
**Check:** Extension activation status
```bash
# View Output Channel
> Docu: Show Output Channel
# Look for activation messages
```
**Solution:** 
- Restart VS Code
- Reload window (`Ctrl+Shift+P` → "Developer: Reload Window")

#### 3. GitHub Copilot Issues
**Check:** Copilot authentication and status
```bash
> GitHub Copilot: Check Status
```
**Solution:**
- Sign in to GitHub Copilot
- Restart VS Code
- Check Copilot subscription status

---

### Chat Participant Not Found

**Symptoms:**
- `@docu` shows "Participant not found"
- Chat doesn't recognize the participant
- No autocomplete for `@docu`

**Causes & Solutions:**

#### 1. Chat Feature Not Enabled
**Check:** GitHub Copilot Chat availability
```bash
# Try opening Copilot Chat
Ctrl+Shift+I (Windows/Linux) or Cmd+Shift+I (Mac)
```
**Solution:**
- Ensure GitHub Copilot Chat is included in your subscription
- Update GitHub Copilot extension
- Restart VS Code

#### 2. Extension Registration Failed
**Check:** Extension output for registration errors
```bash
> Docu: Show Output Channel
# Look for "Chat participant registered" message
```
**Solution:**
- Check for error messages in output
- Restart VS Code
- Reinstall extension if needed

#### 3. Conflicting Extensions
**Check:** Other chat participant extensions
**Solution:**
- Disable other chat extensions temporarily
- Check for extension conflicts in output

---

### Commands Not Working

**Symptoms:**
- Commands like `/new`, `/agent`, `/templates` don't work
- Error messages when running commands
- Partial command execution

**Causes & Solutions:**

#### 1. Incorrect Command Syntax
**Check:** Command format and parameters
```bash
# Correct format examples:
@docu /new "Document Title" --template basic
@docu /agent set prd-creator
@docu /templates list --verbose
```
**Solution:** Review command syntax in documentation

#### 2. Missing Required Parameters
**Check:** Required parameters for commands
**Solution:**
- Use `@docu /help` to see command usage
- Provide all required parameters
- Check parameter spelling and format

#### 3. Workspace Issues
**Check:** Workspace folder availability
```bash
# Ensure workspace folder is open
> File: Open Folder
```
**Solution:**
- Open a workspace folder
- Check folder permissions
- Verify workspace is not read-only

---

### File Operation Errors

**Symptoms:**
- "Permission denied" errors
- "File not found" errors
- Cannot create or update files

**Causes & Solutions:**

#### 1. Permission Issues
**Check:** File and folder permissions
**Solution:**
- Check workspace folder permissions
- Run VS Code as administrator (Windows)
- Verify user has write access to workspace

#### 2. Path Issues
**Check:** File paths and workspace structure
```bash
# Check current workspace
> File: Show Active File in Explorer
```
**Solution:**
- Use relative paths from workspace root
- Check for typos in file paths
- Ensure directories exist

#### 3. Security Restrictions
**Check:** Security validation in output
**Solution:**
- Ensure paths are within workspace
- Avoid restricted directories (node_modules, .git)
- Check file extension restrictions

---

### Template Issues

**Symptoms:**
- Template not found errors
- Template validation failures
- Variables not substituting correctly

**Causes & Solutions:**

#### 1. Template Directory Configuration
**Check:** Template directory setting
```json
// .vscode/settings.json
{
  "docu.templateDirectory": ".vscode/docu/templates"
}
```
**Solution:**
- Verify template directory exists
- Check directory path is correct
- Create directory if missing

#### 2. Template Syntax Errors
**Check:** Template YAML syntax
```bash
@docu /templates validate <template-id>
```
**Solution:**
- Fix YAML syntax errors
- Validate variable definitions
- Check front matter format

#### 3. Variable Issues
**Check:** Variable names and usage
**Solution:**
- Use `{{variableName}}` format
- Define all variables in front matter
- Check variable name spelling

---

### Agent Issues

**Symptoms:**
- Agent not switching
- Agent responses not relevant
- Agent context issues

**Causes & Solutions:**

#### 1. Agent Configuration
**Check:** Agent configuration files
```bash
@docu /agent list
# Verify all agents are listed
```
**Solution:**
- Check agent configuration files
- Reload agent configurations
- Verify agent definitions

#### 2. Context Issues
**Check:** Agent context and previous outputs
**Solution:**
- Provide clear context in conversations
- Reference previous documents
- Use appropriate agent for task

#### 3. Model Availability
**Check:** Language model access
**Solution:**
- Verify GitHub Copilot is active
- Check model availability
- Try switching agents

---

### Performance Issues

**Symptoms:**
- Slow response times
- High memory usage
- Extension freezing

**Causes & Solutions:**

#### 1. Large Files
**Check:** File sizes and workspace size
**Solution:**
- Limit file sizes for operations
- Use file patterns to exclude large files
- Consider workspace cleanup

#### 2. Memory Usage
**Check:** Extension memory usage
```bash
> Docu: Show Diagnostics
# Check memory usage statistics
```
**Solution:**
- Restart VS Code
- Clear logs and cache
- Reduce log retention

#### 3. Network Issues
**Check:** Network connectivity for Copilot
**Solution:**
- Check internet connection
- Verify proxy settings
- Test Copilot connectivity

---

## 🔍 Advanced Diagnostics

### Enable Debug Logging

1. **Enable Debug Mode**
   ```bash
   > Docu: Toggle Debug Mode
   ```

2. **Set Debug Level in Settings**
   ```json
   {
     "docu.logging.level": "debug"
   }
   ```

3. **View Debug Output**
   ```bash
   > Docu: Show Output Channel
   ```

### Export Diagnostic Report

1. **Generate Report**
   ```bash
   > Docu: Export Diagnostics
   ```

2. **Review Report Contents**
   - System information
   - Error statistics
   - Performance metrics
   - Recent debug information

### Check System Requirements

**Minimum Requirements:**
- VS Code 1.97.0+
- Node.js 20.x+ (for development)
- GitHub Copilot subscription
- Active internet connection

**Recommended:**
- 8GB+ RAM
- SSD storage
- Stable internet connection

## 🛠️ Manual Fixes

### Reset Extension Configuration

1. **Clear Workspace Settings**
   ```bash
   # Remove .vscode/settings.json docu settings
   ```

2. **Reset Global Settings**
   ```bash
   # Open Settings UI
   > Preferences: Open Settings (UI)
   # Search "docu" and reset to defaults
   ```

3. **Clear Extension Data**
   ```bash
   > Docu: Clear Logs
   ```

### Reinstall Extension

1. **Uninstall Extension**
   ```bash
   # Extensions view
   > Extensions: Show Installed Extensions
   # Find Docu extension → Uninstall
   ```

2. **Restart VS Code**

3. **Reinstall Extension**
   ```bash
   # Install from Marketplace or VSIX
   ```

### Workspace Reset

1. **Create New Workspace**
   ```bash
   > File: New Window
   > File: Open Folder
   ```

2. **Test Extension**
   ```bash
   @docu /agent list
   ```

3. **Migrate Configuration**
   - Copy working settings
   - Recreate templates
   - Test functionality

## 📊 Monitoring and Prevention

### Regular Maintenance

1. **Weekly Checks**
   - Review diagnostic panel
   - Check error statistics
   - Clear old logs

2. **Monthly Reviews**
   - Update extension
   - Review configuration
   - Clean up templates

3. **Performance Monitoring**
   - Monitor memory usage
   - Check response times
   - Review error rates

### Best Practices

1. **Configuration Management**
   - Use version control for settings
   - Document custom configurations
   - Test changes in development

2. **Template Management**
   - Validate templates regularly
   - Use consistent naming
   - Document template purposes

3. **Workspace Organization**
   - Keep workspaces clean
   - Use appropriate directory structure
   - Manage file permissions

## 🆘 Getting Help

### Self-Service Resources

1. **Documentation**
   - [Installation Guide](installation.md)
   - [Agent Guide](agents.md)
   - [Template Management](template-management.md)
   - [Configuration Reference](configuration.md)

2. **Examples**
   - [Workflow Examples](../examples/workflows/)
   - [Template Examples](../examples/templates/)
   - [Configuration Examples](../examples/configurations/)

### Community Support

1. **GitHub Discussions**
   - [Ask Questions](https://github.com/docu/vscode-docu-extension/discussions)
   - [Share Solutions](https://github.com/docu/vscode-docu-extension/discussions)
   - [Feature Requests](https://github.com/docu/vscode-docu-extension/discussions)

2. **Issue Reporting**
   - [Bug Reports](https://github.com/docu/vscode-docu-extension/issues)
   - Include diagnostic report
   - Provide reproduction steps

### Professional Support

For enterprise users:
- Priority support available
- Custom configuration assistance
- Training and onboarding

## 📋 Issue Report Template

When reporting issues, please include:

```markdown
## Issue Description
Brief description of the problem

## Environment
- VS Code Version: 
- Docu Extension Version: 
- Operating System: 
- GitHub Copilot Status: 

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Diagnostic Information
[Attach diagnostic report from "Docu: Export Diagnostics"]

## Additional Context
Any other relevant information
```

---

**Still having issues?** Don't hesitate to [open an issue](https://github.com/docu/vscode-docu-extension/issues) or [start a discussion](https://github.com/docu/vscode-docu-extension/discussions). We're here to help!