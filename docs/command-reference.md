# Command Reference

This document provides a comprehensive reference for all Docu slash commands and their usage.

## Command Syntax

All Docu commands follow this pattern:
```
@docu /command [arguments] [--options]
```

- **@docu** - Required prefix to invoke Docu chat participant
- **/command** - The command name (required)
- **[arguments]** - Positional arguments (varies by command)
- **[--options]** - Named options with values (optional)

## Document Creation Commands

### /new

Creates a new document with optional template and path specification.

#### Syntax
```bash
@docu /new "Document Title" [--template template-name] [--path directory/]
```

#### Parameters
- **Document Title** (required) - The title of the document to create
- **--template** (optional) - Template to use for document creation
- **--path** (optional) - Directory path where document should be created

#### Examples
```bash
# Create basic document
@docu /new "Getting Started Guide"

# Create with specific template
@docu /new "API Documentation" --template basic

# Create in specific directory
@docu /new "User Manual" --path docs/user-guides/

# Create with template and path
@docu /new "Product Requirements" --template prd --path specs/
```

#### Behavior
- Creates markdown file with kebab-case filename
- Applies specified template or uses basic template
- Creates directory structure if it doesn't exist
- Opens created file in VS Code editor
- Generates clickable file link in chat response

## Agent Management Commands

### /agent list

Lists all available agents with their descriptions and current status.

#### Syntax
```bash
@docu /agent list
```

#### Examples
```bash
@docu /agent list
```

#### Output
```
Available Agents:

🎯 PRD Creator (prd-creator)
   Phase: PRD | Status: Available
   Description: Product concept exploration and PRD generation

💡 Brainstormer (brainstormer)
   Phase: PRD | Status: Available
   Description: Ideation and concept expansion based on PRD context

📋 Requirements Gatherer (requirements-gatherer) ← CURRENT
   Phase: Requirements | Status: Active
   Description: Systematic requirements collection using EARS format

🏗️ Solution Architect (solution-architect)
   Phase: Design | Status: Available
   Description: Technical architecture and design decisions

📝 Specification Writer (specification-writer)
   Phase: Implementation | Status: Available
   Description: Implementation planning and task breakdown

🔍 Quality Reviewer (quality-reviewer)
   Phase: Implementation | Status: Available
   Description: Document validation and improvement suggestions
```

### /agent set

Switches to a specific agent for subsequent interactions.

#### Syntax
```bash
@docu /agent set <agent-name>
```

#### Parameters
- **agent-name** (required) - Name or ID of the agent to activate

#### Examples
```bash
# Switch by full name
@docu /agent set requirements-gatherer

# Switch by short name
@docu /agent set prd-creator

# Switch to quality reviewer
@docu /agent set quality-reviewer
```

#### Behavior
- Changes active agent for current chat session
- Updates system prompt and available tools
- Preserves conversation context when possible
- Shows confirmation of agent switch

### /agent current

Shows information about the currently active agent.

#### Syntax
```bash
@docu /agent current
```

#### Examples
```bash
@docu /agent current
```

#### Output
```
Current Agent: Requirements Gatherer

📋 Requirements Gatherer (requirements-gatherer)
Phase: Requirements
Description: Systematic requirements collection using EARS format
System Prompt: Specialized in gathering and structuring business requirements...
Available Tools: readFile, writeFile, listFiles, applyTemplate, insertSection
Workflow Phase: requirements
```

## Template Management Commands

### /templates list

Lists all available templates with their details.

#### Syntax
```bash
@docu /templates list [--category category-name]
```

#### Parameters
- **--category** (optional) - Filter templates by category

#### Examples
```bash
# List all templates
@docu /templates list

# List templates by category
@docu /templates list --category requirements
```

#### Output
```
Available Templates:

📄 PRD Template (prd)
   Description: Product Requirements Document structure
   Variables: productName, targetUsers, timeline
   Agent Restrictions: prd-creator, brainstormer
   Categories: product, planning

📋 Requirements Template (requirements)
   Description: EARS format requirements document
   Variables: projectName, stakeholder
   Agent Restrictions: requirements-gatherer
   Categories: requirements, ears

📝 Basic Template (basic)
   Description: General document template with front-matter
   Variables: title, author, description
   Agent Restrictions: None
   Categories: general
```

### /templates show

Shows detailed information about a specific template.

#### Syntax
```bash
@docu /templates show <template-name>
```

#### Parameters
- **template-name** (required) - Name or ID of the template

#### Examples
```bash
@docu /templates show prd
@docu /templates show requirements
```

