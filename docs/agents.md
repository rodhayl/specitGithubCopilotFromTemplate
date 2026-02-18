# Agent Guide

This guide provides comprehensive information about Docu's AI agents, their capabilities, and how to use them effectively in your documentation workflow.

## Overview

Docu includes six specialized AI agents, each designed for specific phases of the documentation workflow. These agents follow a Kiro-inspired methodology, progressing from initial product concepts to detailed implementation specifications.

## Agent Architecture

### Agent Phases

The agents are organized into four main workflow phases:

1. **PRD Phase** - Product concept and strategic planning
2. **Requirements Phase** - Detailed business requirements gathering  
3. **Design Phase** - Technical architecture and solution design
4. **Implementation Phase** - Specifications and quality assurance

### Agent Capabilities

Each agent has:
- **Specialized System Prompts** - Tailored for their specific role
- **Tool Access** - Restricted to relevant tools for their phase
- **Template Restrictions** - Can only use appropriate templates
- **Context Awareness** - Builds upon previous agents' outputs

## Agent Profiles

### 1. PRD Creator Agent

**Phase:** PRD  
**Purpose:** Initial product concept exploration and PRD generation

#### Capabilities
- Strategic product questioning
- Market analysis guidance
- User persona development
- Success criteria definition
- Executive summary creation

#### Best Used For
- New product ideation
- Product concept validation
- Strategic planning sessions
- Stakeholder alignment
- Initial product documentation

#### System Prompt Focus
- Asks strategic questions about goals, users, scope, and constraints
- Guides through product discovery process
- Helps identify key success metrics
- Facilitates stakeholder discussions

#### Example Interactions
```bash
@docu /agent set prd-creator
@docu /new "Mobile Banking App PRD" --template prd

# The agent will guide you through:
# - Product vision and objectives
# - Target user identification
# - Market opportunity analysis
# - Success criteria definition
# - Scope and constraints
```

#### Templates Available
- `prd` - Comprehensive PRD template
- `basic` - Simple document template

---

### 2. Brainstormer Agent

**Phase:** PRD  
**Purpose:** Ideation and concept expansion based on PRD context

#### Capabilities
- Open-ended ideation sessions
- Concept exploration and expansion
- Creative problem-solving
- Feature brainstorming
- Innovation facilitation

#### Best Used For
- Expanding on PRD concepts
- Feature ideation sessions
- Creative problem-solving
- Exploring alternative approaches
- Innovation workshops

#### System Prompt Focus
- Encourages creative thinking
- Asks clarifying questions
- Suggests related concepts
- Builds upon existing ideas
- Facilitates brainstorming sessions

#### Example Interactions
```bash
@docu /agent set brainstormer

# Engage in conversation:
"I want to explore innovative features for our mobile banking app"
"What are some creative ways to improve user onboarding?"
"How can we differentiate from competitors?"
```

#### Templates Available
- `basic` - General purpose template
- Custom templates without restrictions

---

### 3. Requirements Gatherer Agent

**Phase:** Requirements  
**Purpose:** Systematic collection and structuring of business requirements

#### Capabilities
- EARS format requirements
- User story creation
- Acceptance criteria definition
- Requirements traceability
- Stakeholder requirement analysis

#### Best Used For
- Formal requirements documentation
- User story development
- Acceptance criteria definition
- Requirements validation
- Compliance documentation

#### System Prompt Focus
- Follows EARS (Easy Approach to Requirements Syntax) methodology
- Creates structured user stories
- Defines clear acceptance criteria
- Ensures requirements traceability
- Validates completeness

#### Example Interactions
```bash
@docu /agent set requirements-gatherer
@docu /new "Banking App Requirements" --template requirements

# The agent will help create:
# - User stories in "As a... I want... So that..." format
# - EARS format acceptance criteria
# - Requirements hierarchy
# - Traceability matrices
```

#### Templates Available
- `requirements` - EARS format requirements template
- `basic` - General purpose template

---

### 4. Solution Architect Agent

**Phase:** Design  
**Purpose:** Technical solution design and system architecture

#### Capabilities
- Architecture pattern recommendations
- Technical decision guidance
- System design documentation
- Technology stack selection
- Integration planning

#### Best Used For
- System architecture design
- Technical specification creation
- Technology selection
- Integration planning
- Technical risk assessment

#### System Prompt Focus
- Focuses on technical decisions and trade-offs
- Recommends architecture patterns
- Considers scalability and performance
- Addresses technical constraints
- Plans system integrations

