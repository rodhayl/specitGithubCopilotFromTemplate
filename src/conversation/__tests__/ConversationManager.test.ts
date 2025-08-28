// ConversationManager unit tests
import { ConversationManager } from '../ConversationManager';
import { 
    QuestionEngine, 
    ResponseProcessor, 
    ContentCapture, 
    WorkflowOrchestrator, 
    ProgressTracker,
    ConversationContext,
    Question
} from '../types';
// VSCode is mocked globally in setup.ts
import MockHelper from '../../test/utils/mockHelpers';

// VSCode is mocked globally in setup.ts

// Mock implementations
class MockQuestionEngine implements QuestionEngine {
    generateInitialQuestions(agentType: string, context: ConversationContext): Question[] {
        return [
            {
                id: 'q1',
                text: 'What problem are you trying to solve?',
                type: 'open-ended',
                examples: ['User authentication issues', 'Data processing bottlenecks'],
                required: true,
                followupTriggers: [],
                category: 'problem-definition',
                priority: 1
            },
            {
                id: 'q2',
                text: 'Who are your target users?',
                type: 'open-ended',
                examples: ['Developers', 'End users', 'Administrators'],
                required: true,
                followupTriggers: [],
                category: 'user-identification',
                priority: 1
            }
        ];
    }

    generateFollowupQuestions(agentType: string, userResponse: string, conversationHistory: any[]): Question[] {
        if (userResponse.toLowerCase().includes('authentication')) {
            return [{
                id: 'followup_auth',
                text: 'What type of authentication are you currently using?',
                type: 'open-ended',
                examples: ['OAuth', 'JWT', 'Session-based'],
                required: false,
                followupTriggers: [],
                category: 'authentication-details',
                priority: 2
            }];
        }
        return [];
    }

    validateQuestionRelevance(questions: Question[], context: ConversationContext): Question[] {
        return questions;
    }

    getQuestionTemplate(agentType: string, phase: string): any {
        return null;
    }

    updateQuestionTemplate(template: any): void {}
}

class MockResponseProcessor implements ResponseProcessor {
    analyzeResponse(response: string, question: Question): any {
        return {
            completeness: response.length > 10 ? 0.8 : 0.4,
            clarity: 0.7,
            extractedEntities: response.toLowerCase().includes('authentication') ? 
                [{ type: 'technology', value: 'authentication', confidence: 0.9, startIndex: 0, endIndex: 14 }] : [],
            suggestedFollowups: ['Could you provide more details?'],
            needsClarification: response.length < 10,
            confidence: 0.8
        };
    }

    extractStructuredData(response: string, expectedFormat: string): any {
        return {
            type: 'text',
            data: { content: response },
            confidence: 0.7,
            source: 'user-response'
        };
    }

    validateCompleteness(response: string, requirements: any[]): any {
        return {
            valid: response.length > 5,
            errors: response.length <= 5 ? ['Response too short'] : [],
            warnings: [],
            score: response.length > 5 ? 0.8 : 0.3
        };
    }

    suggestImprovements(response: string, context: ConversationContext): string[] {
        return response.length < 10 ? ['Please provide more detail'] : [];
    }

    processEntities(response: string): any[] {
        return [];
    }
}

class MockContentCapture implements ContentCapture {
    async updateDocument(documentPath: string, updates: any[]): Promise<any> {
        return {
            success: true,
            updatedSections: ['test-section'],
            errors: [],
            warnings: [],
            changesSummary: 'Updated test section'
        };
    }

    generateDocumentSection(sectionType: string, conversationData: any): string {
        return `Generated ${sectionType} section`;
    }

    validateDocumentStructure(documentPath: string): any {
        return { valid: true, errors: [], warnings: [], score: 1.0 };
    }

    trackChanges(documentPath: string, changes: any[]): void {}

    async getDocumentSections(documentPath: string): Promise<string[]> {
        return ['Introduction', 'Main Content'];
    }

    async extractExistingContent(documentPath: string, section: string): Promise<string> {
        return 'Existing content';
    }
}

class MockWorkflowOrchestrator implements WorkflowOrchestrator {
    async evaluatePhaseCompletion(currentPhase: string, documentPath: string): Promise<any> {
        return {
            phase: currentPhase,
            completionPercentage: 75,
            requiredSections: ['Introduction', 'Main Content'],
            completedSections: ['Introduction'],
            missingSections: ['Main Content'],
            qualityScore: 0.8,
            readyForTransition: false
        };
    }

    suggestNextPhase(currentPhase: string, completionStatus: any): any {
        return {
            nextPhase: 'requirements',
            recommendedAgent: 'requirements-gatherer',
            reason: 'Ready to move to requirements gathering',
            prerequisites: [],
            estimatedDuration: '30 minutes',
            confidence: 0.9
        };
    }

    validatePhaseTransition(fromPhase: string, toPhase: string): any {
        return {
            valid: true,
            errors: [],
            warnings: [],
            prerequisites: [],
            recommendations: []
        };
    }