#### Output
```
Template: PRD Template

ID: prd
Name: PRD Template
Description: Product Requirements Document structure
Version: 1.0
Author: Docu Team
Created: 2024-01-15

Variables:
  - productName (string, required): Name of the product
  - targetUsers (number, optional): Target number of users (default: 10000)
  - timeline (string, optional): Development timeline (default: "12 months")

Agent Restrictions:
  - prd-creator
  - brainstormer

Categories:
  - product
  - planning

Content Preview:
# {{productName}} - Product Requirements Document

**Document Version:** 1.0
**Created:** {{currentDate}}
...
```

### /templates create

Creates a new custom template interactively.

#### Syntax
```bash
@docu /templates create <template-name> [--interactive] [--from existing-template]
```

#### Parameters
- **template-name** (required) - Name for the new template
- **--interactive** (optional) - Use interactive creation wizard
- **--from** (optional) - Base new template on existing template

#### Examples
```bash
# Interactive creation
@docu /templates create meeting-notes --interactive

# Create from existing template
@docu /templates create custom-prd --from prd

# Simple creation
@docu /templates create bug-report
```

#### Interactive Process
1. **Basic Information**: Name, description, version
2. **Variables**: Define template variables and types
3. **Agent Restrictions**: Specify which agents can use template
4. **Categories**: Assign template categories
5. **Content**: Define template content with placeholders

### /templates validate

Validates a template's syntax and structure.

#### Syntax
```bash
@docu /templates validate <template-name>
```

#### Parameters
- **template-name** (required) - Name of template to validate

#### Examples
```bash
@docu /templates validate my-custom-template
```

#### Output
```
Template Validation: my-custom-template

✅ YAML syntax is valid
✅ Required fields present
✅ Variable definitions are correct
⚠️  Warning: Variable 'author' has no default value
✅ Content placeholders match defined variables
✅ Agent restrictions are valid

Validation Score: 95/100

Recommendations:
- Consider adding default value for 'author' variable
- Add description for 'priority' variable
```

### /templates open

Opens a template file for editing in VS Code.

#### Syntax
```bash
@docu /templates open <template-name>
```

#### Parameters
- **template-name** (required) - Name of template to open

#### Examples
```bash
@docu /templates open prd
@docu /templates open my-custom-template
```

#### Behavior
- Opens template YAML file in VS Code editor
- Creates file if it doesn't exist (for custom templates)
- Provides template structure if creating new file

## Document Update Commands

### /update

Updates a specific section of an existing document.

#### Syntax
```bash
@docu /update --file <file-path> --section "<section-name>" [--mode replace|append|prepend] "<content>"
```

#### Parameters
- **--file** (required) - Path to the file to update
- **--section** (required) - Name of the section to update
- **--mode** (optional) - Update mode: replace (default), append, or prepend
- **content** (required) - New content for the section

#### Examples
```bash
# Replace section content
@docu /update --file README.md --section "Installation" "New installation instructions here"

# Append to section
@docu /update --file docs/api.md --section "Authentication" --mode append "Additional authentication methods"

# Prepend to section
@docu /update --file guide.md --section "Overview" --mode prepend "Important: This guide has been updated."
```

#### Behavior
- Locates specified section by header
- Updates content according to specified mode
- Creates section if it doesn't exist
- Preserves document structure and formatting
- Shows diff summary of changes made

## Document Review Commands

### /review

Reviews a document for quality, structure, and completeness.

#### Syntax
```bash
@docu /review --file <file-path> [--level light|normal|strict] [--fix]
```

#### Parameters
- **--file** (required) - Path to the file to review
- **--level** (optional) - Review level: light, normal (default), or strict
- **--fix** (optional) - Automatically apply suggested fixes

#### Examples
```bash
# Basic review
@docu /review --file requirements.md

# Strict review
@docu /review --file design.md --level strict

# Review with auto-fix
@docu /review --file README.md --level normal --fix
```

#### Review Levels

**Light Review:**
- Basic structure validation
- Formatting consistency
- Broken links detection

**Normal Review:**
- Content completeness
- Section organization
- Writing quality
- Template compliance

**Strict Review:**
- Detailed content analysis
- Requirements traceability
- Technical accuracy
- Best practices compliance

#### Output
```
Review Results: requirements.md

✅ Document is valid!

Summary:
- Errors: 0
- Warnings: 2
- Info: 3
- Quality Score: 88/100

Issues Found:

⚠️ WARNING: Section "Non-functional Requirements" could be more detailed
   Line 45-50
   💡 Suggestion: Add specific performance metrics and scalability requirements

⚠️ WARNING: Missing traceability to PRD objectives
   💡 Suggestion: Add references to specific PRD sections for each requirement

ℹ️ INFO: Consider adding more edge case scenarios
   💡 Suggestion: Include requirements for error handling and recovery

Applied Fixes (--fix enabled):
✅ Fixed inconsistent heading levels
✅ Corrected markdown formatting
✅ Updated table of contents
```

