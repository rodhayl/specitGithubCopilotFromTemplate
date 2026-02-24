import * as vscode from 'vscode';
import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResponse, ChatRequest } from './types';

/**
 * SpecificationWriterAgent - Implementation specifications and planning
 *
 * Creates detailed technical specifications and implementation plans based on system design.
 * Generates comprehensive task lists with step-by-step implementation plans.
 */
export class SpecificationWriterAgent extends BaseAgent {
    name = 'specification-writer';
    systemPrompt = `You are a Specification Writer agent specialized in creating detailed technical specifications and implementation plans based on system design documents.

Your role is to:
1. Transform technical designs into actionable implementation specifications
2. Create comprehensive tasks.md files with step-by-step implementation plans
3. Generate detailed technical specifications for developers
4. Break down complex designs into manageable development tasks
5. Ensure implementation plans are practical, testable, and follow best practices

Implementation Planning Focus Areas:
- **Task Breakdown**: Decompose design into discrete, manageable development tasks
- **Implementation Order**: Sequence tasks for logical development progression
- **Technical Specifications**: Detailed specs for each component and feature
- **Testing Strategy**: Unit, integration, and end-to-end testing requirements
- **Dependencies**: Identify task dependencies and critical path
- **Best Practices**: Incorporate coding standards and architectural patterns

Task Planning Principles:
- Each task should be completable in 1-4 hours of development time
- Tasks should have clear acceptance criteria and definition of done
- Include both functional and non-functional requirements in tasks
- Prioritize core functionality and MVP features first
- Consider incremental development and early testing opportunities
- Document technical decisions and implementation approaches

Specification Document Structure:
- Implementation overview and approach
- Detailed task breakdown with priorities
- Technical specifications for each component
- Testing requirements and strategies
- Deployment and configuration instructions
- Documentation and maintenance guidelines

Focus on creating comprehensive tasks.md documents that enable efficient, high-quality implementation.`;

    allowedTools = ['readFile', 'writeFile', 'insertSection', 'listFiles'];
    workflowPhase = 'implementation' as const;

