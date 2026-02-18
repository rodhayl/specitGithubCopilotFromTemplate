import { DocumentUpdateEngine, ConversationResponse, TemplateStructure, ConversationContext } from '../../src/conversation/DocumentUpdateEngine';
import { FileUtils } from '../../src/utils/FileUtils';

// Mock FileUtils
jest.mock('../../src/utils/FileUtils', () => ({
    FileUtils: {
        readFile: jest.fn(),
        writeFile: jest.fn()
    }
}));

// Mock VS Code API
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key, defaultValue) => defaultValue)
        }))
    }
}));

// Mock Logger
jest.mock('../../src/logging', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

describe('DocumentUpdateEngine', () => {
    let documentUpdateEngine: DocumentUpdateEngine;
    let mockFileUtils: jest.Mocked<typeof FileUtils>;

    beforeEach(() => {
        documentUpdateEngine = new DocumentUpdateEngine();
        mockFileUtils = FileUtils as jest.Mocked<typeof FileUtils>;
        jest.clearAllMocks();
    });

    const createMockTemplateStructure = (): TemplateStructure => ({
        sections: {
            'Problem Statement': { header: '## Problem Statement', required: true, order: 1 },
            'Target Users': { header: '## Target Users', required: true, order: 2 },
            'Key Features': { header: '## Key Features', required: false, order: 3 }
        },
        placeholders: {
            '{{PROBLEM_STATEMENT}}': { section: 'Problem Statement', description: 'Main problem being solved' },
            '{{TARGET_USERS}}': { section: 'Target Users', description: 'Primary user personas' }
        }
    });

    const createMockConversationContext = (): ConversationContext => ({
        agentName: 'prd-creator',
        templateId: 'prd',
        currentTurn: 1,
        previousResponses: [],
        documentPath: '/path/to/document.md'
    });

    describe('updateDocumentFromConversation', () => {
        it('should successfully update document from conversation response', async () => {
            const documentPath = '/path/to/document.md';
            const conversationResponse: ConversationResponse = {
                agentMessage: 'The main problem is that users struggle to find reliable card game information and pricing.',
                extractedContent: {
                    problemStatement: 'Users struggle to find reliable card game information and pricing'
                }
            };
            const templateStructure = createMockTemplateStructure();
            const conversationContext = createMockConversationContext();

            mockFileUtils.readFile.mockResolvedValue('# Document Title\n\n## Problem Statement\n\n{{PROBLEM_STATEMENT}}\n');
            mockFileUtils.writeFile.mockResolvedValue();

            const result = await documentUpdateEngine.updateDocumentFromConversation(
                documentPath,
                conversationResponse,
                templateStructure,
                conversationContext
            );

            expect(result.success).toBe(true);
            expect(result.sectionsUpdated).toContain('Problem Statement');
            expect(result.progressPercentage).toBeGreaterThan(0);
            expect(mockFileUtils.writeFile).toHaveBeenCalled();
        });

        it('should handle document update errors gracefully', async () => {
            const documentPath = '/path/to/document.md';
            const conversationResponse: ConversationResponse = {
                agentMessage: 'Test response'
            };
            const templateStructure = createMockTemplateStructure();
            const conversationContext = createMockConversationContext();

            mockFileUtils.writeFile.mockRejectedValue(new Error('Permission denied'));

            const result = await documentUpdateEngine.updateDocumentFromConversation(
                documentPath,
                conversationResponse,
                templateStructure,
                conversationContext
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.sectionsUpdated).toEqual([]);
        });
    });

    describe('mapContentToSections', () => {
        it('should map PRD creator content to appropriate sections', () => {
            const content = 'The main problem is that card game enthusiasts struggle to find reliable pricing information.';
            const templateStructure = createMockTemplateStructure();
            const conversationContext = createMockConversationContext();

            const sectionUpdates = documentUpdateEngine.mapContentToSections(
                content,
                templateStructure,
                conversationContext
            );

            expect(Object.keys(sectionUpdates)).toContain('Problem Statement');
            expect(sectionUpdates['Problem Statement'].content).toContain('card game enthusiasts');
            expect(sectionUpdates['Problem Statement'].mode).toBe('replace');
        });

        it('should handle requirements gatherer content', () => {
            const content = 'The system must support real-time price updates and user authentication.';
            const templateStructure = createMockTemplateStructure();
            const conversationContext: ConversationContext = {
                ...createMockConversationContext(),
                agentName: 'requirements-gatherer'
            };

            const sectionUpdates = documentUpdateEngine.mapContentToSections(
                content,
                templateStructure,
                conversationContext
            );

            // Should extract functional requirements
            expect(Object.keys(sectionUpdates).length).toBeGreaterThan(0);
        });

        it('should return empty updates for irrelevant content', () => {
            const content = 'This is just random text with no relevant information.';
            const templateStructure = createMockTemplateStructure();
            const conversationContext = createMockConversationContext();

            const sectionUpdates = documentUpdateEngine.mapContentToSections(
                content,
                templateStructure,
                conversationContext
            );

            expect(Object.keys(sectionUpdates)).toHaveLength(0);
        });
    });

    describe('applySectionUpdates', () => {
        it('should apply section updates to existing document', async () => {
            const documentPath = '/path/to/document.md';
            const existingContent = '# Document Title\n\n## Problem Statement\n\nPlaceholder text\n\n## Target Users\n\nAnother placeholder\n';
            const updates = {
                'Problem Statement': {
                    content: 'Updated problem statement content',
                    mode: 'replace' as const,
                    priority: 1
                }
            };

            mockFileUtils.readFile.mockResolvedValue(existingContent);
            mockFileUtils.writeFile.mockResolvedValue();

            await documentUpdateEngine.applySectionUpdates(documentPath, updates);

            expect(mockFileUtils.writeFile).toHaveBeenCalledWith(
                documentPath,
                expect.stringContaining('Updated problem statement content')
            );
        });

        it('should create new document when file does not exist', async () => {
            const documentPath = '/path/to/new-document.md';
            const updates = {
                'Problem Statement': {
                    content: 'New problem statement',
                    mode: 'replace' as const,
                    priority: 1
                }
            };

            mockFileUtils.readFile.mockRejectedValue(new Error('File not found'));
            mockFileUtils.writeFile.mockResolvedValue();

            await documentUpdateEngine.applySectionUpdates(documentPath, updates);

            expect(mockFileUtils.writeFile).toHaveBeenCalledWith(
                documentPath,
                expect.stringContaining('New problem statement')
            );
        });

        it('should handle multiple section updates in priority order', async () => {
            const documentPath = '/path/to/document.md';
            const existingContent = '# Document Title\n\n';
            const updates = {
                'Target Users': {
                    content: 'Target user content',
                    mode: 'replace' as const,
                    priority: 2
                },
                'Problem Statement': {
                    content: 'Problem statement content',
                    mode: 'replace' as const,
                    priority: 1
                }
            };

            mockFileUtils.readFile.mockResolvedValue(existingContent);
            mockFileUtils.writeFile.mockResolvedValue();

            await documentUpdateEngine.applySectionUpdates(documentPath, updates);

            // Should be called with content that has Problem Statement before Target Users
            const writeCall = mockFileUtils.writeFile.mock.calls[0];
            const writtenContent = writeCall[1] as string;
            const problemIndex = writtenContent.indexOf('Problem statement content');
            const targetIndex = writtenContent.indexOf('Target user content');
            
            expect(problemIndex).toBeLessThan(targetIndex);
        });
    });

    describe('getUpdateProgress', () => {
        it('should return progress for existing document', () => {
            const documentPath = '/path/to/document.md';
            
            // First call should initialize progress
            const initialProgress = documentUpdateEngine.getUpdateProgress(documentPath);
            expect(initialProgress.documentPath).toBe(documentPath);
            expect(initialProgress.progressPercentage).toBe(0);
            expect(initialProgress.completedSections).toBe(0);

            // Second call should return same progress
            const secondProgress = documentUpdateEngine.getUpdateProgress(documentPath);
            expect(secondProgress).toBe(initialProgress);
        });
    });

    describe('content extraction methods', () => {
        it('should extract problem statement from content', () => {
            const content = 'The main problem we face is that users cannot easily find pricing information for trading cards.';
            const extracted = (documentUpdateEngine as any).extractContentByKeywords(content, ['problem', 'issue']);
            
            expect(extracted).toContain('problem we face');
            expect(extracted).toContain('pricing information');
        });

        it('should extract target users from content', () => {
            const content = 'Our target users are card game enthusiasts and collectors who need reliable pricing data.';
            const extracted = (documentUpdateEngine as any).extractContentByKeywords(content, ['users', 'target']);
            
            expect(extracted).toContain('target users');
            expect(extracted).toContain('card game enthusiasts');
        });

        it('should return empty string when no relevant keywords found', () => {
            const content = 'This is completely unrelated content about cooking recipes.';
            const extracted = (documentUpdateEngine as any).extractContentByKeywords(content, ['problem', 'users']);
            
            expect(extracted).toBe('');
        });
    });

    describe('content formatting', () => {
        it('should format content as requirements list', () => {
            const content = 'System must support authentication\nSystem must handle real-time updates\nSystem must be scalable';
            const formatted = (documentUpdateEngine as any).formatAsRequirementsList(content);
            
            expect(formatted).toContain('- System must support authentication');
            expect(formatted).toContain('- System must handle real-time updates');
            expect(formatted).toContain('- System must be scalable');
        });

        it('should format content as features list', () => {
            const content = 'User Authentication\nPrice Tracking\nInventory Management';
            const formatted = (documentUpdateEngine as any).formatAsFeaturesList(content);
            
            expect(formatted).toContain('### User Authentication');
            expect(formatted).toContain('### Price Tracking');
            expect(formatted).toContain('### Inventory Management');
        });
    });

    describe('section update modes', () => {
        it('should use replace mode for first conversation turn', () => {
            const conversationContext = createMockConversationContext();
            conversationContext.currentTurn = 1;
            
            const mode = (documentUpdateEngine as any).determineUpdateMode('Problem Statement', conversationContext);
            expect(mode).toBe('replace');
        });

        it('should use append mode for subsequent turns', () => {
            const conversationContext = createMockConversationContext();
            conversationContext.currentTurn = 3;
            
            const mode = (documentUpdateEngine as any).determineUpdateMode('Problem Statement', conversationContext);
            expect(mode).toBe('append');
        });
    });
});