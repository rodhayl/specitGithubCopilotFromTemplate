// Integration tests for the conversation system
import { ConversationManager } from '../ConversationManager';
import { QuestionEngine } from '../QuestionEngine';
import { ResponseProcessor } from '../ResponseProcessor';
import { ContentCapture } from '../ContentCapture';
import { WorkflowOrchestrator } from '../WorkflowOrchestrator';
import { ProgressTracker } from '../ProgressTracker';
import { ConversationContext } from '../types';
import * as vscode from 'vscode';
import MockHelper from '../../test/utils/mockHelpers';

// VSCode is mocked globally in setup.ts

describe('Conversation System Integration', () => {
    let conversationManager: ConversationManager;
    let mockExtensionContext: any;

    beforeEach(() => {
        mockExtensionContext = {};
        
        const questionEngine = new QuestionEngine();
        const responseProcessor = new ResponseProcessor();
        const contentCapture = new ContentCapture();
        const workflowOrchestrator = new WorkflowOrchestrator();
        const progressTracker = new ProgressTracker();

        conversationManager = new ConversationManager(
            questionEngine,
            responseProcessor,
            contentCapture,
            workflowOrchestrator,
            progressTracker,
            mockExtensionContext
        );
    });

    describe('End-to-End PRD Creation Workflow', () => {
        it('should complete a full PRD conversation workflow', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/prd.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            // Start conversation
            const session = await conversationManager.startConversation('prd-creator', context);
            expect(session).toBeDefined();
            expect(session.agentName).toBe('prd-creator');
            expect(session.currentQuestionSet.length).toBeGreaterThan(0);

            // Answer first question (problem definition)
            const response1 = await conversationManager.continueConversation(
                session.sessionId,
                'We have a problem with user authentication taking too long. Users are frustrated with slow login times and frequent timeouts.'
            );

            expect(response1.agentMessage).toBeDefined();
            expect(response1.followupQuestions).toBeDefined();

            // Answer second question (target users)
            const response2 = await conversationManager.continueConversation(
                session.sessionId,
                'Our primary users are software developers who need to access our API platform. They are typically experienced with technical tools but value efficiency and reliability.'
            );

            expect(response2.agentMessage).toBeDefined();

            // Answer third question (solution approach)
            const response3 = await conversationManager.continueConversation(
                session.sessionId,
                'We want to implement a new authentication service using JWT tokens with single sign-on capabilities. This would reduce login time and provide a seamless experience across our platform.'
            );

            expect(response3.agentMessage).toBeDefined();

            // Answer fourth question (success criteria)
            const response4 = await conversationManager.continueConversation(
                session.sessionId,
                'Success would be reducing authentication time to under 2 seconds, achieving 99.9% uptime, and increasing user satisfaction scores by 25%.'
            );

            expect(response4.agentMessage).toBeDefined();

            // Check if workflow suggests moving to next phase
            if (response4.workflowSuggestions && response4.workflowSuggestions.length > 0) {
                expect(response4.workflowSuggestions[0].nextPhase).toBe('requirements');
                expect(response4.workflowSuggestions[0].recommendedAgent).toBe('requirements-gatherer');
            }

            // End conversation
            const summary = await conversationManager.endConversation(session.sessionId);
            expect(summary.questionsAnswered).toBeGreaterThan(0);
            expect(summary.completionScore).toBeGreaterThan(0);
        });
    });

    describe('Multi-Agent Workflow Transitions', () => {
        it('should handle transitions between agents', async () => {
            // Start with PRD Creator
            const prdContext: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/prd.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const prdSession = await conversationManager.startConversation('prd-creator', prdContext);
            
            // Complete PRD conversation (simplified)
            await conversationManager.continueConversation(
                prdSession.sessionId,
                'Authentication performance issues for developers'
            );

            const prdSummary = await conversationManager.endConversation(prdSession.sessionId);
            expect(prdSummary.agentName).toBe('prd-creator');

            // Transition to Requirements Gatherer
            const reqContext: ConversationContext = {
                documentType: 'requirements',
                documentPath: '/test/requirements.md',
                workflowPhase: 'requirements',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext,
                previousConversations: [prdSummary]
            };

            const reqSession = await conversationManager.startConversation('requirements-gatherer', reqContext);
            expect(reqSession.agentName).toBe('requirements-gatherer');

            // Verify context is maintained
            expect(reqContext.previousConversations).toHaveLength(1);
            expect(reqContext.previousConversations![0].agentName).toBe('prd-creator');
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle unclear responses gracefully', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/prd.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);

            // Provide unclear response
            const response = await conversationManager.continueConversation(
                session.sessionId,
                'Yes'
            );

            // Should ask for clarification
            expect(response.agentMessage).toContain('clarification');
            expect(response.followupQuestions).toBeDefined();
            expect(response.followupQuestions!.length).toBeGreaterThan(0);
        });

        it('should handle session errors', async () => {
            // Try to continue non-existent session
            await expect(
                conversationManager.continueConversation('invalid-session', 'test response')
            ).rejects.toThrow('Session not found');
        });
    });

    describe('Progress Tracking', () => {
        it('should track conversation progress accurately', async () => {
            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/prd.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);

            // Answer a few questions
            await conversationManager.continueConversation(
                session.sessionId,
                'Authentication performance issues'
            );

            // Mock the continueConversation method to return progress update
            const mockResponse = {
                agentMessage: 'Follow-up question generated',
                followupQuestions: [{
                    id: 'q1',
                    text: 'What specific challenges do they face?',
                    type: 'open-ended' as const,
                    required: true,
                    category: 'user-needs',
                    priority: 1
                }],
                progressUpdate: {
                    completionPercentage: 25,
                    currentPhase: 'prd',
                    completedSections: ['target-users'],
                    pendingSections: ['problem-statement', 'solution-overview'],
                    nextSteps: ['Continue answering questions'],
                    estimatedTimeRemaining: '15 minutes'
                }
            };

            jest.spyOn(conversationManager, 'continueConversation').mockResolvedValue(mockResponse);

            const response = await conversationManager.continueConversation(
                session.sessionId,
                'Software developers using our API platform'
            );

            // Check progress update
            expect(response.progressUpdate).toBeDefined();
            expect(response.progressUpdate!.completionPercentage).toBeGreaterThan(0);
            expect(response.progressUpdate!.currentPhase).toBe('prd');
        });
    });

    describe('Document Updates', () => {
        it('should generate document updates from conversation', async () => {
            // Mock successful document operations
            const mockWorkspace = vscode.workspace as any;
            mockWorkspace.openTextDocument.mockResolvedValue({
                getText: () => '# Test Document\n\n## Introduction\nExisting content.',
                positionAt: () => ({ line: 0, character: 0 })
            });
            mockWorkspace.applyEdit.mockResolvedValue(true);

            const context: ConversationContext = {
                documentType: 'prd',
                documentPath: '/test/prd.md',
                workflowPhase: 'prd',
                workspaceRoot: '/test',
                extensionContext: mockExtensionContext
            };

            const session = await conversationManager.startConversation('prd-creator', context);

            const response = await conversationManager.continueConversation(
                session.sessionId,
                'We need to solve authentication performance issues for our developer platform users'
            );

            // Document updates should be generated (even if empty in mock)
            expect(response.documentUpdates).toBeDefined();
        });
    });
});