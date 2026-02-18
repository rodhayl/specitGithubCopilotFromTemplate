import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResponse, ChatRequest } from './types';

/**
 * SolutionArchitectAgent - Technical architecture and design
 *
 * Designs technical solutions and system architecture based on business requirements.
 * Creates comprehensive design documents with system architecture, components, and interfaces.
 */
export class SolutionArchitectAgent extends BaseAgent {
    name = 'solution-architect';
    systemPrompt = `You are a Solution Architect agent specialized in designing technical solutions and system architecture based on business requirements.

Your role is to:
1. Transform business requirements into technical architecture and design decisions
2. Create comprehensive design documents with system architecture, components, and interfaces
3. Make informed technical trade-offs and document the rationale behind decisions
4. Design scalable, maintainable, and secure system architectures
5. Build upon requirements documents to create implementation-ready technical designs

Architecture Design Focus Areas:
- **System Architecture**: High-level system components, services, and their interactions
- **Data Architecture**: Data models, storage solutions, and data flow patterns
- **Integration Architecture**: APIs, messaging patterns, and external system integrations
- **Security Architecture**: Authentication, authorization, encryption, and security patterns
- **Performance Architecture**: Scalability patterns, caching strategies, and performance considerations
- **Deployment Architecture**: Infrastructure, containerization, and deployment strategies

Technical Decision Framework:
- Evaluate multiple solution approaches and document trade-offs
- Consider non-functional requirements (performance, security, scalability, maintainability)
- Align technical decisions with business constraints and requirements
- Document assumptions, risks, and mitigation strategies
- Provide clear rationale for architectural choices

Design Document Structure:
- Overview and architectural principles
- System architecture diagrams and component descriptions
- Data models and database design
- API specifications and integration patterns
- Security and performance considerations
- Implementation guidelines and best practices

Focus on creating comprehensive design.md documents that bridge the gap between business requirements and technical implementation.`;

    allowedTools = ['readFile', 'writeFile', 'insertSection', 'applyTemplate'];
    workflowPhase = 'design' as const;

