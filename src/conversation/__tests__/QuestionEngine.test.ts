// QuestionEngine unit tests
import { QuestionEngine } from '../QuestionEngine';
import { ConversationContext, ConversationTurn, Question } from '../types';
import { ExtensionContext } from '../../test/mocks/vscode';

// VSCode is mocked globally in setup.ts

describe('QuestionEngine', () => {
    let questionEngine: QuestionEngine;
    let mockContext: ConversationContext;

    beforeEach(() => {
        questionEngine = new QuestionEngine();
        mockContext = {
            documentType: 'prd',
            documentPath: '/test/document.md',
            workflowPhase: 'prd',
            workspaceRoot: '/test',
            extensionContext: new ExtensionContext()
        };
    });

    describe('generateInitialQuestions', () => {
        it('should generate initial questions for PRD Creator agent', () => {
            const questions = questionEngine.generateInitialQuestions('prd-creator', mockContext);

            expect(questions).toBeDefined();
            expect(questions.length).toBeGreaterThan(0);
            expect(questions.length).toBeLessThanOrEqual(5);
            
            // Check that primary questions are included
            const questionTexts = questions.map(q => q.text);
            expect(questionTexts.some(text => text.includes('problem'))).toBe(true);
            expect(questionTexts.some(text => text.includes('users'))).toBe(true);
            expect(questionTexts.some(text => text.includes('solution'))).toBe(true);
        });

        it('should generate initial questions for Brainstormer agent', () => {
            const questions = questionEngine.generateInitialQuestions('brainstormer', mockContext);

            expect(questions).toBeDefined();
            expect(questions.length).toBeGreaterThan(0);
            
            const questionTexts = questions.map(q => q.text);
            expect(questionTexts.some(text => text.includes('concept') || text.includes('idea'))).toBe(true);
        });

        it('should generate initial questions for Requirements Gatherer agent', () => {
            const requirementsContext = {
                ...mockContext,
                workflowPhase: 'requirements'
            };
            
            const questions = questionEngine.generateInitialQuestions('requirements-gatherer', requirementsContext);

            expect(questions).toBeDefined();
            expect(questions.length).toBeGreaterThan(0);
            
            const questionTexts = questions.map(q => q.text);
            expect(questionTexts.some(text => text.includes('functional') || text.includes('requirements'))).toBe(true);
        });

        it('should return default questions for unknown agent', () => {
            const questions = questionEngine.generateInitialQuestions('unknown-agent', mockContext);

            expect(questions).toBeDefined();
            expect(questions.length).toBeGreaterThan(0);
        });

        it('should prioritize questions correctly', () => {
            const questions = questionEngine.generateInitialQuestions('prd-creator', mockContext);

            // Check that questions are sorted by priority
            for (let i = 1; i < questions.length; i++) {
                expect(questions[i].priority).toBeGreaterThanOrEqual(questions[i - 1].priority);
            }
        });
    });

    describe('generateFollowupQuestions', () => {
        it('should generate follow-up questions based on trigger words', () => {
            const userResponse = 'We have performance issues with slow response times';
            const conversationHistory: ConversationTurn[] = [
                {
                    id: 'turn1',
                    sessionId: 'session1',
                    timestamp: new Date(),
                    type: 'question',
                    content: 'What problem are you trying to solve?'
                },
                {
                    id: 'turn2',
                    sessionId: 'session1',
                    timestamp: new Date(),
                    type: 'response',
                    content: userResponse
                }
            ];

            const followups = questionEngine.generateFollowupQuestions('prd-creator', userResponse, conversationHistory);

            expect(followups).toBeDefined();
            expect(followups.length).toBeGreaterThan(0);
            
            // Should generate performance-related follow-up
            const followupTexts = followups.map(q => q.text);
            expect(followupTexts.some(text => text.includes('performance') || text.includes('response'))).toBe(true);
        });

        it('should generate contextual follow-ups for short responses', () => {
            const userResponse = 'Yes';
            const conversationHistory: ConversationTurn[] = [];

            const followups = questionEngine.generateFollowupQuestions('prd-creator', userResponse, conversationHistory);

            expect(followups).toBeDefined();
            expect(followups.length).toBeGreaterThan(0);
            
            // Should ask for more detail
            const followupTexts = followups.map(q => q.text);
            expect(followupTexts.some(text => text.includes('detail') || text.includes('more'))).toBe(true);
        });

        it('should generate user impact follow-ups when appropriate', () => {
            const userResponse = 'Our users are having trouble with the authentication system';
            const conversationHistory: ConversationTurn[] = [
                {
                    id: 'turn1',
                    sessionId: 'session1',
                    timestamp: new Date(),
                    type: 'question',
                    content: 'What problem are you trying to solve?'
                }
            ];

            const followups = questionEngine.generateFollowupQuestions('prd-creator', userResponse, conversationHistory);

            expect(followups).toBeDefined();
            const followupTexts = followups.map(q => q.text);
            expect(followupTexts.some(text => text.includes('impact') || text.includes('affect'))).toBe(true);
        });

        it('should limit follow-up questions to maximum of 3', () => {
            const userResponse = 'We have performance issues with slow response times and user authentication problems';
            const conversationHistory: ConversationTurn[] = [];

            const followups = questionEngine.generateFollowupQuestions('prd-creator', userResponse, conversationHistory);

            expect(followups.length).toBeLessThanOrEqual(3);
        });

        it('should remove duplicate questions', () => {
            const userResponse = 'performance performance performance';
            const conversationHistory: ConversationTurn[] = [];

            const followups = questionEngine.generateFollowupQuestions('prd-creator', userResponse, conversationHistory);

            // Check for duplicates
            const questionTexts = followups.map(q => q.text);
            const uniqueTexts = new Set(questionTexts);
            expect(questionTexts.length).toBe(uniqueTexts.size);
        });
    });

    describe('validateQuestionRelevance', () => {
        it('should filter out technical questions for PRD phase', () => {
            const questions: Question[] = [
                {
                    id: 'q1',
                    text: 'What is your business goal?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'business-goal',
                    priority: 1
                },
                {
                    id: 'q2',
                    text: 'What database schema will you use?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'technical-implementation',
                    priority: 1
                }
            ];

            const relevantQuestions = questionEngine.validateQuestionRelevance(questions, mockContext);

            expect(relevantQuestions.length).toBe(1);
            expect(relevantQuestions[0].category).toBe('business-goal');
        });

        it('should filter out detailed requirements questions for PRD phase', () => {
            const questions: Question[] = [
                {
                    id: 'q1',
                    text: 'What is your product vision?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'product-vision',
                    priority: 1
                },
                {
                    id: 'q2',
                    text: 'What are the detailed acceptance criteria?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'detailed-requirements',
                    priority: 1
                }
            ];

            const relevantQuestions = questionEngine.validateQuestionRelevance(questions, mockContext);

            expect(relevantQuestions.length).toBe(1);
            expect(relevantQuestions[0].category).toBe('product-vision');
        });

        it('should keep all relevant questions', () => {
            const questions: Question[] = [
                {
                    id: 'q1',
                    text: 'What problem are you solving?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'problem-definition',
                    priority: 1
                },
                {
                    id: 'q2',
                    text: 'Who are your users?',
                    type: 'open-ended',
                    examples: [],
                    required: true,
                    followupTriggers: [],
                    category: 'user-identification',
                    priority: 1
                }
            ];

            const relevantQuestions = questionEngine.validateQuestionRelevance(questions, mockContext);

            expect(relevantQuestions.length).toBe(2);
        });
    });

    describe('getQuestionTemplate and updateQuestionTemplate', () => {
        it('should retrieve existing question template', () => {
            const template = questionEngine.getQuestionTemplate('prd-creator', 'prd');

            expect(template).toBeDefined();
            expect(template?.agentName).toBe('prd-creator');
            expect(template?.phase).toBe('prd');
            expect(template?.initialQuestions.primary.length).toBeGreaterThan(0);
        });

        it('should return null for non-existent template', () => {
            const template = questionEngine.getQuestionTemplate('non-existent', 'phase');

            expect(template).toBeNull();
        });

        it('should update question template', () => {
            const newTemplate = {
                agentName: 'test-agent',
                phase: 'test-phase',
                initialQuestions: {
                    primary: [{
                        id: 'test-q1',
                        text: 'Test question?',
                        type: 'open-ended' as const,
                        examples: [],
                        required: true,
                        followupTriggers: [],
                        category: 'test',
                        priority: 1
                    }],
                    secondary: [],
                    validation: []
                },
                followupStrategies: [],
                completionCriteria: {
                    minimumQuestions: 1,
                    requiredCategories: ['test'],
                    qualityThreshold: 0.5,
                    completionRules: []
                }
            };

            questionEngine.updateQuestionTemplate(newTemplate);
            const retrieved = questionEngine.getQuestionTemplate('test-agent', 'test-phase');

            expect(retrieved).toBeDefined();
            expect(retrieved?.agentName).toBe('test-agent');
            expect(retrieved?.initialQuestions.primary[0].text).toBe('Test question?');
        });
    });
});