// QuestionEngine implementation with agent-specific question templates
import {
    QuestionEngine as IQuestionEngine,
    Question,
    ConversationContext,
    ConversationTurn,
    AgentQuestionTemplate,
    QuestionSet,
    FollowupStrategy,
    CompletionCriteria
} from './types';

export class QuestionEngine implements IQuestionEngine {
    private questionTemplates: Map<string, AgentQuestionTemplate> = new Map();

    constructor() {
        this.initializeBuiltInTemplates();
    }

    generateInitialQuestions(agentType: string, context: ConversationContext): Question[] {
        const template = this.questionTemplates.get(`${agentType}-${context.workflowPhase}`);
        if (!template) {
            return this.getDefaultQuestions(agentType);
        }

        // Start with primary questions
        let questions = [...template.initialQuestions.primary];

        // Add relevant secondary questions based on context
        const relevantSecondary = this.filterSecondaryQuestions(
            template.initialQuestions.secondary,
            context
        );
        questions = questions.concat(relevantSecondary);

        // Validate and prioritize
        questions = this.validateQuestionRelevance(questions, context);
        questions.sort((a, b) => a.priority - b.priority);

        return questions.slice(0, 5); // Limit initial questions to 5
    }

    generateFollowupQuestions(
        agentType: string,
        userResponse: string,
        conversationHistory: ConversationTurn[]
    ): Question[] {
        const template = this.questionTemplates.get(`${agentType}-prd`); // Default to prd phase
        if (!template) {
            return [];
        }

        const followupQuestions: Question[] = [];

        // Check each followup strategy
        for (const strategy of template.followupStrategies) {
            if (this.matchesTrigger(userResponse, strategy.trigger)) {
                followupQuestions.push(...strategy.questions);
            }
        }

        // Generate contextual follow-ups based on conversation history
        const contextualFollowups = this.generateContextualFollowups(
            agentType,
            userResponse,
            conversationHistory
        );
        followupQuestions.push(...contextualFollowups);

        // Remove duplicates and limit
        const uniqueQuestions = this.removeDuplicateQuestions(followupQuestions);
        return uniqueQuestions.slice(0, 3); // Limit to 3 follow-up questions
    }

    validateQuestionRelevance(questions: Question[], context: ConversationContext): Question[] {
        return questions.filter(question => {
            // Check if question is relevant to document type
            if (context.documentType === 'prd' && question.category.includes('technical-implementation')) {
                return false; // Technical questions not relevant for PRD
            }

            // Check if question is relevant to workflow phase
            if (context.workflowPhase === 'prd' && question.category.includes('detailed-requirements')) {
                return false; // Detailed requirements not relevant for PRD phase
            }

            return true;
        });
    }

    getQuestionTemplate(agentType: string, phase: string): AgentQuestionTemplate | null {
        return this.questionTemplates.get(`${agentType}-${phase}`) || null;
    }

    updateQuestionTemplate(template: AgentQuestionTemplate): void {
        const key = `${template.agentName}-${template.phase}`;
        this.questionTemplates.set(key, template);
    }