#### Example Interactions
```bash
@docu /agent set solution-architect
@docu /new "Banking App Architecture" --template basic

# The agent will guide you through:
# - Architecture patterns selection
# - Technology stack decisions
# - System component design
# - Integration strategies
# - Performance considerations
```

#### Templates Available
- `basic` - General purpose template
- Custom architecture templates

---

### 5. Specification Writer Agent

**Phase:** Implementation  
**Purpose:** Detailed technical specifications and implementation plans

#### Capabilities
- Implementation task breakdown
- Technical specification writing
- API documentation
- Development planning
- Task prioritization

#### Best Used For
- Implementation planning
- Technical specification creation
- Development task breakdown
- API documentation
- Sprint planning

#### System Prompt Focus
- Creates actionable implementation tasks
- Provides technical implementation details
- Breaks down complex features
- Considers development dependencies
- Plans testing strategies

#### Example Interactions
```bash
@docu /agent set specification-writer
@docu /new "Banking App Implementation Plan" --template basic

# The agent will help create:
# - Detailed implementation tasks
# - Technical specifications
# - API definitions
# - Testing strategies
# - Development milestones
```

#### Templates Available
- `basic` - General purpose template
- Custom implementation templates

---

### 6. Quality Reviewer Agent

**Phase:** Implementation  
**Purpose:** Document validation and quality assurance

#### Capabilities
- Document quality assessment
- Consistency checking
- Completeness validation
- Style and format review
- Improvement recommendations

#### Best Used For
- Document quality assurance
- Consistency validation
- Completeness checking
- Style guide enforcement
- Final review processes

#### System Prompt Focus
- Applies strict review criteria
- Checks for completeness and consistency
- Validates against standards
- Provides concrete improvement suggestions
- Ensures quality compliance

#### Example Interactions
```bash
@docu /agent set quality-reviewer
@docu /review --file requirements.md --level strict --fix

# The agent will:
# - Analyze document structure
# - Check for completeness
# - Validate consistency
# - Suggest improvements
# - Apply fixes if requested
```

#### Templates Available
- All templates (for review purposes)

## Agent Management

### Switching Agents

```bash
# List all available agents
@docu /agent list

# Switch to specific agent
@docu /agent set <agent-name>

# Check current agent
@docu /agent current
```

### Agent Context

Agents maintain context across interactions:
- **Previous Outputs** - Reference earlier documents
- **Workflow State** - Track current phase
- **User Preferences** - Remember settings
- **Project Context** - Understand project scope

### Agent Collaboration

Agents are designed to work together:

1. **Sequential Workflow** - Each agent builds on previous work
2. **Context Sharing** - Agents reference previous outputs
3. **Phase Transitions** - Natural progression through workflow
4. **Quality Gates** - Review points between phases

## Workflow Examples

### Complete Documentation Workflow

```bash
# Phase 1: PRD Creation
@docu /agent set prd-creator
@docu /new "E-commerce Platform PRD" --template prd

# Phase 1: Ideation
@docu /agent set brainstormer
# Engage in conversation about features and innovations

# Phase 2: Requirements
@docu /agent set requirements-gatherer
@docu /new "E-commerce Requirements" --template requirements

# Phase 3: Design
@docu /agent set solution-architect
@docu /new "E-commerce Architecture" --template basic

# Phase 4: Implementation
@docu /agent set specification-writer
@docu /new "E-commerce Implementation Plan" --template basic

# Phase 4: Quality Assurance
@docu /agent set quality-reviewer
@docu /review --file requirements.md --level strict
@docu /review --file architecture.md --level normal
```

### Iterative Refinement

```bash
# Start with requirements
@docu /agent set requirements-gatherer
@docu /new "API Requirements" --template requirements

# Review and refine
@docu /agent set quality-reviewer
@docu /review --file api-requirements.md --level normal

# Back to requirements for updates
@docu /agent set requirements-gatherer
@docu /update --file api-requirements.md --section "Authentication" "Updated auth requirements"

# Final review
@docu /agent set quality-reviewer
@docu /review --file api-requirements.md --level strict --fix
```

## Best Practices

### Documentation Management (IMPORTANT)

**To avoid documentation bloat and maintain a clean codebase:**

1. **NO Implementation Reports** ❌
   - Do NOT create implementation summary documents
   - Do NOT create completion reports or status documents
   - Do NOT create code review summary files
   - Do NOT create fix summary documents

2. **Use CHANGELOG.md Instead** ✅
   - Add ONE LINE per feature/fix to CHANGELOG.md
   - Format: `- Added template caching for performance [#123]`
   - Keep entries concise and actionable
   - Link to issues/PRs when relevant

