# Complete Docu Tutorial

This comprehensive tutorial will guide you through every aspect of using Docu, from installation to advanced workflows.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Your First Document](#your-first-document)
3. [Understanding Agents](#understanding-agents)
4. [Working with Templates](#working-with-templates)
5. [Complete Workflow Example](#complete-workflow-example)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites Check

Before we begin, ensure you have:
- ✅ VS Code 1.97.0 or higher
- ✅ GitHub Copilot subscription and extension
- ✅ Docu extension installed
- ✅ A workspace folder open in VS Code

### Verification

Let's verify everything is working:

1. **Open GitHub Copilot Chat**
   - Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)
   - The chat panel should open on the side

2. **Test Docu**
   - Type `@docu` in the chat
   - You should see Docu respond with a greeting

3. **Check Available Commands**
   ```
   @docu /help
   ```

If you see a list of available commands, you're ready to proceed!

## Your First Document

Let's create your first document with Docu.

### Step 1: Create a Basic Document

```
@docu /new "My First Document"
```

**What happens:**
- Docu creates a new markdown file
- The file is saved in your workspace
- A clickable link appears in the chat
- The document opens in VS Code

### Step 2: Examine the Created Document

The document should contain:
- A title header
- Basic front-matter (metadata)
- Template structure
- Placeholder content

### Step 3: Create with Template

```
@docu /new "Product Requirements" --template prd
```

**What's different:**
- Uses the PRD (Product Requirements Document) template
- Contains structured sections for product planning
- Includes variables and placeholders
- More comprehensive structure

### Step 4: Specify Location

```
@docu /new "User Guide" --path docs/user-guides/
```

**Result:**
- Creates the document in `docs/user-guides/` directory
- Creates the directory if it doesn't exist
- Maintains organized file structure

## Understanding Agents

Docu uses specialized AI agents for different types of documentation work.

### Meet the Agents

#### 1. PRD Creator 🎯
**Purpose:** Product concept exploration and PRD generation
**Best for:** Starting new products or features
**Specializes in:** Strategic thinking, market analysis, product vision

#### 2. Brainstormer 💡
**Purpose:** Ideation and concept expansion
**Best for:** Exploring possibilities and creative solutions
**Specializes in:** Creative thinking, feature exploration, innovation

#### 3. Requirements Gatherer 📋
**Purpose:** Systematic requirements collection
**Best for:** Detailed business requirements
**Specializes in:** EARS format, user stories, acceptance criteria

#### 4. Solution Architect 🏗️
**Purpose:** Technical architecture and design
**Best for:** System design and technical decisions
**Specializes in:** Architecture patterns, technical trade-offs

#### 5. Specification Writer 📝
**Purpose:** Implementation planning and task breakdown
**Best for:** Development planning and specifications
**Specializes in:** Task decomposition, technical details

#### 6. Quality Reviewer 🔍
**Purpose:** Document validation and improvement
**Best for:** Quality assurance and document review
**Specializes in:** Quality assessment, improvement suggestions

### Working with Agents

#### List Available Agents
```
@docu /agent list
```

#### Switch Agents
```
@docu /agent set prd-creator
```

#### Check Current Agent
```
@docu /agent current
```

### Agent Workflow

The agents are designed to work in sequence:
1. **PRD Creator** → Create product vision
2. **Brainstormer** → Explore ideas and possibilities  
3. **Requirements Gatherer** → Define detailed requirements
4. **Solution Architect** → Design technical solution
5. **Specification Writer** → Plan implementation
6. **Quality Reviewer** → Validate and improve

## Working with Templates

Templates provide structure and consistency for your documents.

### Built-in Templates

#### PRD Template
```
@docu /templates show prd
```
- Product Requirements Document structure
- Variables: productName, targetUsers, timeline
- Sections: Executive Summary, Objectives, Market Analysis

#### Requirements Template  
```
@docu /templates show requirements
```
- EARS format requirements structure
- Variables: projectName, stakeholder
- Sections: User Stories, Acceptance Criteria

#### Basic Template
```
@docu /templates show basic
```
- General document template
- Variables: title, author, description
- Minimal structure for any document type

### Creating Custom Templates

#### Interactive Creation
```
@docu /templates create meeting-notes --interactive
```

**The wizard will ask:**
1. Template name and description
2. Variables to include
3. Default values
4. Agent restrictions
5. Template content

#### Manual Creation

Create `.vscode/docu/templates/bug-report.yaml`:`
``yaml
---
id: bug-report
name: Bug Report Template
description: Template for documenting software bugs
variables:
  - name: bugTitle
    description: Brief description of the bug
    required: true
    type: string
  - name: severity
    description: Bug severity level
    required: false
    type: string
    defaultValue: "Medium"
  - name: reporter
    description: Person reporting the bug
    required: false
    type: string
    defaultValue: "Unknown"
---

# Bug Report: {{bugTitle}}

**Reported by:** {{reporter}}  
**Date:** {{currentDate}}  
**Severity:** {{severity}}

## Description

Brief description of the bug.

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen.

## Actual Behavior

What actually happens.

## Environment

- OS: 
- Browser: 
- Version: 

## Additional Notes

Any additional information.
```

#### Validate Templates
```
@docu /templates validate bug-report
```

## Complete Workflow Example

Let's walk through a complete documentation workflow for a new feature.

### Scenario: User Authentication Feature

We'll document a user authentication feature from concept to implementation.

#### Phase 1: Product Requirements (PRD Creator)

**Step 1: Switch to PRD Creator**
```
@docu /agent set prd-creator
```

**Step 2: Create PRD**
```
@docu /new "User Authentication PRD" --template prd
```

**Step 3: Engage with Agent**
```
I want to add user authentication to our web application. It should support email/password login, social login, and password recovery.
```

**Agent Response:**
The PRD Creator will ask strategic questions:
- What are the business objectives for authentication?
- Who are the target users?
- What security requirements do you have?
- How does this fit into your product roadmap?

**Step 4: Complete PRD Sections**
Work with the agent to fill out:
- Executive Summary
- Product Objectives  
- User Personas
- Success Criteria
- Technical Requirements

#### Phase 2: Ideation (Brainstormer)

**Step 5: Switch to Brainstormer**
```
@docu /agent set brainstormer
```

**Step 6: Explore Ideas**
```
What innovative authentication features could we consider beyond basic login?
```

**Agent Response:**
The Brainstormer might suggest:
- Biometric authentication
- Passwordless login options
- Social login integrations
- Multi-factor authentication
- Single sign-on (SSO)

**Step 7: Refine Ideas**
Discuss and refine the most promising ideas for your use case.

#### Phase 3: Requirements (Requirements Gatherer)

**Step 8: Switch to Requirements Gatherer**
```
@docu /agent set requirements-gatherer
```

**Step 9: Create Requirements Document**
```
@docu /new "User Authentication Requirements" --template requirements
```

**Step 10: Define User Stories**
Work with the agent to create structured requirements:

```
User Story: As a new user, I want to create an account with email and password, so that I can access the application.

Acceptance Criteria:
1. WHEN user provides valid email and password THEN system SHALL create new account
2. WHEN email is already registered THEN system SHALL display appropriate error message
3. WHEN password doesn't meet requirements THEN system SHALL show password criteria
4. WHEN account is created THEN system SHALL send verification email
```

#### Phase 4: Architecture (Solution Architect)

**Step 11: Switch to Solution Architect**
```
@docu /agent set solution-architect
```

**Step 12: Create Architecture Document**
```
@docu /new "User Authentication Architecture" --template basic
```

**Step 13: Design Technical Solution**
Discuss architecture decisions:
- Authentication flow design
- Database schema for users
- Security measures (hashing, tokens)
- API endpoint design
- Integration patterns

#### Phase 5: Implementation Planning (Specification Writer)

**Step 14: Switch to Specification Writer**
```
@docu /agent set specification-writer
```

**Step 15: Create Implementation Plan**
```
@docu /new "User Authentication Implementation" --template basic
```

**Step 16: Break Down Tasks**
The agent will help create detailed implementation tasks:

```markdown
## Implementation Tasks

- [ ] 1. Database Schema Setup
  - Create users table with email, password_hash, created_at fields
  - Add indexes for email lookup performance
  - Create email_verifications table for verification tokens

- [ ] 2. Authentication API Endpoints
  - POST /api/auth/register - User registration
  - POST /api/auth/login - User login
  - POST /api/auth/logout - User logout
  - POST /api/auth/verify-email - Email verification

- [ ] 3. Password Security
  - Implement bcrypt password hashing
  - Add password strength validation
  - Create password reset functionality
```

#### Phase 6: Quality Review (Quality Reviewer)

**Step 17: Switch to Quality Reviewer**
```
@docu /agent set quality-reviewer
```

**Step 18: Review Documents**
```
@docu /review --file "user-authentication-requirements.md" --level strict
```

**Step 19: Address Feedback**
The Quality Reviewer will provide specific feedback and suggestions for improvement.

### Workflow Summary

You now have a complete set of documentation:
1. **PRD** - Strategic product document
2. **Requirements** - Detailed functional requirements  
3. **Architecture** - Technical design decisions
4. **Implementation Plan** - Development roadmap
5. **Quality Reports** - Validation and improvements

## Advanced Features

### Document Updates

#### Update Specific Sections
```
@docu /update --file README.md --section "Installation" "Updated installation instructions here"
```

#### Append to Sections
```
@docu /update --file requirements.md --section "Security Requirements" --mode append "Additional security measures"
```

### Multi-Document Operations

#### Summarize Multiple Documents
```
@docu /summarize --pattern "requirements/*.md" --output requirements-summary.md
```

#### Create Document Catalog
```
@docu /catalog --pattern "docs/**/*.md" --output project-index.md
```

### Template Management

#### List Templates by Category
```
@docu /templates list --category requirements
```

#### Create Template from Existing
```
@docu /templates create custom-prd --from prd
```

### Diagnostics and Debugging

#### System Diagnostics
```
@docu /diagnostics
```

#### Performance Metrics
```
@docu /diagnostics --section performance
```

## Best Practices

### 1. Follow the Agent Workflow

Use agents in their intended sequence for best results:
- Start with PRD Creator for new features
- Use Brainstormer to explore possibilities
- Gather detailed requirements systematically
- Design architecture before implementation
- Plan implementation carefully
- Review everything for quality

### 2. Maintain Document Relationships

- Use consistent naming conventions
- Reference related documents explicitly
- Maintain traceability between phases
- Update related documents when making changes

### 3. Leverage Templates Effectively

- Use built-in templates as starting points
- Create custom templates for repeated document types
- Include meaningful variables and defaults
- Validate templates before using

### 4. Regular Quality Reviews

- Review documents at each phase
- Address quality feedback promptly
- Use strict review level for important documents
- Apply auto-fixes when appropriate

### 5. Organize Your Workspace

```
project/
├── docs/
│   ├── prd/
│   ├── requirements/
│   ├── architecture/
│   └── implementation/
├── .vscode/
│   ├── settings.json
│   └── docu/
│       └── templates/
└── README.md
```

### 6. Configuration Management

- Set appropriate default directories
- Configure logging levels for debugging
- Use workspace-specific settings
- Version control your templates and settings

## Troubleshooting

### Common Issues and Solutions

#### Agent Not Responding
**Problem:** `@docu` doesn't respond in chat
**Solutions:**
1. Check GitHub Copilot is authenticated
2. Restart VS Code
3. Verify extension is enabled
4. Check Output channel for errors

#### Template Errors
**Problem:** Template validation fails
**Solutions:**
1. Check YAML syntax
2. Verify variable definitions
3. Ensure required fields are present
4. Use `/templates validate` command

#### File Creation Fails
**Problem:** Cannot create documents
**Solutions:**
1. Check workspace permissions
2. Verify directory paths
3. Ensure VS Code has write access
4. Try different default directory

#### Performance Issues
**Problem:** Slow response times
**Solutions:**
1. Check internet connection
2. Reduce workspace size if very large
3. Clear VS Code cache
4. Check system resources

### Getting Help

#### Built-in Help
```
@docu /help
@docu /help new
@docu /diagnostics
```

#### Documentation Resources
- [FAQ](faq.md) - Common questions and answers
- [Command Reference](command-reference.md) - Complete command syntax
- [Troubleshooting Guide](troubleshooting.md) - Detailed problem solving

#### Community Support
- [GitHub Issues](https://github.com/docu/vscode-docu-extension/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/docu/vscode-docu-extension/discussions) - Questions and community help

## Next Steps

### Explore Advanced Workflows
- Try the [API Documentation Workflow](../examples/workflows/api-documentation.md)
- Study the [Demo Project](../examples/demo-project/)
- Experiment with custom templates

### Customize for Your Team
- Create team-specific templates
- Set up workspace configurations
- Establish documentation standards
- Train team members on workflows

### Integrate with Your Process
- Include documentation in code reviews
- Set up quality gates
- Automate template validation
- Track documentation metrics

---

**Congratulations!** You've completed the comprehensive Docu tutorial. You now have the knowledge to create professional documentation using AI-powered workflows. Start with simple documents and gradually adopt more advanced features as you become comfortable with the system.

**Happy documenting!** 🚀