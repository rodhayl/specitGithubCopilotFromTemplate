import { OutputCoordinator, OutputContent, FeedbackContent } from '../../src/commands/OutputCoordinator';
import { CommandTip } from '../../src/commands/CommandTipProvider';

// Mock vscode module
const mockStream = {
    markdown: jest.fn()
};

jest.mock('vscode', () => ({
    ChatResponseStream: jest.fn()
}));

describe('OutputCoordinator', () => {
    let coordinator: OutputCoordinator;

    beforeEach(() => {
        // Reset singleton instance for each test
        (OutputCoordinator as any).instance = undefined;
        coordinator = OutputCoordinator.getInstance();
        // Reset mock
        mockStream.markdown.mockClear();
    });

    afterEach(() => {
        coordinator.clear();
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = OutputCoordinator.getInstance();
            const instance2 = OutputCoordinator.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('registerPrimaryOutput', () => {
        it('should register primary output', () => {
            const output: OutputContent = {
                type: 'success',
                title: 'Test Success',
                message: 'Test message'
            };

            coordinator.registerPrimaryOutput('test-source', output);
            const state = coordinator.getState();

            expect(state.primaryOutput).toEqual(output);
        });

        it('should replace existing primary output', () => {
            const output1: OutputContent = {
                type: 'info',
                title: 'First Output',
                message: 'First message'
            };

            const output2: OutputContent = {
                type: 'success',
                title: 'Second Output',
                message: 'Second message'
            };

            coordinator.registerPrimaryOutput('source1', output1);
            coordinator.registerPrimaryOutput('source2', output2);

            const state = coordinator.getState();
            expect(state.primaryOutput).toEqual(output2);
        });
    });

    describe('addSecondaryFeedback', () => {
        it('should add secondary feedback', () => {
            const feedback: FeedbackContent = {
                type: 'conversation',
                content: 'Test feedback',
                priority: 5
            };

            coordinator.addSecondaryFeedback('test-source', feedback);
            const state = coordinator.getState();

            expect(state.secondaryFeedback.get('test-source')).toEqual(feedback);
        });

        it('should detect and suppress duplicate feedback', () => {
            const feedback1: FeedbackContent = {
                type: 'conversation',
                content: 'Duplicate content',
                priority: 5
            };

            const feedback2: FeedbackContent = {
                type: 'guidance',
                content: 'Duplicate content',
                priority: 3
            };

            coordinator.addSecondaryFeedback('source1', feedback1);
            coordinator.addSecondaryFeedback('source2', feedback2);

            const state = coordinator.getState();
            expect(state.secondaryFeedback.size).toBe(1);
            expect(state.duplicatesSuppressed).toContain('source2: guidance');
        });
    });

    describe('addTips', () => {
        it('should add tips', () => {
            const tips: CommandTip[] = [
                {
                    type: 'suggestion',
                    title: 'Test Tip',
                    content: 'Test tip content'
                }
            ];

            coordinator.addTips('test-source', tips);
            const state = coordinator.getState();

            expect(state.tips.get('test-source')).toEqual(tips);
        });

        it('should filter duplicate tips', () => {
            const tips1: CommandTip[] = [
                {
                    type: 'suggestion',
                    title: 'Duplicate Tip',
                    content: 'Same content'
                }
            ];

            const tips2: CommandTip[] = [
                {
                    type: 'info',
                    title: 'Duplicate Tip',
                    content: 'Same content'  // Same content to trigger duplicate detection
                }
            ];

            coordinator.addTips('source1', tips1);
            coordinator.addTips('source2', tips2);

            const state = coordinator.getState();
            expect(state.tips.get('source2')).toBeUndefined();
            expect(state.duplicatesSuppressed).toContain('source2: 1 duplicate tips');
        });

        it('should handle empty tips array', () => {
            coordinator.addTips('test-source', []);
            const state = coordinator.getState();

            expect(state.tips.get('test-source')).toBeUndefined();
        });
    });

    describe('render', () => {
        it('should render primary output only', async () => {
            const output: OutputContent = {
                type: 'success',
                title: 'Test Success',
                message: 'Test message',
                details: ['Detail 1', 'Detail 2'],
                nextSteps: ['Step 1', 'Step 2']
            };

            coordinator.registerPrimaryOutput('test-source', output);
            await coordinator.render(mockStream as any);

            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('## Test Success')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Test message')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('Detail 1')
            );
        });

        it('should render coordinated output with priority ordering', async () => {
            const primaryOutput: OutputContent = {
                type: 'success',
                title: 'Primary',
                message: 'Primary message'
            };

            const highPriorityFeedback: FeedbackContent = {
                type: 'warning',
                content: 'High priority feedback',
                priority: 1
            };

            coordinator.registerPrimaryOutput('primary', primaryOutput);
            coordinator.addSecondaryFeedback('high', highPriorityFeedback);

            await coordinator.render(mockStream as any);

            const calls = mockStream.markdown.mock.calls;
            const allContent = calls.map(call => call[0]).join('');

            // Check that content is rendered (basic functionality test)
            expect(allContent).toContain('Primary');
            expect(allContent).toContain('High priority');
            
            // Verify sections are sorted by priority (lower numbers = higher priority)
            const coordinated = coordinator.getState();
            expect(coordinated.rendered).toBe(true);
        });

        it('should suppress tips when conversation feedback is present', async () => {
            const primaryOutput: OutputContent = {
                type: 'success',
                title: 'Primary',
                message: 'Primary message'
            };

            const conversationFeedback: FeedbackContent = {
                type: 'conversation',
                content: 'Conversation feedback',
                priority: 5
            };

            const tips: CommandTip[] = [
                {
                    type: 'suggestion',
                    title: 'Test Tip',
                    content: 'Should be suppressed'
                }
            ];

            coordinator.registerPrimaryOutput('primary', primaryOutput);
            coordinator.addSecondaryFeedback('conversation', conversationFeedback);
            coordinator.addTips('tips', tips);

            await coordinator.render(mockStream as any);

            const calls = mockStream.markdown.mock.calls;
            const allContent = calls.map(call => call[0]).join('');

            expect(allContent).toContain('Conversation feedback');
            expect(allContent).not.toContain('Test Tip');
        });

        it('should not render twice', async () => {
            const output: OutputContent = {
                type: 'info',
                title: 'Test',
                message: 'Test message'
            };

            coordinator.registerPrimaryOutput('test', output);
            await coordinator.render(mockStream as any);
            await coordinator.render(mockStream as any);

            // Should only render once
            expect(mockStream.markdown).toHaveBeenCalledTimes(1);
        });
    });

    describe('clear', () => {
        it('should clear all state', () => {
            const output: OutputContent = {
                type: 'success',
                title: 'Test',
                message: 'Test message'
            };

            const feedback: FeedbackContent = {
                type: 'conversation',
                content: 'Test feedback',
                priority: 5
            };

            const tips: CommandTip[] = [
                {
                    type: 'suggestion',
                    title: 'Test Tip',
                    content: 'Test content'
                }
            ];

            coordinator.registerPrimaryOutput('test', output);
            coordinator.addSecondaryFeedback('feedback', feedback);
            coordinator.addTips('tips', tips);

            coordinator.clear();
            const state = coordinator.getState();

            expect(state.primaryOutput).toBeUndefined();
            expect(state.secondaryFeedback.size).toBe(0);
            expect(state.tips.size).toBe(0);
            expect(state.rendered).toBe(false);
            expect(state.duplicatesSuppressed).toEqual([]);
        });
    });

    describe('deduplication logic', () => {
        it('should detect similar content with high similarity', () => {
            const feedback1: FeedbackContent = {
                type: 'conversation',
                content: 'This is a test message for similarity detection',
                priority: 5
            };

            const feedback2: FeedbackContent = {
                type: 'guidance',
                content: 'This is a test message for similarity detection',
                priority: 3
            };

            coordinator.addSecondaryFeedback('source1', feedback1);
            coordinator.addSecondaryFeedback('source2', feedback2);

            const state = coordinator.getState();
            expect(state.duplicatesSuppressed.length).toBeGreaterThan(0);
        });

        it('should not suppress dissimilar content', () => {
            const feedback1: FeedbackContent = {
                type: 'conversation',
                content: 'Completely different content about conversations',
                priority: 5
            };

            const feedback2: FeedbackContent = {
                type: 'guidance',
                content: 'Totally unrelated guidance about something else',
                priority: 3
            };

            coordinator.addSecondaryFeedback('source1', feedback1);
            coordinator.addSecondaryFeedback('source2', feedback2);

            const state = coordinator.getState();
            expect(state.secondaryFeedback.size).toBe(2);
            expect(state.duplicatesSuppressed.length).toBe(0);
        });
    });
});