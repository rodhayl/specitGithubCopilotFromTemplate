import * as vscode from 'vscode';
import { BaseAgent } from './BaseAgent';
import { Agent, AgentContext, AgentResponse, ChatRequest } from './types';

/**
 * BrainstormerAgent - Creative ideation and concept exploration
 *
 * Facilitates creative brainstorming sessions focused on ideation and concept exploration.
 * Helps users develop and expand ideas through open-ended conversation and strategic questioning.
 */
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

    async handleDirectRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse> {
        try {
            // Check if there's a PRD to use as context
            let prdContext = '';
            if (context.workflowState?.documents?.prd) {
                try {
                    prdContext = `\n\nPRD Context: Available for reference`;
                } catch (error) {
                    this.log('Could not read PRD for context', 'warn');
                }
            }

            // Build the prompt for brainstorming
            const prompt = this.buildBrainstormingPrompt(request.prompt, prdContext, context);

            // Use the LLM model from context if available; fall back to static response
            let response: string;
            if (context.model) {
                try {
                    const messages = [vscode.LanguageModelChatMessage.User(prompt)];
                    const tokenSource = new vscode.CancellationTokenSource();
                    const llmResponse = await context.model.sendRequest(messages, {}, tokenSource.token);
                    let content = '';
                    for await (const chunk of llmResponse.stream) {
                        if (chunk instanceof vscode.LanguageModelTextPart) {
                            content += chunk.value;
                        }
                    }
                    tokenSource.dispose();
                    response = content || this.createBrainstormingResponse(request.prompt, prdContext);
                } catch (llmError) {
                    this.log(
                        `LLM call failed, using fallback: ${llmError instanceof Error ? llmError.message : String(llmError)}`,
                        'warn'
                    );
                    response = this.createBrainstormingResponse(request.prompt, prdContext);
                }
            } else {
                response = this.createBrainstormingResponse(request.prompt, prdContext);
            }

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

    /**
     * Override to provide brainstorming-specific offline response
     */
    protected async getAgentSpecificOfflineResponse(
        operation: string, 
        templateType: string, 
        context: AgentContext
    ): Promise<string | null> {
        let response = `💡 **Brainstormer - Offline Mode**\n\n`;
        response += `I'm the Brainstormer agent, specialized in creative ideation and concept exploration. While I can't have dynamic conversations right now, I can provide structured frameworks to help you explore and develop your ideas.\n\n`;

        switch (operation) {
            case 'document-creation':
                response += `**Creative Brainstorming Framework (Offline)**\n\n`;
                response += `I'll create a structured brainstorming template that includes:\n`;
                response += `• **Idea Exploration Canvas** - Systematic idea development framework\n`;
                response += `• **Perspective Shifting** - Multiple viewpoints and angles\n`;
                response += `• **Opportunity Mapping** - Potential applications and extensions\n`;
                response += `• **Creative Connections** - Related concepts and variations\n`;
                response += `• **Challenge Identification** - Potential obstacles and solutions\n`;
                response += `• **Innovation Triggers** - Questions to spark new thinking\n\n`;
                
                response += `**Brainstorming Techniques (Self-Guided):**\n`;
                response += `1. **Mind Mapping** - Start with your core idea and branch out\n`;
                response += `2. **SCAMPER Method** - Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse\n`;
                response += `3. **Six Thinking Hats** - Explore from different perspectives\n`;
                response += `4. **What If Analysis** - Explore hypothetical scenarios\n`;
                response += `5. **Analogical Thinking** - Find parallels in other domains\n\n`;
                
                response += `**Key Questions to Explore:**\n`;
                response += `• What if this idea was 10x bigger/smaller?\n`;
                response += `• How would different user types approach this?\n`;
                response += `• What adjacent problems could this solve?\n`;
                response += `• What would the opposite approach look like?\n`;
                response += `• How might this evolve in 5 years?\n`;
                break;

            case 'document-review':
                response += `**Idea Evaluation Framework (Offline)**\n\n`;
                response += `Use this framework to evaluate and refine your ideas:\n\n`;
                
                response += `**Idea Clarity Assessment:**\n`;
                response += `□ Core concept is clearly articulated\n`;
                response += `□ Problem being solved is specific\n`;
                response += `□ Target users are identified\n`;
                response += `□ Value proposition is compelling\n\n`;
                
                response += `**Creative Exploration Depth:**\n`;
                response += `□ Multiple perspectives have been considered\n`;
                response += `□ Alternative approaches have been explored\n`;
                response += `□ Potential variations have been identified\n`;
                response += `□ Related opportunities have been mapped\n\n`;
                
                response += `**Feasibility Considerations:**\n`;
                response += `□ Technical feasibility has been assessed\n`;
                response += `□ Market opportunity has been considered\n`;
                response += `□ Resource requirements have been estimated\n`;
                response += `□ Potential challenges have been identified\n\n`;
                
                response += `**Innovation Potential:**\n`;
                response += `□ Unique aspects have been highlighted\n`;
                response += `□ Competitive advantages have been identified\n`;
                response += `□ Scalability potential has been explored\n`;
                response += `□ Future evolution paths have been considered\n`;
                break;

            case 'conversation':
                response += `**Structured Idea Exploration (Offline)**\n\n`;
                response += `Work through this systematic exploration process:\n\n`;
                
                response += `**Phase 1: Core Idea Definition**\n`;
                response += `1. What is your core idea in one sentence?\n`;
                response += `2. What inspired this idea?\n`;
                response += `3. What problem does it address?\n`;
                response += `4. Who would benefit from this?\n`;
                response += `5. What makes it interesting or unique?\n\n`;
                
                response += `**Phase 2: Perspective Expansion**\n`;
                response += `1. How would different user types view this?\n`;
                response += `2. What would critics say about this idea?\n`;
                response += `3. How might this work in different contexts?\n`;
                response += `4. What would happen if resources were unlimited?\n`;
                response += `5. What if you had to implement this tomorrow?\n\n`;
                
                response += `**Phase 3: Creative Variations**\n`;
                response += `1. What are 5 different ways to approach this?\n`;
                response += `2. How could you combine this with other ideas?\n`;
                response += `3. What would the premium version look like?\n`;
                response += `4. How could you simplify this to its essence?\n`;
                response += `5. What adjacent problems could this solve?\n\n`;
                
                response += `**Phase 4: Opportunity Identification**\n`;
                response += `1. What new opportunities does this create?\n`;
                response += `2. What partnerships could enhance this?\n`;
                response += `3. How might this disrupt existing solutions?\n`;
                response += `4. What would success look like?\n`;
                response += `5. How could this evolve over time?\n\n`;
                
                response += `**💡 Creative tip:** Don't judge ideas during exploration - capture everything and evaluate later!`;
                break;

            default:
                response += `**Brainstormer Offline Capabilities**\n\n`;
                response += `I can help you explore ideas through:\n`;
                response += `• Structured brainstorming frameworks\n`;
                response += `• Creative thinking techniques\n`;
                response += `• Perspective-shifting exercises\n`;
                response += `• Opportunity mapping templates\n`;
                response += `• Idea evaluation checklists\n\n`;
                
                response += `**Available commands:**\n`;
                response += `• \`/new <idea-name>\` - Create brainstorming template\n`;
                response += `• \`/help\` - Get offline help\n`;
                response += `• \`/status\` - Check offline status\n`;
                break;
        }

        return response;
    }

    /**
     * Override to provide brainstorming-specific template content
     */
    protected async getTemplateSpecificContent(templateType: string, title: string, context: AgentContext): Promise<string> {
        // For brainstorming, we create an idea exploration template regardless of templateType
        return `## 🎯 Core Idea

### Initial Concept
*Describe your core idea in 1-2 sentences*

**Example:** "A mobile app that helps busy parents plan and coordinate family meals by suggesting recipes based on dietary preferences, available ingredients, and time constraints."

**Your idea:**
*[Write your core concept here. Be as specific or as broad as you like - we'll explore it together!]*

### Inspiration Source
*What inspired this idea?*

**Examples:**
- Personal frustration with existing solutions
- Observation of unmet needs in the market
- Combination of existing ideas in a new way
- Emerging technology or trend

**Your inspiration:**
*[What sparked this idea? Understanding the origin can help us explore related directions.]*

## 🔍 Problem Exploration

### Problem Definition
*What specific problem does this address?*

**Guiding questions:**
- Who experiences this problem?
- When does this problem occur?
- Why is this problem important to solve?
- How do people currently deal with this?

**Your problem analysis:**
*[Dig deep into the problem. The better you understand it, the more creative solutions you can generate.]*

### Problem Variations
*Are there related or adjacent problems?*

**Examples:**
- Different user groups with similar needs
- The same problem in different contexts
- Upstream or downstream problems
- Seasonal or situational variations

**Related problems you've identified:**
1. *[Related problem 1]*
2. *[Related problem 2]*
3. *[Related problem 3]*

## 👥 User Perspective Exploration

### Primary Users
*Who would use or benefit from this?*

**User exploration framework:**
- **Demographics:** Age, role, lifestyle, etc.
- **Motivations:** What drives them?
- **Frustrations:** What bothers them most?
- **Behaviors:** How do they currently act?
- **Goals:** What are they trying to achieve?

**Your primary users:**
*[Describe your main users. Think beyond demographics to understand their mindset and context.]*

### Alternative User Types
*Who else might find this valuable?*

**Consider:**
- Indirect beneficiaries
- Different use cases
- Unexpected user groups
- Future user evolution

**Alternative users:**
1. *[User type 1]: [How they might use it]*
2. *[User type 2]: [How they might use it]*
3. *[User type 3]: [How they might use it]*

## 💡 Creative Variations

### Approach Variations
*What are different ways to solve this problem?*

**Brainstorming prompt:** Generate 10 different approaches, from practical to wild:

1. *[Approach 1]*
2. *[Approach 2]*
3. *[Approach 3]*
4. *[Approach 4]*
5. *[Approach 5]*
6. *[Approach 6]*
7. *[Approach 7]*
8. *[Approach 8]*
9. *[Approach 9]*
10. *[Approach 10]*

### Scale Variations
*How might this work at different scales?*

**Micro version (simplest possible):**
*[What's the absolute minimum viable version?]*

**Standard version (balanced approach):**
*[What's a reasonable, practical implementation?]*

**Macro version (if resources were unlimited):**
*[What's the most ambitious version you can imagine?]*

### Context Variations
*How might this work in different situations?*

**Different contexts to explore:**
- Geographic variations (urban vs rural, different countries)
- Temporal variations (different times of day, seasons, life stages)
- Technology variations (mobile vs desktop, online vs offline)
- Social variations (individual vs group, private vs public)

**Context explorations:**
1. *[Context 1]: [How it might work differently]*
2. *[Context 2]: [How it might work differently]*
3. *[Context 3]: [How it might work differently]*

## 🔗 Creative Connections

### Analogical Thinking
*What similar solutions exist in other domains?*

**Examples:**
- How do other industries solve similar problems?
- What can we learn from nature?
- How did people solve this historically?
- What works in completely different contexts?

**Analogies and inspirations:**
1. *[Analogy 1]: [What we can learn from it]*
2. *[Analogy 2]: [What we can learn from it]*
3. *[Analogy 3]: [What we can learn from it]*

### Combination Opportunities
*What could you combine this with?*

**Combination brainstorming:**
- Existing products or services
- Emerging technologies
- Different business models
- Complementary solutions

**Interesting combinations:**
1. *[Your idea] + [Other concept] = [New possibility]*
2. *[Your idea] + [Other concept] = [New possibility]*
3. *[Your idea] + [Other concept] = [New possibility]*

### Adjacent Opportunities
*What related opportunities does this create?*

**Opportunity mapping:**
- What else could you build on this foundation?
- What complementary products or services emerge?
- What new markets could this open up?
- What partnerships become possible?

**Adjacent opportunities:**
1. *[Opportunity 1]: [Why it's interesting]*
2. *[Opportunity 2]: [Why it's interesting]*
3. *[Opportunity 3]: [Why it's interesting]*

## 🚀 Future Visioning

### Evolution Scenarios
*How might this idea evolve over time?*

**Timeline exploration:**

**Year 1:** *[What might this look like in the first year?]*

**Year 3:** *[How might it develop by year 3?]*

**Year 10:** *[What's the long-term vision?]*

### Disruption Potential
*How might this change existing markets or behaviors?*

**Disruption analysis:**
- What current solutions might this replace?
- What new behaviors might this enable?
- What industries might this affect?
- What resistance might you encounter?

**Your disruption thoughts:**
*[How might this change the status quo? Think big!]*

### Technology Integration
*How might emerging technologies enhance this?*

**Technology considerations:**
- AI and machine learning
- IoT and connected devices
- Blockchain and decentralization
- AR/VR and immersive experiences
- Voice and conversational interfaces

**Technology integration ideas:**
1. *[Technology 1]: [How it could enhance your idea]*
2. *[Technology 2]: [How it could enhance your idea]*
3. *[Technology 3]: [How it could enhance your idea]*

## ⚡ Innovation Triggers

### "What If" Explorations
*Push your thinking with hypothetical scenarios*

Work through these thought experiments:

**What if this was free?** *[How would that change everything?]*

**What if this was 100x more expensive?** *[What premium value would justify that?]*

**What if everyone already had this?** *[What would be the next logical step?]*

**What if this was illegal?** *[What alternative approaches would emerge?]*

**What if this could only work offline?** *[How would you adapt?]*

**What if this had to work for children?** *[How would you simplify?]*

**What if this had to work for experts?** *[How would you add sophistication?]*

### Constraint Challenges
*How would limitations spark creativity?*

**Resource constraints:**
- What if you had only $100 to build this?
- What if you had only 1 week to launch?
- What if you could only use existing technology?

**Your constraint solutions:**
*[How would severe limitations force creative solutions?]*

**Capability constraints:**
- What if users had no technical skills?
- What if there was no internet access?
- What if it had to work on any device?

**Your accessibility solutions:**
*[How would you make this work for everyone?]*

## 🎨 Creative Synthesis

### Unique Value Combinations
*What makes your approach special?*

**Value synthesis:**
Combine the most interesting elements from your exploration:

1. *[Unique element 1] + [Unique element 2] = [Special combination]*
2. *[Unique element 3] + [Unique element 4] = [Special combination]*
3. *[Unique element 5] + [Unique element 6] = [Special combination]*

### Breakthrough Insights
*What surprising discoveries emerged?*

**Key insights from your exploration:**
1. *[Insight 1]: [Why it's important]*
2. *[Insight 2]: [Why it's important]*
3. *[Insight 3]: [Why it's important]*

### Next Level Thinking
*What questions emerged that you want to explore further?*

**Questions for deeper exploration:**
1. *[Question 1]*
2. *[Question 2]*
3. *[Question 3]*
4. *[Question 4]*
5. *[Question 5]*

## 🎯 Prioritization & Focus

### Most Promising Directions
*Which ideas excite you most?*

**Top 3 directions to pursue:**
1. **[Direction 1]:** *[Why it's promising]*
2. **[Direction 2]:** *[Why it's promising]*
3. **[Direction 3]:** *[Why it's promising]*

### Validation Priorities
*What assumptions need testing first?*

**Key assumptions to validate:**
1. *[Assumption 1]: [How to test it]*
2. *[Assumption 2]: [How to test it]*
3. *[Assumption 3]: [How to test it]*

### Next Steps
*What actions will move this forward?*

**Immediate next steps:**
1. *[Action 1]: [Timeline]*
2. *[Action 2]: [Timeline]*
3. *[Action 3]: [Timeline]*

## 🚀 Transition Planning

### From Brainstorming to Structure
*How will you move from exploration to execution?*

**Recommended progression:**
1. **Concept Refinement:** Choose your most promising direction
2. **Problem Validation:** Test your assumptions with real users
3. **Solution Design:** Move to structured product requirements
4. **Requirements Gathering:** Break down into specific features and user stories

### Ready for Next Phase?
*When you're ready to move from exploration to structured development:*

- **For Product Development:** Use \`/agent set prd-creator\` to create a Product Requirements Document
- **For Requirements:** Use \`/agent set requirements-gatherer\` to structure user stories
- **For Technical Planning:** Use \`/agent set solution-architect\` to design the system

**Current readiness assessment:**
□ Core concept is clear and compelling
□ Target users are well-defined
□ Key assumptions are identified
□ Most promising direction is selected
□ Ready to move to structured planning

*Check the boxes above when you feel ready to transition from creative exploration to structured development!*`;
    }
}