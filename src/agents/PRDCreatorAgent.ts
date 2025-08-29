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

    /**
     * Override to provide PRD-specific offline response
     */
    protected async getAgentSpecificOfflineResponse(
        operation: string, 
        templateType: string, 
        context: AgentContext
    ): Promise<string | null> {
        if (templateType !== 'prd') {
            return null;
        }

        let response = `🚀 **PRD Creator - Offline Mode**\n\n`;
        response += `I'm the PRD Creator agent, and while I can't have dynamic conversations right now, I can still help you create a comprehensive Product Requirements Document structure.\n\n`;

        switch (operation) {
            case 'document-creation':
                response += `**Creating a PRD Offline**\n\n`;
                response += `I'll create a structured PRD template with:\n`;
                response += `• **Executive Summary** - Clear problem statement and solution overview\n`;
                response += `• **Product Objectives** - Goals, success metrics, and KPIs\n`;
                response += `• **User Personas** - Target users, needs, and pain points\n`;
                response += `• **Functional Requirements** - Core features and capabilities\n`;
                response += `• **Technical Constraints** - Platform, performance, and integration requirements\n`;
                response += `• **Business Context** - Market positioning and competitive analysis\n`;
                response += `• **Success Criteria** - Launch criteria and post-launch metrics\n\n`;
                
                response += `**PRD Best Practices (Offline Guidance):**\n`;
                response += `1. **Start with the problem** - Clearly define what you're solving\n`;
                response += `2. **Know your users** - Be specific about who will use this\n`;
                response += `3. **Define success** - Set measurable goals and KPIs\n`;
                response += `4. **Prioritize ruthlessly** - Focus on must-have vs nice-to-have\n`;
                response += `5. **Consider constraints** - Technical, business, and resource limitations\n\n`;
                
                response += `**Self-guided questions to work through:**\n`;
                response += `• What specific problem does this product solve?\n`;
                response += `• Who experiences this problem most acutely?\n`;
                response += `• How do they currently solve this problem?\n`;
                response += `• What would make your solution 10x better?\n`;
                response += `• How will you measure product success?\n`;
                response += `• What are your biggest assumptions?\n`;
                break;

            case 'document-review':
                response += `**PRD Review Checklist (Offline)**\n\n`;
                response += `Use this comprehensive checklist to review your PRD:\n\n`;
                
                response += `**Problem & Solution Clarity:**\n`;
                response += `□ Problem statement is specific and compelling\n`;
                response += `□ Target users are clearly defined\n`;
                response += `□ Solution approach is explained\n`;
                response += `□ Value proposition is clear\n\n`;
                
                response += `**User Understanding:**\n`;
                response += `□ User personas are detailed and realistic\n`;
                response += `□ User needs and pain points are documented\n`;
                response += `□ User journey is considered\n`;
                response += `□ Use cases are comprehensive\n\n`;
                
                response += `**Product Definition:**\n`;
                response += `□ Core features are prioritized\n`;
                response += `□ Feature requirements are specific\n`;
                response += `□ Success criteria are measurable\n`;
                response += `□ Scope is clearly defined\n\n`;
                
                response += `**Business Context:**\n`;
                response += `□ Market opportunity is sized\n`;
                response += `□ Competitive landscape is analyzed\n`;
                response += `□ Business model is defined\n`;
                response += `□ Go-to-market strategy is outlined\n\n`;
                
                response += `**Feasibility:**\n`;
                response += `□ Technical constraints are identified\n`;
                response += `□ Resource requirements are estimated\n`;
                response += `□ Timeline is realistic\n`;
                response += `□ Risks are documented\n`;
                break;

            case 'conversation':
                response += `**PRD Development Conversation (Offline)**\n\n`;
                response += `While I can't have a dynamic conversation, here's a structured approach to develop your PRD:\n\n`;
                
                response += `**Phase 1: Problem Discovery**\n`;
                response += `Work through these questions systematically:\n`;
                response += `1. What problem are you solving? (Be specific)\n`;
                response += `2. Who has this problem? (Define your users)\n`;
                response += `3. How big is this problem? (Market size, frequency)\n`;
                response += `4. How do people solve it today? (Current alternatives)\n`;
                response += `5. Why is this the right time? (Market timing)\n\n`;
                
                response += `**Phase 2: Solution Design**\n`;
                response += `1. What's your core solution approach?\n`;
                response += `2. What makes it unique or better?\n`;
                response += `3. What are the key features?\n`;
                response += `4. What's the minimum viable product?\n`;
                response += `5. How will users discover and adopt it?\n\n`;
                
                response += `**Phase 3: Success Definition**\n`;
                response += `1. What does success look like?\n`;
                response += `2. How will you measure it?\n`;
                response += `3. What are your key metrics?\n`;
                response += `4. What are your assumptions?\n`;
                response += `5. How will you validate them?\n\n`;
                
                response += `**💡 Pro tip:** Work through each phase completely before moving to the next. Document your answers in the PRD template sections.`;
                break;

            default:
                response += `**PRD Creator Offline Capabilities**\n\n`;
                response += `I can help you create structured PRD documents with:\n`;
                response += `• Complete document framework\n`;
                response += `• Best practice guidance\n`;
                response += `• Self-guided question sets\n`;
                response += `• Review checklists\n`;
                response += `• Examples and templates\n\n`;
                
                response += `**Available commands:**\n`;
                response += `• \`/new <product-name>\` - Create PRD template\n`;
                response += `• \`/help\` - Get offline help\n`;
                response += `• \`/status\` - Check offline status\n`;
                break;
        }

        return response;
    }

    /**
     * Override to provide PRD-specific template content
     */
    protected async getTemplateSpecificContent(templateType: string, title: string, context: AgentContext): Promise<string> {
        if (templateType !== 'prd') {
            return super.getTemplateSpecificContent(templateType, title, context);
        }

        return `## Executive Summary

### Problem Statement
*What specific problem does ${title} solve?*

**Example:** "Small business owners struggle to manage customer relationships effectively because existing CRM solutions are too complex and expensive for their needs, leading to lost sales opportunities and poor customer retention."

**Your problem statement:**
*[Describe the specific problem you're addressing. Be concrete and focus on the pain points your target users experience.]*

### Solution Overview
*What is your proposed solution?*

**Example:** "A simplified, affordable CRM designed specifically for small businesses with intuitive contact management, automated follow-ups, and integrated communication tools."

**Your solution:**
*[Describe your solution approach. Focus on the key capabilities and how they address the problem.]*

### Value Proposition
*What makes your solution unique and valuable?*

**Example:** "The only CRM that small business owners can set up in under 10 minutes and see ROI within the first month through automated customer engagement."

**Your value proposition:**
*[Explain what makes your solution different and why users would choose it over alternatives.]*

## Product Objectives

### Primary Goals
*What are the 2-3 main objectives this product aims to achieve?*

**Examples:**
- Increase small business customer retention by 25%
- Reduce time spent on customer management by 50%
- Enable businesses to scale customer relationships without additional staff

**Your primary goals:**
1. *[First primary objective - be specific and measurable]*
2. *[Second primary objective]*
3. *[Third primary objective]*

### Success Metrics
*How will you measure success?*

**Examples:**
- User adoption: 1,000 active users within 6 months
- Engagement: 80% of users active weekly
- Business impact: 25% improvement in customer retention for users
- Revenue: $50K ARR within first year

**Your success metrics:**
- *[Adoption metric]*
- *[Engagement metric]*
- *[Business impact metric]*
- *[Revenue/business metric]*

## User Personas

### Primary User: [User Type Name]
*Who is your main target user?*

**Example: Small Business Owner**
- **Demographics:** 25-55 years old, owns business with 1-20 employees
- **Background:** Limited technical expertise, wears multiple hats
- **Current behavior:** Uses spreadsheets, sticky notes, or basic tools
- **Pain points:** Forgets to follow up, loses track of customer info, no time for complex systems
- **Goals:** Grow business, improve customer relationships, save time
- **Motivations:** Success of their business, providing for family
- **Preferred communication:** Email, phone, in-person

**Your primary user:**
- **Demographics:** *[Age, role, company size, etc.]*
- **Background:** *[Experience, technical level, context]*
- **Current behavior:** *[How they currently solve the problem]*
- **Pain points:** *[Specific frustrations and challenges]*
- **Goals:** *[What they want to accomplish]*
- **Motivations:** *[What drives their decisions]*
- **Preferred communication:** *[How they like to interact]*

### Secondary Users
*Are there other important user types?*

**Example: Office Manager**
- **Role:** Handles day-to-day operations
- **Needs:** Easy data entry, reporting capabilities
- **Relationship to primary user:** Reports to business owner

**Your secondary users:**
*[Describe any additional user types and their specific needs]*

## Functional Requirements

### Core Features (Must-Have)
*What are the essential features for the minimum viable product?*

**Examples:**
1. **Contact Management**
   - Add, edit, delete customer contacts
   - Store basic info: name, email, phone, company
   - Add notes and interaction history

2. **Communication Tracking**
   - Log calls, emails, meetings
   - Set follow-up reminders
   - View communication timeline

3. **Simple Reporting**
   - Customer list with last contact date
   - Overdue follow-ups dashboard
   - Basic activity summary

**Your core features:**
1. **[Feature Name]**
   - *[Specific capability 1]*
   - *[Specific capability 2]*
   - *[Specific capability 3]*

2. **[Feature Name]**
   - *[Specific capability 1]*
   - *[Specific capability 2]*
   - *[Specific capability 3]*

3. **[Feature Name]**
   - *[Specific capability 1]*
   - *[Specific capability 2]*
   - *[Specific capability 3]*

### Enhanced Features (Should-Have)
*What features would significantly improve the product?*

**Examples:**
- Email integration and templates
- Mobile app for on-the-go access
- Basic automation workflows
- Integration with common business tools

**Your enhanced features:**
- *[Important but not critical feature 1]*
- *[Important but not critical feature 2]*
- *[Important but not critical feature 3]*

### Future Features (Could-Have)
*What features might be valuable in future versions?*

**Examples:**
- Advanced analytics and insights
- Team collaboration features
- API for third-party integrations
- AI-powered customer insights

**Your future features:**
- *[Nice-to-have feature 1]*
- *[Nice-to-have feature 2]*
- *[Nice-to-have feature 3]*

## Technical Constraints

### Platform Requirements
*What platforms and technologies are required?*

**Examples:**
- Web-based application (responsive design)
- Mobile apps for iOS and Android
- Cloud-hosted for reliability and scalability
- Offline capability for mobile use

**Your platform requirements:**
- *[Platform 1 and rationale]*
- *[Platform 2 and rationale]*
- *[Platform 3 and rationale]*

### Performance Requirements
*What are the performance expectations?*

**Examples:**
- Page load times under 2 seconds
- Support for 10,000+ contacts per user
- 99.9% uptime availability
- Real-time sync across devices

**Your performance requirements:**
- *[Performance requirement 1]*
- *[Performance requirement 2]*
- *[Performance requirement 3]*

### Integration Requirements
*What systems need to integrate with your product?*

**Examples:**
- Email providers (Gmail, Outlook)
- Calendar applications
- Accounting software (QuickBooks)
- Communication tools (Slack, Teams)

**Your integration requirements:**
- *[Integration 1 and purpose]*
- *[Integration 2 and purpose]*
- *[Integration 3 and purpose]*

### Security Requirements
*What security measures are necessary?*

**Examples:**
- Data encryption in transit and at rest
- User authentication and authorization
- GDPR compliance for data privacy
- Regular security audits and updates

**Your security requirements:**
- *[Security requirement 1]*
- *[Security requirement 2]*
- *[Security requirement 3]*

## Business Constraints

### Timeline
*What are the key milestones and deadlines?*

**Example:**
- MVP development: 3 months
- Beta testing: 1 month
- Public launch: 6 months from start
- Feature complete v1.0: 9 months

**Your timeline:**
- *[Milestone 1]: [Timeframe]*
- *[Milestone 2]: [Timeframe]*
- *[Milestone 3]: [Timeframe]*
- *[Milestone 4]: [Timeframe]*

### Budget Constraints
*What are the financial limitations?*

**Examples:**
- Development budget: $100K
- Marketing budget: $25K
- Infrastructure costs: $5K/month
- Team size: 3-5 people

**Your budget constraints:**
- *[Budget category 1]: [Amount/limit]*
- *[Budget category 2]: [Amount/limit]*
- *[Budget category 3]: [Amount/limit]*

### Resource Constraints
*What team and resource limitations exist?*

**Examples:**
- Small development team (2-3 developers)
- Limited design resources (1 designer)
- No dedicated QA team
- Founder doing product management

**Your resource constraints:**
- *[Resource constraint 1]*
- *[Resource constraint 2]*
- *[Resource constraint 3]*

### Market Constraints
*What market factors affect the product?*

**Examples:**
- Competitive pressure from established players
- Seasonal business cycles (B2B sales)
- Economic uncertainty affecting small business spending
- Regulatory requirements for data handling

**Your market constraints:**
- *[Market constraint 1]*
- *[Market constraint 2]*
- *[Market constraint 3]*

## Competitive Analysis

### Direct Competitors
*Who are your main competitors?*

**Example:**
**Salesforce Essentials**
- Strengths: Brand recognition, feature-rich
- Weaknesses: Complex, expensive for small businesses
- Market position: Enterprise-focused with small business offering

**Your direct competitors:**
**[Competitor 1 Name]**
- Strengths: *[What they do well]*
- Weaknesses: *[Their limitations]*
- Market position: *[How they're positioned]*

**[Competitor 2 Name]**
- Strengths: *[What they do well]*
- Weaknesses: *[Their limitations]*
- Market position: *[How they're positioned]*

### Indirect Competitors
*What alternative solutions do users currently use?*

**Examples:**
- Spreadsheets (Excel, Google Sheets)
- Note-taking apps (Notion, Evernote)
- Basic contact apps (phone contacts)
- Email organization systems

**Your indirect competitors:**
- *[Alternative solution 1]*
- *[Alternative solution 2]*
- *[Alternative solution 3]*

### Competitive Advantage
*What will make you win against competitors?*

**Examples:**
- Simplicity: 10x easier to set up and use
- Price: 50% less expensive than alternatives
- Focus: Built specifically for small businesses
- Speed: Fastest time to value

**Your competitive advantages:**
- *[Advantage 1]: [Specific differentiator]*
- *[Advantage 2]: [Specific differentiator]*
- *[Advantage 3]: [Specific differentiator]*

## Go-to-Market Strategy

### Target Market
*Who will you target first?*

**Example:**
- Primary: Service-based small businesses (consultants, agencies, contractors)
- Secondary: Retail small businesses
- Geographic focus: English-speaking markets initially

**Your target market:**
- Primary: *[Specific market segment]*
- Secondary: *[Additional segments]*
- Geographic focus: *[Market regions]*

### Marketing Channels
*How will you reach your target users?*

**Examples:**
- Content marketing (blog, SEO)
- Social media (LinkedIn, Twitter)
- Partnerships with small business organizations
- Direct outreach to target customers

**Your marketing channels:**
- *[Channel 1]: [Strategy and rationale]*
- *[Channel 2]: [Strategy and rationale]*
- *[Channel 3]: [Strategy and rationale]*

### Pricing Strategy
*How will you price your product?*

**Example:**
- Freemium model: Free for up to 100 contacts
- Pro plan: $29/month for unlimited contacts and features
- Annual discount: 20% off for yearly subscriptions

**Your pricing strategy:**
- *[Pricing tier 1]: [Price and features]*
- *[Pricing tier 2]: [Price and features]*
- *[Pricing considerations]: [Rationale]*

## Risk Assessment

### Technical Risks
*What technical challenges might you face?*

**Examples:**
- Scalability issues as user base grows
- Data migration complexity from existing systems
- Mobile app development complexity
- Third-party integration reliability

**Your technical risks:**
- *[Risk 1]: [Impact and mitigation strategy]*
- *[Risk 2]: [Impact and mitigation strategy]*
- *[Risk 3]: [Impact and mitigation strategy]*

### Market Risks
*What market factors could impact success?*

**Examples:**
- Economic downturn affecting small business spending
- Large competitor launching similar product
- Changes in user behavior or preferences
- Regulatory changes affecting data handling

**Your market risks:**
- *[Risk 1]: [Impact and mitigation strategy]*
- *[Risk 2]: [Impact and mitigation strategy]*
- *[Risk 3]: [Impact and mitigation strategy]*

### Business Risks
*What business challenges might arise?*

**Examples:**
- Difficulty acquiring customers cost-effectively
- Higher than expected churn rates
- Team scaling challenges
- Funding or cash flow issues

**Your business risks:**
- *[Risk 1]: [Impact and mitigation strategy]*
- *[Risk 2]: [Impact and mitigation strategy]*
- *[Risk 3]: [Impact and mitigation strategy]*

## Success Criteria

### Launch Criteria
*What needs to be true for you to launch?*

**Examples:**
- Core features complete and tested
- 50 beta users providing positive feedback
- Performance benchmarks met
- Security audit completed
- Support documentation ready

**Your launch criteria:**
- *[Criterion 1]: [Specific requirement]*
- *[Criterion 2]: [Specific requirement]*
- *[Criterion 3]: [Specific requirement]*
- *[Criterion 4]: [Specific requirement]*

### 3-Month Success Metrics
*What should be achieved 3 months post-launch?*

**Examples:**
- 500 registered users
- 200 active monthly users
- 4.5+ app store rating
- $5K monthly recurring revenue
- 85% user retention rate

**Your 3-month metrics:**
- *[Metric 1]: [Target number]*
- *[Metric 2]: [Target number]*
- *[Metric 3]: [Target number]*
- *[Metric 4]: [Target number]*

### 12-Month Success Metrics
*What should be achieved 12 months post-launch?*

**Examples:**
- 5,000 registered users
- 2,000 active monthly users
- $50K monthly recurring revenue
- Break-even on customer acquisition
- 90% user satisfaction score

**Your 12-month metrics:**
- *[Metric 1]: [Target number]*
- *[Metric 2]: [Target number]*
- *[Metric 3]: [Target number]*
- *[Metric 4]: [Target number]*

## Next Steps

### Immediate Actions (Next 2 Weeks)
*What needs to happen right away?*

**Examples:**
1. Validate problem with 20 target users
2. Create detailed user journey maps
3. Develop technical architecture plan
4. Set up development environment

**Your immediate actions:**
1. *[Action 1]: [Owner and deadline]*
2. *[Action 2]: [Owner and deadline]*
3. *[Action 3]: [Owner and deadline]*
4. *[Action 4]: [Owner and deadline]*

### Short-term Goals (Next 1-2 Months)
*What are the key milestones?*

**Examples:**
1. Complete user research and validation
2. Finalize technical specifications
3. Begin MVP development
4. Establish key partnerships

**Your short-term goals:**
1. *[Goal 1]: [Timeline]*
2. *[Goal 2]: [Timeline]*
3. *[Goal 3]: [Timeline]*
4. *[Goal 4]: [Timeline]*

### Transition to Requirements
*How will you move from PRD to detailed requirements?*

**Recommended next steps:**
1. **Requirements Gathering**: Use the Requirements Gatherer agent to break down features into detailed user stories
2. **User Story Mapping**: Create a comprehensive user story map based on this PRD
3. **Acceptance Criteria**: Define specific acceptance criteria for each feature
4. **Prioritization**: Rank requirements by importance and effort

**To transition:** Use \`/agent set requirements-gatherer\` when ready to move to the next phase.`;
    }
}