    private initializeBuiltInTemplates(): void {
        // PRD Creator Agent Template
        this.questionTemplates.set('prd-creator-prd', {
            agentName: 'prd-creator',
            phase: 'prd',
            initialQuestions: {
                primary: [
                    {
                        id: 'prd_problem_definition',
                        text: 'What specific problem or pain point are you trying to solve with this product?',
                        type: 'open-ended',
                        examples: [
                            'Users struggle with managing multiple authentication systems',
                            'Our current data processing is too slow for real-time needs',
                            'Customers can\'t easily find the information they need'
                        ],
                        required: true,
                        followupTriggers: ['slow', 'performance', 'speed', 'time'],
                        category: 'problem-definition',
                        priority: 1
                    },
                    {
                        id: 'prd_target_users',
                        text: 'Who are your primary target users, and what are their key characteristics?',
                        type: 'open-ended',
                        examples: [
                            'Software developers who need to integrate authentication',
                            'Business analysts who create reports from large datasets',
                            'End customers who shop on our e-commerce platform'
                        ],
                        required: true,
                        followupTriggers: ['developer', 'analyst', 'customer', 'user'],
                        category: 'user-identification',
                        priority: 1
                    },
                    {
                        id: 'prd_solution_approach',
                        text: 'What\'s your proposed solution approach, and what makes it unique?',
                        type: 'open-ended',
                        examples: [
                            'A unified authentication service with single sign-on',
                            'Real-time data processing using streaming architecture',
                            'AI-powered search and recommendation system'
                        ],
                        required: true,
                        followupTriggers: ['api', 'service', 'platform', 'system'],
                        category: 'solution-definition',
                        priority: 1
                    },
                    {
                        id: 'prd_success_criteria',
                        text: 'How will you measure success? What are your key performance indicators?',
                        type: 'open-ended',
                        examples: [
                            'Reduce authentication time by 50%',
                            'Process 10,000 transactions per second',
                            'Increase user engagement by 25%'
                        ],
                        required: true,
                        followupTriggers: ['metric', 'kpi', 'measure', 'goal'],
                        category: 'success-metrics',
                        priority: 1
                    }
                ],
                secondary: [
                    {
                        id: 'prd_constraints',
                        text: 'What are your main technical, business, or timeline constraints?',
                        type: 'open-ended',
                        examples: [
                            'Must integrate with existing legacy systems',
                            'Budget limited to $50,000',
                            'Must launch within 6 months'
                        ],
                        required: false,
                        followupTriggers: ['budget', 'timeline', 'legacy', 'constraint'],
                        category: 'constraints',
                        priority: 2
                    },
                    {
                        id: 'prd_competition',
                        text: 'What existing solutions or competitors are you aware of?',
                        type: 'open-ended',
                        examples: [
                            'Auth0 and Okta for authentication',
                            'Apache Kafka for data streaming',
                            'Elasticsearch for search functionality'
                        ],
                        required: false,
                        followupTriggers: ['competitor', 'alternative', 'existing'],
                        category: 'competitive-analysis',
                        priority: 3
                    }
                ],
                validation: [
                    {
                        id: 'prd_clarify_scope',
                        text: 'Could you clarify the scope of this project? Is this a new product or an enhancement?',
                        type: 'multiple-choice',
                        examples: ['New product', 'Major enhancement', 'Minor feature addition'],
                        required: true,
                        followupTriggers: [],
                        category: 'scope-clarification',
                        priority: 1
                    }
                ]
            },
            followupStrategies: [
                {
                    trigger: '(performance|slow|speed|time|latency)',
                    questions: [
                        {
                            id: 'prd_performance_details',
                            text: 'What are your specific performance requirements? What response times are acceptable?',
                            type: 'structured',
                            examples: ['< 100ms response time', '99.9% uptime', '1000 concurrent users'],
                            required: false,
                            followupTriggers: [],
                            category: 'performance-requirements',
                            priority: 2
                        }
                    ],
                    contentExtraction: [
                        {
                            pattern: '(\\d+)\\s*(ms|seconds?|minutes?)',
                            targetField: 'response_time',
                            dataType: 'duration',
                            required: false
                        }
                    ],
                    priority: 1
                },
                {
                    trigger: '(user|customer|developer|analyst)',
                    questions: [
                        {
                            id: 'prd_user_details',
                            text: 'Can you describe a typical day or workflow for these users?',
                            type: 'open-ended',
                            examples: [
                                'Developers start by checking authentication status, then make API calls',
                                'Analysts log in, run queries, and generate reports for stakeholders'
                            ],
                            required: false,
                            followupTriggers: [],
                            category: 'user-workflow',
                            priority: 2
                        }
                    ],
                    contentExtraction: [
                        {
                            pattern: '(workflow|process|steps?|procedure)',
                            targetField: 'user_workflow',
                            dataType: 'text',
                            required: false
                        }
                    ],
                    priority: 1
                }
            ],
            completionCriteria: {
                minimumQuestions: 4,
                requiredCategories: ['problem-definition', 'user-identification', 'solution-definition', 'success-metrics'],
                qualityThreshold: 0.7,
                completionRules: [
                    {
                        type: 'question-count',
                        threshold: 4,
                        validator: (state) => state.answeredQuestions.size >= 4
                    },
                    {
                        type: 'category-coverage',
                        threshold: 4,
                        validator: (state) => {
                            const categories = new Set();
                            state.answeredQuestions.forEach((_, questionId) => {
                                // This would need to map question IDs to categories
                                categories.add('covered');
                            });
                            return categories.size >= 4;
                        }
                    }
                ]
            }
        });

        // Brainstormer Agent Template
        this.questionTemplates.set('brainstormer-prd', {
            agentName: 'brainstormer',
            phase: 'prd',
            initialQuestions: {
                primary: [
                    {
                        id: 'brainstorm_concept_exploration',
                        text: 'Let\'s explore your concept! What inspired this idea, and what makes you excited about it?',
                        type: 'open-ended',
                        examples: [
                            'I noticed users struggling with complex workflows',
                            'There\'s a gap in the market for simple solutions',
                            'New technology makes this approach possible now'
                        ],
                        required: true,
                        followupTriggers: ['inspired', 'excited', 'opportunity'],
                        category: 'concept-exploration',
                        priority: 1
                    },
                    {
                        id: 'brainstorm_variations',
                        text: 'What are some different ways you could approach this problem? Let\'s think of alternatives.',
                        type: 'open-ended',
                        examples: [
                            'Mobile app vs web platform vs API service',
                            'Automated solution vs human-assisted vs hybrid',
                            'Freemium vs subscription vs one-time purchase'
                        ],
                        required: true,
                        followupTriggers: ['alternative', 'different', 'approach'],
                        category: 'solution-variations',
                        priority: 1
                    },
                    {
                        id: 'brainstorm_opportunities',
                        text: 'What opportunities do you see beyond the immediate problem? How could this expand?',
                        type: 'open-ended',
                        examples: [
                            'Could integrate with other tools in the ecosystem',
                            'Might enable new business models for customers',
                            'Could expand to serve adjacent markets'
                        ],
                        required: true,
                        followupTriggers: ['opportunity', 'expand', 'integrate'],
                        category: 'opportunity-identification',
                        priority: 1
                    },
                    {
                        id: 'brainstorm_challenges',
                        text: 'What potential challenges or obstacles do you anticipate? Let\'s think through the risks.',
                        type: 'open-ended',
                        examples: [
                            'Technical complexity might be higher than expected',
                            'Users might resist changing their current workflow',
                            'Competitors might respond quickly'
                        ],
                        required: true,
                        followupTriggers: ['challenge', 'obstacle', 'risk'],
                        category: 'challenge-identification',
                        priority: 1
                    }
                ],
                secondary: [
                    {
                        id: 'brainstorm_analogies',
                        text: 'Are there any existing products or services that work similarly? What can we learn from them?',
                        type: 'open-ended',
                        examples: [
                            'Like Uber for transportation, but for data processing',
                            'Similar to how Slack changed team communication',
                            'Follows the Netflix model of personalized recommendations'
                        ],
                        required: false,
                        followupTriggers: ['like', 'similar', 'analogy'],
                        category: 'analogies',
                        priority: 2
                    }
                ],
                validation: [
                    {
                        id: 'brainstorm_clarify_vision',
                        text: 'Help me understand your vision better - is this more about solving a specific problem or creating a new opportunity?',
                        type: 'multiple-choice',
                        examples: ['Solving existing problem', 'Creating new opportunity', 'Both equally'],
                        required: false,
                        followupTriggers: [],
                        category: 'vision-clarification',
                        priority: 1
                    }
                ]
            },
            followupStrategies: [
                {
                    trigger: '(opportunity|expand|grow|scale)',
                    questions: [
                        {
                            id: 'brainstorm_scaling_ideas',
                            text: 'How do you envision this scaling? What would success at 10x or 100x look like?',
                            type: 'open-ended',
                            examples: [
                                'From single company to industry-wide adoption',
                                'From one geographic region to global presence',
                                'From basic features to comprehensive platform'
                            ],
                            required: false,
                            followupTriggers: [],
                            category: 'scaling-vision',
                            priority: 2
                        }
                    ],
                    contentExtraction: [
                        {
                            pattern: '(scale|scaling|growth|expansion)',
                            targetField: 'scaling_vision',
                            dataType: 'text',
                            required: false
                        }
                    ],
                    priority: 1
                }
            ],
            completionCriteria: {
                minimumQuestions: 3,
                requiredCategories: ['concept-exploration', 'solution-variations', 'opportunity-identification'],
                qualityThreshold: 0.6,
                completionRules: [
                    {
                        type: 'question-count',
                        threshold: 3,
                        validator: (state) => state.answeredQuestions.size >= 3
                    }
                ]
            }
        });

        // Requirements Gatherer Agent Template
        this.questionTemplates.set('requirements-gatherer-requirements', {
            agentName: 'requirements-gatherer',
            phase: 'requirements',
            initialQuestions: {
                primary: [
                    {
                        id: 'req_functional_needs',
                        text: 'What are the core functional requirements? What must the system be able to do?',
                        type: 'structured',
                        examples: [
                            'Users must be able to authenticate using email and password',
                            'System must process payments within 5 seconds',
                            'Data must be backed up every 24 hours'
                        ],
                        required: true,
                        followupTriggers: ['must', 'shall', 'required'],
                        category: 'functional-requirements',
                        priority: 1
                    },
                    {
                        id: 'req_user_roles',
                        text: 'What different user roles will interact with the system, and what can each role do?',
                        type: 'structured',
                        examples: [
                            'Admin: full access to all features and user management',
                            'Editor: can create and modify content but not user accounts',
                            'Viewer: read-only access to published content'
                        ],
                        required: true,
                        followupTriggers: ['role', 'permission', 'access'],
                        category: 'user-roles',
                        priority: 1
                    },
                    {
                        id: 'req_acceptance_criteria',
                        text: 'For each main feature, what are the acceptance criteria? When is it considered "done"?',
                        type: 'structured',
                        examples: [
                            'WHEN user enters valid credentials THEN system SHALL authenticate within 2 seconds',
                            'IF payment fails THEN system SHALL display error message and retry option',
                            'WHEN backup completes THEN system SHALL send confirmation email'
                        ],
                        required: true,
                        followupTriggers: ['when', 'if', 'then', 'shall'],
                        category: 'acceptance-criteria',
                        priority: 1
                    },
                    {
                        id: 'req_constraints',
                        text: 'What are your non-functional requirements and constraints (performance, security, compliance)?',
                        type: 'structured',
                        examples: [
                            'System must support 1000 concurrent users',
                            'All data must be encrypted at rest and in transit',
                            'Must comply with GDPR and SOC 2 requirements'
                        ],
                        required: true,
                        followupTriggers: ['performance', 'security', 'compliance'],
                        category: 'non-functional-requirements',
                        priority: 1
                    }
                ],
                secondary: [
                    {
                        id: 'req_edge_cases',
                        text: 'What edge cases or error conditions should we consider?',
                        type: 'open-ended',
                        examples: [
                            'What happens when external API is unavailable?',
                            'How should system behave with invalid input data?',
                            'What if user loses internet connection during operation?'
                        ],
                        required: false,
                        followupTriggers: ['error', 'fail', 'exception'],
                        category: 'edge-cases',
                        priority: 2
                    }
                ],
                validation: [
                    {
                        id: 'req_priority_validation',
                        text: 'Which of these requirements are absolutely critical for the first release?',
                        type: 'multiple-choice',
                        examples: ['All of them', 'Core functionality only', 'Need to prioritize'],
                        required: false,
                        followupTriggers: [],
                        category: 'priority-validation',
                        priority: 1
                    }
                ]
            },
            followupStrategies: [
                {
                    trigger: '(performance|speed|latency|throughput)',
                    questions: [
                        {
                            id: 'req_performance_specifics',
                            text: 'Can you specify exact performance requirements with measurable criteria?',
                            type: 'structured',
                            examples: [
                                'Response time: < 200ms for 95% of requests',
                                'Throughput: 10,000 requests per second',
                                'Availability: 99.9% uptime'
                            ],
                            required: false,
                            followupTriggers: [],
                            category: 'performance-details',
                            priority: 2
                        }
                    ],
                    contentExtraction: [
                        {
                            pattern: '(\\d+)\\s*(ms|seconds?|requests?)',
                            targetField: 'performance_metrics',
                            dataType: 'metrics',
                            required: false
                        }
                    ],
                    priority: 1
                }
            ],
            completionCriteria: {
                minimumQuestions: 4,
                requiredCategories: ['functional-requirements', 'user-roles', 'acceptance-criteria', 'non-functional-requirements'],
                qualityThreshold: 0.8,
                completionRules: [
                    {
                        type: 'question-count',
                        threshold: 4,
                        validator: (state) => state.answeredQuestions.size >= 4
                    }
                ]
            }
        });
    }

