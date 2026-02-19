import * as vscode from 'vscode';
import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResponse } from './types';

/**
 * RequirementsGathererAgent - Structured requirements collection
 *
 * Systematically collects and structures business requirements using EARS format.
 * Creates user stories and transforms brainstormed ideas into structured requirements.
 */
export class RequirementsGathererAgent extends BaseAgent {
    name = 'requirements-gatherer';
    systemPrompt = `You are a Requirements Gatherer agent specialized in systematically collecting and structuring business requirements using the EARS (Easy Approach to Requirements Syntax) format.

Your role is to:
1. Transform brainstormed ideas and PRD concepts into structured requirements
2. Create user stories in the format "As a [role], I want [feature], so that [benefit]"
3. Generate acceptance criteria using EARS format (WHEN/IF/THEN/SHALL statements)
4. Ensure requirements are testable, measurable, and implementation-ready
5. Build upon previous agent outputs (PRD, brainstorming notes) for context continuity

EARS Format Guidelines:
- Use WHEN [event] THEN [system] SHALL [response] for event-driven requirements
- Use IF [precondition] THEN [system] SHALL [response] for conditional requirements
- Use WHERE [location/context] for spatial or contextual requirements
- Use WHILE [ongoing condition] for continuous requirements

Requirements Structure:
- Each requirement should have a clear user story
- Break down complex features into multiple granular requirements
- Include edge cases and error conditions
- Consider non-functional requirements (performance, security, usability)
- Reference related requirements and dependencies

Focus on creating comprehensive, well-structured requirements.md documents that serve as the foundation for technical design and implementation.`;

    allowedTools = ['readFile', 'writeFile', 'insertSection', 'applyTemplate'];
    workflowPhase = 'requirements' as const;

