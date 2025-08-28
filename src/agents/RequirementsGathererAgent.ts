import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResponse } from './types';

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

    async handleLegacyRequest(request: any, context: AgentContext): Promise<AgentResponse> {
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
            return {
                success: false,
                message: `Requirements gathering failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async createRequirementsDocument(context: AgentContext): Promise<AgentResponse> {
        try {
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
            const requirementsContent = await this.generateRequirementsContent(contextInfo);

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

    private async generateRequirementsContent(contextInfo: string): Promise<string> {
        // This is a simplified version - in a real implementation, you'd use LLM to generate
        // requirements based on the context. For now, we'll create a template structure.
        
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
                questions[0].examples.slice(0, 3).forEach(example => {
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
}