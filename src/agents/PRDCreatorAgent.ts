// PRD Creator Agent implementation
import * as vscode from 'vscode';
import { BaseAgent } from './BaseAgent';
import { ChatRequest, AgentContext, AgentResponse } from './types';

export class PRDCreatorAgent extends BaseAgent {
    constructor() {
        super(
            'prd-creator',
            `You are a PRD Creator agent that helps develop initial product ideas into comprehensive Product Requirements Documents.

Your role is to:
1. Engage in conversational exploration of product concepts
2. Ask strategic questions about goals, users, scope, constraints, and success criteria
3. Guide users through systematic thinking about their product vision
4. Generate structured PRD documents with executive summary, objectives, personas, and success criteria

When interacting with users:
- Ask open-ended questions to understand the product vision
- Probe for specific details about target users and their needs
- Explore technical and business constraints
- Help define measurable success criteria
- Maintain a collaborative, consultative tone

When creating PRD documents:
- Use clear, structured sections
- Include executive summary, objectives, user personas, functional requirements, and success metrics
- Write in business language that stakeholders can understand
- Focus on the "what" and "why" rather than the "how"`,
            ['writeFile', 'applyTemplate', 'openInEditor'],
            'prd'
        );
    }

    async handleLegacyRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        this.log(`Handling legacy request: ${request.command || 'chat'}`);

        try {
            const params = this.parseParameters(request);

            // Handle specific commands
            if (request.command === 'new' && params.title) {
                return await this.createNewPRD(params.title, request.prompt, context);
            }

            // Handle conversational PRD development
            return await this.handleConversationalPRDRequest(request, context);

        } catch (error) {
            this.log(`Error handling request: ${error}`, 'error');
            return this.createResponse(
                `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                [],
                ['Try rephrasing your request', 'Use /new <title> to create a new PRD']
            );
        }
    }

    private async createNewPRD(title: string, prompt: string, context: AgentContext): Promise<AgentResponse> {
        this.log(`Creating new PRD: ${title}`);

        const prdContent = this.generatePRDTemplate(title, prompt, context);
        const fileName = this.sanitizeFileName(title);
        const filePath = `${context.userPreferences.defaultDirectory}/${fileName}.md`;

        const toolCalls = [
            {
                tool: 'writeFile',
                parameters: {
                    path: filePath,
                    content: prdContent,
                    createIfMissing: true
                }
            },
            {
                tool: 'openInEditor',
                parameters: {
                    path: filePath,
                    preview: false
                }
            }
        ];

        // Update workflow state
        context.workflowState.documents.prd = filePath;
        context.workflowState.currentPhase = 'prd';

        return this.createResponse(
            `I've created a new PRD document: **${title}**\n\n` +
            `The document includes:\n` +
            `- Executive Summary\n` +
            `- Product Objectives\n` +
            `- User Personas\n` +
            `- Functional Requirements\n` +
            `- Success Metrics\n\n` +
            `The PRD has been saved to \`${filePath}\` and opened for editing.\n\n` +
            `Next steps:\n` +
            `- Review and refine the PRD content\n` +
            `- Add specific details about your product vision\n` +
            `- When ready, we can move to requirements gathering`,
            toolCalls,
            [
                'Help me refine the PRD content',
                'Switch to brainstormer agent for ideation',
                'Move to requirements gathering phase'
            ]
        );
    }

    private async handleConversationalPRDRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        // Analyze the request to determine what kind of help the user needs
        const prompt = request.prompt.toLowerCase();

        if (prompt.includes('prd') || prompt.includes('product requirements') || prompt.includes('document')) {
            return this.providePRDGuidance(request, context);
        }

        if (prompt.includes('idea') || prompt.includes('concept') || prompt.includes('product')) {
            return this.facilitateIdeaExploration(request, context);
        }

        if (prompt.includes('help') || prompt.includes('what') || prompt.includes('how')) {
            return this.provideHelp(context);
        }

