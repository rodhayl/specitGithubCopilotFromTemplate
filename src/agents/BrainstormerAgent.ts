import { BaseAgent } from './BaseAgent';
import { Agent, AgentContext, AgentResponse, ChatRequest } from './types';

export class BrainstormerAgent extends BaseAgent implements Agent {
    constructor() {
        super(
            'brainstormer',
            `You are a creative brainstorming assistant focused on ideation and concept exploration. Your role is to help users develop and expand their ideas through open-ended conversation and strategic questioning.

## Your Approach:
- Ask thought-provoking questions to explore different angles
- Suggest related concepts and connections
- Help identify opportunities and potential challenges
- Encourage creative thinking and "what if" scenarios
- Build upon existing ideas to generate new insights

## Key Behaviors:
1. **Exploratory Questioning**: Ask open-ended questions that help users think deeper about their ideas
2. **Concept Expansion**: Suggest related ideas, variations, and extensions
3. **Perspective Shifting**: Help users see their ideas from different viewpoints (user, business, technical, etc.)
4. **Opportunity Identification**: Point out potential opportunities and applications
5. **Creative Connections**: Make connections between seemingly unrelated concepts

## Context Awareness:
- If a PRD (Product Requirements Document) exists, use it as context for informed brainstorming
- Reference previous conversations and insights
- Build upon existing documentation and requirements
- Consider the broader project context and constraints

## Output Style:
- Use conversational, engaging language
- Ask 2-3 follow-up questions per response
- Provide concrete examples and scenarios
- Organize thoughts clearly with bullet points or numbered lists
- Capture key insights for future reference

Remember: Your goal is to facilitate creative thinking and help users explore the full potential of their ideas before moving to more structured requirements gathering.`,
            ['readFile', 'writeFile', 'listFiles', 'insertSection'],
            'prd'
        );
    }

