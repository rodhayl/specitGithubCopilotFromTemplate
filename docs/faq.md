# Frequently Asked Questions (FAQ)

## General Questions

### What is Docu?

Docu is a VS Code extension that provides AI-powered documentation assistance through GitHub Copilot Chat. It uses specialized AI agents to help you create, manage, and maintain high-quality documentation using intelligent workflows.

### How does Docu work?

Docu works through:
1. **Specialized AI Agents** - Six different agents for different documentation phases
2. **Chat Interface** - Interact through GitHub Copilot Chat using `@docu`
3. **Slash Commands** - Powerful commands for document operations
4. **Templates** - Built-in and customizable templates for various document types
5. **Workflow Management** - Guided progression through documentation phases

### Do I need GitHub Copilot?

Yes, Docu requires an active GitHub Copilot subscription as it uses Copilot's language models for AI features. However, basic file operations and template processing work without Copilot.

### What types of documents can Docu help with?

Docu can help with:
- Product Requirements Documents (PRDs)
- Technical requirements and specifications
- System architecture documentation
- Implementation plans and task lists
- API documentation
- User guides and tutorials
- Meeting notes and reports
- Any structured documentation

## Installation and Setup

### How do I install Docu?

1. **From VS Code Marketplace** (coming soon):
   - Open VS Code Extensions panel (`Ctrl+Shift+X`)
   - Search for "Docu"
   - Click Install

2. **From VSIX file**:
   - Download the VSIX file from releases
   - Run `code --install-extension docu-x.x.x.vsix`
   - Or use VS Code Command Palette: "Extensions: Install from VSIX"

### What are the system requirements?

- **VS Code**: Version 1.97.0 or higher
- **Node.js**: Version 20.x or higher (for development)
- **GitHub Copilot**: Active subscription required
- **Operating System**: Windows, macOS, or Linux

### How do I configure Docu?

Configure through VS Code settings (`Ctrl+,` → search "docu"):

```json
{
  "docu.defaultDirectory": "docs",
  "docu.defaultAgent": "prd-creator",
  "docu.templateDirectory": ".vscode/docu/templates",
  "docu.autoSaveDocuments": true,
  "docu.logging.level": "info"
}
```

### Why isn't Docu responding in chat?

Check these common issues:
1. **GitHub Copilot**: Ensure Copilot is active and authenticated
2. **Chat Participant**: Make sure you're using `@docu` prefix
3. **Extension Status**: Check if Docu extension is enabled
4. **Workspace**: Ensure you have a workspace folder open
5. **Permissions**: Check if Copilot has necessary permissions

## Using Agents

### What are the different agents?

1. **PRD Creator** - Product concept exploration and PRD generation
2. **Brainstormer** - Ideation and concept expansion
3. **Requirements Gatherer** - Systematic requirements collection using EARS format
4. **Solution Architect** - Technical architecture and design decisions
5. **Specification Writer** - Implementation planning and task breakdown
6. **Quality Reviewer** - Document validation and improvement suggestions

### How do I switch between agents?

```bash
# List available agents
@docu /agent list

# Switch to specific agent
@docu /agent set requirements-gatherer

# Show current agent
@docu /agent current
```

### Can I use agents in any order?

While agents are designed for a specific workflow (PRD → Requirements → Design → Implementation), you can use them in any order. However, following the intended sequence provides the best results as agents build on context from previous phases.

### How do agents maintain context?

Agents maintain context by:
- Reading related documents in your workspace
- Preserving conversation history within the chat session
- Using document references and links
- Following established naming conventions

## Templates

### What templates are included?

Built-in templates:
- **PRD Template** - Product Requirements Document structure
- **Requirements Template** - EARS format requirements document
- **Basic Template** - General document template with front-matter

### How do I create custom templates?

1. **Interactive Creation**:
   ```bash
   @docu /templates create my-template --interactive
   ```

2. **Manual Creation**:
   - Create YAML file in `.vscode/docu/templates/`
   - Define variables and content structure
   - Use `{{variable}}` placeholders

