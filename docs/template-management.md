# Template Management System

The Docu extension provides a comprehensive template management system that allows you to create, customize, and manage document templates for consistent documentation across your projects.

## Overview

Templates in Docu are Markdown files with YAML front matter that define:
- Template metadata (ID, name, description)
- Variables for dynamic content substitution
- Agent restrictions (which AI agents can use the template)
- Default front matter for generated documents

## Built-in Templates

Docu comes with several built-in templates:

### Basic Template (`basic`)
A simple template for general-purpose documents with title, overview, details, and next steps sections.

### PRD Template (`prd`)
A comprehensive Product Requirements Document template with sections for:
- Executive summary
- Product objectives and success criteria
- User personas
- Scope and constraints
- Acceptance criteria

### Requirements Template (`requirements`)
A structured requirements document template following EARS (Easy Approach to Requirements Syntax) format with:
- User stories
- Acceptance criteria in WHEN/THEN format
- Requirements traceability

## Template Commands

### List Templates
```
/templates list [--agent <agent-name>] [--verbose]
```
- Lists all available templates
- Filter by agent with `--agent` flag
- Show detailed information with `--verbose` flag

### Show Template Details
```
/templates show <template-id>
```
- Shows detailed information about a specific template
- Displays variables, restrictions, and content preview

### Open Template
```
/templates open <template-id> [--mode <edit|view>]
```
- Opens a template in the editor
- Built-in templates open in read-only mode
- User templates can be edited directly
- Use `--mode edit` for editing mode, `--mode view` for viewing

### Validate Template
```
/templates validate <template-id>
```
- Validates template syntax and structure
- Checks YAML front matter
- Validates variable definitions
- Reports errors, warnings, and suggestions

### Create Template
```
/templates create <template-id> [--name <name>] [--description <desc>] [--interactive]
```
- Creates a new user-defined template
- Use `--interactive` to open template creation wizard
- Specify name and description with flags

## User-Defined Templates

### Template Directory
User templates are stored in `.vscode/docu/templates/` within your workspace. The directory structure:

```
.vscode/
└── docu/
    └── templates/
        ├── my-template.md
        ├── api-doc.yaml
        └── meeting-notes.md
```

### Template File Format

Templates use YAML front matter followed by Markdown content:

```yaml
---
id: my-template
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
  - name: priority
    description: Priority level
    required: false
    type: string
    defaultValue: Medium
agentRestrictions:
  - requirements-gatherer
  - solution-architect
frontMatter:
  type: CustomDoc
  version: 1.0
---

# {{title}}

**Author:** {{author}}  
**Priority:** {{priority}}  
**Created:** {{currentDate}}

## Overview

{{overview}}

## Requirements

{{requirements}}

## Implementation Notes

{{implementation}}
```

### Variable Types

Templates support several variable types:

- `string` - Text content
- `number` - Numeric values
- `boolean` - True/false values

### System Variables

Docu provides built-in system variables:

- `{{currentDate}}` - Current date (YYYY-MM-DD)
- `{{currentDateTime}}` - Current date and time (ISO format)
- `{{workspaceRoot}}` - Workspace root directory
- `{{author}}` - Author from Git config or user settings

### Agent Restrictions

Templates can be restricted to specific AI agents:

```yaml
agentRestrictions:
  - prd-creator
  - requirements-gatherer
```

When specified, only listed agents can use the template. Empty array or omitted field means all agents can use it.

## Template Validation

The validation system checks for:

### Errors (Must Fix)
- Invalid YAML syntax in front matter
- Missing required template fields
- Invalid variable names
- Malformed variable brackets `{{}}`

### Warnings (Should Fix)
- Missing template metadata
- Unknown variable types
- Missing variable descriptions

### Info (Consider)
- Templates without variables
- Very long lines
- Missing common variables like `{{title}}`

## Best Practices

### Template Design
1. **Use descriptive IDs** - Choose clear, unique identifiers
2. **Define all variables** - Document purpose and requirements
3. **Provide defaults** - Set sensible default values for optional variables
4. **Structure content** - Use consistent heading hierarchy
5. **Add comments** - Include helpful comments in templates

### Variable Naming
1. **Use camelCase** - `primaryGoal`, `userStory`
2. **Be descriptive** - `acceptanceCriteria` not `ac`
3. **Group related** - `persona1Name`, `persona1Role`
4. **Avoid conflicts** - Don't use system variable names

### Content Organization
1. **Logical flow** - Structure content in logical order
2. **Consistent formatting** - Use consistent Markdown formatting
3. **Helpful placeholders** - Provide guidance in variable descriptions
4. **Modular sections** - Design reusable content blocks

## Template Workflow

### Creating Templates
1. **Plan structure** - Define sections and variables needed
2. **Create template** - Use `/templates create` command
3. **Define variables** - Add variable definitions to front matter
4. **Test template** - Validate and test with sample data
5. **Refine content** - Iterate based on usage feedback

### Using Templates
1. **Browse available** - Use `/templates list` to see options
2. **Review details** - Use `/templates show` to understand variables
3. **Apply template** - Use `/new` command with `--template` flag
4. **Customize content** - Fill in variables and customize as needed

### Maintaining Templates
1. **Regular validation** - Use `/templates validate` periodically
2. **Update documentation** - Keep descriptions current
3. **Version control** - Track template changes in Git
4. **Share templates** - Document templates for team use

## Troubleshooting

### Common Issues

**Template not found**
- Check template ID spelling
- Verify template file exists in `.vscode/docu/templates/`
- Reload templates with `/templates list`

**Validation errors**
- Check YAML syntax in front matter
- Verify variable definitions are complete
- Ensure variable names follow naming rules

**Variables not substituting**
- Check variable name spelling in content
- Verify variables are defined in front matter
- Ensure proper `{{variable}}` syntax

**Agent restrictions not working**
- Verify agent names are correct
- Check if agent supports template restrictions
- Ensure array format in YAML

### Getting Help

1. **Validate templates** - Use validation command to identify issues
2. **Check examples** - Review built-in templates for reference
3. **Test incrementally** - Start simple and add complexity gradually
4. **Use interactive mode** - Create templates with `--interactive` flag

## Advanced Features

### Conditional Content
Templates can include conditional logic using variables:

```markdown
{{#if priority === 'High'}}
⚠️ **HIGH PRIORITY** - Immediate attention required
{{/if}}
```

### Nested Variables
Variables can reference other variables:

```yaml
variables:
  - name: projectName
    description: Project name
    required: true
    type: string
  - name: fileName
    description: Generated filename
    defaultValue: "{{projectName}}-requirements"
    type: string
```

### Template Inheritance
Templates can extend other templates (planned feature):

```yaml
extends: basic
overrides:
  - section: Overview
    content: "Custom overview content"
```

This comprehensive template management system provides flexibility and consistency for all your documentation needs while maintaining ease of use and powerful customization options.