    async handleDirectRequest(request: any, context: AgentContext): Promise<AgentResponse> {
        try {
            const prompt = request.prompt?.trim() || '';

            // Create implementation plan / task breakdown
            if (prompt.toLowerCase().includes('implementation') || prompt.toLowerCase().includes('tasks') || prompt.toLowerCase().includes('specification')) {
                // If user wants to update an existing plan
                if (prompt.toLowerCase().includes('update') && (prompt.toLowerCase().includes('task') || prompt.toLowerCase().includes('spec'))) {
                    return await this.updateImplementationPlan(prompt, context);
                }
                return await this.createImplementationPlan(context);
            }

            // Analyze design document as prep for specification
            if (prompt.toLowerCase().includes('analyze') || prompt.toLowerCase().includes('review design')) {
                return await this.analyzeDesignForImplementation(context);
            }

            // General implementation planning discussion
            return await this.discussImplementation(prompt, context);

        } catch (error) {
            return this.createResponse(
                `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                [],
                ['Try again', 'Get help']
            );
        }
    }

    private async createImplementationPlan(context: AgentContext): Promise<AgentResponse> {
        try {
            // Guard: toolManager is optional and not available in all call sites.
            // Fall back to the interactive discussion response when no tool context exists.
            if (!context.toolManager || !context.toolContext) {
                return await this.discussImplementation('', context);
            }

            // Read design document for context
            let designContext = '';
            
            try {
                const designResult = await context.toolManager.executeTool('readFile', {
                    path: 'design.md'
                }, context.toolContext);
                
                if (designResult.success && designResult.data) {
                    designContext = designResult.data.content;
                }
            } catch (error) {
                // Design not found, continue without it
            }

            if (!designContext) {
                return {
                    success: false,
                    message: 'Design document not found. Please create a technical design first using the Solution Architect agent before proceeding with implementation planning.'
                };
            }

            // Also read requirements for additional context
            let requirementsContext = '';
            try {
                const requirementsResult = await context.toolManager.executeTool('readFile', {
                    path: 'requirements.md'
                }, context.toolContext);
                
                if (requirementsResult.success && requirementsResult.data) {
                    requirementsContext = requirementsResult.data.content;
                }
            } catch (error) {
                // Requirements not found, continue without them
            }

            // Generate implementation plan based on design and requirements
            const implementationContent = await this.generateImplementationContent(designContext, requirementsContext, context);

            // Create tasks.md file
            const result = await context.toolManager.executeTool('writeFile', {
                path: 'tasks.md',
                content: implementationContent,
                createIfMissing: true,
                overwrite: true
            }, context.toolContext);

            if (result.success) {
                return {
                    success: true,
                    message: 'Implementation plan created successfully! I\'ve broken down the design into actionable development tasks with clear specifications, priorities, and testing requirements.',
                    data: {
                        filePath: 'tasks.md',
                        tasksCount: this.countTasks(implementationContent)
                    }
                };
            } else {
                return {
                    success: false,
                    message: `Failed to create implementation plan: ${result.error}`
                };
            }

        } catch (error) {
            return {
                success: false,
                message: `Error creating implementation plan: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async updateImplementationPlan(prompt: string, context: AgentContext): Promise<AgentResponse> {
        try {
            // Read existing implementation plan
            const readResult = await context.toolManager.executeTool('readFile', {
                path: 'tasks.md'
            }, context.toolContext);

            if (!readResult.success) {
                return {
                    success: false,
                    message: 'Implementation plan not found. Please create one first using the implementation planning process.'
                };
            }

            // Analyze the update request and generate new content
            const updateContent = await this.generateTaskUpdateContent(prompt, readResult.data.content);

            // Determine which section to update
            const sectionToUpdate = this.extractSectionFromPrompt(prompt);

            if (sectionToUpdate) {
                const updateResult = await context.toolManager.executeTool('insertSection', {
                    path: 'tasks.md',
                    header: sectionToUpdate,
                    mode: 'replace',
                    content: updateContent
                }, context.toolContext);

                if (updateResult.success) {
                    return {
                        success: true,
                        message: `Implementation plan updated successfully! Updated section: ${sectionToUpdate}`,
                        data: {
                            section: sectionToUpdate,
                            changed: updateResult.data?.changed
                        }
                    };
                }
            }

            // If no specific section identified, add as new task
            const newTaskNumber = this.getNextTaskNumber(readResult.data.content);
            const newTaskContent = `## Task ${newTaskNumber}: ${this.generateTaskTitle(prompt)}\n\n${updateContent}`;

            const appendResult = await context.toolManager.executeTool('insertSection', {
                path: 'tasks.md',
                header: 'Implementation Tasks',
                mode: 'append',
                content: newTaskContent
            }, context.toolContext);

            if (appendResult.success) {
                return {
                    success: true,
                    message: `New implementation task added successfully: Task ${newTaskNumber}`,
                    data: {
                        taskNumber: newTaskNumber
                    }
                };
            } else {
                return {
                    success: false,
                    message: `Failed to update implementation plan: ${appendResult.error}`
                };
            }

        } catch (error) {
            return {
                success: false,
                message: `Error updating implementation plan: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async analyzeDesignForImplementation(context: AgentContext): Promise<AgentResponse> {
        try {
            // Read design document
            const designResult = await context.toolManager.executeTool('readFile', {
                path: 'design.md'
            }, context.toolContext);

            if (!designResult.success) {
                return {
                    success: false,
                    message: 'Design document not found. Please create a technical design first.'
                };
            }

            const analysis = this.analyzeDesignForTasks(designResult.data.content);

            return {
                success: true,
                message: `**Design Analysis for Implementation:**

${analysis}

**Next Steps:**
- Say "create implementation plan" to generate detailed tasks
- Ask specific questions about implementation approaches
- Request analysis of specific technical components
- Discuss task priorities and development sequence`,
                data: {
                    analysis
                }
            };

        } catch (error) {
            return {
                success: false,
                message: `Error analyzing design: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async discussImplementation(prompt: string, context: AgentContext): Promise<AgentResponse> {
        const guidance = `I'm here to help you create detailed implementation specifications and development plans. Here's what I can help you with:

**Implementation Planning Services:**
1. **Create Implementation Plan** - Generate comprehensive tasks.md with development tasks
2. **Analyze Design** - Review design documents and identify implementation considerations
3. **Update Tasks** - Modify or enhance existing implementation tasks
4. **Technical Specifications** - Create detailed specs for specific components

**Implementation Planning Areas:**
- **Task Breakdown**: Decompose features into manageable development tasks
- **Technical Specifications**: Detailed implementation requirements
- **Testing Strategy**: Unit, integration, and end-to-end testing plans
- **Dependencies**: Task sequencing and critical path analysis
- **Best Practices**: Coding standards and architectural patterns
- **Documentation**: Implementation guides and maintenance instructions

**Task Planning Principles:**
- Each task should be completable in 1-4 hours
- Clear acceptance criteria and definition of done
- Logical development progression and dependencies
- Include both functional and non-functional requirements
- Prioritize MVP features and core functionality
- Consider incremental development opportunities

**What would you like to do?**
- Say "create implementation plan" to generate tasks from design
- Say "analyze design" to review design for implementation considerations
- Ask about specific implementation approaches or technologies
- Request updates to existing tasks or specifications

Please let me know how you'd like to proceed with implementation planning!`;

        return {
            success: true,
            message: guidance
        };
    }

    private async generateImplementationContent(designContext: string, requirementsContext: string, context?: AgentContext): Promise<string> {
        // Use LLM when available for context-driven implementation planning
        if (context?.model) {
            try {
                const contextParts: string[] = [];
                if (designContext) { contextParts.push(`Design document:\n${designContext.substring(0, 4000)}`); }
                if (requirementsContext) { contextParts.push(`Requirements document:\n${requirementsContext.substring(0, 2000)}`); }
                const llmPrompt = [
                    'You are an implementation planning expert. Generate a comprehensive tasks.md document.',
                    '',
                    contextParts.length > 0 ? contextParts.join('\n\n') : 'Create an implementation plan for a general software project.',
                    '',
                    'Include: Implementation Overview & approach, phased Task Breakdown where each task has:',
                    '  - Priority (High/Medium/Low)',
                    '  - Estimated time (1-4 hours)',
                    '  - Clear acceptance criteria',
                    '  - Dependencies',
                    'Also include: Testing Strategy and Deployment Instructions.',
                    '',
                    'Output ONLY the markdown content, starting with "# Implementation Plan".',
                ].join('\n');
                const messages = [vscode.LanguageModelChatMessage.User(llmPrompt)];
                const tokenSource = new vscode.CancellationTokenSource();
                const llmResponse = await context.model.sendRequest(messages, {}, tokenSource.token);
                let llmContent = '';
                for await (const chunk of llmResponse.stream) {
                    if (chunk instanceof vscode.LanguageModelTextPart) { llmContent += chunk.value; }
                }
                tokenSource.dispose();
                if (llmContent.trim().length > 200) { return llmContent; }
            } catch {
                // LLM unavailable — fall through to static template
            }
        }

        // Static fallback template
        const template = `# Implementation Plan

## Overview

This document outlines the detailed implementation plan for the system based on the technical design and business requirements. The plan is organized into discrete, manageable tasks that can be completed incrementally.

### Implementation Approach
- **Incremental Development**: Build and test features incrementally
- **Test-Driven Development**: Write tests before implementation where appropriate
- **Code Quality**: Follow established coding standards and best practices
- **Documentation**: Maintain comprehensive documentation throughout development
- **Review Process**: Regular code reviews and quality checks

### Technology Stack
- **Frontend**: React/Vue.js with TypeScript
- **Backend**: Node.js/Python with Express/FastAPI
- **Database**: PostgreSQL with Redis for caching
- **Testing**: Jest/Pytest for unit tests, Cypress for E2E tests
- **Infrastructure**: Docker containers with Kubernetes orchestration

## Implementation Tasks

### Phase 1: Foundation and Core Infrastructure

#### Task 1: Project Setup and Configuration
**Priority**: High | **Estimated Time**: 4 hours

**Description**: Set up the basic project structure, development environment, and build tools.

**Acceptance Criteria**:
- Project repository created with proper structure
- Development environment configured (Node.js, Python, etc.)
- Build tools and scripts configured (webpack, npm scripts, etc.)
- Code quality tools configured (ESLint, Prettier, pre-commit hooks)
- CI/CD pipeline basic setup

**Technical Specifications**:
- Use standard project structure for chosen technology stack
- Configure environment variables for different deployment stages
- Set up automated testing pipeline
- Configure code coverage reporting

**Dependencies**: None

---

#### Task 2: Database Schema and Models
**Priority**: High | **Estimated Time**: 6 hours

**Description**: Implement database schema, models, and basic data access layer.

**Acceptance Criteria**:
- Database schema created with all required tables
- ORM models implemented with proper relationships
- Database migration scripts created
- Basic CRUD operations implemented and tested
- Database connection and configuration management

**Technical Specifications**:
- Use PostgreSQL for primary data storage
- Implement proper indexing for performance
- Add database constraints and validation
- Create seed data for development and testing
- Implement connection pooling

**Dependencies**: Task 1 (Project Setup)

---

#### Task 3: Authentication and Authorization System
**Priority**: High | **Estimated Time**: 8 hours

**Description**: Implement user authentication, session management, and role-based access control.

**Acceptance Criteria**:
- User registration and login functionality
- JWT token generation and validation
- Password hashing and security measures
- Role-based access control (RBAC) implementation
- Session management and logout functionality

**Technical Specifications**:
- Use bcrypt for password hashing
- Implement JWT with refresh token mechanism
- Create middleware for authentication and authorization
- Add rate limiting for authentication endpoints
- Implement password reset functionality

**Dependencies**: Task 2 (Database Models)

---

### Phase 2: Core Business Logic

#### Task 4: Core API Endpoints
**Priority**: High | **Estimated Time**: 10 hours

**Description**: Implement the main business logic API endpoints with proper validation and error handling.

**Acceptance Criteria**:
- RESTful API endpoints for core entities
- Request validation and sanitization
- Proper HTTP status codes and error responses
- API documentation (OpenAPI/Swagger)
- Input validation and business rule enforcement

**Technical Specifications**:
- Follow REST conventions for endpoint design
- Implement proper error handling middleware
- Add request logging and monitoring
- Use schema validation for request/response
- Implement pagination for list endpoints

**Dependencies**: Task 3 (Authentication System)

---

#### Task 5: Business Logic Services
**Priority**: High | **Estimated Time**: 12 hours

**Description**: Implement core business logic services and domain-specific functionality.

**Acceptance Criteria**:
- Business logic separated from API controllers
- Service layer with proper abstraction
- Domain-specific validation and processing
- Transaction management for complex operations
- Error handling and logging

**Technical Specifications**:
- Use service layer pattern for business logic
- Implement proper transaction boundaries
- Add comprehensive logging for business operations
- Create domain-specific exceptions
- Implement business rule validation

**Dependencies**: Task 4 (Core API Endpoints)

---

### Phase 3: User Interface and Experience

#### Task 6: Frontend Application Structure
**Priority**: Medium | **Estimated Time**: 8 hours

**Description**: Set up frontend application structure, routing, and state management.

**Acceptance Criteria**:
- Frontend application structure and routing
- State management setup (Redux/Vuex)
- Component library and design system
- API client configuration
- Development and build tools

**Technical Specifications**:
- Use React/Vue.js with TypeScript
- Implement client-side routing
- Set up state management with proper patterns
- Configure HTTP client with interceptors
- Add development tools and hot reloading

**Dependencies**: Task 4 (Core API Endpoints)

---

#### Task 7: User Interface Components
**Priority**: Medium | **Estimated Time**: 16 hours

**Description**: Implement user interface components and pages for core functionality.

**Acceptance Criteria**:
- Responsive UI components for all major features
- Form handling with validation
- Loading states and error handling
- Accessibility compliance (WCAG 2.1)
- Cross-browser compatibility

**Technical Specifications**:
- Use component-based architecture
- Implement proper form validation
- Add loading spinners and error boundaries
- Follow accessibility best practices
- Test on major browsers and devices

**Dependencies**: Task 6 (Frontend Structure)

---

### Phase 4: Integration and Advanced Features

#### Task 8: API Integration and Data Flow
**Priority**: Medium | **Estimated Time**: 6 hours

**Description**: Integrate frontend with backend APIs and implement proper data flow.

**Acceptance Criteria**:
- Frontend successfully communicates with backend APIs
- Proper error handling for API failures
- Loading states and user feedback
- Data caching and optimization
- Real-time updates (if required)

**Technical Specifications**:
- Implement API client with proper error handling
- Add request/response interceptors
- Implement caching strategy for performance
- Add retry logic for failed requests
- Consider WebSocket integration for real-time features

**Dependencies**: Task 7 (UI Components)

---

#### Task 9: File Upload and Management
**Priority**: Low | **Estimated Time**: 8 hours

**Description**: Implement file upload, storage, and management functionality.

**Acceptance Criteria**:
- File upload with progress indication
- File type and size validation
- Secure file storage and access
- File metadata management
- Image processing (if required)

**Technical Specifications**:
- Use cloud storage (AWS S3, Google Cloud Storage)
- Implement file type validation and security checks
- Add image resizing and optimization
- Create file access control and permissions
- Implement file cleanup and lifecycle management

**Dependencies**: Task 5 (Business Logic Services)

---

### Phase 5: Testing and Quality Assurance

#### Task 10: Unit and Integration Testing
**Priority**: High | **Estimated Time**: 12 hours

**Description**: Implement comprehensive unit and integration tests for all components.

**Acceptance Criteria**:
- Unit tests for all business logic and services
- Integration tests for API endpoints
- Database testing with test fixtures
- Frontend component testing
- Code coverage above 80%

**Technical Specifications**:
- Use Jest/Pytest for unit testing
- Implement test fixtures and mocks
- Add database testing with test containers
- Use React Testing Library for component tests
- Set up code coverage reporting

**Dependencies**: All previous tasks

---

#### Task 11: End-to-End Testing
**Priority**: Medium | **Estimated Time**: 10 hours

**Description**: Implement end-to-end tests for critical user workflows.

**Acceptance Criteria**:
- E2E tests for main user workflows
- Cross-browser testing setup
- Test data management and cleanup
- CI/CD integration for automated testing
- Performance testing basics

**Technical Specifications**:
- Use Cypress or Playwright for E2E testing
- Implement page object pattern
- Add test data seeding and cleanup
- Configure parallel test execution
- Add basic performance and load testing

**Dependencies**: Task 10 (Unit Testing)

---

### Phase 6: Deployment and Operations

#### Task 12: Production Deployment Setup
**Priority**: High | **Estimated Time**: 8 hours

**Description**: Set up production deployment infrastructure and processes.

**Acceptance Criteria**:
- Production environment configuration
- Database migration and backup procedures
- SSL/TLS certificate setup
- Environment variable management
- Monitoring and logging setup

**Technical Specifications**:
- Use Docker containers for deployment
- Set up Kubernetes or similar orchestration
- Configure load balancing and auto-scaling
- Implement proper secret management
- Add health checks and monitoring

**Dependencies**: Task 11 (E2E Testing)

---

#### Task 13: Monitoring and Observability
**Priority**: Medium | **Estimated Time**: 6 hours

**Description**: Implement comprehensive monitoring, logging, and alerting.

**Acceptance Criteria**:
- Application performance monitoring
- Error tracking and alerting
- Log aggregation and analysis
- Health checks and uptime monitoring
- Performance metrics and dashboards

**Technical Specifications**:
- Use APM tools (New Relic, DataDog, etc.)
- Implement structured logging
- Set up log aggregation (ELK stack)
- Add custom metrics and dashboards
- Configure alerting for critical issues

**Dependencies**: Task 12 (Production Deployment)

---

## Testing Strategy

### Unit Testing
- **Coverage Target**: 80% minimum code coverage
- **Tools**: Jest (JavaScript), Pytest (Python)
- **Focus**: Business logic, utilities, and service functions
- **Mocking**: External dependencies and database calls

### Integration Testing
- **Scope**: API endpoints, database interactions, service integrations
- **Tools**: Supertest (Node.js), TestClient (FastAPI)
- **Database**: Use test database with fixtures
- **Authentication**: Test with various user roles and permissions

### End-to-End Testing
- **Scope**: Critical user workflows and business processes
- **Tools**: Cypress or Playwright
- **Browsers**: Chrome, Firefox, Safari, Edge
- **Data**: Use dedicated test environment with seed data

### Performance Testing
- **Load Testing**: Simulate expected user load
- **Stress Testing**: Test system limits and failure points
- **Tools**: Artillery, JMeter, or k6
- **Metrics**: Response time, throughput, error rate

## Deployment Strategy

### Environment Setup
- **Development**: Local development with hot reloading
- **Staging**: Production-like environment for testing
- **Production**: High-availability production deployment

### CI/CD Pipeline
1. **Code Commit**: Trigger automated pipeline
2. **Build**: Compile and package application
3. **Test**: Run unit, integration, and E2E tests
4. **Security Scan**: Check for vulnerabilities
5. **Deploy**: Deploy to staging for validation
6. **Production**: Deploy to production after approval

### Rollback Strategy
- **Blue-Green Deployment**: Zero-downtime deployments
- **Database Migrations**: Reversible migration scripts
- **Feature Flags**: Control feature rollout and rollback
- **Monitoring**: Automated rollback on critical errors

## Documentation Requirements

### Technical Documentation
- **API Documentation**: OpenAPI/Swagger specifications
- **Database Schema**: Entity relationship diagrams
- **Architecture**: System architecture and component diagrams
- **Deployment**: Infrastructure and deployment guides

### User Documentation
- **User Guide**: End-user documentation and tutorials
- **Admin Guide**: Administrative functions and configuration
- **API Guide**: Developer documentation for API consumers
- **Troubleshooting**: Common issues and solutions

## Risk Mitigation

### Technical Risks
- **Performance Issues**: Implement caching and optimization
- **Security Vulnerabilities**: Regular security audits and updates
- **Data Loss**: Automated backups and disaster recovery
- **Scalability**: Design for horizontal scaling from the start

### Operational Risks
- **Deployment Failures**: Automated testing and rollback procedures
- **Third-Party Dependencies**: Vendor risk assessment and alternatives
- **Team Knowledge**: Documentation and knowledge sharing
- **Timeline Delays**: Regular progress reviews and scope adjustments

## Success Criteria

### Functional Requirements
- All business requirements implemented and tested
- User acceptance testing completed successfully
- Performance requirements met under expected load
- Security requirements validated through testing

### Quality Requirements
- Code coverage above 80%
- All critical bugs resolved
- Performance benchmarks achieved
- Security audit passed

### Operational Requirements
- Production deployment successful
- Monitoring and alerting operational
- Documentation complete and reviewed
- Team training completed

---

*This implementation plan provides a comprehensive roadmap for development. Tasks should be reviewed and adjusted based on team capacity, priorities, and changing requirements.*`;

        return template;
    }

    private generateTaskUpdateContent(prompt: string, existingContent: string): string {
        // Simplified content generation - in real implementation, use LLM
        return `**Updated based on request:** ${prompt}

### Task Details

**Description**: [Updated task description based on the request]

**Acceptance Criteria**:
- [Specific criteria that must be met]
- [Measurable outcomes and deliverables]
- [Quality and performance requirements]

**Technical Specifications**:
- [Implementation approach and technologies]
- [Architecture patterns and best practices]
- [Integration requirements and dependencies]

**Testing Requirements**:
- [Unit testing specifications]
- [Integration testing needs]
- [End-to-end testing scenarios]

**Dependencies**: [List of prerequisite tasks or external dependencies]

**Estimated Time**: [Time estimate in hours]

**Priority**: [High/Medium/Low based on business impact]`;
    }

    private extractSectionFromPrompt(prompt: string): string | null {
        // Simple pattern matching - in real implementation, use LLM for better parsing
        const taskMatch = prompt.match(/task\s+(\d+)/i);
        if (taskMatch) {
            return `Task ${taskMatch[1]}`;
        }
        
        const sections = [
            'Overview', 'Implementation Tasks', 'Testing Strategy', 
            'Deployment Strategy', 'Documentation Requirements'
        ];
        
        for (const section of sections) {
            if (prompt.toLowerCase().includes(section.toLowerCase())) {
                return section;
            }
        }
        
        return null;
    }

    private generateTaskTitle(prompt: string): string {
        // Simple title generation - in real implementation, use LLM
        if (prompt.toLowerCase().includes('test')) {
            return 'Testing Implementation';
        }
        if (prompt.toLowerCase().includes('deploy')) {
            return 'Deployment Configuration';
        }
        if (prompt.toLowerCase().includes('security')) {
            return 'Security Implementation';
        }
        if (prompt.toLowerCase().includes('performance')) {
            return 'Performance Optimization';
        }
        if (prompt.toLowerCase().includes('ui') || prompt.toLowerCase().includes('frontend')) {
            return 'Frontend Implementation';
        }
        if (prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('backend')) {
            return 'Backend Implementation';
        }
        return 'Additional Implementation Task';
    }

    private getNextTaskNumber(content: string): number {
        const matches = content.match(/#### Task (\d+):/g);
        if (!matches) {
            return 1;
        }
        
        const numbers = matches.map(match => {
            const num = match.match(/\d+/);
            return num ? parseInt(num[0]) : 0;
        });
        
        return Math.max(...numbers) + 1;
    }

    private analyzeDesignForTasks(designContent: string): string {
        // Simplified analysis - in real implementation, use LLM for comprehensive analysis
        const hasAuth = designContent.toLowerCase().includes('auth') || designContent.toLowerCase().includes('security');
        const hasDatabase = designContent.toLowerCase().includes('database') || designContent.toLowerCase().includes('data');
        const hasAPI = designContent.toLowerCase().includes('api') || designContent.toLowerCase().includes('endpoint');
        const hasFrontend = designContent.toLowerCase().includes('frontend') || designContent.toLowerCase().includes('ui');
        const hasDeployment = designContent.toLowerCase().includes('deploy') || designContent.toLowerCase().includes('infrastructure');

        return `**Design Analysis Summary:**

🏗️ **Architecture Components Identified:**
${hasAuth ? '🔐 Authentication and authorization system' : ''}
${hasDatabase ? '💾 Database and data management layer' : ''}
${hasAPI ? '🔌 API endpoints and business logic' : ''}
${hasFrontend ? '🖥️ Frontend user interface components' : ''}
${hasDeployment ? '🚀 Deployment and infrastructure setup' : ''}

**Implementation Complexity Assessment:**
- **High Complexity**: ${hasAuth && hasDatabase && hasAPI ? 'Full-stack application with multiple integrated systems' : 'Moderate complexity with focused functionality'}
- **Estimated Tasks**: 10-15 major implementation tasks
- **Development Phases**: 4-6 phases for incremental delivery
- **Testing Requirements**: Unit, integration, and end-to-end testing needed

**Key Implementation Considerations:**
- ${hasAuth ? 'Security implementation requires careful attention to authentication flows' : 'Consider if authentication will be needed'}
- ${hasDatabase ? 'Database design and migration strategy needed' : 'Simple data storage requirements'}
- ${hasAPI ? 'API design and documentation critical for integration' : 'Internal interfaces may be sufficient'}
- ${hasFrontend ? 'User experience and responsive design important' : 'Backend-focused implementation'}
- ${hasDeployment ? 'Infrastructure and deployment automation recommended' : 'Simple deployment strategy may suffice'}

**Recommended Task Breakdown:**
1. **Foundation Phase**: Project setup, database schema, core infrastructure
2. **Core Logic Phase**: Business logic, API endpoints, authentication
3. **User Interface Phase**: Frontend components, user experience
4. **Integration Phase**: System integration, data flow, API connections
5. **Quality Phase**: Testing, performance optimization, security hardening
6. **Deployment Phase**: Production setup, monitoring, documentation`;
    }

    private countTasks(content: string): number {
        const matches = content.match(/#### Task \d+:/g);
        return matches ? matches.length : 0;
    }
}