    async handleDirectRequest(request: any, context: AgentContext): Promise<AgentResponse> {
        try {
            const prompt = request.prompt?.trim() || '';
            
            // Check if user is asking to create requirements document
            if (prompt.toLowerCase().includes('requirements') || prompt.toLowerCase().includes('gather requirements')) {
                return await this.createRequirementsDocument(context);
            }

            // Check if user wants to update existing requirements
            if (prompt.toLowerCase().includes('update') && prompt.toLowerCase().includes('requirement')) {
                return await this.updateRequirements(prompt, context);
            }

            // General requirements gathering conversation
            return await this.gatherRequirements(prompt, context);

        } catch (error) {
            return this.createResponse(
                `Requirements gathering failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async createRequirementsDocument(context: AgentContext): Promise<AgentResponse> {
        try {
            // Guard: toolManager is optional and not available in all call sites
            // (e.g. when invoked without a full workspace tool context). Fall back
            // to the interactive guidance response in that case.
            if (!context.toolManager || !context.toolContext) {
                return await this.gatherRequirements('', context);
            }

            // First, try to read PRD or brainstorming outputs for context
            let contextInfo = '';
            
            // Look for PRD document
            try {
                const prdResult = await context.toolManager.executeTool('readFile', {
                    path: 'PRD.txt'
                }, context.toolContext);
                
                if (prdResult.success && prdResult.data) {
                    contextInfo += `PRD Context:\n${prdResult.data.content}\n\n`;
                }
            } catch (error) {
                // PRD not found, continue without it
            }

            // Look for brainstorming notes
            try {
                const brainstormResult = await context.toolManager.executeTool('readFile', {
                    path: 'brainstorming-notes.md'
                }, context.toolContext);
                
                if (brainstormResult.success && brainstormResult.data) {
                    contextInfo += `Brainstorming Context:\n${brainstormResult.data.content}\n\n`;
                }
            } catch (error) {
                // Brainstorming notes not found, continue without them
            }

            // Generate requirements based on available context
            const requirementsContent = await this.generateRequirementsContent(contextInfo, context);

            // Create requirements.md file
            const result = await context.toolManager.executeTool('writeFile', {
                path: 'requirements.md',
                content: requirementsContent,
                createIfMissing: true
            }, context.toolContext);

            if (result.success) {
                return {
                    success: true,
                    message: 'Requirements document created successfully! I\'ve structured the requirements using EARS format with user stories and acceptance criteria.',
                    data: {
                        filePath: 'requirements.md',
                        requirementsCount: this.countRequirements(requirementsContent)
                    }
                };
            } else {
                return {
                    success: false,
                    message: `Failed to create requirements document: ${result.error}`
                };
            }

        } catch (error) {
            return {
                success: false,
                message: `Error creating requirements document: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async updateRequirements(prompt: string, context: AgentContext): Promise<AgentResponse> {
        try {
            // Guard: toolManager is optional
            if (!context.toolManager || !context.toolContext) {
                return await this.gatherRequirements(prompt, context);
            }

            // Read existing requirements
            const readResult = await context.toolManager.executeTool('readFile', {
                path: 'requirements.md'
            }, context.toolContext);

            if (!readResult.success) {
                return {
                    success: false,
                    message: 'Requirements document not found. Please create one first using the requirements gathering process.'
                };
            }

            // Analyze the update request and generate new content
            const updateContent = await this.generateUpdateContent(prompt, readResult.data.content);

            // Determine which section to update (this is simplified - in a real implementation, 
            // you'd use LLM to parse the request more intelligently)
            const sectionToUpdate = this.extractSectionFromPrompt(prompt);

            if (sectionToUpdate) {
                const updateResult = await context.toolManager.executeTool('insertSection', {
                    path: 'requirements.md',
                    header: sectionToUpdate,
                    mode: 'replace',
                    content: updateContent
                }, context.toolContext);

                if (updateResult.success) {
                    return {
                        success: true,
                        message: `Requirements updated successfully! Updated section: ${sectionToUpdate}`,
                        data: {
                            section: sectionToUpdate,
                            changed: updateResult.data?.changed
                        }
                    };
                }
            }

            // If no specific section identified, append as new requirement
            const newRequirementNumber = this.getNextRequirementNumber(readResult.data.content);
            const newRequirementContent = `### Requirement ${newRequirementNumber}\n\n${updateContent}`;

            const appendResult = await context.toolManager.executeTool('insertSection', {
                path: 'requirements.md',
                header: 'Requirements',
                mode: 'append',
                content: newRequirementContent
            }, context.toolContext);

            if (appendResult.success) {
                return {
                    success: true,
                    message: `New requirement added successfully as Requirement ${newRequirementNumber}`,
                    data: {
                        requirementNumber: newRequirementNumber
                    }
                };
            } else {
                return {
                    success: false,
                    message: `Failed to update requirements: ${appendResult.error}`
                };
            }

        } catch (error) {
            return {
                success: false,
                message: `Error updating requirements: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async gatherRequirements(prompt: string, context: AgentContext): Promise<AgentResponse> {
        // This would typically involve LLM interaction to gather more requirements
        // For now, provide guidance on requirements gathering
        
        const guidance = `I'm here to help you gather and structure requirements systematically. Here's what I can help you with:

**Requirements Gathering Process:**
1. **Create Requirements Document** - I can generate a structured requirements.md file based on your PRD and brainstorming notes
2. **Add New Requirements** - Tell me about new features or needs, and I'll format them as proper requirements
3. **Update Existing Requirements** - I can modify or enhance existing requirements based on new insights

**EARS Format I Use:**
- **User Stories**: "As a [role], I want [feature], so that [benefit]"
- **Acceptance Criteria**: 
  - WHEN [event] THEN [system] SHALL [response]
  - IF [precondition] THEN [system] SHALL [response]
  - WHERE [location/context] for spatial requirements
  - WHILE [ongoing condition] for continuous requirements

**What would you like to do?**
- Say "create requirements" to generate a requirements document
- Describe a feature or need to add it as a new requirement
- Say "update requirement X" to modify an existing requirement

Please share your thoughts or let me know how you'd like to proceed with requirements gathering.`;

        return {
            success: true,
            message: guidance
        };
    }

    private async generateRequirementsContent(contextInfo: string, context?: AgentContext): Promise<string> {
        // Use LLM when available for context-aware dynamic content generation
        if (context?.model) {
            try {
                const llmPrompt = [
                    'You are a requirements engineer. Generate a comprehensive requirements.md document.',
                    'Use EARS format (Easy Approach to Requirements Syntax):',
                    '  WHEN [event] THEN [system] SHALL [response]',
                    '  IF [precondition] THEN [system] SHALL [response]',
                    '',
                    contextInfo ? `Project context:\n${contextInfo}` : 'Create requirements for a general software project.',
                    '',
                    'Include: Introduction, Functional Requirements with user stories ("As a [role], I want [feature], so that [benefit]"),',
                    'EARS acceptance criteria, Non-Functional Requirements (performance, security, usability),',
                    'and Assumptions & Constraints.',
                    '',
                    'Output ONLY the markdown content, starting with "# Requirements Document".',
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

        // Static fallback template (used when no LLM model is available)
        const template = `# Requirements Document

## Introduction

This document outlines the functional and non-functional requirements for the system based on the product requirements and brainstorming sessions.

${contextInfo ? `## Context\n\n${contextInfo}` : ''}

## Requirements

### Requirement 1

**User Story:** As a user, I want to access the system, so that I can perform my tasks efficiently.

#### Acceptance Criteria

1. WHEN a user accesses the system THEN the system SHALL authenticate the user within 3 seconds
2. IF authentication fails THEN the system SHALL display an error message and allow retry
3. WHEN authentication succeeds THEN the system SHALL redirect to the main dashboard

### Requirement 2

**User Story:** As a user, I want to manage my data, so that I can maintain accurate information.

#### Acceptance Criteria

1. WHEN a user creates new data THEN the system SHALL validate all required fields
2. WHEN data is saved THEN the system SHALL confirm successful save operation
3. IF validation fails THEN the system SHALL highlight errors and prevent save

### Requirement 3

**User Story:** As an administrator, I want to configure system settings, so that I can customize the system behavior.

#### Acceptance Criteria

1. WHEN an administrator accesses settings THEN the system SHALL verify admin privileges
2. WHEN settings are modified THEN the system SHALL apply changes immediately
3. WHEN invalid settings are entered THEN the system SHALL prevent save and show validation errors

## Non-Functional Requirements

### Performance Requirements
- The system SHALL respond to user actions within 2 seconds under normal load
- The system SHALL support up to 100 concurrent users

### Security Requirements
- The system SHALL encrypt all sensitive data in transit and at rest
- The system SHALL implement role-based access control

### Usability Requirements
- The system SHALL be accessible via modern web browsers
- The system SHALL follow WCAG 2.1 accessibility guidelines

## Assumptions and Constraints

### Assumptions
- Users have basic computer literacy
- Internet connectivity is available

### Constraints
- Must integrate with existing authentication system
- Must comply with data protection regulations
`;

        return template;
    }

    private generateUpdateContent(prompt: string, existingContent: string): string {
        // Simplified content generation - in real implementation, use LLM
        return `**Updated based on request:** ${prompt}

**User Story:** As a user, I want [feature based on prompt], so that [benefit].

#### Acceptance Criteria

1. WHEN [condition] THEN the system SHALL [response]
2. IF [precondition] THEN the system SHALL [alternative response]`;
    }

    private extractSectionFromPrompt(prompt: string): string | null {
        // Simple pattern matching - in real implementation, use LLM for better parsing
        const sectionMatch = prompt.match(/requirement\s+(\d+)/i);
        if (sectionMatch) {
            return `Requirement ${sectionMatch[1]}`;
        }
        return null;
    }

    private getNextRequirementNumber(content: string): number {
        const matches = content.match(/### Requirement (\d+)/g);
        if (!matches) {
            return 1;
        }
        
        const numbers = matches.map(match => {
            const num = match.match(/\d+/);
            return num ? parseInt(num[0]) : 0;
        });
        
        return Math.max(...numbers) + 1;
    }

    private countRequirements(content: string): number {
        const matches = content.match(/### Requirement \d+/g);
        return matches ? matches.length : 0;
    }

    /**
     * Override initial conversation message for requirements context
     */
    protected generateInitialConversationMessage(session: any): string {
        const questions = session.currentQuestionSet.slice(0, 1);
        
        let message = `📋 **Welcome to Requirements Gathering!**\n\n`;
        message += `I'm here to help you transform your ideas into structured, testable requirements using the EARS format `;
        message += `(Easy Approach to Requirements Syntax). We'll create clear user stories and acceptance criteria `;
        message += `that your development team can implement with confidence.\n\n`;
        
        if (questions.length > 0) {
            message += `Let's start by understanding your functional needs:\n\n`;
            message += `**${questions[0].text}**\n\n`;
            
            if (questions[0].examples && questions[0].examples.length > 0) {
                message += `📝 *Here are some examples of well-structured requirements:*\n`;
                questions[0].examples.slice(0, 3).forEach((example: string) => {
                    message += `• ${example}\n`;
                });
                message += `\n`;
            }
            
            message += `Remember: Good requirements are specific, measurable, and testable! 🎯`;
        }

        return message;
    }

    /**
     * Override followup suggestions for requirements context
     */
    protected generateInitialFollowups(): string[] {
        return [
            'I know exactly what the system needs to do',
            'Help me structure my requirements properly',
            'Show me more EARS format examples',
            'What makes a good requirement?'
        ];
    }

    /**
     * Override to provide requirements-specific offline response
     */
    protected async getAgentSpecificOfflineResponse(
        operation: string, 
        templateType: string, 
        context: AgentContext
    ): Promise<string | null> {
        if (templateType !== 'requirements') {
            return null;
        }

        let response = `📋 **Requirements Gatherer - Offline Mode**\n\n`;
        response += `I'm the Requirements Gatherer agent, specialized in creating structured, testable requirements using the EARS format. While I can't have dynamic conversations right now, I can provide comprehensive frameworks for requirements documentation.\n\n`;

        switch (operation) {
            case 'document-creation':
                response += `**Creating Requirements Documents Offline**\n\n`;
                response += `I'll create a structured requirements template with:\n`;
                response += `• **User Stories** - "As a [role], I want [feature], so that [benefit]" format\n`;
                response += `• **EARS Acceptance Criteria** - WHEN/IF/THEN/SHALL statements\n`;
                response += `• **Functional Requirements** - Core system capabilities\n`;
                response += `• **Non-Functional Requirements** - Performance, security, usability\n`;
                response += `• **Edge Cases & Error Handling** - What happens when things go wrong\n`;
                response += `• **Dependencies & Assumptions** - Prerequisites and constraints\n\n`;
                
                response += `**EARS Format Guidelines (Offline Reference):**\n`;
                response += `• **WHEN** [event] **THEN** [system] **SHALL** [response] - Event-driven requirements\n`;
                response += `• **IF** [precondition] **THEN** [system] **SHALL** [response] - Conditional requirements\n`;
                response += `• **WHERE** [location/context] - Spatial or contextual requirements\n`;
                response += `• **WHILE** [ongoing condition] - Continuous requirements\n\n`;
                
                response += `**Requirements Quality Checklist:**\n`;
                response += `□ Specific and unambiguous\n`;
                response += `□ Measurable and testable\n`;
                response += `□ Achievable and realistic\n`;
                response += `□ Relevant to user needs\n`;
                response += `□ Time-bound where applicable\n`;
                break;

            case 'document-review':
                response += `**Requirements Review Framework (Offline)**\n\n`;
                response += `Use this comprehensive checklist to review your requirements:\n\n`;
                
                response += `**User Story Quality:**\n`;
                response += `□ Follows "As a [role], I want [feature], so that [benefit]" format\n`;
                response += `□ Role is specific and well-defined\n`;
                response += `□ Feature is clear and actionable\n`;
                response += `□ Benefit explains the value and motivation\n\n`;
                
                response += `**Acceptance Criteria Quality:**\n`;
                response += `□ Uses proper EARS format (WHEN/IF/THEN/SHALL)\n`;
                response += `□ Criteria are specific and measurable\n`;
                response += `□ All scenarios are covered (happy path, edge cases, errors)\n`;
                response += `□ Criteria are testable and verifiable\n\n`;
                
                response += `**Completeness Check:**\n`;
                response += `□ All functional requirements are documented\n`;
                response += `□ Non-functional requirements are included\n`;
                response += `□ Dependencies are identified\n`;
                response += `□ Assumptions are documented\n`;
                response += `□ Edge cases and error scenarios are covered\n\n`;
                
                response += `**Clarity and Consistency:**\n`;
                response += `□ Language is clear and unambiguous\n`;
                response += `□ Terminology is consistent throughout\n`;
                response += `□ Requirements don't contradict each other\n`;
                response += `□ Priority levels are assigned\n`;
                break;

            case 'conversation':
                response += `**Structured Requirements Gathering (Offline)**\n\n`;
                response += `Work through this systematic process to gather comprehensive requirements:\n\n`;
                
                response += `**Phase 1: Functional Requirements Discovery**\n`;
                response += `For each major feature or capability:\n`;
                response += `1. Who will use this feature? (Define the role)\n`;
                response += `2. What do they want to accomplish? (Define the want)\n`;
                response += `3. Why is this valuable to them? (Define the benefit)\n`;
                response += `4. What are the specific steps they'll take?\n`;
                response += `5. What could go wrong and how should the system respond?\n\n`;
                
                response += `**Phase 2: Acceptance Criteria Definition**\n`;
                response += `For each user story, define:\n`;
                response += `1. **Happy Path:** WHEN [normal condition] THEN system SHALL [expected response]\n`;
                response += `2. **Edge Cases:** IF [unusual condition] THEN system SHALL [appropriate response]\n`;
                response += `3. **Error Handling:** WHEN [error occurs] THEN system SHALL [error response]\n`;
                response += `4. **Validation:** IF [invalid input] THEN system SHALL [validation response]\n\n`;
                
                response += `**Phase 3: Non-Functional Requirements**\n`;
                response += `Consider these categories:\n`;
                response += `• **Performance:** How fast should it be?\n`;
                response += `• **Scalability:** How many users/transactions?\n`;
                response += `• **Security:** What data needs protection?\n`;
                response += `• **Usability:** What's the user experience expectation?\n`;
                response += `• **Reliability:** What's the uptime requirement?\n`;
                response += `• **Compatibility:** What systems must it work with?\n\n`;
                
                response += `**Phase 4: Dependencies & Constraints**\n`;
                response += `Document:\n`;
                response += `• What other systems or features does this depend on?\n`;
                response += `• What assumptions are you making?\n`;
                response += `• What technical or business constraints exist?\n`;
                response += `• What regulatory or compliance requirements apply?\n\n`;
                
                response += `**💡 Pro tip:** Write requirements from the user's perspective, not the system's. Focus on what value is delivered, not how it's implemented.`;
                break;

            default:
                response += `**Requirements Gatherer Offline Capabilities**\n\n`;
                response += `I can help you create structured requirements through:\n`;
                response += `• EARS format templates and examples\n`;
                response += `• User story frameworks\n`;
                response += `• Acceptance criteria checklists\n`;
                response += `• Requirements quality guidelines\n`;
                response += `• Review and validation frameworks\n\n`;
                
                response += `**Available commands:**\n`;
                response += `• \`/new <feature-name>\` - Create requirements template\n`;
                response += `• \`/help\` - Get offline help\n`;
                response += `• \`/status\` - Check offline status\n`;
                break;
        }

        return response;
    }

    /**
     * Override to provide requirements-specific template content
     */
    protected async getTemplateSpecificContent(templateType: string, title: string, context: AgentContext): Promise<string> {
        if (templateType !== 'requirements') {
            return super.getTemplateSpecificContent(templateType, title, context);
        }

        return `## Introduction

This document outlines the functional and non-functional requirements for **${title}**. Requirements are structured using the EARS format (Easy Approach to Requirements Syntax) to ensure clarity, testability, and implementation readiness.

### Document Purpose
*Explain what this requirements document covers and who should use it*

**Example:** "This document defines the requirements for the customer management system, intended for use by developers, testers, and product stakeholders to guide implementation and validation."

**Your document purpose:**
*[Describe the scope and intended audience for these requirements]*

### Reference Documents
*List any related documents that provide context*

**Examples:**
- Product Requirements Document (PRD)
- User research findings
- Technical architecture documents
- Existing system documentation

**Your reference documents:**
- *[Document 1]: [Brief description]*
- *[Document 2]: [Brief description]*
- *[Document 3]: [Brief description]*

## Requirements Overview

### Requirement Categories
*Organize your requirements into logical groups*

**Example categories:**
- User Management
- Data Management
- Reporting and Analytics
- Integration and APIs
- Security and Compliance

**Your requirement categories:**
1. *[Category 1]: [Brief description]*
2. *[Category 2]: [Brief description]*
3. *[Category 3]: [Brief description]*
4. *[Category 4]: [Brief description]*

## Functional Requirements

### Requirement 1: [Feature Name]

**User Story:** As a [specific role], I want [specific capability], so that [specific benefit].

**Example:** "As a sales manager, I want to view a dashboard of team performance metrics, so that I can identify coaching opportunities and track progress toward goals."

**Your user story:**
*As a [role], I want [capability], so that [benefit].*

#### Acceptance Criteria

**Example criteria:**
1. **WHEN** a sales manager logs into the system **THEN** the system **SHALL** display the team dashboard within 3 seconds
2. **WHEN** the dashboard loads **THEN** the system **SHALL** show current month metrics by default
3. **IF** no data is available for the selected period **THEN** the system **SHALL** display a "No data available" message
4. **WHEN** a manager clicks on a team member's metrics **THEN** the system **SHALL** show detailed individual performance data

**Your acceptance criteria:**
1. **WHEN** [trigger event] **THEN** the system **SHALL** [expected response]
2. **IF** [condition] **THEN** the system **SHALL** [conditional response]
3. **WHEN** [user action] **THEN** the system **SHALL** [system reaction]
4. **IF** [error condition] **THEN** the system **SHALL** [error handling]

#### Priority
*Set priority level: Critical, High, Medium, Low*

**Your priority:** *[Priority level and rationale]*

#### Dependencies
*List any other requirements or systems this depends on*

**Your dependencies:**
- *[Dependency 1]: [Why it's needed]*
- *[Dependency 2]: [Why it's needed]*

---

### Requirement 2: [Feature Name]

**User Story:** As a [role], I want [capability], so that [benefit].

**Example:** "As a customer service representative, I want to search for customers by multiple criteria, so that I can quickly find the right customer record during support calls."

**Your user story:**
*As a [role], I want [capability], so that [benefit].*

#### Acceptance Criteria

**Example criteria:**
1. **WHEN** a user enters search criteria **THEN** the system **SHALL** return results within 2 seconds
2. **WHEN** multiple search fields are used **THEN** the system **SHALL** apply AND logic between fields
3. **IF** no results are found **THEN** the system **SHALL** suggest alternative search terms
4. **WHEN** more than 100 results are found **THEN** the system **SHALL** paginate results with 25 per page

**Your acceptance criteria:**
1. **WHEN** [trigger] **THEN** the system **SHALL** [response]
2. **IF** [condition] **THEN** the system **SHALL** [response]
3. **WHEN** [action] **THEN** the system **SHALL** [reaction]
4. **WHILE** [ongoing condition] **THEN** the system **SHALL** [continuous behavior]

#### Priority
**Your priority:** *[Priority level and rationale]*

#### Dependencies
**Your dependencies:**
- *[Dependency 1]: [Description]*
- *[Dependency 2]: [Description]*

---

### Requirement 3: [Feature Name]

**User Story:** As a [role], I want [capability], so that [benefit].

**Your user story:**
*As a [role], I want [capability], so that [benefit].*

#### Acceptance Criteria

**Your acceptance criteria:**
1. **WHEN** [event] **THEN** the system **SHALL** [response]
2. **IF** [precondition] **THEN** the system **SHALL** [response]
3. **WHERE** [location/context] the system **SHALL** [behavior]
4. **WHEN** [error occurs] **THEN** the system **SHALL** [error handling]

#### Priority
**Your priority:** *[Priority level and rationale]*

#### Dependencies
**Your dependencies:**
- *[List any dependencies]*

---

*Continue adding requirements following the same pattern...*

## Non-Functional Requirements

### Performance Requirements

**Response Time:**
- **WHEN** a user performs any action **THEN** the system **SHALL** respond within 2 seconds under normal load
- **WHEN** the system is under peak load **THEN** 95% of requests **SHALL** complete within 5 seconds

**Throughput:**
- The system **SHALL** support at least [X] concurrent users
- The system **SHALL** process at least [X] transactions per minute

**Your performance requirements:**
- *[Response time requirement]: [Specific timing]*
- *[Throughput requirement]: [Specific capacity]*
- *[Scalability requirement]: [Growth expectations]*

### Security Requirements

**Authentication:**
- **WHEN** a user attempts to access the system **THEN** the system **SHALL** require valid authentication
- **IF** authentication fails 3 times **THEN** the system **SHALL** lock the account for 15 minutes

**Authorization:**
- **WHEN** an authenticated user accesses a feature **THEN** the system **SHALL** verify appropriate permissions
- **IF** a user lacks required permissions **THEN** the system **SHALL** deny access and log the attempt

**Data Protection:**
- The system **SHALL** encrypt all sensitive data in transit using TLS 1.3 or higher
- The system **SHALL** encrypt all sensitive data at rest using AES-256 encryption

**Your security requirements:**
- *[Authentication requirement]: [Specific method]*
- *[Authorization requirement]: [Permission model]*
- *[Data protection requirement]: [Encryption standards]*

### Usability Requirements

**Accessibility:**
- The system **SHALL** comply with WCAG 2.1 Level AA accessibility guidelines
- **WHEN** using screen readers **THEN** all functionality **SHALL** be accessible

**User Experience:**
- **WHEN** a new user first accesses the system **THEN** they **SHALL** be able to complete their primary task within 5 minutes without training
- The system **SHALL** provide contextual help for all major features

**Your usability requirements:**
- *[Accessibility requirement]: [Specific standards]*
- *[User experience requirement]: [Usability goals]*
- *[Help and documentation requirement]: [Support features]*

### Reliability Requirements

**Availability:**
- The system **SHALL** maintain 99.9% uptime during business hours
- **WHEN** planned maintenance occurs **THEN** users **SHALL** receive 24-hour advance notice

**Data Integrity:**
- **WHEN** data is saved **THEN** the system **SHALL** verify data integrity before confirming save
- The system **SHALL** perform automated backups every 4 hours

**Your reliability requirements:**
- *[Availability requirement]: [Uptime expectations]*
- *[Backup requirement]: [Backup frequency and retention]*
- *[Recovery requirement]: [Recovery time objectives]*

### Compatibility Requirements

**Browser Support:**
- The system **SHALL** function correctly on Chrome, Firefox, Safari, and Edge (latest 2 versions)
- **WHEN** using unsupported browsers **THEN** the system **SHALL** display a compatibility warning

**Integration Requirements:**
- The system **SHALL** integrate with [existing system] via REST API
- **WHEN** external systems are unavailable **THEN** the system **SHALL** continue to function with cached data

**Your compatibility requirements:**
- *[Browser requirement]: [Supported browsers]*
- *[Integration requirement]: [External systems]*
- *[Platform requirement]: [Operating systems/devices]*

## Edge Cases and Error Handling

### Data Validation

**Input Validation:**
- **WHEN** invalid data is entered **THEN** the system **SHALL** highlight errors and prevent submission
- **IF** required fields are empty **THEN** the system **SHALL** display specific field-level error messages

**Data Limits:**
- **WHEN** data exceeds maximum limits **THEN** the system **SHALL** truncate with user notification
- **IF** file uploads exceed size limits **THEN** the system **SHALL** reject with clear error message

**Your validation requirements:**
- *[Input validation]: [Validation rules]*
- *[Data limits]: [Size and format constraints]*
- *[Error messaging]: [User communication standards]*

### System Errors

**Network Issues:**
- **WHEN** network connectivity is lost **THEN** the system **SHALL** queue actions for retry when connection resumes
- **IF** external services are unavailable **THEN** the system **SHALL** display appropriate error messages

**Server Errors:**
- **WHEN** server errors occur **THEN** the system **SHALL** log detailed error information for debugging
- **IF** critical errors occur **THEN** the system **SHALL** notify administrators immediately

**Your error handling requirements:**
- *[Network error handling]: [Retry and fallback strategies]*
- *[Server error handling]: [Logging and notification]*
- *[User error communication]: [Error message standards]*

## Assumptions and Dependencies

### Assumptions

**User Assumptions:**
- Users have basic computer literacy
- Users have reliable internet connectivity
- Users will receive appropriate training

**Technical Assumptions:**
- Existing infrastructure can support the new system
- Third-party services will maintain current API contracts
- Database performance will scale with user growth

**Your assumptions:**
1. *[User assumption]: [Impact if incorrect]*
2. *[Technical assumption]: [Impact if incorrect]*
3. *[Business assumption]: [Impact if incorrect]*

### Dependencies

**External Dependencies:**
- Integration with [external system] must be completed first
- User authentication system must be upgraded
- Database migration must be completed

**Internal Dependencies:**
- User interface design must be finalized
- API specifications must be approved
- Testing environment must be configured

**Your dependencies:**
1. *[External dependency]: [Timeline and impact]*
2. *[Internal dependency]: [Timeline and impact]*
3. *[Technical dependency]: [Timeline and impact]*

## Acceptance Testing Criteria

### Testing Approach

**Functional Testing:**
- Each acceptance criterion must pass automated tests
- User stories must be validated through user acceptance testing
- Integration points must be tested with real data

**Non-Functional Testing:**
- Performance requirements must be validated under load
- Security requirements must pass penetration testing
- Usability requirements must be validated with real users

**Your testing approach:**
- *[Functional testing]: [Testing methods]*
- *[Performance testing]: [Load testing strategy]*
- *[Security testing]: [Security validation approach]*

### Definition of Done

A requirement is considered complete when:
□ All acceptance criteria pass automated tests
□ Code review is completed and approved
□ Documentation is updated
□ User acceptance testing is passed
□ Performance benchmarks are met
□ Security review is completed

**Your definition of done:**
□ *[Completion criterion 1]*
□ *[Completion criterion 2]*
□ *[Completion criterion 3]*
□ *[Completion criterion 4]*

## Traceability Matrix

### Requirement to User Story Mapping

| Requirement ID | User Story | Priority | Status |
|---------------|------------|----------|---------|
| REQ-001 | As a [role], I want [feature]... | High | Not Started |
| REQ-002 | As a [role], I want [feature]... | Medium | Not Started |
| REQ-003 | As a [role], I want [feature]... | High | Not Started |

**Your traceability matrix:**
*[Create a table mapping your requirements to user stories, priorities, and implementation status]*

## Glossary

### Terms and Definitions

**Business Terms:**
- **[Term 1]:** [Definition]
- **[Term 2]:** [Definition]

**Technical Terms:**
- **[Technical term 1]:** [Definition]
- **[Technical term 2]:** [Definition]

**Your glossary:**
- **[Term]:** *[Definition]*
- **[Term]:** *[Definition]*
- **[Term]:** *[Definition]*

## Appendices

### Appendix A: User Research Summary
*[Include relevant user research findings that informed these requirements]*

### Appendix B: Competitive Analysis
*[Include analysis of how competitors handle similar requirements]*

### Appendix C: Regulatory Requirements
*[Include any compliance or regulatory requirements that must be met]*

---

## Next Steps

### Requirements Review Process
1. **Stakeholder Review:** Share with product owners, developers, and testers
2. **Technical Feasibility:** Validate technical approach with development team
3. **Estimation:** Get effort estimates for each requirement
4. **Prioritization:** Finalize priority order based on business value and effort

### Transition to Design
When requirements are approved:
- Use \`/agent set solution-architect\` to create technical design
- Use \`/agent set specification-writer\` to create detailed specifications
- Begin sprint planning and development

### Requirements Management
- Track changes and updates in version control
- Maintain traceability to user stories and test cases
- Regular review and refinement based on feedback

**Current status:**
□ Requirements documented
□ Stakeholder review completed
□ Technical feasibility confirmed
□ Ready for design phase`;
    }
}