3. **Update User Documentation** ✅
   - Update README.md for user-facing changes
   - Update docs/manual.md for how-to guides
   - Update relevant docs/ files for new features
   - Keep documentation current and accurate

4. **Where to Document What:**
   - **CHANGELOG.md** - All changes (one line each)
   - **README.md** - Project overview, quick start, basic usage
   - **docs/manual.md** - Comprehensive user manual and how-to guides
   - **docs/quick-start.md** - Getting started tutorial
   - **docs/command-reference.md** - Command documentation
   - **docs/faq.md** - Common questions and troubleshooting
   - **Code Comments** - Implementation details and rationale
   - **JSDoc** - API documentation

5. **Clean Codebase Rules:**
   - Keep root directory minimal (README, LICENSE, CHANGELOG, CONTRIBUTING)
   - All documentation in `docs/` directory
   - No temporary or status files in repository
   - Use git commit messages for detailed change descriptions

### Agent Selection

1. **Follow the Workflow** - Use agents in their intended phase order
2. **Match Purpose** - Choose agents based on your current task
3. **Consider Context** - Agents work best with relevant context
4. **Iterate as Needed** - Switch back to previous agents for refinement

### Effective Interactions

1. **Be Specific** - Provide clear context and requirements
2. **Use Templates** - Leverage appropriate templates for structure
3. **Build Incrementally** - Work through phases systematically
4. **Review Regularly** - Use Quality Reviewer for validation
5. **Document in CHANGELOG** - One line per change, not full reports
6. **Update User Docs** - Keep manual.md and relevant docs current

### Context Management

1. **Reference Previous Work** - Agents can access earlier documents
2. **Maintain Consistency** - Keep terminology and concepts aligned
3. **Document Decisions** - Record important choices in code comments or relevant docs
4. **Track Progress** - Use CHANGELOG.md for progress tracking

## Customization

### Agent Configuration

Agents can be customized through configuration files in `.vscode/docu/agents/`:

```yaml
# .vscode/docu/agents/custom-requirements.yaml
name: custom-requirements-gatherer
description: Custom requirements gatherer for our methodology
phase: requirements
systemPrompt: |
  You are a specialized requirements analyst for enterprise software.
  Focus on compliance, security, and scalability requirements.
  Use our internal requirements template format.
allowedTools:
  - readFile
  - writeFile
  - applyTemplate
  - insertSection
workflowPhase: requirements
```

### Template Restrictions

Control which templates agents can use:

```yaml
# In template definition
agentRestrictions:
  - requirements-gatherer
  - quality-reviewer
```

### System Prompt Customization

Modify agent behavior through system prompts:

```yaml
systemPrompt: |
  You are a {agentName} specialized in {domain}.
  Your role is to {primaryFunction}.
  
  Key responsibilities:
  - {responsibility1}
  - {responsibility2}
  
  Always follow {methodology} methodology.
  Ensure outputs are {qualityStandard} compliant.
```

## Troubleshooting

### Agent Not Responding

1. Check agent is properly set: `@docu /agent current`
2. Verify GitHub Copilot is authenticated
3. Check extension output for errors
4. Try switching agents and back

### Context Issues

1. Ensure previous documents are accessible
2. Check workspace folder structure
3. Verify file permissions
4. Review agent configuration

### Template Restrictions

1. Check template agent restrictions
2. Verify agent has access to required templates
3. Use `/templates list --agent <name>` to see available templates

### Performance Issues

1. Check system resources
2. Review log files for bottlenecks
3. Consider reducing context size
4. Enable performance telemetry

## Advanced Features

### Agent Hooks

Create automated workflows with agent hooks:

```json
{
  "trigger": "file.saved",
  "pattern": "*requirements*.md",
  "agent": "quality-reviewer",
  "action": "review --level normal"
}
```

### Multi-Agent Workflows

Define complex workflows with multiple agents:

```yaml
workflow:
  name: complete-feature-spec
  phases:
    - agent: prd-creator
      template: prd
      output: feature-prd.md
    - agent: requirements-gatherer
      template: requirements
      input: feature-prd.md
      output: feature-requirements.md
    - agent: solution-architect
      template: basic
      input: feature-requirements.md
      output: feature-architecture.md
```

### Agent Analytics

Monitor agent usage and effectiveness:

```bash
# View agent usage statistics
@docu /diagnostics --section agents

# Export agent performance data
@docu /export --type agent-analytics
```

---

**Next Steps:**
- Explore [Template Management](template-management.md)
- Review [Configuration Reference](configuration.md)
- Check [Troubleshooting Guide](troubleshooting.md)