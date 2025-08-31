import { OutputCoordinator } from '../../commands/OutputCoordinator';
import { CommandResult } from '../../commands/types';
import { CommandTip } from '../../commands/CommandTipProvider';
import { OutputContent, FeedbackContent } from '../../commands/OutputCoordinator';

describe('OutputCoordinator', () => {
    let coordinator: OutputCoordinator;

    beforeEach(() => {
        // Reset singleton instance for each test
        coordinator = OutputCoordinator.getInstance();
        coordinator.clear();
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = OutputCoordinator.getInstance();
            const instance2 = OutputCoordinator.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('primary output registration', () => {
        it('should register primary output correctly', () => {
            const primaryOutput: OutputContent = {
                type: 'success',
                title: 'Test Success',
                message: 'Operation completed successfully',
                details: ['Detail 1', 'Detail 2']
            };

            coordinator.registerPrimaryOutput('test', primaryOutput);
            const state = coordinator.getState();
            
            expect(state.primaryOutput).toBeDefined();
            expect(state.primaryOutput?.type).toBe('success');
            expect(state.primaryOutput?.title).toBe('Test Success');
        });
    });

    describe('feedback management', () => {
        it('should add feedback correctly', () => {
            const feedback: FeedbackContent = {
                type: 'guidance',
                source: 'test-source',
                message: 'Test feedback message',
                priority: 1
            };

            coordinator.addFeedback(feedback);
            const pendingFeedback = coordinator.getPendingFeedback();
            
            expect(pendingFeedback).toHaveLength(1);
            expect(pendingFeedback[0].message).toBe('Test feedback message');
        });

        it('should prevent duplicate feedback from same source', () => {
            const feedback: FeedbackContent = {
                type: 'guidance',
                source: 'test-source',
                message: 'Test feedback message',
                priority: 1
            };

            // Add same feedback twice
            coordinator.addFeedback(feedback);
            coordinator.addFeedback(feedback);

            const pendingFeedback = coordinator.getPendingFeedback();
            
            // Should only have one instance
            expect(pendingFeedback).toHaveLength(1);
        });
    });

    describe('tips management', () => {
        it('should add tips correctly', () => {
            const tips: CommandTip[] = [
                {
                    type: 'info',
                    title: 'Tip 1',
                    content: 'Tip 1',
                    priority: 1,
                    category: 'general'
                },
                {
                    type: 'info',
                    title: 'Tip 2',
                    content: 'Tip 2',
                    priority: 2,
                    category: 'general'
                }
            ];

            coordinator.addTips('test-source', tips);
            const state = coordinator.getState();
            
            expect(state.tips.has('test-source')).toBe(true);
            expect(state.tips.get('test-source')).toHaveLength(2);
        });
    });

    describe('state management', () => {
        it('should clear state correctly', () => {
            const primaryOutput: OutputContent = {
                type: 'success',
                title: 'Test',
                message: 'Test message'
            };

            coordinator.registerPrimaryOutput('test', primaryOutput);
            coordinator.clear();
            
            const state = coordinator.getState();
            expect(state.primaryOutput).toBeUndefined();
            expect(state.tips.size).toBe(0);
        });
    });
});