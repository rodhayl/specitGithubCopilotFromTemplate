# Feature Development Workflow

This workflow guides you through the complete feature development lifecycle using Cursor's AI capabilities and the specialized agent prompts.

## Workflow Overview

```
PRD Creation → Requirements Gathering → Solution Architecture → Implementation Planning → Development → Quality Review
```

## Phase 1: Product Requirements (PRD)

### Step 1: Initial Concept Development
1. Open Cursor AI chat (`Cmd/Ctrl + K`)
2. Load PRD Creator prompt: `@prd-creator`
3. Describe your feature idea or problem statement
4. Follow the guided questions to develop:
   - Problem definition and target users
   - Market opportunity and competitive analysis
   - Success metrics and business objectives
   - Scope definition and constraints

### Step 2: Creative Exploration
1. Switch to Brainstormer prompt: `@brainstormer`
2. Explore innovative approaches and alternatives
3. Generate multiple solution concepts
4. Identify unique value propositions and differentiators

### Deliverables
- [ ] Product Requirements Document (PRD)
- [ ] User personas and use cases
- [ ] Success metrics and KPIs
- [ ] Feature scope and priorities

## Phase 2: Requirements Analysis

### Step 3: Detailed Requirements Gathering
1. Load Requirements Gatherer prompt: `@requirements-gatherer`
2. Review the PRD and extract detailed requirements
3. Create structured user stories with acceptance criteria
4. Define functional and non-functional requirements
5. Establish requirements traceability matrix

### Step 4: Requirements Validation
1. Review requirements for completeness and clarity
2. Validate with stakeholders and domain experts
3. Ensure all requirements are testable and measurable
4. Document assumptions and constraints

### Deliverables
- [ ] Functional requirements specification
- [ ] User stories with acceptance criteria
- [ ] Non-functional requirements (performance, security, etc.)
- [ ] Requirements traceability matrix

## Phase 3: Solution Design

### Step 5: Architecture Planning
1. Load Solution Architect prompt: `@solution-architect`
2. Analyze requirements and technical constraints
3. Design system architecture and component structure
4. Select appropriate technology stack and patterns
5. Plan integrations and data flows

### Step 6: Technical Specification
1. Switch to Specification Writer prompt: `@specification-writer`
2. Create detailed technical specifications
3. Define API contracts and data models
4. Plan database schema and migrations
5. Establish testing strategy and quality gates

### Deliverables
- [ ] System architecture documentation
- [ ] Technical specifications and API designs
- [ ] Database schema and data models
- [ ] Integration specifications
- [ ] Testing strategy and quality criteria

## Phase 4: Implementation Planning

### Step 7: Task Breakdown
1. Continue with Specification Writer prompt
2. Break down features into specific development tasks
3. Identify task dependencies and critical path
4. Estimate effort and assign priorities
5. Plan sprint/iteration structure

### Step 8: Development Setup
1. Set up development environment and tooling
2. Create project structure and initial scaffolding
3. Configure CI/CD pipeline and quality gates
4. Set up monitoring and logging infrastructure

### Deliverables
- [ ] Detailed task breakdown with estimates
- [ ] Sprint/iteration plan with dependencies
- [ ] Development environment setup
- [ ] CI/CD pipeline configuration

## Phase 5: Development Execution

### Step 9: Iterative Development
For each development task:
1. Use Cursor's AI completion for code generation
2. Follow TDD approach with test-first development
3. Implement features incrementally with frequent commits
4. Use AI chat for problem-solving and code review
5. Maintain documentation as you develop

### Step 10: Continuous Integration
1. Run automated tests on every commit
2. Perform code quality checks and security scans
3. Deploy to staging environment for integration testing
4. Monitor performance and error metrics

### Deliverables
- [ ] Working software with automated tests
- [ ] Continuous integration pipeline
- [ ] Staging environment deployment
- [ ] Performance and monitoring setup

## Phase 6: Quality Assurance

### Step 11: Comprehensive Review
1. Load Quality Reviewer prompt: `@quality-reviewer`
2. Perform thorough code review for quality and security
3. Validate all requirements and acceptance criteria
4. Execute comprehensive testing strategy
5. Review documentation for completeness and accuracy

### Step 12: User Acceptance Testing
1. Deploy to user acceptance testing environment
2. Conduct user testing sessions with target users
3. Gather feedback and identify improvement opportunities
4. Address critical issues and validate fixes

### Deliverables
- [ ] Code review report with quality assessment
- [ ] Test execution results and coverage report
- [ ] User acceptance testing feedback
- [ ] Production readiness checklist

## Phase 7: Deployment and Monitoring

### Step 13: Production Deployment
1. Prepare production deployment plan
2. Execute deployment with rollback capability
3. Monitor system health and performance metrics
4. Validate feature functionality in production

### Step 14: Post-Launch Review
1. Monitor user adoption and engagement metrics
2. Collect user feedback and support requests
3. Analyze performance and identify optimization opportunities
4. Plan future iterations and improvements

### Deliverables
- [ ] Production deployment and monitoring
- [ ] User adoption and engagement metrics
- [ ] Post-launch review and lessons learned
- [ ] Future iteration planning

## Cursor AI Integration Tips

### Effective Prompt Usage
- Start conversations with specific agent prompts (`@agent-name`)
- Provide context about your project and current phase
- Ask follow-up questions to dive deeper into specific areas
- Use code selection with `Cmd/Ctrl + L` for targeted assistance

### Code Generation Best Practices
- Use `Cmd/Ctrl + K` for inline code generation
- Provide clear, specific instructions for what you want
- Review and test all AI-generated code before committing
- Use AI for boilerplate generation and complex logic assistance

### Documentation Workflow
- Use AI to generate initial documentation drafts
- Maintain documentation alongside code development
- Use AI to review and improve documentation clarity
- Keep documentation updated as requirements evolve

## Quality Gates

Each phase should meet these criteria before proceeding:

### PRD Phase
- [ ] Clear problem statement and target users defined
- [ ] Success metrics and business objectives established
- [ ] Scope and constraints documented
- [ ] Stakeholder alignment achieved

### Requirements Phase
- [ ] All functional requirements documented with acceptance criteria
- [ ] Non-functional requirements specified and measurable
- [ ] Requirements traceability established
- [ ] Requirements validated with stakeholders

### Design Phase
- [ ] System architecture documented and reviewed
- [ ] Technical specifications complete and detailed
- [ ] API contracts and data models defined
- [ ] Testing strategy established

### Implementation Phase
- [ ] All tasks completed with adequate test coverage
- [ ] Code quality standards met
- [ ] Integration testing successful
- [ ] Documentation updated and complete

### Quality Phase
- [ ] Comprehensive code review completed
- [ ] All tests passing with adequate coverage
- [ ] User acceptance testing successful
- [ ] Production readiness validated

This workflow ensures systematic, high-quality feature development while leveraging Cursor's AI capabilities for maximum productivity and quality.