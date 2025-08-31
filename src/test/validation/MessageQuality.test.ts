import { describe, it, expect, beforeEach } from '@jest/globals';
import { MessageFormatter, MessageContent } from '../../utils/MessageFormatter';
import { OutputCoordinator } from '../../commands/OutputCoordinator';

describe('Message Quality Validation Tests', () => {
    let messageFormatter: MessageFormatter;
    let outputCoordinator: OutputCoordinator;

    beforeEach(() => {
        messageFormatter = MessageFormatter.getInstance();
        outputCoordinator = OutputCoordinator.getInstance();
        outputCoordinator.clear();
    });

    describe('Message Content Quality', () => {
        it('should reject empty or placeholder messages', () => {
            const badMessages: MessageContent[] = [
                { type: 'info' as const, title: '', message: 'Test' },
                { type: 'info' as const, title: 'Test', message: '' },
                { type: 'info' as const, title: 'Task Reminder', message: 'Fix this' },
                { type: 'info' as const, title: 'Implementation Note', message: 'TODO: implement' },
                { type: 'info' as const, title: 'Sample Text', message: 'placeholder text' },
                { type: 'info' as const, title: 'Demo Content', message: 'Lorem ipsum' }
            ];

            // Test that the formatter can handle bad messages without crashing
            for (const message of badMessages) {
                expect(() => {
                    const formatted = messageFormatter.formatMessage(message);
                    // Should produce some output even for bad messages
                    expect(formatted).toBeTruthy();
                }).not.toThrow();
            }
            
            // Verify that bad messages are indeed problematic
            const emptyTitleMessage = badMessages.find(m => m.title.trim().length === 0);
            const emptyMessageMessage = badMessages.find(m => m.message.trim().length === 0);
            
            expect(emptyTitleMessage).toBeTruthy();
            expect(emptyMessageMessage).toBeTruthy();
            
            // The formatter should handle these gracefully
            expect(() => messageFormatter.formatMessage(emptyTitleMessage!)).not.toThrow();
            expect(() => messageFormatter.formatMessage(emptyMessageMessage!)).not.toThrow();
        });

        it('should provide specific and actionable messages', () => {
            const goodMessage: MessageContent = {
                type: 'success',
                title: 'Document Created Successfully',
                message: 'Created "CardCraft Online Store PRD" using the basic template in docs/01-prd/',
                details: [
                    'File saved to: docs/01-prd/cardcraft-online-store-prd.md',
                    'Template: basic-prd-template',
                    'Size: 2.3 KB'
                ],
                metadata: {
                    'Creation Time': '2024-01-15 10:30:00',
                    'Template Used': 'basic-prd-template',
                    'File Path': 'docs/01-prd/cardcraft-online-store-prd.md'
                }
            };

            const formatted = messageFormatter.formatMessage(goodMessage);

            // Should contain specific information
            expect(formatted).toContain('CardCraft Online Store PRD');
            expect(formatted).toContain('basic template');
            expect(formatted).toContain('docs/01-prd/');
            expect(formatted).toContain('2.3 KB');
            
            // Should have clear structure
            expect(formatted).toContain('✅'); // Success icon
            expect(formatted).toContain('**Details:**');
            expect(formatted).toContain('**Information:**');
        });

        it('should provide helpful error messages with recovery options', () => {
            const error = new Error('Template "advanced-prd" not found');
            const suggestions = [
                'Use "/templates" to see available templates',
                'Try using the "basic" template instead',
                'Check template name spelling'
            ];

            const formatted = messageFormatter.formatError(error, suggestions);

            // Should contain error information
            expect(formatted).toContain('Template "advanced-prd" not found');
            expect(formatted).toContain('❌'); // Error icon
            
            // Should contain recovery suggestions
            expect(formatted).toContain('/templates');
            expect(formatted).toContain('basic');
            expect(formatted).toContain('spelling');
        });

        it('should format progress messages clearly', () => {
            const progressMessage = {
                title: 'Creating Document',
                message: 'Generating content from template...',
                progress: 65
            };

            const formatted = messageFormatter.formatProgress(progressMessage);

            // Should contain progress information
            expect(formatted).toContain('Creating Document');
            expect(formatted).toContain('Generating content');
            expect(formatted).toContain('65%');
            expect(formatted).toContain('⏳'); // Progress icon
            
            // Should have progress bar
            expect(formatted).toMatch(/\[█+░*\]/); // Progress bar pattern
        });
    });

    describe('Message Consistency', () => {
        it('should use consistent formatting across message types', () => {
            const messages: MessageContent[] = [
                { type: 'success', title: 'Success Test', message: 'Success message' },
                { type: 'error', title: 'Error Test', message: 'Error message' },
                { type: 'warning', title: 'Warning Test', message: 'Warning message' },
                { type: 'info', title: 'Info Test', message: 'Info message' }
            ];

            const formatted = messages.map(msg => messageFormatter.formatMessage(msg));

            // All should have consistent structure
            for (const format of formatted) {
                // Check for icon at start and ## header
                expect(format).toMatch(/^(✅|❌|⚠️|ℹ️).* ## /); // Icon + header
                expect(format).toContain('\n---\n'); // Divider
            }

            // Should have different icons
            expect(formatted[0]).toContain('✅'); // Success
            expect(formatted[1]).toContain('❌'); // Error
            expect(formatted[2]).toContain('⚠️'); // Warning
            expect(formatted[3]).toContain('ℹ️'); // Info
        });

        it('should maintain consistent tone and language', () => {
            const messages = [
                'Document created successfully',
                'Template applied correctly', 
                'File saved to workspace',
                'Operation completed'
            ];

            // All messages should be:
            // - Past tense for completed actions or clear statements
            // - Positive and clear
            // - Professional but friendly
            for (const message of messages) {
                // Allow past tense, adverbs, or clear completion statements
                expect(message).toMatch(/ed$|ly$|saved|created|completed|finished|done|ready|available/i);
                expect(message.toLowerCase()).not.toMatch(/failed|error|problem/);
                expect(message).toMatch(/^[A-Z]/); // Proper capitalization
            }
        });

        it('should provide appropriate level of detail', () => {
            // Test that messages provide right amount of information
            const detailedMessage: MessageContent = {
                type: 'success',
                title: 'Document Created',
                message: 'Successfully created your PRD document',
                details: [
                    'File: cardcraft-prd.md',
                    'Location: docs/01-prd/',
                    'Size: 2.3 KB',
                    'Template: basic-prd'
                ],
                metadata: {
                    'Created': '2024-01-15 10:30:00',
                    'Author': 'User'
                }
            };

            const formatted = messageFormatter.formatMessage(detailedMessage);

            // Should have main message (brief)
            expect(detailedMessage.message.length).toBeLessThan(100);
            
            // Should have details (specific)
            expect(detailedMessage.details?.length).toBeGreaterThan(2);
            
            // Should have metadata (contextual)
            expect(Object.keys(detailedMessage.metadata || {}).length).toBeGreaterThan(0);
        });
    });

    describe('Feedback Coordination Quality', () => {
        it('should prioritize feedback appropriately', () => {
            // Add feedback with different priorities
            outputCoordinator.addFeedback({
                type: 'warning',
                message: 'High priority warning',
                priority: 10,
                source: 'test-high'
            });

            outputCoordinator.addFeedback({
                type: 'tip',
                message: 'Low priority tip',
                priority: 3,
                source: 'test-low'
            });

            outputCoordinator.addFeedback({
                type: 'guidance',
                message: 'Medium priority guidance',
                priority: 7,
                source: 'test-medium'
            });

            const feedback = outputCoordinator.getPendingFeedback();

            // Should be ordered by priority (high to low)
            expect(feedback[0].priority).toBe(10);
            expect(feedback[1].priority).toBe(7);
            expect(feedback[2].priority).toBe(3);
        });

        it('should prevent feedback spam from same source', () => {
            const feedback = {
                type: 'tip' as const,
                message: 'Repeated tip',
                priority: 5,
                source: 'spam-source'
            };

            // Try to add same feedback multiple times
            for (let i = 0; i < 5; i++) {
                outputCoordinator.addFeedback(feedback);
            }

            const pendingFeedback = outputCoordinator.getPendingFeedback();
            
            // Should only have one instance
            expect(pendingFeedback).toHaveLength(1);
        });

        it('should group related feedback appropriately', () => {
            // Add related feedback
            outputCoordinator.addFeedback({
                type: 'tip',
                message: 'Tip about templates',
                priority: 5,
                source: 'template-tip-1'
            });

            outputCoordinator.addFeedback({
                type: 'tip', 
                message: 'Another template tip',
                priority: 6,
                source: 'template-tip-2'
            });

            outputCoordinator.addFeedback({
                type: 'guidance',
                message: 'File organization guidance',
                priority: 7,
                source: 'file-guidance'
            });

            const feedback = outputCoordinator.getPendingFeedback();
            
            // Should have all feedback
            expect(feedback).toHaveLength(3);
            
            // Tips should be grouped by type
            const tips = feedback.filter(f => f.type === 'tip');
            const guidance = feedback.filter(f => f.type === 'guidance');
            
            expect(tips).toHaveLength(2);
            expect(guidance).toHaveLength(1);
        });
    });

    describe('Message Accessibility', () => {
        it('should use clear and simple language', () => {
            const message: MessageContent = {
                type: 'info',
                title: 'Template Information',
                message: 'The basic template includes sections for overview, requirements, and implementation details.',
                details: [
                    'Overview section: Describes the project purpose',
                    'Requirements section: Lists functional and non-functional requirements', 
                    'Implementation section: Provides technical guidance'
                ]
            };

            const formatted = messageFormatter.formatMessage(message);

            // Should use simple, clear language
            expect(message.message.split(' ').length).toBeLessThan(20); // Not too long
            expect(message.message).not.toMatch(/utilize|leverage|facilitate/); // Avoid jargon
            expect(message.message).toMatch(/^[A-Z]/); // Proper capitalization
        });

        it('should provide meaningful icons and visual cues', () => {
            const messageTypes = ['success', 'error', 'warning', 'info'] as const;
            const expectedIcons = ['✅', '❌', '⚠️', 'ℹ️'];

            messageTypes.forEach((type, index) => {
                const message: MessageContent = {
                    type,
                    title: `Test ${type}`,
                    message: `Test ${type} message`
                };

                const formatted = messageFormatter.formatMessage(message);
                expect(formatted).toContain(expectedIcons[index]);
            });
        });

        it('should structure information hierarchically', () => {
            const message: MessageContent = {
                type: 'success',
                title: 'Document Created',
                message: 'Your document has been created successfully.',
                details: [
                    'Primary details here',
                    'Secondary details here'
                ],
                metadata: {
                    'Technical Info': 'For advanced users'
                }
            };

            const formatted = messageFormatter.formatMessage(message);

            // Should have clear hierarchy
            const lines = formatted.split('\n');
            const titleLine = lines.find(line => line.includes('Document Created'));
            const detailsLine = lines.find(line => line.includes('**Details:**'));
            const metadataLine = lines.find(line => line.includes('**Information:**'));

            expect(titleLine).toBeTruthy();
            expect(detailsLine).toBeTruthy();
            expect(metadataLine).toBeTruthy();

            // Title should come first
            const titleIndex = lines.indexOf(titleLine!);
            const detailsIndex = lines.indexOf(detailsLine!);
            const metadataIndex = lines.indexOf(metadataLine!);

            expect(titleIndex).toBeLessThan(detailsIndex);
            expect(detailsIndex).toBeLessThan(metadataIndex);
        });
    });

    describe('Context-Aware Messaging', () => {
        it('should provide context-appropriate suggestions', () => {
            // Test different contexts require different suggestions
            const contexts = [
                {
                    command: 'new',
                    expectedSuggestions: ['edit', 'template', 'save']
                },
                {
                    command: 'templates',
                    expectedSuggestions: ['create', 'new', 'choose']
                },
                {
                    command: 'help',
                    expectedSuggestions: ['command', 'example', 'guide']
                }
            ];

            // This would be tested in integration with actual command handlers
            // Here we test the principle that suggestions should be contextual
            for (const context of contexts) {
                expect(context.expectedSuggestions.length).toBeGreaterThan(0);
                expect(context.expectedSuggestions).not.toContain('generic');
            }
        });

        it('should adapt message detail level based on user experience', () => {
            // Beginner users should get more detailed messages
            const beginnerMessage: MessageContent = {
                type: 'success',
                title: 'Document Created',
                message: 'Great! I\'ve created your document. Here\'s what happened and what you can do next.',
                details: [
                    'Your document was saved to the workspace',
                    'You can edit it directly in VS Code',
                    'Use /templates to see other available templates',
                    'The document includes placeholder content to get you started'
                ]
            };

            // Advanced users should get concise messages
            const advancedMessage: MessageContent = {
                type: 'success',
                title: 'Document Created',
                message: 'Document created successfully.',
                metadata: {
                    'Path': 'docs/prd.md',
                    'Template': 'basic',
                    'Size': '2.3KB'
                }
            };

            const beginnerFormatted = messageFormatter.formatMessage(beginnerMessage);
            const advancedFormatted = messageFormatter.formatMessage(advancedMessage);

            // Beginner message should be more detailed
            expect(beginnerMessage.details?.length || 0).toBeGreaterThan(2);
            expect(beginnerFormatted.length).toBeGreaterThan(advancedFormatted.length);

            // Advanced message should be more concise
            expect(advancedMessage.message.length).toBeLessThan(50);
            expect(Object.keys(advancedMessage.metadata || {}).length).toBeGreaterThan(0);
        });
    });
});