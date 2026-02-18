// ContentCapture unit tests
import { ContentCapture } from '../../src/conversation/ContentCapture';
import { DocumentUpdate, ConversationData } from '../../src/conversation/types';
import * as vscode from 'vscode';
import MockHelper from '../utils/mockHelpers';

// VSCode is mocked globally in setup.ts

describe('ContentCapture', () => {
    let contentCapture: ContentCapture;

    beforeEach(() => {
        contentCapture = new ContentCapture();
        MockHelper.resetAllMocks();
        MockHelper.setupCommonMocks();
    });

    describe('updateDocument', () => {
        it('should update existing document sections', async () => {
            const existingContent = `# Test Document

## Introduction
This is the introduction.

## Requirements
Existing requirements content.
`;

            // Create a proper mock document
            const mockDocument = {
                getText: jest.fn().mockReturnValue(existingContent),
                uri: { fsPath: '/test/document.md' },
                positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
                lineAt: jest.fn().mockReturnValue({ text: '' }),
                lineCount: existingContent.split('\n').length
            };

            // Mock openTextDocument to return our mock document
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
            (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

            const updates: DocumentUpdate[] = [
                {
                    section: 'Requirements',
                    content: 'Updated requirements content.',
                    updateType: 'replace',
                    timestamp: new Date(),
                    confidence: 0.9
                }
            ];

            const result = await contentCapture.updateDocument('/test/document.md', updates);

            expect(result.success).toBe(true);
            expect(result.updatedSections).toContain('Requirements');
            expect(result.errors).toHaveLength(0);
        });

        it('should append content to existing sections', async () => {
            const existingContent = `# Test Document

## Requirements
Existing requirements.
`;

            // Create a proper mock document
            const mockDocument = {
                getText: jest.fn().mockReturnValue(existingContent),
                uri: { fsPath: '/test/document.md' },
                positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
                lineAt: jest.fn().mockReturnValue({ text: '' }),
                lineCount: existingContent.split('\n').length
            };

            // Mock openTextDocument to return our mock document
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
            (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

            const updates: DocumentUpdate[] = [
                {
                    section: 'Requirements',
                    content: 'Additional requirement.',
                    updateType: 'append',
                    timestamp: new Date(),
                    confidence: 0.8
                }
            ];

            const result = await contentCapture.updateDocument('/test/document.md', updates);

            expect(result.success).toBe(true);
            expect(result.updatedSections).toContain('Requirements');
        });

        it('should create new sections when they don\'t exist', async () => {
            const existingContent = `# Test Document

## Introduction
This is the introduction.
`;

            // Create a proper mock document
            const mockDocument = {
                getText: jest.fn().mockReturnValue(existingContent),
                uri: { fsPath: '/test/document.md' },
                positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
                lineAt: jest.fn().mockReturnValue({ text: '' }),
                lineCount: existingContent.split('\n').length
            };

            // Mock openTextDocument to return our mock document
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
            (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

            const updates: DocumentUpdate[] = [
                {
                    section: 'New Section',
                    content: 'New section content.',
                    updateType: 'replace',
                    timestamp: new Date(),
                    confidence: 0.9
                }
            ];

            const result = await contentCapture.updateDocument('/test/document.md', updates);

            expect(result.success).toBe(true);
            expect(result.updatedSections).toContain('New Section');
        });

        it('should handle document creation when file doesn\'t exist', async () => {
            (vscode.workspace.openTextDocument as jest.Mock)
                .mockRejectedValueOnce(new Error('File not found'))
                .mockResolvedValueOnce(MockHelper.createMockTextDocument(''));
            
            (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

            const updates: DocumentUpdate[] = [
                {
                    section: 'Introduction',
                    content: 'New document content.',
                    updateType: 'replace',
                    timestamp: new Date(),
                    confidence: 0.9
                }
            ];

            const result = await contentCapture.updateDocument('/test/new-document.md', updates);

            expect(result.success).toBe(true);
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        });

        it('should handle multiple updates in sequence', async () => {
            const existingContent = `# Test Document

## Section 1
Content 1.

## Section 2
Content 2.
`;

            // Create a proper mock document
            const mockDocument = {
                getText: jest.fn().mockReturnValue(existingContent),
                uri: { fsPath: '/test/document.md' },
                positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
                lineAt: jest.fn().mockReturnValue({ text: '' }),
                lineCount: existingContent.split('\n').length
            };

            // Mock openTextDocument to return our mock document
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
            (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

            const updates: DocumentUpdate[] = [
                {
                    section: 'Section 1',
                    content: 'Updated content 1.',
                    updateType: 'replace',
                    timestamp: new Date(),
                    confidence: 0.9
                },
                {
                    section: 'Section 2',
                    content: 'Updated content 2.',
                    updateType: 'replace',
                    timestamp: new Date(),
                    confidence: 0.8
                }
            ];

            const result = await contentCapture.updateDocument('/test/document.md', updates);

            expect(result.success).toBe(true);
            expect(result.updatedSections).toHaveLength(2);
            expect(result.updatedSections).toContain('Section 1');
            expect(result.updatedSections).toContain('Section 2');
        });

        it('should track changes and generate summary', async () => {
            const existingContent = `# Test Document

## Introduction
Old content.
`;

            // Create a proper mock document
            const mockDocument = {
                getText: jest.fn().mockReturnValue(existingContent),
                uri: { fsPath: '/test/document.md' },
                positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
                lineAt: jest.fn().mockReturnValue({ text: '' }),
                lineCount: existingContent.split('\n').length
            };

            // Mock openTextDocument to return our mock document
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
            (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

            const updates: DocumentUpdate[] = [
                {
                    section: 'Introduction',
                    content: 'New content.',
                    updateType: 'replace',
                    timestamp: new Date(),
                    confidence: 0.9
                }
            ];

            const result = await contentCapture.updateDocument('/test/document.md', updates);

            expect(result.changesSummary).toBeDefined();
            expect(result.changesSummary).toContain('modified');
        });
    });

    describe('generateDocumentSection', () => {
        it('should generate section using templates', () => {
            const conversationData: ConversationData = {
                sessionId: 'test-session',
                agentName: 'prd-creator',
                responses: new Map([
                    ['q1', 'This product helps users manage their tasks efficiently'],
                    ['q2', 'Primary users are project managers and team leads']
                ]),
                extractedData: new Map([
                    ['summary', 'Task management solution for teams'],
                    ['primary_user_who', 'Project managers and team leads']
                ]),
                metadata: {}
            };

            const section = contentCapture.generateDocumentSection('Executive Summary', conversationData);

            expect(section).toBeDefined();
            expect(section.length).toBeGreaterThan(0);
            expect(section).toContain('Task management solution for teams');
        });

        it('should generate generic section when no template exists', () => {
            const conversationData: ConversationData = {
                sessionId: 'test-session',
                agentName: 'test-agent',
                responses: new Map([
                    ['q1', 'This is relevant to custom section content'],
                    ['q2', 'This is not relevant']
                ]),
                extractedData: new Map(),
                metadata: {}
            };

            const section = contentCapture.generateDocumentSection('Custom Section', conversationData);

            expect(section).toBeDefined();
            expect(section.length).toBeGreaterThan(0);
        });

        it('should handle empty conversation data', () => {
            const conversationData: ConversationData = {
                sessionId: 'test-session',
                agentName: 'test-agent',
                responses: new Map(),
                extractedData: new Map(),
                metadata: {}
            };

            const section = contentCapture.generateDocumentSection('Test Section', conversationData);

            expect(section).toBeDefined();
            expect(section).toContain('will be added based on conversation');
        });
    });

    describe('validateDocumentStructure', () => {
        it('should validate document structure', () => {
            const result = contentCapture.validateDocumentStructure('/test/document.md');

            expect(result).toBeDefined();
            expect(result.valid).toBeDefined();
            expect(result.errors).toBeDefined();
            expect(result.warnings).toBeDefined();
            expect(result.score).toBeDefined();
        });
    });

    describe('getDocumentSections', () => {
        it('should extract sections from document', async () => {
            const content = `# Main Title

## Introduction
Content here.

### Subsection
More content.

## Requirements
Requirements content.

## Conclusion
Final thoughts.
`;

            // Create a proper mock document
            const mockDocument = {
                getText: jest.fn().mockReturnValue(content),
                uri: { fsPath: '/test/document.md' },
                positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
                lineAt: jest.fn().mockReturnValue({ text: '' }),
                lineCount: content.split('\n').length
            };

            // Mock openTextDocument to return our mock document
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);

            const sections = await contentCapture.getDocumentSections('/test/document.md');

            expect(sections).toContain('Introduction');
            expect(sections).toContain('Subsection');
            expect(sections).toContain('Requirements');
            expect(sections).toContain('Conclusion');
        });

        it('should handle documents without sections', async () => {
            const content = 'This is a document without any headers.';
            MockHelper.mockDocumentContent('/test/document.md', content);

            const sections = await contentCapture.getDocumentSections('/test/document.md');

            expect(sections).toHaveLength(0);
        });

        it('should handle file read errors', async () => {
            (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error('File not found'));

            const sections = await contentCapture.getDocumentSections('/test/nonexistent.md');

            expect(sections).toHaveLength(0);
        });
    });

    describe('extractExistingContent', () => {
        it('should extract content from specific section', async () => {
            const content = `# Document

## Introduction
This is the introduction content.
It has multiple lines.

## Requirements
This is requirements content.
`;

            // Create a proper mock document
            const mockDocument = {
                getText: jest.fn().mockReturnValue(content),
                uri: { fsPath: '/test/document.md' },
                positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
                lineAt: jest.fn().mockReturnValue({ text: '' }),
                lineCount: content.split('\n').length
            };

            // Mock openTextDocument to return our mock document
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);

            const sectionContent = await contentCapture.extractExistingContent('/test/document.md', 'Introduction');

            expect(sectionContent).toContain('This is the introduction content');
            expect(sectionContent).toContain('It has multiple lines');
            expect(sectionContent).not.toContain('## Introduction');
        });

        it('should return empty string for non-existent section', async () => {
            const content = `# Document

## Introduction
Content here.
`;

            MockHelper.mockDocumentContent('/test/document.md', content);

            const sectionContent = await contentCapture.extractExistingContent('/test/document.md', 'Non-existent');

            expect(sectionContent).toBe('');
        });

        it('should handle file read errors', async () => {
            (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error('File not found'));

            const sectionContent = await contentCapture.extractExistingContent('/test/nonexistent.md', 'Introduction');

            expect(sectionContent).toBe('');
        });
    });

    describe('trackChanges', () => {
        it('should track document changes', () => {
            const changes = [
                {
                    section: 'Introduction',
                    oldContent: 'Old content',
                    newContent: 'New content',
                    changeType: 'modification' as const,
                    timestamp: new Date(),
                    source: 'conversation'
                }
            ];

            // Should not throw
            expect(() => {
                contentCapture.trackChanges('/test/document.md', changes);
            }).not.toThrow();
        });

        it('should limit change history', () => {
            const changes = Array.from({ length: 150 }, (_, i) => ({
                section: `Section ${i}`,
                oldContent: `Old content ${i}`,
                newContent: `New content ${i}`,
                changeType: 'modification' as const,
                timestamp: new Date(),
                source: 'conversation'
            }));

            // Should not throw and should handle large number of changes
            expect(() => {
                contentCapture.trackChanges('/test/document.md', changes);
            }).not.toThrow();
        });
    });
});