        // Default conversational response
        return this.createResponse(
            `I'm here to help you develop your product ideas into a comprehensive PRD. ` +
            `I can help you:\n\n` +
            `- Explore and refine your product concept\n` +
            `- Create a structured PRD document\n` +
            `- Ask strategic questions about goals and users\n` +
            `- Define success criteria and constraints\n\n` +
            `What would you like to work on? You can:\n` +
            `- Tell me about your product idea\n` +
            `- Use \`/new <title>\` to create a new PRD\n` +
            `- Ask me questions about PRD best practices`,
            [],
            [
                'Tell me about your product idea',
                'Create a new PRD document',
                'What makes a good PRD?'
            ]
        );
    }

    private providePRDGuidance(request: ChatRequest, context: AgentContext): AgentResponse {
        return this.createResponse(
            `A great PRD should answer these key questions:\n\n` +
            `**Product Vision**\n` +
            `- What problem are you solving?\n` +
            `- Who is your target user?\n` +
            `- What's your unique value proposition?\n\n` +
            `**Scope & Constraints**\n` +
            `- What's in scope for this version?\n` +
            `- What are your technical constraints?\n` +
            `- What's your timeline and budget?\n\n` +
            `**Success Metrics**\n` +
            `- How will you measure success?\n` +
            `- What are your key performance indicators?\n` +
            `- What does "done" look like?\n\n` +
            `Would you like me to help you work through any of these areas?`,
            [],
            [
                'Help me define my product vision',
                'Work through scope and constraints',
                'Define success metrics'
            ]
        );
    }

    private facilitateIdeaExploration(request: ChatRequest, context: AgentContext): AgentResponse {
        return this.createResponse(
            `Let's explore your product idea! I'd love to learn more about:\n\n` +
            `**The Problem**\n` +
            `- What specific problem or pain point are you addressing?\n` +
            `- Who experiences this problem most acutely?\n` +
            `- How do people currently solve this problem?\n\n` +
            `**Your Solution**\n` +
            `- What's your proposed solution?\n` +
            `- What makes your approach unique?\n` +
            `- Why is now the right time for this solution?\n\n` +
            `**Target Users**\n` +
            `- Who would use your product?\n` +
            `- What are their key characteristics?\n` +
            `- What motivates them to seek a solution?\n\n` +
            `Tell me about any of these aspects, and I'll help you develop them further!`,
            [],
            [
                'Let me describe the problem I\'m solving',
                'Here\'s my solution approach',
                'Let me tell you about my target users'
            ]
        );
    }

    private provideHelp(context: AgentContext): AgentResponse {
        return this.createResponse(
            `I'm the PRD Creator agent, and I specialize in helping you develop product ideas into comprehensive Product Requirements Documents.\n\n` +
            `**What I can do:**\n` +
            `- Guide you through product concept exploration\n` +
            `- Ask strategic questions about your product vision\n` +
            `- Create structured PRD documents\n` +
            `- Help define user personas and success criteria\n\n` +
            `**Available commands:**\n` +
            `- \`/new <title>\` - Create a new PRD document\n` +
            `- \`/agent list\` - See all available agents\n` +
            `- \`/agent set brainstormer\` - Switch to ideation mode\n\n` +
            `**Getting started:**\n` +
            `Just tell me about your product idea, or use \`/new\` to create a PRD document right away!`,
            [],
            [
                'Tell me about my product idea',
                'Create a new PRD document',
                'Switch to brainstormer agent'
            ]
        );
    }

    private generatePRDTemplate(title: string, prompt: string, context: AgentContext): string {
        const date = new Date().toISOString().split('T')[0];
        
        return `---
title: ${title}
type: PRD
created: ${date}
author: ${context.extensionContext.globalState.get('user.name', 'User')}
status: draft
---

# ${title}

## Executive Summary

*Brief overview of the product, its purpose, and key value proposition.*

[To be completed based on product concept discussion]

## Product Objectives

### Primary Goals
- [Define 2-3 primary objectives this product aims to achieve]

### Success Metrics
- [Define measurable outcomes that indicate success]

## User Personas

### Primary User
- **Who:** [Description of primary user]
- **Needs:** [Key needs and pain points]
- **Goals:** [What they want to accomplish]
- **Context:** [When/where they would use the product]

### Secondary Users
- [Additional user types if applicable]

## Functional Requirements

### Core Features
1. [Essential feature 1]
2. [Essential feature 2]
3. [Essential feature 3]

### Nice-to-Have Features
- [Additional features for future consideration]

## Technical Constraints

- [Platform requirements]
- [Performance requirements]
- [Integration requirements]
- [Security requirements]

## Business Constraints

- **Timeline:** [Project timeline]
- **Budget:** [Budget considerations]
- **Resources:** [Team and resource constraints]

## Success Criteria

### Launch Criteria
- [What needs to be true for launch]

### Post-Launch Metrics
- [How success will be measured after launch]

## Next Steps

1. Review and refine this PRD
2. Conduct user research to validate assumptions
3. Move to detailed requirements gathering
4. Begin technical design phase

---

*This PRD was created using the Docu extension PRD Creator agent. Continue the conversation to refine and expand these sections.*`;
    }

    private sanitizeFileName(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    /**
     * Override initial conversation message for PRD-specific context
     */
    protected generateInitialConversationMessage(session: any): string {
        const questions = session.currentQuestionSet.slice(0, 1);
        
        let message = `🚀 **Welcome to PRD Creation!**\n\n`;
        message += `I'm here to help you transform your product idea into a comprehensive Product Requirements Document. `;
        message += `I'll ask you strategic questions about your vision, users, and goals to create a solid foundation for your project.\n\n`;
        
        if (questions.length > 0) {
            message += `Let's start with the most important question:\n\n`;
            message += `**${questions[0].text}**\n\n`;
            
            if (questions[0].examples && questions[0].examples.length > 0) {
                message += `💡 *Here are some examples to inspire you:*\n`;
                questions[0].examples.slice(0, 3).forEach((example: string) => {
                    message += `• ${example}\n`;
                });
                message += `\n`;
            }
            
            message += `Take your time to think about this - a clear problem definition is the foundation of a great product! 🎯`;
        }

        return message;
    }

    /**
     * Override followup suggestions for PRD context
     */
    protected generateInitialFollowups(): string[] {
        return [
            'I have a clear problem in mind',
            'I need help defining the problem',
            'Can you give me more examples?',
            'What other questions will you ask?'
        ];
    }
}