3. **Example Template**:
   ```yaml
   ---
   id: meeting-notes
   name: Meeting Notes
   description: Template for meeting documentation
   variables:
     - name: meetingTitle
       description: Meeting title
       required: true
       type: string
   ---
   
   # {{meetingTitle}}
   
   **Date:** {{currentDate}}
   **Attendees:** {{attendees}}
   
   ## Agenda
   {{agenda}}
   
   ## Notes
   {{notes}}
   
   ## Action Items
   {{actionItems}}
   ```

### How do I manage templates?

```bash
# List all templates
@docu /templates list

# Show template details
@docu /templates show prd

# Validate template
@docu /templates validate my-template

# Open template for editing
@docu /templates open my-template
```

### Can templates be restricted to specific agents?

Yes, use the `agentRestrictions` field in template YAML:

```yaml
agentRestrictions:
  - requirements-gatherer
  - solution-architect
```

## Commands and Workflows

### What slash commands are available?

#### Document Creation
- `/new "Title"` - Create new document
- `/new "Title" --template prd` - Create with specific template
- `/new "Title" --path docs/` - Create in specific directory

#### Agent Management
- `/agent list` - List available agents
- `/agent set agent-name` - Switch to specific agent
- `/agent current` - Show current agent

#### Template Management
- `/templates list` - List all templates
- `/templates show template-name` - Show template details
- `/templates create template-name` - Create new template

#### Document Operations
- `/update --file path --section "Section"` - Update document section
- `/review --file path --level strict` - Review document quality
- `/summarize --pattern "*.md"` - Summarize multiple documents

### How do I update existing documents?

```bash
# Replace section content
@docu /update --file README.md --section "Installation" "New installation steps"

# Append to section
@docu /update --file docs/api.md --section "Authentication" --mode append "Additional auth info"

# Prepend to section
@docu /update --file guide.md --section "Overview" --mode prepend "Important note:"
```

### What review levels are available?

- **Light** - Basic structure and formatting checks
- **Normal** - Comprehensive content and quality review
- **Strict** - Detailed analysis with improvement suggestions

```bash
# Review with auto-fix
@docu /review --file requirements.md --level strict --fix
```

## Troubleshooting

### Docu isn't working at all

1. **Check Extension Status**:
   - Open Extensions panel (`Ctrl+Shift+X`)
   - Verify Docu is installed and enabled
   - Look for any error indicators

2. **Verify GitHub Copilot**:
   - Ensure Copilot extension is installed
   - Check Copilot authentication status
   - Try using Copilot directly to verify it's working

3. **Check Workspace**:
   - Ensure you have a folder open in VS Code
   - Verify you're not in a restricted workspace

4. **Restart VS Code**:
   - Close and reopen VS Code
   - Try reloading the window (`Ctrl+Shift+P` → "Developer: Reload Window")

### Commands aren't recognized

1. **Use Correct Prefix**: Always start with `@docu`
2. **Check Syntax**: Ensure proper command syntax
3. **Verify Agent**: Some commands work only with specific agents
4. **Check Permissions**: Ensure Copilot has necessary permissions

### Templates aren't loading

1. **Check Template Directory**:
   ```bash
   # Verify template directory setting
   @docu /templates list
   ```

2. **Validate Template Syntax**:
   ```bash
   @docu /templates validate template-name
   ```

3. **Check File Permissions**: Ensure VS Code can read template files

4. **Verify YAML Format**: Check for YAML syntax errors

### Agent context is lost

1. **Stay in Same Workspace**: Don't switch workspaces during workflow
2. **Use Consistent Naming**: Follow naming conventions for related documents
3. **Reference Documents**: Explicitly reference related documents when needed
4. **Maintain Chat Session**: Avoid starting new chat sessions mid-workflow

### Performance issues

1. **Large Workspaces**: Docu may be slower in very large workspaces
2. **Network Issues**: Check internet connection for Copilot API calls
3. **Resource Usage**: Close unnecessary VS Code windows/extensions
4. **Clear Cache**: Restart VS Code to clear any cached data

