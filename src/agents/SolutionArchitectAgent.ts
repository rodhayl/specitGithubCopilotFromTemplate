import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResponse, ChatRequest } from './types';

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

    async handleLegacyRequest(request: any, context: AgentContext): Promise<AgentResponse> {
        return await this.handleRequest(request, context);
    }

    async handleRequest(request: any, context: AgentContext): Promise<AgentResponse> {
        try {
            const prompt = request.prompt?.trim() || '';
            
            // Check if user is asking to create design document
            if (prompt.toLowerCase().includes('design') || prompt.toLowerCase().includes('architecture')) {
                return await this.createDesignDocument(context);
            }

            // Check if user wants to update existing design
            if (prompt.toLowerCase().includes('update') && prompt.toLowerCase().includes('design')) {
                return await this.updateDesign(prompt, context);
            }

            // Check if user wants to analyze requirements for design
            if (prompt.toLowerCase().includes('analyze') || prompt.toLowerCase().includes('review requirements')) {
                return await this.analyzeRequirements(context);
            }

            // General architecture discussion
            return await this.discussArchitecture(prompt, context);

        } catch (error) {
            return {
                success: false,
                message: `Architecture design failed: ${error instanceof Error ? error.message : String(error)}`
            };
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
}