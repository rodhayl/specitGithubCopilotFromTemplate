# Docu Examples

This directory contains example documents, workflows, and templates to help you get started with the Docu extension.

## 📁 Directory Structure

```
examples/
├── workflows/          # Complete workflow examples
├── templates/          # Custom template examples
├── documents/          # Sample generated documents
├── configurations/     # Configuration examples
└── use-cases/         # Specific use case examples
```

## 🚀 Quick Start Examples

### 1. Basic Document Creation

```bash
# Create a simple document
@docu /new "Getting Started Guide" --template basic
```

### 2. PRD Workflow

```bash
# Start with PRD creation
@docu /agent set prd-creator
@docu /new "Mobile App PRD" --template prd

# Expand with brainstorming
@docu /agent set brainstormer
# Engage in conversation about features

# Gather requirements
@docu /agent set requirements-gatherer
@docu /new "Mobile App Requirements" --template requirements
```

### 3. Template Management

```bash
# List available templates
@docu /templates list

# Create custom template
@docu /templates create api-doc --name "API Documentation" --interactive

# Validate template
@docu /templates validate api-doc
```

## 📋 Workflow Examples

### Complete Feature Development

See [workflows/feature-development.md](workflows/feature-development.md) for a complete example of developing a feature from concept to implementation.

### API Documentation

See [workflows/api-documentation.md](workflows/api-documentation.md) for creating comprehensive API documentation.

### Requirements Gathering

See [workflows/requirements-gathering.md](workflows/requirements-gathering.md) for systematic requirements collection.

## 📄 Template Examples

### Custom Templates

- [templates/api-endpoint.md](templates/api-endpoint.md) - API endpoint documentation
- [templates/user-story.md](templates/user-story.md) - User story template
- [templates/technical-spec.md](templates/technical-spec.md) - Technical specification
- [templates/meeting-notes.md](templates/meeting-notes.md) - Meeting notes template

### Template Configurations

- [templates/template-config.yaml](templates/template-config.yaml) - Advanced template configuration
- [templates/variables-example.yaml](templates/variables-example.yaml) - Template variables example

## 🎯 Use Case Examples

### Enterprise Software

- [use-cases/enterprise-software/](use-cases/enterprise-software/) - Enterprise application documentation
- Includes: PRD, requirements, architecture, implementation plans

### Mobile App Development

- [use-cases/mobile-app/](use-cases/mobile-app/) - Mobile application documentation
- Includes: User personas, feature specs, technical requirements

### API Development

- [use-cases/api-development/](use-cases/api-development/) - API documentation workflow
- Includes: API specs, endpoint documentation, integration guides

### Open Source Project

- [use-cases/open-source/](use-cases/open-source/) - Open source project documentation
- Includes: Contributing guides, README templates, issue templates

## ⚙️ Configuration Examples

### Workspace Configuration

```json
// .vscode/settings.json
{
  "docu.defaultDirectory": "docs",
  "docu.defaultAgent": "prd-creator",
  "docu.templateDirectory": ".vscode/docu/templates",
  "docu.autoSaveDocuments": true,
  "docu.showWorkflowProgress": true,
  "docu.logging.level": "info",
  "docu.telemetry.enabled": true
}
```

### Agent Configuration

```yaml
# .vscode/docu/agents/custom-architect.yaml
name: custom-solution-architect
description: Solution architect specialized in microservices
phase: design
systemPrompt: |
  You are a solution architect specializing in microservices architecture.
  Focus on scalability, resilience, and maintainability.
  Consider cloud-native patterns and containerization.
allowedTools:
  - readFile
  - writeFile
  - applyTemplate
  - insertSection
workflowPhase: design
```

### Template Directory Structure

```
.vscode/docu/templates/
├── api-endpoint.md
├── user-story.md
├── technical-spec.md
├── meeting-notes.md
└── custom-prd.yaml
```

## 🔄 Common Workflows

### 1. New Feature Development

```bash
# 1. Create PRD
@docu /agent set prd-creator
@docu /new "User Authentication Feature" --template prd

# 2. Brainstorm implementation approaches
@docu /agent set brainstormer
# Discuss: "What are different ways to implement user authentication?"

# 3. Gather detailed requirements
@docu /agent set requirements-gatherer
@docu /new "Authentication Requirements" --template requirements

# 4. Design architecture
@docu /agent set solution-architect
@docu /new "Authentication Architecture" --template basic

# 5. Create implementation plan
@docu /agent set specification-writer
@docu /new "Authentication Implementation" --template basic

# 6. Review all documents
@docu /agent set quality-reviewer
@docu /review --file authentication-requirements.md --level strict
```

### 2. Documentation Maintenance

```bash
# Review existing documentation
@docu /review --file README.md --level normal

# Update sections as needed
@docu /update --file README.md --section "Installation" "Updated installation steps"

# Validate changes
@docu /review --file README.md --level light
```

### 3. Template Creation and Testing

```bash
# Create new template
@docu /templates create bug-report --interactive

# Validate template
@docu /templates validate bug-report

# Test template
@docu /new "Test Bug Report" --template bug-report

# Review generated document
@docu /review --file test-bug-report.md --level normal
```

## 📊 Analytics and Monitoring

### Usage Analytics

```bash
# View diagnostics
@docu /diagnostics

# Export usage data
@docu /export --type usage-analytics

# Check performance metrics
@docu /diagnostics --section performance
```

### Debug and Troubleshooting

```bash
# Enable debug logging
@docu /debug enable

# View logs
@docu /logs show

# Export diagnostic report
@docu /diagnostics export
```

## 🎓 Learning Path

### Beginner

1. Start with [workflows/basic-usage.md](workflows/basic-usage.md)
2. Try [use-cases/simple-project/](use-cases/simple-project/)
3. Create your first custom template

### Intermediate

1. Complete [workflows/feature-development.md](workflows/feature-development.md)
2. Explore [use-cases/api-development/](use-cases/api-development/)
3. Set up custom agent configurations

### Advanced

1. Create complex multi-agent workflows
2. Develop custom templates with advanced variables
3. Set up automated quality gates
4. Integrate with CI/CD pipelines

## 🤝 Contributing Examples

We welcome contributions of new examples! Please:

1. Follow the existing structure
2. Include clear documentation
3. Test all commands and workflows
4. Add appropriate metadata

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

## 📚 Additional Resources

- [Main Documentation](../README.md)
- [Installation Guide](../docs/installation.md)
- [Agent Guide](../docs/agents.md)
- [Template Management](../docs/template-management.md)
- [Configuration Reference](../docs/configuration.md)

---

**Need help?** Check our [Troubleshooting Guide](../docs/troubleshooting.md) or [open an issue](https://github.com/docu/vscode-docu-extension/issues).