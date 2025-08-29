# Docu Extension Troubleshooting Guide

This guide helps you resolve common issues with the Docu VS Code extension, particularly around offline mode detection and GitHub Copilot integration.

## Quick Fixes

### 1. Extension Shows Offline Mode Incorrectly

**Problem:** Docu reports being offline even when GitHub Copilot is working properly.

**Quick Fix:**
```bash
# Check status
@docu /diagnostics

# Try agent switching to refresh connection
@docu /agent set prd-creator

# If still offline, restart VS Code
```

### 2. GitHub Copilot Authentication Conflicts

**Problem:** Using Docu causes GitHub Copilot to prompt for re-authentication.

**Quick Fix:**
1. Restart VS Code completely
2. Re-authenticate GitHub Copilot if needed:
   - `Ctrl+Shift+P` → "GitHub Copilot: Sign Out"
   - `Ctrl+Shift+P` → "GitHub Copilot: Sign In"

### 3. Template Variable Errors

**Problem:** Getting "Missing required variables" when creating documents.

**Quick Fix:**
```bash
# Use basic template instead
@docu /new "Document Title" --template basic

# Or check what's needed
@docu /templates show prd
```

## Detailed Troubleshooting

### Offline Mode Issues

#### Symptoms
- Extension reports offline status
- Agents provide basic templates instead of AI responses
- Limited functionality available
- Error messages about model availability

#### Root Causes
1. **GitHub Copilot Authentication Problems**
   - Copilot not properly authenticated
   - Authentication token expired
   - Extension conflicts

2. **Model Detection Issues**
   - Timing issues during extension startup
   - Network connectivity problems
   - VS Code API limitations

3. **Extension Initialization Problems**
   - Extension loaded before Copilot
   - Workspace not properly initialized
   - Configuration conflicts

#### Solutions

**Method 1: Restart and Refresh**
1. Close VS Code completely
2. Reopen VS Code and your workspace
3. Wait for all extensions to load
4. Test Docu functionality

**Method 2: Re-authenticate GitHub Copilot**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "GitHub Copilot: Sign Out"
3. Run "GitHub Copilot: Sign In"
4. Complete authentication process
5. Test Docu again

**Method 3: Check Extension Order**
1. Disable Docu extension
2. Restart VS Code
3. Verify GitHub Copilot works
4. Re-enable Docu extension
5. Test functionality

### GitHub Copilot Integration Issues

#### Authentication Interference

**Problem:** Docu causes GitHub Copilot to lose authentication or prompt for re-login.

**Investigation Steps:**
1. Check if issue occurs consistently
2. Note timing (startup, during use, after specific actions)
3. Test with other AI extensions disabled

**Solutions:**
1. **Prevent Conflicts:**
   - Authenticate Copilot before using Docu
   - Avoid rapid switching between AI features
   - Use extensions sequentially rather than simultaneously

2. **Resolve Active Conflicts:**
   - Restart VS Code
   - Re-authenticate both extensions if needed
   - Check for extension updates

#### Model Availability Detection

**Problem:** Docu can't detect available GitHub Copilot models.

**Diagnostic Commands:**
```bash
# Check current status
@docu /diagnostics

# List available agents (should work even offline)
@docu /agent list

# Test basic functionality
@docu /help
```

**Solutions:**
1. **Verify Copilot Status:**
   - Test Copilot in code editor (get suggestions)
   - Try Copilot Chat independently
   - Check Copilot status in VS Code status bar

2. **Refresh Model Detection:**
   - Switch agents: `@docu /agent set prd-creator`
   - Restart VS Code if needed
   - Wait for full extension initialization

### Command and Template Issues

#### Template Variable Errors

**Error Message:**
```
❌ Error creating document: Missing required variables
The PRD template requires specific variables: executiveSummary, primaryGoal1, successCriteria1...
```

**Understanding the Issue:**
- Some templates require specific variables to be defined
- The PRD and Requirements templates have structured formats
- Variables must be provided or placeholders used

**Solutions:**

**Option 1: Use Basic Template**
```bash
@docu /new "Document Title" --template basic --path docs/
```

**Option 2: Check Template Requirements**
```bash
@docu /templates show prd
@docu /templates show requirements
```

**Option 3: Use Placeholders (if supported)**
```bash
@docu /new "Document Title" --template prd --with-placeholders --path docs/
```

#### Command Not Implemented

**Error Message:**
```
Command not implemented yet
```

**Understanding the Issue:**
- Some commands shown in documentation may not be fully implemented
- The extension is under active development
- Some features work through conversation rather than commands

**Workarounds:**

**Instead of `/review --file document.md`:**
```
Switch to Quality Reviewer agent and ask:
"Please review my document at docs/prd.md for completeness and quality"
```

**Instead of `/update --file document.md --section "Requirements"`:**
```
Switch to appropriate agent and ask:
"Please help me update the Requirements section in my document with additional user stories"
```

**Instead of `/catalog --pattern "docs/**/*.md"`:**
```
Ask any agent:
"Please create an index of all documentation files in my docs/ folder"
```

### Agent and Conversation Issues

#### Agents Not Responding Contextually

**Symptoms:**
- Generic responses regardless of input
- No personalized suggestions
- Conversations don't build on previous context

**Causes:**
1. **Offline Mode:** Extension thinks it's offline
2. **Context Loss:** Agent state not maintained
3. **Model Issues:** Problems with underlying AI models

**Solutions:**

**Check Online Status:**
```bash
@docu /agent current
@docu /diagnostics
```

**Improve Prompts:**
- Be specific about your project
- Provide context in each message
- Ask direct questions
- Reference previous work

**Example of Good Prompt:**
```
I'm working on CardCraft, an online card game marketplace. Based on the PRD we developed, help me create user stories for the shopping cart functionality. Focus on competitive players who need to quickly purchase tournament supplies.
```