    async executePhaseTransition(suggestion: any): Promise<any> {
        return {
            success: true,
            fromPhase: 'prd',
            toPhase: 'requirements',
            newAgent: 'requirements-gatherer',
            message: 'Transition completed',
            nextSteps: ['Start requirements gathering']
        };
    }

    getWorkflowPhases(): string[] {
        return ['prd', 'requirements', 'design', 'implementation'];
    }

    getPhaseRequirements(phase: string): string[] {
        return ['Introduction', 'Main Content'];
    }
}

class MockProgressTracker implements ProgressTracker {
    calculateProgress(sessionId: string): any {
        return {
            currentPhase: 'prd',
            completionPercentage: 50,
            completedSections: ['Introduction'],
            pendingSections: ['Main Content'],
            nextSteps: ['Complete main content'],
            estimatedTimeRemaining: '15 minutes'
        };
    }

    updateProgress(sessionId: string, updates: any): void {}

    getCompletionMetrics(sessionId: string): any {
        return {
            questionsAnswered: 2,
            totalQuestions: 4,
            sectionsCompleted: 1,
            totalSections: 3,
            qualityScore: 0.7,
            timeSpent: 300,
            estimatedTimeRemaining: 600
        };
    }

    identifyMissingSections(documentPath: string, phase: string): string[] {
        return ['Main Content', 'Conclusion'];
    }

    estimateRemainingWork(sessionId: string): string {
        return '15 minutes';
    }
}

describe('ConversationManager', () => {
    let conversationManager: ConversationManager;
    let mockExtensionContext: any;

    beforeEach(() => {
        mockExtensionContext = {};
        
        conversationManager = new ConversationManager(
            new MockQuestionEngine(),
            new MockResponseProcessor(),
            new MockContentCapture(),
            new MockWorkflowOrchestrator(),
            new MockProgressTracker(),
            mockExtensionContext
        );
    });

    describe('startConversation', () => {
        it('should create a new conversation session', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);

            expect(session).toBeDefined();
            expect(session.agentName).toBe('prd-creator');
            expect(session.currentQuestionSet).toHaveLength(2);
            expect(session.state.isActive).toBe(true);
            expect(session.state.completionScore).toBe(0);
        });

        it('should end existing session when starting new one for same agent', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            // Start first session
            const session1 = await conversationManager.startConversation('prd-creator', context);
            
            // Start second session with same agent
            const session2 = await conversationManager.startConversation('prd-creator', context);

            expect(session2.sessionId).not.toBe(session1.sessionId);
            expect(conversationManager.getActiveSession('prd-creator')?.sessionId).toBe(session2.sessionId);
        });
    });

    describe('continueConversation', () => {
        it('should process user response and generate follow-up', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);
            const response = await conversationManager.continueConversation(session.sessionId, 'We have authentication issues with our current system');

            expect(response).toBeDefined();
            expect(response.agentMessage).toBeDefined();
            expect(response.sessionId).toBe(session.sessionId);
            expect(response.followupQuestions).toBeDefined();
        });

        it('should handle clarification requests for unclear responses', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);
            const response = await conversationManager.continueConversation(session.sessionId, 'Yes'); // Short, unclear response

            expect(response.agentMessage).toContain('clarification');
            expect(response.followupQuestions).toHaveLength(1);
        });

        it('should throw error for non-existent session', async () => {
            await expect(
                conversationManager.continueConversation('invalid-session', 'test response')
            ).rejects.toThrow('Session not found');
        });
    });

    describe('endConversation', () => {
        it('should end conversation and return summary', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);
            await conversationManager.continueConversation(session.sessionId, 'Authentication issues');
            
            const summary = await conversationManager.endConversation(session.sessionId);

            expect(summary).toBeDefined();
            expect(summary.sessionId).toBe(session.sessionId);
            expect(summary.agentName).toBe('prd-creator');
            expect(summary.questionsAnswered).toBe(1);
            expect(summary.completedAt).toBeDefined();
        });

        it('should remove session from active sessions', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);
            await conversationManager.endConversation(session.sessionId);

            expect(conversationManager.getActiveSession('prd-creator')).toBeNull();
        });
    });

    describe('getConversationHistory', () => {
        it('should return conversation history for session', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);
            await conversationManager.continueConversation(session.sessionId, 'Test response');

            const history = conversationManager.getConversationHistory(session.sessionId);

            expect(history.length).toBeGreaterThan(0);
            expect(history[0].type).toBe('system');
            expect(history.some(turn => turn.type === 'response')).toBe(true);
        });

        it('should return empty array for non-existent session', () => {
            const history = conversationManager.getConversationHistory('invalid-session');
            expect(history).toEqual([]);
        });
    });

    describe('pauseConversation and resumeConversation', () => {
        it('should pause and resume conversation', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/document.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);
            
            await conversationManager.pauseConversation(session.sessionId);
            expect(session.state.isActive).toBe(false);

            const resumedSession = await conversationManager.resumeConversation(session.sessionId);
            expect(resumedSession.state.isActive).toBe(true);
        });
    });
});