## Multi-Document Commands

### /summarize

Creates a summary of multiple documents matching a pattern.

#### Syntax
```bash
@docu /summarize --pattern "<glob-pattern>" [--output summary.md]
```

#### Parameters
- **--pattern** (required) - Glob pattern to match files
- **--output** (optional) - Output file for summary (default: summary.md)

#### Examples
```bash
# Summarize all markdown files
@docu /summarize --pattern "*.md"

# Summarize requirements documents
@docu /summarize --pattern "requirements/*.md" --output requirements-summary.md

# Summarize specific file types
@docu /summarize --pattern "docs/**/*.md"
```

#### Output
Creates a summary document with:
- Document inventory
- Key sections from each document
- Cross-references and relationships
- Metadata table

### /catalog

Creates a catalog/index of documents in the workspace.

#### Syntax
```bash
@docu /catalog [--pattern "<glob-pattern>"] [--output index.md]
```

#### Parameters
- **--pattern** (optional) - Glob pattern to match files (default: "**/*.md")
- **--output** (optional) - Output file for catalog (default: index.md)

#### Examples
```bash
# Create full catalog
@docu /catalog

# Catalog specific directory
@docu /catalog --pattern "docs/**/*.md" --output docs-index.md

# Catalog with custom output
@docu /catalog --output project-catalog.md
```

## Diagnostic Commands

### /diagnostics

Shows system diagnostics and health information.

#### Syntax
```bash
@docu /diagnostics [--section all|system|performance|configuration]
```

#### Parameters
- **--section** (optional) - Specific diagnostic section to show

#### Examples
```bash
# Show all diagnostics
@docu /diagnostics

# Show system information only
@docu /diagnostics --section system

# Show performance metrics
@docu /diagnostics --section performance
```

#### Output
```
Docu Diagnostics Report

System Information:
✅ VS Code Version: 1.97.0
✅ Docu Extension Version: 1.0.0
✅ GitHub Copilot: Active
✅ Workspace: /Users/username/project

Performance Metrics:
✅ Average Response Time: 1.2s
✅ Template Load Time: 0.3s
✅ File Operations: 0.1s
⚠️  Large Workspace: 1,500+ files detected

Configuration:
✅ Default Directory: docs/
✅ Template Directory: .vscode/docu/templates/
✅ Logging Level: info
⚠️  Custom templates: 0 found

Recommendations:
- Consider organizing large workspace into subdirectories
- Add custom templates for frequently used document types
```

## Help Commands

### /help

Shows general help information and command overview.

#### Syntax
```bash
@docu /help [command-name]
```

#### Parameters
- **command-name** (optional) - Get help for specific command

#### Examples
```bash
# General help
@docu /help

# Help for specific command
@docu /help new
@docu /help templates
```

## Command Options Reference

### Global Options

These options work with multiple commands:

- **--help** - Show help for the command
- **--verbose** - Show detailed output
- **--quiet** - Suppress non-essential output
- **--dry-run** - Show what would be done without executing

### File Path Options

- **--file** - Specify file path (relative to workspace root)
- **--path** - Specify directory path
- **--output** - Specify output file path

### Content Options

- **--template** - Specify template to use
- **--mode** - Specify operation mode (replace, append, prepend)
- **--level** - Specify intensity level (light, normal, strict)

### Filter Options

- **--pattern** - Glob pattern for file matching
- **--category** - Filter by category
- **--agent** - Filter by agent restriction

## Error Handling

### Common Error Messages

**"Command not recognized"**
- Check command spelling
- Ensure you're using `@docu` prefix
- Verify command exists in this reference

**"File not found"**
- Check file path is relative to workspace root
- Ensure file exists and is accessible
- Verify file permissions

**"Template not found"**
- Check template name spelling
- Use `/templates list` to see available templates
- Ensure custom templates are in correct directory

**"Agent not available"**
- Use `/agent list` to see available agents
- Check agent name spelling
- Ensure GitHub Copilot is active

**"Invalid syntax"**
- Check command syntax against this reference
- Ensure required parameters are provided
- Verify option format (--option value)

### Getting Help

For additional help:
- Use `/help` command for general assistance
- Use `/help command-name` for specific command help
- Check the [FAQ](faq.md) for common issues
- Review [Troubleshooting Guide](troubleshooting.md)

---

**This reference covers all available Docu commands. For examples and workflows, see the [Examples](../examples/) directory.**
</content>