**Example of Poor Prompt:**
```
Help me with requirements.
```

#### Agent Switching Problems

**Error Message:**
```
❌ Failed to switch to agent: requirements-gatherer
```

**Solutions:**

**Check Available Agents:**
```bash
@docu /agent list
```

**Use Exact Agent Names:**
- `prd-creator` (not "PRD Creator")
- `requirements-gatherer` (not "requirements")
- `solution-architect` (not "architect")
- `specification-writer` (not "spec writer")
- `quality-reviewer` (not "reviewer")
- `brainstormer` (not "brainstorm")

**Correct Commands:**
```bash
@docu /agent set prd-creator
@docu /agent set requirements-gatherer
@docu /agent set solution-architect
@docu /agent set specification-writer
@docu /agent set quality-reviewer
@docu /agent set brainstormer
```

### File and Workspace Issues

#### Document Creation Problems

**Issue:** Files not created in expected locations or permission errors.

**Prerequisites:**
1. **Open Workspace:** Ensure a folder is open in VS Code
   - Use File → Open Folder
   - Select your project directory
   - Verify folder appears in Explorer panel

2. **Check Permissions:** Ensure write access to target directory
   - Avoid system directories
   - Use project-relative paths
   - Create directories manually if needed

**Path Examples:**
```bash
# Good paths (relative to workspace)
@docu /new "Document" --path docs/
@docu /new "Document" --path ./requirements/
@docu /new "Document" --path subfolder/document.md

# Avoid absolute paths or system directories
# Bad: C:\System\document.md
# Bad: /usr/local/document.md
```

#### Workspace Not Detected

**Error Message:**
```
❌ No workspace folder open. Please open a folder in VS Code first.
```

**Solution:**
1. File → Open Folder (or `Ctrl+K Ctrl+O`)
2. Select your project directory
3. Wait for VS Code to load the workspace
4. Verify folder appears in Explorer panel
5. Try Docu command again

### Performance Issues

#### Slow Responses or Timeouts

**Symptoms:**
- Long delays before agent responses
- Timeout errors
- VS Code becomes unresponsive

**Causes:**
1. **Network Issues:** Slow connection to AI services
2. **Large Requests:** Complex prompts or large documents
3. **Resource Constraints:** System performance issues
4. **Extension Conflicts:** Multiple AI extensions running

**Solutions:**

**Immediate Fixes:**
1. **Break Down Requests:** Ask for one section at a time
2. **Simplify Prompts:** Be concise and specific
3. **Check Network:** Ensure stable internet connection

**System Optimization:**
1. **Close Unused Extensions:** Disable unnecessary extensions
2. **Restart VS Code:** Reload window or restart completely
3. **Check System Resources:** Ensure adequate RAM and CPU

**Advanced Troubleshooting:**
1. **Developer Tools:** `Ctrl+Shift+P` → "Developer: Toggle Developer Tools"
2. **Check Console:** Look for error messages or warnings
3. **Extension Logs:** Check VS Code output panel for extension logs

## Diagnostic Information

### System Check Commands

```bash
# Basic functionality test
@docu /help

# Agent system test
@docu /agent list
@docu /agent current

# Template system test
@docu /templates list

# Document creation test
@docu /new "Test Document" --template basic
```

### Information to Collect for Support

When reporting issues, include:

**System Information:**
- VS Code version
- Docu extension version
- GitHub Copilot extension version
- Operating system and version

**Error Details:**
- Exact error messages
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if helpful

**Extension Status:**
- GitHub Copilot authentication status
- Other AI extensions installed
- Workspace configuration

**Diagnostic Output:**
```bash
# Run these and include output
@docu /help
@docu /agent list
@docu /diagnostics  # if available
```

## Prevention Tips

### Best Practices

1. **Setup Order:**
   - Install and authenticate GitHub Copilot first
   - Install Docu extension second
   - Test both independently before using together

2. **Usage Patterns:**
   - Open workspace before using Docu
   - Use one AI extension at a time when possible
   - Save work frequently
   - Use basic templates when in doubt

3. **Maintenance:**
   - Keep extensions updated
   - Restart VS Code periodically
   - Clear extension cache if issues persist

### Avoiding Common Issues

1. **Authentication Problems:**
   - Don't switch rapidly between AI extensions
   - Complete authentication flows fully
   - Restart VS Code after authentication issues

2. **Template Errors:**
   - Start with basic templates
   - Check template requirements before use
   - Use conversational approach for complex documents

3. **Performance Issues:**
   - Break large tasks into smaller parts
   - Close unnecessary applications
   - Use wired internet connection when possible

## Recovery Procedures

### Complete Reset

If multiple issues persist:

1. **Disable Extensions:**
   - Disable Docu extension
   - Disable GitHub Copilot extension
   - Restart VS Code

2. **Re-enable Sequentially:**
   - Enable GitHub Copilot first
   - Test authentication and functionality
   - Enable Docu extension
   - Test basic functionality

3. **Verify Functionality:**
   - Test each agent individually
   - Create test documents
   - Verify conversation capabilities

### Emergency Workarounds

When Docu isn't working properly:

1. **Manual Document Creation:**
   - Create markdown files manually
   - Use basic templates as starting points
   - Copy structure from working examples

2. **Alternative AI Tools:**
   - Use GitHub Copilot Chat directly
   - Use other AI assistants for content
   - Import generated content into Docu templates

3. **Offline Development:**
   - Use Docu's offline templates
   - Follow structured approaches manually
   - Enhance with AI when connectivity returns

---

This troubleshooting guide covers the most common issues with the Docu extension. For additional support or to report bugs, please refer to the extension documentation or support channels.