    async handleLegacyRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        try {
            // Check if there's a PRD to use as context
            let prdContext = '';
            if (context.workflowState?.documents?.prd) {
                try {
                    // For now, we'll simulate reading PRD content
                    // This would be implemented with actual file reading in a complete system
                    prdContext = `\n\nPRD Context: Available for reference`;
                } catch (error) {
                    console.warn('Could not read PRD for context:', error);
                }
            }

            // Build the prompt for brainstorming
            const prompt = this.buildBrainstormingPrompt(request.prompt, prdContext, context);

            // For now, create a simulated brainstorming response
            // In a complete implementation, this would use the LLM service
            const response = this.createBrainstormingResponse(request.prompt, prdContext);

            // Extract insights and suggestions from the response
            const insights = this.extractInsights(response);

            return {
                content: response,
                followupSuggestions: [
                    'Continue exploring this concept',
                    'Identify potential challenges',
                    'Consider different user perspectives',
                    'Explore related opportunities'
                ]
            };

        } catch (error) {
            return {
                content: `I encountered an error during brainstorming: ${error instanceof Error ? error.message : 'Unknown error'}. Let's try a different approach to explore your ideas.`,
                followupSuggestions: ['Try rephrasing your idea', 'Start with a simpler concept']
            };
        }
    }

    /**
     * Create a brainstorming response (simplified implementation)
     */
    private createBrainstormingResponse(userInput: string, prdContext: string): string {
        // This is a simplified implementation for demonstration
        // In a complete system, this would use the LLM service
        
        const responses = [
            `That's an interesting concept! Let me help you explore "${userInput}" further.

🤔 **Questions to consider:**
- What specific problem does this solve for users?
- Who would be the primary beneficiaries of this idea?
- What would make this solution unique compared to existing alternatives?

💡 **Potential opportunities:**
- Could this be expanded to serve additional user groups?
- Are there related problems this could also address?
- What partnerships or integrations might enhance this concept?

🎯 **Next exploration areas:**
- User experience scenarios
- Technical feasibility considerations
- Market positioning possibilities

What aspect of this idea excites you most? I'd love to dive deeper into that area!`,

            `Great thinking on "${userInput}"! This has some really promising angles to explore.

🔍 **Let's dig deeper:**
- What inspired this idea? Was there a specific pain point you experienced?
- How do you envision users discovering and adopting this solution?
- What would success look like in 6 months? In 2 years?

🌟 **Interesting variations to consider:**
- Could this work in different contexts or industries?
- What if we approached this from a mobile-first perspective?
- How might AI or automation enhance this concept?

🚀 **Potential impact areas:**
- User productivity improvements
- Cost savings or efficiency gains
- New market opportunities

Which of these directions feels most compelling to you? Let's explore that path together!`
        ];

        // Return a random response for variety
        return responses[Math.floor(Math.random() * responses.length)];
    }

    /**
     * Build a brainstorming prompt based on user input and context
     */
    private buildBrainstormingPrompt(userInput: string, prdContext: string, context: AgentContext): string {
        let prompt = `User wants to brainstorm about: ${userInput}`;

        if (prdContext) {
            prompt += prdContext;
            prompt += '\n\nPlease use the PRD context to inform your brainstorming and ask relevant questions.';
        }

        // Add previous conversation context if available
        if (context.previousOutputs && context.previousOutputs.length > 0) {
            const recentContext = context.previousOutputs.slice(-2).join('\n\n');
            prompt += `\n\nPrevious conversation context:\n${recentContext}`;
        }

        prompt += `\n\nPlease:
1. Respond to their input with enthusiasm and curiosity
2. Ask 2-3 thought-provoking follow-up questions
3. Suggest related concepts or variations to explore
4. Identify potential opportunities or applications
5. Help them think about different perspectives (users, business, technical)
6. Keep the conversation engaging and creative

Format your response in a conversational way that encourages further exploration.`;

        return prompt;
    }

    /**
     * Extract key insights from the brainstorming response
     */
    private extractInsights(response: string): string[] {
        const insights: string[] = [];
        
        // Look for key phrases that indicate insights
        const insightPatterns = [
            /(?:key insight|important point|consider that|what if|opportunity to|potential for)([^.!?]*[.!?])/gi,
            /(?:this could|you might|perhaps|maybe|consider)([^.!?]*[.!?])/gi
        ];

        for (const pattern of insightPatterns) {
            const matches = response.match(pattern);
            if (matches) {
                insights.push(...matches.map(match => match.trim()));
            }
        }

        // Limit to top 5 insights
        return insights.slice(0, 5);
    }

    /**
     * Generate follow-up questions based on the current discussion
     */
    generateFollowUpQuestions(topic: string, context?: string): string[] {
        const questions = [
            `What specific problems does ${topic} solve?`,
            `Who would benefit most from ${topic}?`,
            `What would success look like for ${topic}?`,
            `What challenges might arise with ${topic}?`,
            `How does ${topic} compare to existing solutions?`,
            `What would make ${topic} unique or special?`,
            `What resources would be needed for ${topic}?`,
            `How might ${topic} evolve over time?`
        ];

        // Return 3 random questions
        const shuffled = questions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
    }

    /**
     * Suggest related concepts based on the current topic
     */
    suggestRelatedConcepts(topic: string): string[] {
        // This is a simplified implementation - in a real system, 
        // this could use more sophisticated concept mapping
        const concepts = [
            'User experience variations',
            'Alternative use cases',
            'Integration possibilities',
            'Scalability considerations',
            'Market opportunities',
            'Technology alternatives',
            'Business model options',
            'Partnership potential'
        ];

        return concepts.slice(0, 4);
    }

    /**
     * Capture insights for downstream agents
     */
    async captureInsights(insights: string[], context: AgentContext): Promise<void> {
        if (insights.length === 0) {return;}

        const insightsDoc = {
            timestamp: new Date().toISOString(),
            agent: this.name,
            insights: insights,
            context: context.currentDocument || 'brainstorming-session'
        };

        // Store insights in workflow state for other agents to use
        if (context.workflowState) {
            if (!context.workflowState.context.brainstormingInsights) {
                context.workflowState.context.brainstormingInsights = [];
            }
            context.workflowState.context.brainstormingInsights.push(insightsDoc);
        }
    }

    /**
     * Transition to requirements gathering
     */
    suggestTransitionToRequirements(context: AgentContext): string {
        return `Based on our brainstorming session, you now have a solid foundation of ideas and insights. 

**Next Steps:**
1. **Requirements Gathering**: Use the Requirements Gatherer agent to structure your ideas into formal requirements
2. **User Story Creation**: Convert insights into specific user stories and acceptance criteria
3. **Prioritization**: Identify which features are most important for the initial version

Would you like to switch to the Requirements Gatherer agent to start formalizing these ideas into structured requirements?

Use: \`/agent set requirements-gatherer\` to make the transition.`;
    }

    /**
     * Override initial conversation message for brainstorming context
     */
    protected generateInitialConversationMessage(session: any): string {
        const questions = session.currentQuestionSet.slice(0, 1);
        
        let message = `💡 **Welcome to Brainstorming Mode!**\n\n`;
        message += `I'm here to help you explore and expand your ideas through creative thinking and strategic questioning. `;
        message += `Let's dive deep into your concept and discover new possibilities together!\n\n`;
        
        if (questions.length > 0) {
            message += `Let's start exploring:\n\n`;
            message += `**${questions[0].text}**\n\n`;
            
            if (questions[0].examples && questions[0].examples.length > 0) {
                message += `🌟 *Here are some thought starters:*\n`;
                questions[0].examples.slice(0, 3).forEach((example: string) => {
                    message += `• ${example}\n`;
                });
                message += `\n`;
            }
            
            message += `Don't worry about being perfect - this is all about exploration and creativity! 🚀`;
        }

        return message;
    }

    /**
     * Override followup suggestions for brainstorming context
     */
    protected generateInitialFollowups(): string[] {
        return [
            'I have an exciting idea to explore',
            'Help me think through this concept',
            'What kinds of questions will you ask?',
            'I want to explore different approaches'
        ];
    }
}