### File operations fail

1. **Check Permissions**: Ensure VS Code can write to target directory
2. **Verify Paths**: Use relative paths from workspace root
3. **Directory Existence**: Docu creates directories automatically, but check parent paths
4. **File Conflicts**: Check if files are open in other applications

## Advanced Usage

### Can I customize agent behavior?

Currently, agents have predefined behavior optimized for their specific roles. Future versions may support custom agent configurations.

### How do I integrate Docu with CI/CD?

While Docu is primarily an interactive tool, you can:
1. Use generated documentation in CI/CD pipelines
2. Validate documentation structure in automated tests
3. Export templates for use in other tools
4. Use Docu-generated content as input for other documentation tools

### Can I use Docu offline?

Basic features work offline:
- File operations (read, write, list)
- Template processing
- Document structure management

AI features require internet connection for GitHub Copilot.

### How do I backup my templates and configurations?

Templates and configurations are stored in your workspace:
- **Templates**: `.vscode/docu/templates/`
- **Settings**: `.vscode/settings.json`
- **Agent Configs**: `.vscode/docu/agents/` (if customized)

Include these directories in your version control system.

### Can multiple team members use Docu on the same project?

Yes! Docu is designed for team collaboration:
- Templates are shared through workspace configuration
- Generated documents are standard markdown files
- Settings can be committed to version control
- Each team member needs their own GitHub Copilot subscription

## Best Practices

### How should I organize my documentation?

Recommended structure:
```
docs/
├── prd/
│   └── product-requirements.md
├── requirements/
│   └── functional-requirements.md
├── design/
│   └── system-architecture.md
├── implementation/
│   └── development-tasks.md
└── templates/
    ├── custom-prd.yaml
    └── api-spec.yaml
```

### What naming conventions should I use?

- **Files**: Use kebab-case (e.g., `user-authentication-prd.md`)
- **Sections**: Use title case (e.g., "User Authentication")
- **Variables**: Use camelCase (e.g., `{{productName}}`)
- **Templates**: Use kebab-case (e.g., `api-documentation`)

### How do I maintain document quality?

1. **Use Quality Reviewer**: Regularly review documents with the Quality Reviewer agent
2. **Follow Templates**: Use consistent templates for similar document types
3. **Maintain Traceability**: Link related documents and requirements
4. **Regular Updates**: Keep documentation current with implementation
5. **Team Reviews**: Have team members review generated documentation

### When should I use different agents?

- **PRD Creator**: When starting a new product or feature
- **Brainstormer**: When you need to explore ideas and possibilities
- **Requirements Gatherer**: When you need detailed, structured requirements
- **Solution Architect**: When designing technical solutions
- **Specification Writer**: When planning implementation details
- **Quality Reviewer**: When validating and improving existing documents

## Getting Help

### Where can I find more help?

- **Documentation**: Check the [complete documentation](../README.md)
- **Examples**: Review [example workflows](../examples/)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/docu/vscode-docu-extension/issues)
- **Discussions**: Ask questions on [GitHub Discussions](https://github.com/docu/vscode-docu-extension/discussions)

### How do I report a bug?

1. **Check Existing Issues**: Search for similar issues first
2. **Gather Information**:
   - VS Code version
   - Docu extension version
   - GitHub Copilot status
   - Error messages or logs
   - Steps to reproduce

3. **Create Issue**: Use the bug report template on GitHub

### How do I request a feature?

1. **Check Roadmap**: Review planned features first
2. **Search Discussions**: See if others have requested similar features
3. **Create Feature Request**: Use the feature request template
4. **Provide Context**: Explain the use case and expected behavior

### How do I contribute?

See our [Contributing Guide](../CONTRIBUTING.md) for:
- Code contributions
- Documentation improvements
- Template contributions
- Bug reports and feature requests

---

**Still have questions?** Check our [Troubleshooting Guide](troubleshooting.md) or [open a discussion](https://github.com/docu/vscode-docu-extension/discussions) on GitHub.
</content>