    private getDefaultQuestions(agentType: string): Question[] {
        const defaultQuestions: Record<string, Question[]> = {
            'prd-creator': [
                {
                    id: 'default_problem',
                    text: 'What problem are you trying to solve?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'general',
                    priority: 1
                }
            ],
            'brainstormer': [
                {
                    id: 'default_idea',
                    text: 'Tell me about your idea!',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'general',
                    priority: 1
                }
            ],
            'requirements-gatherer': [
                {
                    id: 'default_requirements',
                    text: 'What are your main requirements?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'general',
                    priority: 1
                }
            ]
        };

        return defaultQuestions[agentType] || [];
    }

    private filterSecondaryQuestions(secondaryQuestions: Question[], context: ConversationContext): Question[] {
        // Filter secondary questions based on context
        return secondaryQuestions.filter(question => {
            // Add context-specific filtering logic here
            return true; // For now, include all secondary questions
        });
    }

    private matchesTrigger(userResponse: string, trigger: string): boolean {
        try {
            const regex = new RegExp(trigger, 'i');
            return regex.test(userResponse);
        } catch (error) {
            // If regex is invalid, fall back to simple string matching
            return userResponse.toLowerCase().includes(trigger.toLowerCase());
        }
    }

    private generateContextualFollowups(
        agentType: string,
        userResponse: string,
        conversationHistory: ConversationTurn[]
    ): Question[] {
        const followups: Question[] = [];

        // Generate follow-ups based on response length and detail
        if (userResponse.length < 20) {
            followups.push({
                id: `contextual_detail_${Date.now()}`,
                text: 'Could you provide more detail about that?',
                type: 'open-ended',
                examples: [],
                required: false,
                followupTriggers: [],
                category: 'clarification',
                priority: 3
            });
        }

        // Generate follow-ups based on conversation history
        const recentQuestions = conversationHistory
            .filter(turn => turn.type === 'question')
            .slice(-3);

        if (recentQuestions.length > 0) {
            const lastQuestionContent = recentQuestions[recentQuestions.length - 1]?.content || '';
            
            if (lastQuestionContent.includes('problem') && userResponse.includes('user')) {
                followups.push({
                    id: `contextual_user_impact_${Date.now()}`,
                    text: 'How does this problem specifically impact those users?',
                    type: 'open-ended',
                    examples: ['Causes delays in their workflow', 'Increases their costs', 'Creates frustration'],
                    required: false,
                    followupTriggers: [],
                    category: 'user-impact',
                    priority: 2
                });
            }
        }

        return followups;
    }

    private removeDuplicateQuestions(questions: Question[]): Question[] {
        const seen = new Set<string>();
        return questions.filter(question => {
            const key = question.text.toLowerCase().trim();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
}