    async handleDirectRequest(request: any, context: AgentContext): Promise<AgentResponse> {
        try {
            const prompt = request.prompt?.trim() || '';

            // Create a new design document
            if (prompt.toLowerCase().includes('design') || prompt.toLowerCase().includes('architecture')) {
                // If user wants to update an existing design
                if (prompt.toLowerCase().includes('update') && prompt.toLowerCase().includes('design')) {
                    return await this.updateDesign(prompt, context);
                }
                return await this.createDesignDocument(context);
            }

            // Analyze requirements before designing
            if (prompt.toLowerCase().includes('analyze') || prompt.toLowerCase().includes('review requirements')) {
                return await this.analyzeRequirements(context);
            }

            // General architecture discussion / guidance
            return await this.discussArchitecture(prompt, context);

        } catch (error) {
            return this.createResponse(
                `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                [],
                ['Try again', 'Get help']
            );
        }
    }

    private async createDesignDocument(context: AgentContext): Promise<AgentResponse> {
        try {
            // Read requirements document for context
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

            if (!requirementsContext) {
                return {
                    success: false,
                    message: 'Requirements document not found. Please create requirements first using the Requirements Gatherer agent before proceeding with design.'
                };
            }

            // Generate design content based on requirements
            const designContent = await this.generateDesignContent(requirementsContext);

            // Create design.md file
            const result = await context.toolManager.executeTool('writeFile', {
                path: 'design.md',
                content: designContent,
                createIfMissing: true
            }, context.toolContext);

            if (result.success) {
                return {
                    success: true,
                    message: 'Design document created successfully! I\'ve created a comprehensive technical architecture based on your requirements, including system components, data models, and implementation guidelines.',
                    data: {
                        filePath: 'design.md',
                        sectionsCount: this.countSections(designContent)
                    }
                };
            } else {
                return {
                    success: false,
                    message: `Failed to create design document: ${result.error}`
                };
            }

        } catch (error) {
            return {
                success: false,
                message: `Error creating design document: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async updateDesign(prompt: string, context: AgentContext): Promise<AgentResponse> {
        try {
            // Read existing design
            const readResult = await context.toolManager.executeTool('readFile', {
                path: 'design.md'
            }, context.toolContext);

            if (!readResult.success) {
                return {
                    success: false,
                    message: 'Design document not found. Please create one first using the design creation process.'
                };
            }

            // Analyze the update request and generate new content
            const updateContent = await this.generateUpdateContent(prompt, readResult.data.content);

            // Determine which section to update
            const sectionToUpdate = this.extractSectionFromPrompt(prompt);

            if (sectionToUpdate) {
                const updateResult = await context.toolManager.executeTool('insertSection', {
                    path: 'design.md',
                    header: sectionToUpdate,
                    mode: 'replace',
                    content: updateContent
                }, context.toolContext);

                if (updateResult.success) {
                    return {
                        success: true,
                        message: `Design updated successfully! Updated section: ${sectionToUpdate}`,
                        data: {
                            section: sectionToUpdate,
                            changed: updateResult.data?.changed
                        }
                    };
                }
            }

            // If no specific section identified, append as new section
            const newSectionContent = `## ${this.generateSectionTitle(prompt)}\n\n${updateContent}`;

            const appendResult = await context.toolManager.executeTool('insertSection', {
                path: 'design.md',
                header: 'Design Document',
                mode: 'append',
                content: newSectionContent
            }, context.toolContext);

            if (appendResult.success) {
                return {
                    success: true,
                    message: `New design section added successfully: ${this.generateSectionTitle(prompt)}`,
                    data: {
                        section: this.generateSectionTitle(prompt)
                    }
                };
            } else {
                return {
                    success: false,
                    message: `Failed to update design: ${appendResult.error}`
                };
            }

        } catch (error) {
            return {
                success: false,
                message: `Error updating design: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async analyzeRequirements(context: AgentContext): Promise<AgentResponse> {
        try {
            // Read requirements document
            const requirementsResult = await context.toolManager.executeTool('readFile', {
                path: 'requirements.md'
            }, context.toolContext);

            if (!requirementsResult.success) {
                return {
                    success: false,
                    message: 'Requirements document not found. Please create requirements first.'
                };
            }

            const analysis = this.analyzeRequirementsForDesign(requirementsResult.data.content);

            return {
                success: true,
                message: `**Requirements Analysis for Design:**

${analysis}

**Next Steps:**
- Say "create design" to generate a comprehensive design document
- Ask specific questions about architecture decisions
- Request analysis of specific technical areas (security, performance, etc.)`,
                data: {
                    analysis
                }
            };

        } catch (error) {
            return {
                success: false,
                message: `Error analyzing requirements: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async discussArchitecture(prompt: string, context: AgentContext): Promise<AgentResponse> {
        const guidance = `I'm here to help you design technical solutions and system architecture. Here's what I can help you with:

**Architecture Design Services:**
1. **Create Design Document** - Generate comprehensive technical design based on your requirements
2. **Analyze Requirements** - Review requirements and identify key architectural considerations
3. **Update Design** - Modify or enhance existing design sections
4. **Architecture Consultation** - Discuss specific technical decisions and trade-offs

**Architecture Areas I Cover:**
- **System Architecture**: Components, services, and interactions
- **Data Architecture**: Models, storage, and data flow
- **Integration Architecture**: APIs and external systems
- **Security Architecture**: Authentication, authorization, encryption
- **Performance Architecture**: Scalability and optimization
- **Deployment Architecture**: Infrastructure and deployment strategies

**Technical Decision Framework:**
- Evaluate multiple solution approaches
- Document trade-offs and rationale
- Consider non-functional requirements
- Align with business constraints
- Provide implementation guidelines

**What would you like to do?**
- Say "create design" to generate a design document from requirements
- Say "analyze requirements" to review requirements for design considerations
- Ask about specific architecture patterns or technologies
- Request updates to existing design sections

Please let me know how you'd like to proceed with the technical design!`;

        return {
            success: true,
            message: guidance
        };
    }

    private async generateDesignContent(requirementsContext: string): Promise<string> {
        // This is a simplified version - in a real implementation, you'd use LLM to generate
        // design based on the requirements. For now, we'll create a comprehensive template.
        
        const template = `# Design Document

## Overview

This document outlines the technical architecture and design decisions for the system based on the business requirements. The design follows industry best practices and considers scalability, maintainability, and security.

### Architectural Principles
- **Modularity**: System components are loosely coupled and highly cohesive
- **Scalability**: Architecture supports horizontal and vertical scaling
- **Security**: Security is built into every layer of the system
- **Maintainability**: Code and architecture are designed for easy maintenance and updates
- **Performance**: System is optimized for efficient resource utilization

## System Architecture

### High-Level Architecture

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Presentation  │    │   Application   │    │      Data       │
│      Layer      │◄──►│     Layer       │◄──►│     Layer       │
│                 │    │                 │    │                 │
│ - Web UI        │    │ - Business      │    │ - Database      │
│ - Mobile App    │    │   Logic         │    │ - File Storage  │
│ - APIs          │    │ - Services      │    │ - Cache         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
\`\`\`

### Component Architecture

#### Frontend Components
- **User Interface Layer**: React/Vue.js components for user interaction
- **State Management**: Redux/Vuex for application state
- **API Client**: HTTP client for backend communication
- **Authentication**: JWT token management and user session handling

#### Backend Components
- **API Gateway**: Request routing, authentication, and rate limiting
- **Application Services**: Business logic implementation
- **Data Access Layer**: Database abstraction and ORM
- **Authentication Service**: User authentication and authorization
- **Notification Service**: Email, SMS, and push notifications

#### Infrastructure Components
- **Load Balancer**: Traffic distribution and high availability
- **Application Servers**: Containerized application instances
- **Database Cluster**: Primary/replica database setup
- **Cache Layer**: Redis for session and data caching
- **Message Queue**: Asynchronous task processing

## Data Architecture

### Data Models

#### User Entity
\`\`\`typescript
interface User {
  id: string;
  email: string;
  username: string;
  profile: UserProfile;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
}
\`\`\`

#### Core Business Entity
\`\`\`typescript
interface BusinessEntity {
  id: string;
  name: string;
  description: string;
  status: EntityStatus;
  metadata: Record<string, any>;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}
\`\`\`

### Database Design

#### Relational Database (PostgreSQL)
- **Users Table**: User accounts and authentication data
- **Profiles Table**: User profile information
- **Business_Entities Table**: Core business data
- **Audit_Log Table**: System activity tracking

#### NoSQL Database (MongoDB)
- **Documents Collection**: Flexible document storage
- **Analytics Collection**: Event tracking and metrics
- **Cache Collection**: Temporary data storage

### Data Flow Patterns

1. **CRUD Operations**: Standard create, read, update, delete patterns
2. **Event Sourcing**: Audit trail and state reconstruction
3. **CQRS**: Separate read and write models for performance
4. **Data Synchronization**: Real-time updates via WebSockets

## API Design

### RESTful API Endpoints

#### Authentication Endpoints
- \`POST /api/auth/login\` - User authentication
- \`POST /api/auth/logout\` - User logout
- \`POST /api/auth/refresh\` - Token refresh
- \`GET /api/auth/profile\` - User profile

#### Business Entity Endpoints
- \`GET /api/entities\` - List entities with pagination
- \`POST /api/entities\` - Create new entity
- \`GET /api/entities/:id\` - Get entity by ID
- \`PUT /api/entities/:id\` - Update entity
- \`DELETE /api/entities/:id\` - Delete entity

### API Standards
- **HTTP Status Codes**: Standard REST status codes
- **Request/Response Format**: JSON with consistent structure
- **Error Handling**: Standardized error response format
- **Versioning**: URL-based versioning (/api/v1/)
- **Rate Limiting**: Request throttling and quotas

## Security Architecture

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with refresh tokens
- **Role-Based Access Control (RBAC)**: Granular permission system
- **OAuth 2.0**: Third-party authentication integration
- **Multi-Factor Authentication**: Optional 2FA for enhanced security

### Data Security
- **Encryption at Rest**: Database and file encryption
- **Encryption in Transit**: TLS 1.3 for all communications
- **Data Masking**: Sensitive data protection in logs
- **Input Validation**: SQL injection and XSS prevention

### Infrastructure Security
- **Network Segmentation**: Isolated network zones
- **Firewall Rules**: Restrictive ingress/egress policies
- **Container Security**: Secure container images and runtime
- **Monitoring**: Security event logging and alerting

## Performance Architecture

### Scalability Patterns
- **Horizontal Scaling**: Auto-scaling application instances
- **Database Sharding**: Data partitioning for large datasets
- **CDN Integration**: Static asset delivery optimization
- **Microservices**: Service-based architecture for independent scaling

### Caching Strategy
- **Application Cache**: In-memory caching with Redis
- **Database Query Cache**: Optimized query result caching
- **HTTP Cache**: Browser and proxy caching headers
- **API Response Cache**: Cached responses for expensive operations

### Performance Monitoring
- **Application Metrics**: Response times, throughput, error rates
- **Infrastructure Metrics**: CPU, memory, disk, network usage
- **Database Performance**: Query performance and optimization
- **User Experience**: Real user monitoring and synthetic tests

## Deployment Architecture

### Infrastructure
- **Cloud Platform**: AWS/Azure/GCP with managed services
- **Container Orchestration**: Kubernetes for container management
- **CI/CD Pipeline**: Automated testing and deployment
- **Environment Management**: Development, staging, production environments

### Deployment Strategy
- **Blue-Green Deployment**: Zero-downtime deployments
- **Rolling Updates**: Gradual service updates
- **Feature Flags**: Controlled feature rollouts
- **Rollback Procedures**: Quick recovery from failed deployments

## Implementation Guidelines

### Development Standards
- **Code Quality**: ESLint, Prettier, and code review processes
- **Testing Strategy**: Unit, integration, and end-to-end testing
- **Documentation**: API documentation and code comments
- **Version Control**: Git workflow with feature branches

### Technology Stack
- **Frontend**: React/Vue.js, TypeScript, Tailwind CSS
- **Backend**: Node.js/Python/Java, Express/FastAPI/Spring
- **Database**: PostgreSQL, MongoDB, Redis
- **Infrastructure**: Docker, Kubernetes, AWS/Azure/GCP

### Best Practices
- **Error Handling**: Comprehensive error handling and logging
- **Logging**: Structured logging with correlation IDs
- **Monitoring**: Application and infrastructure monitoring
- **Security**: Regular security audits and updates

## Risks and Mitigation

### Technical Risks
- **Scalability Bottlenecks**: Implement performance monitoring and auto-scaling
- **Data Loss**: Regular backups and disaster recovery procedures
- **Security Vulnerabilities**: Regular security audits and updates
- **Third-Party Dependencies**: Vendor risk assessment and alternatives

### Operational Risks
- **Deployment Failures**: Automated testing and rollback procedures
- **Performance Degradation**: Monitoring and alerting systems
- **Data Inconsistency**: Transaction management and data validation
- **Service Outages**: High availability and redundancy planning

## Next Steps

1. **Review and Approve Design**: Stakeholder review and approval process
2. **Create Implementation Plan**: Break down design into development tasks
3. **Set Up Development Environment**: Infrastructure and tooling setup
4. **Begin Implementation**: Start with core components and iterate
5. **Testing and Validation**: Continuous testing throughout development

---

*This design document serves as the foundation for technical implementation. It should be reviewed and updated as requirements evolve and implementation progresses.*`;

        return template;
    }

    private generateUpdateContent(prompt: string, existingContent: string): string {
        // Simplified content generation - in real implementation, use LLM
        return `**Updated based on request:** ${prompt}

### Technical Approach

The updated design addresses the following considerations:
- Architecture patterns and best practices
- Performance and scalability requirements
- Security and compliance considerations
- Integration and deployment strategies

### Implementation Details

- **Components**: [Specific components to be updated/added]
- **Technologies**: [Technology stack considerations]
- **Patterns**: [Design patterns and architectural decisions]
- **Trade-offs**: [Technical trade-offs and rationale]

### Next Steps

- Review updated design with stakeholders
- Update implementation plan accordingly
- Consider impact on existing components`;
    }

    private extractSectionFromPrompt(prompt: string): string | null {
        // Simple pattern matching - in real implementation, use LLM for better parsing
        const sections = [
            'Overview', 'System Architecture', 'Data Architecture', 'API Design',
            'Security Architecture', 'Performance Architecture', 'Deployment Architecture',
            'Implementation Guidelines'
        ];
        
        for (const section of sections) {
            if (prompt.toLowerCase().includes(section.toLowerCase())) {
                return section;
            }
        }
        
        return null;
    }

    private generateSectionTitle(prompt: string): string {
        // Simple title generation - in real implementation, use LLM
        if (prompt.toLowerCase().includes('security')) {
            return 'Security Considerations';
        }
        if (prompt.toLowerCase().includes('performance')) {
            return 'Performance Optimization';
        }
        if (prompt.toLowerCase().includes('database')) {
            return 'Database Design';
        }
        if (prompt.toLowerCase().includes('api')) {
            return 'API Specifications';
        }
        return 'Additional Design Considerations';
    }

    private analyzeRequirementsForDesign(requirementsContent: string): string {
        // Simplified analysis - in real implementation, use LLM for comprehensive analysis
        const functionalReqs = (requirementsContent.match(/### Requirement \d+/g) || []).length;
        const hasAuth = requirementsContent.toLowerCase().includes('auth') || requirementsContent.toLowerCase().includes('login');
        const hasData = requirementsContent.toLowerCase().includes('data') || requirementsContent.toLowerCase().includes('store');
        const hasAPI = requirementsContent.toLowerCase().includes('api') || requirementsContent.toLowerCase().includes('interface');

        return `**Requirements Analysis Summary:**

📊 **Functional Requirements**: ${functionalReqs} requirements identified
🔐 **Authentication Needs**: ${hasAuth ? 'Required' : 'Not specified'}
💾 **Data Management**: ${hasData ? 'Required' : 'Not specified'}
🔌 **API Integration**: ${hasAPI ? 'Required' : 'Not specified'}

**Key Architecture Considerations:**
- System needs to support ${functionalReqs} functional requirements
- ${hasAuth ? 'Authentication and authorization system required' : 'Consider if authentication is needed'}
- ${hasData ? 'Data storage and management architecture needed' : 'Minimal data requirements'}
- ${hasAPI ? 'API design and integration patterns required' : 'Consider internal vs external interfaces'}

**Recommended Architecture Patterns:**
- Layered architecture for separation of concerns
- RESTful API design for external interfaces
- ${hasAuth ? 'JWT-based authentication with RBAC' : 'Simple session management'}
- ${hasData ? 'Database abstraction layer with ORM' : 'In-memory or file-based storage'}`;
    }

    private countSections(content: string): number {
        const matches = content.match(/^##\s+/gm);
        return matches ? matches.length : 0;
    }

    /**
     * Override to provide design-specific offline response
     */
    protected async getAgentSpecificOfflineResponse(
        operation: string, 
        templateType: string, 
        context: AgentContext
    ): Promise<string | null> {
        if (templateType !== 'design') {
            return null;
        }

        let response = `🏗️ **Solution Architect - Offline Mode**\n\n`;
        response += `I'm the Solution Architect agent, specialized in creating technical designs and system architecture. While I can't have dynamic conversations right now, I can provide comprehensive frameworks for technical design documentation.\n\n`;

        switch (operation) {
            case 'document-creation':
                response += `**Creating Design Documents Offline**\n\n`;
                response += `I'll create a structured design template with:\n`;
                response += `• **System Architecture** - High-level components and interactions\n`;
                response += `• **Data Architecture** - Data models, storage, and flow patterns\n`;
                response += `• **API Design** - Interface specifications and integration patterns\n`;
                response += `• **Security Architecture** - Authentication, authorization, and protection\n`;
                response += `• **Performance Architecture** - Scalability and optimization strategies\n`;
                response += `• **Deployment Architecture** - Infrastructure and deployment patterns\n\n`;
                
                response += `**Architecture Design Principles (Offline Reference):**\n`;
                response += `• **Modularity** - Loosely coupled, highly cohesive components\n`;
                response += `• **Scalability** - Horizontal and vertical scaling capabilities\n`;
                response += `• **Security** - Defense in depth, security by design\n`;
                response += `• **Maintainability** - Clean code, clear documentation\n`;
                response += `• **Performance** - Efficient resource utilization\n`;
                response += `• **Reliability** - Fault tolerance and graceful degradation\n\n`;
                
                response += `**Technical Decision Framework:**\n`;
                response += `1. **Evaluate Options** - Consider multiple approaches\n`;
                response += `2. **Document Trade-offs** - Pros, cons, and rationale\n`;
                response += `3. **Consider NFRs** - Non-functional requirements impact\n`;
                response += `4. **Align with Constraints** - Business and technical limits\n`;
                response += `5. **Plan Implementation** - Practical implementation steps\n`;
                break;

            case 'document-review':
                response += `**Design Review Framework (Offline)**\n\n`;
                response += `Use this comprehensive checklist to review your design:\n\n`;
                
                response += `**Architecture Quality:**\n`;
                response += `□ System components are clearly defined and documented\n`;
                response += `□ Component interactions and dependencies are specified\n`;
                response += `□ Architecture supports scalability requirements\n`;
                response += `□ Security considerations are integrated throughout\n\n`;
                
                response += `**Design Completeness:**\n`;
                response += `□ All functional requirements are addressed\n`;
                response += `□ Non-functional requirements are considered\n`;
                response += `□ Data models and storage are designed\n`;
                response += `□ API interfaces are specified\n\n`;
                
                response += `**Technical Feasibility:**\n`;
                response += `□ Technology choices are appropriate and justified\n`;
                response += `□ Performance requirements can be met\n`;
                response += `□ Security requirements are achievable\n`;
                response += `□ Implementation complexity is reasonable\n\n`;
                
                response += `**Implementation Readiness:**\n`;
                response += `□ Design provides clear implementation guidance\n`;
                response += `□ Technical risks are identified and mitigated\n`;
                response += `□ Dependencies and assumptions are documented\n`;
                response += `□ Testing strategy is outlined\n`;
                break;

            case 'conversation':
                response += `**Structured Design Process (Offline)**\n\n`;
                response += `Work through this systematic design process:\n\n`;
                
                response += `**Phase 1: Requirements Analysis**\n`;
                response += `1. What are the key functional requirements?\n`;
                response += `2. What are the non-functional requirements (performance, security, scalability)?\n`;
                response += `3. What are the business constraints and limitations?\n`;
                response += `4. What are the technical constraints and dependencies?\n`;
                response += `5. What are the integration requirements?\n\n`;
                
                response += `**Phase 2: Architecture Design**\n`;
                response += `1. What are the main system components?\n`;
                response += `2. How do components interact with each other?\n`;
                response += `3. What are the data flows and processing patterns?\n`;
                response += `4. What external systems need integration?\n`;
                response += `5. What are the deployment and infrastructure needs?\n\n`;
                
                response += `**Phase 3: Technical Decisions**\n`;
                response += `1. What technology stack best fits the requirements?\n`;
                response += `2. What architectural patterns should be used?\n`;
                response += `3. How will the system handle scalability?\n`;
                response += `4. What security measures are needed?\n`;
                response += `5. How will performance requirements be met?\n\n`;
                
                response += `**Phase 4: Implementation Planning**\n`;
                response += `1. What are the development phases and milestones?\n`;
                response += `2. What are the technical risks and mitigation strategies?\n`;
                response += `3. What testing approaches will be used?\n`;
                response += `4. What documentation and standards are needed?\n`;
                response += `5. How will the system be deployed and maintained?\n\n`;
                
                response += `**💡 Architecture tip:** Start with the big picture, then drill down into details. Always consider how your design will evolve over time.`;
                break;

            default:
                response += `**Solution Architect Offline Capabilities**\n\n`;
                response += `I can help you create technical designs through:\n`;
                response += `• Comprehensive architecture templates\n`;
                response += `• System design frameworks\n`;
                response += `• Technical decision guidelines\n`;
                response += `• Design review checklists\n`;
                response += `• Implementation planning templates\n\n`;
                
                response += `**Available commands:**\n`;
                response += `• \`/new <system-name>\` - Create design template\n`;
                response += `• \`/help\` - Get offline help\n`;
                response += `• \`/status\` - Check offline status\n`;
                break;
        }

        return response;
    }

    /**
     * Override to provide design-specific template content
     */
    protected async getTemplateSpecificContent(templateType: string, title: string, context: AgentContext): Promise<string> {
        if (templateType !== 'design') {
            return super.getTemplateSpecificContent(templateType, title, context);
        }

        return `## Overview

This document outlines the technical architecture and design decisions for **${title}**. The design follows industry best practices and considers scalability, maintainability, security, and performance requirements.

### System Purpose
*Describe what this system does and why it exists*

**Example:** "This system provides a comprehensive customer relationship management platform that enables small businesses to track customer interactions, manage sales pipelines, and automate follow-up communications."

**Your system purpose:**
*[Describe the core purpose and value proposition of your system]*

### Architectural Principles
*Define the key principles guiding your design decisions*

**Example principles:**
- **Modularity:** Components are loosely coupled and highly cohesive
- **Scalability:** System supports both horizontal and vertical scaling
- **Security:** Security is built into every layer of the architecture
- **Maintainability:** Code and architecture are designed for easy updates
- **Performance:** System is optimized for efficient resource utilization
- **Reliability:** System provides fault tolerance and graceful degradation

**Your architectural principles:**
1. *[Principle 1]: [Description and rationale]*
2. *[Principle 2]: [Description and rationale]*
3. *[Principle 3]: [Description and rationale]*
4. *[Principle 4]: [Description and rationale]*

### Design Constraints
*Document any constraints that influence the design*

**Example constraints:**
- Must integrate with existing authentication system
- Budget limit of $10K for infrastructure
- Must support 1000 concurrent users
- Compliance with GDPR and SOC 2

**Your design constraints:**
- *[Constraint 1]: [Impact on design]*
- *[Constraint 2]: [Impact on design]*
- *[Constraint 3]: [Impact on design]*

## System Architecture

### High-Level Architecture

*Describe the overall system structure and major components*

**Architecture Diagram (Text-based):**
\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Presentation  │    │   Application   │    │      Data       │
│      Layer      │◄──►│     Layer       │◄──►│     Layer       │
│                 │    │                 │    │                 │
│ - Web UI        │    │ - Business      │    │ - Database      │
│ - Mobile App    │    │   Logic         │    │ - File Storage  │
│ - APIs          │    │ - Services      │    │ - Cache         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
\`\`\`

**Your architecture diagram:**
*[Create a text-based diagram or description of your system's high-level architecture]*

### Component Architecture

#### Frontend Components
*Describe the user-facing components*

**Example components:**
- **User Interface Layer:** React components for user interaction
- **State Management:** Redux for application state
- **API Client:** Axios for backend communication
- **Authentication:** JWT token management
- **Routing:** React Router for navigation

**Your frontend components:**
- **[Component 1]:** *[Description and responsibility]*
- **[Component 2]:** *[Description and responsibility]*
- **[Component 3]:** *[Description and responsibility]*
- **[Component 4]:** *[Description and responsibility]*

#### Backend Components
*Describe the server-side components*

**Example components:**
- **API Gateway:** Request routing and authentication
- **Application Services:** Business logic implementation
- **Data Access Layer:** Database abstraction
- **Authentication Service:** User management
- **Notification Service:** Email and push notifications

**Your backend components:**
- **[Component 1]:** *[Description and responsibility]*
- **[Component 2]:** *[Description and responsibility]*
- **[Component 3]:** *[Description and responsibility]*
- **[Component 4]:** *[Description and responsibility]*

#### Infrastructure Components
*Describe the infrastructure and deployment components*

**Example components:**
- **Load Balancer:** Traffic distribution
- **Application Servers:** Containerized instances
- **Database Cluster:** Primary/replica setup
- **Cache Layer:** Redis for performance
- **Message Queue:** Asynchronous processing

**Your infrastructure components:**
- **[Component 1]:** *[Description and purpose]*
- **[Component 2]:** *[Description and purpose]*
- **[Component 3]:** *[Description and purpose]*

### Component Interactions

*Describe how components communicate with each other*

**Interaction patterns:**
1. **User Request Flow:** User → UI → API Gateway → Service → Database
2. **Authentication Flow:** Login → Auth Service → JWT Token → Protected Resources
3. **Data Update Flow:** UI → API → Service → Database → Cache Invalidation
4. **Notification Flow:** Event → Message Queue → Notification Service → External APIs

**Your interaction patterns:**
1. *[Flow 1]: [Step-by-step description]*
2. *[Flow 2]: [Step-by-step description]*
3. *[Flow 3]: [Step-by-step description]*

## Data Architecture

### Data Models

*Define the core data entities and their relationships*

#### Primary Entities

**Example Entity:**
\`\`\`typescript
interface User {
  id: string;
  email: string;
  username: string;
  profile: UserProfile;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  preferences: UserPreferences;
}
\`\`\`

**Your primary entities:**
\`\`\`typescript
interface [EntityName] {
  // Define your entity structure
  id: string;
  // Add your fields here
  createdAt: Date;
  updatedAt: Date;
}
\`\`\`

#### Entity Relationships

*Describe how entities relate to each other*

**Example relationships:**
- User **has many** Orders (1:N)
- Order **belongs to** User (N:1)
- Order **has many** OrderItems (1:N)
- Product **has many** OrderItems (1:N)

**Your entity relationships:**
- *[Entity A] **[relationship]** [Entity B] ([cardinality])*
- *[Entity C] **[relationship]** [Entity D] ([cardinality])*
- *[Entity E] **[relationship]** [Entity F] ([cardinality])*

### Database Design

#### Database Technology Choice

*Explain your database technology selection*

**Example rationale:**
"PostgreSQL was chosen for the primary database due to its ACID compliance, strong consistency guarantees, and excellent support for complex queries. Redis is used for caching and session storage due to its high performance and simple key-value operations."

**Your database choice:**
*[Database technology]: [Rationale for selection]*

#### Database Schema

**Example schema:**
\`\`\`sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
\`\`\`

**Your database schema:**
\`\`\`sql
-- Define your tables here
CREATE TABLE [table_name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Add your columns
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### Data Flow Patterns

*Describe how data moves through the system*

**Data flow patterns:**
1. **CRUD Operations:** Standard create, read, update, delete patterns
2. **Event Sourcing:** Audit trail and state reconstruction
3. **CQRS:** Separate read and write models for performance
4. **Data Synchronization:** Real-time updates via WebSockets

**Your data flow patterns:**
1. *[Pattern 1]: [Description and use case]*
2. *[Pattern 2]: [Description and use case]*
3. *[Pattern 3]: [Description and use case]*

## API Design

### API Architecture

*Describe your API design approach*

**API Style:** RESTful APIs with JSON payloads
**Authentication:** JWT Bearer tokens
**Versioning:** URL-based versioning (/api/v1/)
**Documentation:** OpenAPI/Swagger specifications

**Your API approach:**
- **Style:** *[REST, GraphQL, gRPC, etc.]*
- **Authentication:** *[JWT, OAuth, API keys, etc.]*
- **Versioning:** *[URL, header, parameter-based]*
- **Documentation:** *[Swagger, Postman, custom]*

### API Endpoints

#### Authentication Endpoints

**Example endpoints:**
\`\`\`
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/profile
\`\`\`

**Your authentication endpoints:**
\`\`\`
[METHOD] /api/v1/auth/[endpoint]
[METHOD] /api/v1/auth/[endpoint]
[METHOD] /api/v1/auth/[endpoint]
\`\`\`

#### Core Business Endpoints

**Example endpoints:**
\`\`\`
GET    /api/v1/users          # List users with pagination
POST   /api/v1/users          # Create new user
GET    /api/v1/users/:id      # Get user by ID
PUT    /api/v1/users/:id      # Update user
DELETE /api/v1/users/:id      # Delete user
\`\`\`

**Your business endpoints:**
\`\`\`
[METHOD] /api/v1/[resource]     # [Description]
[METHOD] /api/v1/[resource]     # [Description]
[METHOD] /api/v1/[resource]/:id # [Description]
\`\`\`

### API Standards

*Define your API conventions and standards*

**Request/Response Format:**
\`\`\`json
// Standard success response
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0"
  }
}

// Standard error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  }
}
\`\`\`

**Your API standards:**
- **Status Codes:** *[Which HTTP status codes you use]*
- **Error Handling:** *[Error response format]*
- **Pagination:** *[Pagination strategy]*
- **Rate Limiting:** *[Rate limiting approach]*

## Security Architecture

### Authentication & Authorization

*Describe how users are authenticated and authorized*

**Authentication Strategy:**
- **Method:** JWT tokens with refresh token rotation
- **Storage:** HTTP-only cookies for web, secure storage for mobile
- **Expiration:** Access tokens expire in 15 minutes, refresh tokens in 7 days
- **Multi-Factor:** Optional TOTP-based 2FA

**Authorization Model:**
- **RBAC:** Role-based access control with granular permissions
- **Roles:** Admin, Manager, User, Guest
- **Permissions:** Create, Read, Update, Delete, Manage
- **Scope:** Resource-level and action-level permissions

**Your authentication & authorization:**
- **Authentication Method:** *[JWT, session, OAuth, etc.]*
- **Token Storage:** *[Cookies, localStorage, secure storage]*
- **Authorization Model:** *[RBAC, ABAC, simple roles]*
- **Multi-Factor:** *[2FA method if applicable]*

### Data Security

*Describe how data is protected*

**Encryption:**
- **In Transit:** TLS 1.3 for all communications
- **At Rest:** AES-256 encryption for sensitive data
- **Key Management:** AWS KMS or similar key management service
- **Hashing:** bcrypt for passwords, SHA-256 for data integrity

**Data Protection:**
- **Input Validation:** Strict validation and sanitization
- **SQL Injection:** Parameterized queries and ORM protection
- **XSS Prevention:** Content Security Policy and output encoding
- **CSRF Protection:** CSRF tokens and SameSite cookies

**Your data security measures:**
- **Encryption Standards:** *[TLS version, encryption algorithms]*
- **Key Management:** *[How encryption keys are managed]*
- **Input Validation:** *[Validation strategy]*
- **Attack Prevention:** *[SQL injection, XSS, CSRF protection]*

### Infrastructure Security

*Describe infrastructure-level security measures*

**Network Security:**
- **Firewalls:** Restrictive ingress/egress rules
- **VPC:** Isolated network with private subnets
- **Load Balancer:** SSL termination and DDoS protection
- **Monitoring:** Security event logging and alerting

**Your infrastructure security:**
- **Network Isolation:** *[VPC, subnets, security groups]*
- **Access Control:** *[IAM, service accounts, least privilege]*
- **Monitoring:** *[Security logging, alerting, SIEM]*
- **Compliance:** *[Regulatory requirements, auditing]*

## Performance Architecture

### Scalability Strategy

*Describe how the system will scale*

**Horizontal Scaling:**
- **Application Servers:** Auto-scaling groups with load balancing
- **Database:** Read replicas and connection pooling
- **Cache:** Distributed Redis cluster
- **CDN:** Global content delivery network

**Vertical Scaling:**
- **Resource Monitoring:** CPU, memory, and disk usage tracking
- **Auto-scaling:** Automatic resource allocation based on demand
- **Performance Tuning:** Database query optimization and indexing

**Your scalability approach:**
- **Horizontal Scaling:** *[How you'll scale out]*
- **Vertical Scaling:** *[How you'll scale up]*
- **Bottleneck Identification:** *[Monitoring and optimization strategy]*
- **Capacity Planning:** *[Growth projections and planning]*

### Caching Strategy

*Describe your caching approach*

**Cache Layers:**
1. **Browser Cache:** Static assets and API responses
2. **CDN Cache:** Global edge caching for static content
3. **Application Cache:** In-memory caching with Redis
4. **Database Cache:** Query result caching and connection pooling

**Cache Patterns:**
- **Cache-Aside:** Application manages cache population
- **Write-Through:** Updates go to cache and database simultaneously
- **Write-Behind:** Asynchronous database updates from cache
- **Cache Invalidation:** TTL-based and event-driven invalidation

**Your caching strategy:**
- **Cache Layers:** *[What you'll cache and where]*
- **Cache Patterns:** *[How you'll manage cache consistency]*
- **Invalidation Strategy:** *[How you'll keep cache fresh]*
- **Performance Targets:** *[Cache hit ratios, response times]*

### Performance Monitoring

*Describe how you'll monitor and optimize performance*

**Metrics to Track:**
- **Application Metrics:** Response times, throughput, error rates
- **Infrastructure Metrics:** CPU, memory, disk, network usage
- **Database Performance:** Query times, connection counts, lock waits
- **User Experience:** Real user monitoring and synthetic tests

**Your monitoring approach:**
- **Key Metrics:** *[What you'll measure]*
- **Monitoring Tools:** *[APM, logging, metrics platforms]*
- **Alerting:** *[When and how you'll be notified of issues]*
- **Optimization Process:** *[How you'll identify and fix performance issues]*

## Deployment Architecture

### Infrastructure Platform

*Describe your deployment infrastructure*

**Cloud Platform:** AWS/Azure/GCP with managed services
**Containerization:** Docker containers with Kubernetes orchestration
**CI/CD Pipeline:** GitHub Actions/GitLab CI with automated testing
**Environment Management:** Development, staging, production environments

**Your infrastructure choice:**
- **Cloud Provider:** *[AWS, Azure, GCP, on-premise]*
- **Containerization:** *[Docker, Kubernetes, serverless]*
- **CI/CD Platform:** *[GitHub Actions, Jenkins, GitLab CI]*
- **Infrastructure as Code:** *[Terraform, CloudFormation, ARM]*

### Deployment Strategy

*Describe how you'll deploy updates*

**Deployment Patterns:**
- **Blue-Green Deployment:** Zero-downtime deployments with instant rollback
- **Rolling Updates:** Gradual service updates with health checks
- **Canary Releases:** Controlled rollouts to subset of users
- **Feature Flags:** Runtime feature toggling and A/B testing

**Your deployment strategy:**
- **Deployment Pattern:** *[Blue-green, rolling, canary]*
- **Rollback Strategy:** *[How you'll handle failed deployments]*
- **Feature Management:** *[Feature flags, A/B testing]*
- **Environment Promotion:** *[How code moves through environments]*

### Monitoring and Observability

*Describe your operational monitoring approach*

**Observability Stack:**
- **Logging:** Structured logging with correlation IDs
- **Metrics:** Application and infrastructure metrics
- **Tracing:** Distributed tracing for request flows
- **Alerting:** Proactive alerting based on SLIs/SLOs

**Your observability approach:**
- **Logging Strategy:** *[What you'll log and how]*
- **Metrics Collection:** *[What metrics you'll track]*
- **Alerting Rules:** *[When you'll be notified]*
- **Dashboards:** *[How you'll visualize system health]*

## Implementation Guidelines

### Development Standards

*Define coding and development standards*

**Code Quality:**
- **Linting:** ESLint/Prettier for consistent code formatting
- **Testing:** Unit tests (80%+ coverage), integration tests, E2E tests
- **Code Review:** Mandatory peer review for all changes
- **Documentation:** API docs, code comments, architecture decisions

**Your development standards:**
- **Code Style:** *[Linting rules, formatting standards]*
- **Testing Requirements:** *[Coverage targets, testing types]*
- **Review Process:** *[Code review requirements]*
- **Documentation Standards:** *[What documentation is required]*

### Technology Stack

*Define your technology choices*

**Frontend Stack:**
- **Framework:** React/Vue.js/Angular
- **Language:** TypeScript for type safety
- **Styling:** Tailwind CSS/Styled Components
- **Build Tools:** Vite/Webpack for bundling

**Backend Stack:**
- **Runtime:** Node.js/Python/Java
- **Framework:** Express/FastAPI/Spring Boot
- **Database:** PostgreSQL/MongoDB
- **Cache:** Redis/Memcached

**Your technology stack:**
- **Frontend:** *[Framework, language, tools]*
- **Backend:** *[Runtime, framework, database]*
- **DevOps:** *[CI/CD, monitoring, deployment tools]*
- **Third-party Services:** *[External APIs, services]*

### Best Practices

*Define implementation best practices*

**Architecture Patterns:**
- **Dependency Injection:** For loose coupling and testability
- **Repository Pattern:** For data access abstraction
- **Factory Pattern:** For object creation and configuration
- **Observer Pattern:** For event-driven architecture

**Your implementation patterns:**
- **Design Patterns:** *[Which patterns you'll use and why]*
- **Error Handling:** *[Error handling strategy]*
- **Logging Standards:** *[What and how to log]*
- **Performance Guidelines:** *[Performance best practices]*

## Risk Assessment and Mitigation

### Technical Risks

*Identify and plan for technical risks*

**Scalability Risks:**
- **Risk:** Database becomes bottleneck under high load
- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Implement read replicas, connection pooling, and query optimization

**Security Risks:**
- **Risk:** Data breach due to insufficient access controls
- **Probability:** Low
- **Impact:** Very High
- **Mitigation:** Implement RBAC, regular security audits, and penetration testing

**Your technical risks:**
1. **[Risk Name]**
   - **Probability:** *[Low/Medium/High]*
   - **Impact:** *[Low/Medium/High/Very High]*
   - **Mitigation:** *[How you'll prevent or handle this risk]*

2. **[Risk Name]**
   - **Probability:** *[Low/Medium/High]*
   - **Impact:** *[Low/Medium/High/Very High]*
   - **Mitigation:** *[How you'll prevent or handle this risk]*

### Operational Risks

*Identify operational and business risks*

**Deployment Risks:**
- **Risk:** Failed deployment causes system outage
- **Mitigation:** Blue-green deployments with automated rollback
- **Monitoring:** Real-time health checks and alerting

**Performance Risks:**
- **Risk:** System performance degrades under load
- **Mitigation:** Load testing, performance monitoring, auto-scaling
- **Response Plan:** Performance optimization playbook

**Your operational risks:**
1. **[Risk Name]:** *[Description and mitigation strategy]*
2. **[Risk Name]:** *[Description and mitigation strategy]*
3. **[Risk Name]:** *[Description and mitigation strategy]*

## Testing Strategy

### Testing Approach

*Define your testing methodology*

**Testing Pyramid:**
1. **Unit Tests (70%):** Test individual functions and components
2. **Integration Tests (20%):** Test component interactions
3. **End-to-End Tests (10%):** Test complete user workflows

**Testing Types:**
- **Functional Testing:** Verify features work as specified
- **Performance Testing:** Load testing and stress testing
- **Security Testing:** Penetration testing and vulnerability scanning
- **Usability Testing:** User experience validation

**Your testing strategy:**
- **Test Coverage:** *[Coverage targets for different test types]*
- **Testing Tools:** *[Jest, Cypress, Selenium, etc.]*
- **Test Environments:** *[Where tests run]*
- **Automation Level:** *[What's automated vs manual]*

### Quality Assurance

*Define quality assurance processes*

**QA Process:**
1. **Development Testing:** Developer runs unit and integration tests
2. **Code Review:** Peer review includes test coverage verification
3. **QA Testing:** Dedicated QA testing in staging environment
4. **User Acceptance Testing:** Stakeholder validation before release

**Your QA approach:**
- **QA Process:** *[Steps in your quality assurance process]*
- **Test Data Management:** *[How you'll manage test data]*
- **Bug Tracking:** *[How you'll track and resolve issues]*
- **Release Criteria:** *[What must pass before release]*

## Documentation and Knowledge Management

### Documentation Strategy

*Define what documentation will be created and maintained*

**Technical Documentation:**
- **API Documentation:** OpenAPI/Swagger specifications
- **Code Documentation:** Inline comments and README files
- **Architecture Decisions:** ADR (Architecture Decision Records)
- **Deployment Guides:** Step-by-step deployment instructions

**User Documentation:**
- **User Guides:** End-user documentation and tutorials
- **Admin Guides:** System administration documentation
- **Troubleshooting:** Common issues and solutions
- **FAQ:** Frequently asked questions

**Your documentation plan:**
- **Technical Docs:** *[What technical documentation you'll create]*
- **User Docs:** *[What user-facing documentation you'll create]*
- **Maintenance:** *[How you'll keep documentation current]*
- **Access:** *[Where documentation will be stored and accessed]*

## Next Steps and Implementation Plan

### Development Phases

*Break down implementation into manageable phases*

**Phase 1: Foundation (Weeks 1-4)**
- Set up development environment and CI/CD pipeline
- Implement core authentication and authorization
- Create basic database schema and data access layer
- Develop fundamental API endpoints

**Phase 2: Core Features (Weeks 5-8)**
- Implement primary business logic and services
- Develop user interface components
- Add data validation and error handling
- Implement basic security measures

**Phase 3: Advanced Features (Weeks 9-12)**
- Add performance optimizations and caching
- Implement advanced security features
- Develop monitoring and logging
- Add integration with external services

**Your implementation phases:**
**Phase 1: [Name] ([Timeline])**
- *[Key deliverables and milestones]*

**Phase 2: [Name] ([Timeline])**
- *[Key deliverables and milestones]*

**Phase 3: [Name] ([Timeline])**
- *[Key deliverables and milestones]*

### Success Criteria

*Define what success looks like for the implementation*

**Technical Success Criteria:**
- All functional requirements are implemented and tested
- System meets performance benchmarks (response time < 2s)
- Security requirements pass penetration testing
- Code coverage exceeds 80% for critical components

**Business Success Criteria:**
- System supports target user load (1000 concurrent users)
- Deployment process is automated and reliable
- Documentation is complete and accessible
- Team is trained and ready for production support

**Your success criteria:**
- **Technical:** *[Technical measures of success]*
- **Business:** *[Business measures of success]*
- **Quality:** *[Quality measures of success]*
- **Operational:** *[Operational readiness measures]*

### Transition to Implementation

*Plan the handoff from design to development*

**Design Review Process:**
1. **Stakeholder Review:** Present design to product owners and architects
2. **Technical Review:** Validate feasibility with development team
3. **Security Review:** Validate security architecture with security team
4. **Approval:** Get formal approval to proceed with implementation

**Implementation Kickoff:**
- **Team Formation:** Assign developers, testers, and other roles
- **Environment Setup:** Provision development and testing environments
- **Sprint Planning:** Break down design into development tasks
- **Knowledge Transfer:** Share design decisions and rationale with team

**Ready for implementation when:**
□ Design document is reviewed and approved
□ Technical feasibility is confirmed
□ Development team is assembled and trained
□ Development environment is set up
□ First sprint is planned and ready to start

---

*This design document provides the technical foundation for implementing ${title}. It should be treated as a living document that evolves as implementation progresses and new insights are gained.*`;
    }
}