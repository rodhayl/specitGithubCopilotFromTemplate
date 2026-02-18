import * as path from 'path';
import { FileUtils } from '../../src/utils/FileUtils';

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    }
}));

// Mock StringUtils
jest.mock('../../src/utils/StringUtils', () => ({
    StringUtils: {
        sanitizeForFilename: jest.fn((input: string) => {
            return input.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        })
    }
}));

describe('FileUtils', () => {
    describe('generateSafeFilePath', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('with customPath', () => {
            it('should generate correct path with customPath and title', () => {
                const result = FileUtils.generateSafeFilePath(
                    'CardCraft Online Store PRD',
                    'basic',
                    'docs/01-prd/',
                    '/test/workspace'
                );

                // Normalize path separators for cross-platform testing
                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/01-prd/cardcraft-online-store-prd.md');
            });

            it('should handle customPath without trailing slash', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My Document',
                    'basic',
                    'docs/custom',
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/custom/my-document.md');
            });

            it('should sanitize title in customPath', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My Document! @#$%^&*()',
                    'basic',
                    'docs/test/',
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/test/my-document.md');
            });

            it('should handle relative customPath', () => {
                const result = FileUtils.generateSafeFilePath(
                    'Test Doc',
                    'basic',
                    'custom/path',
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/custom/path/test-doc.md');
            });
        });

        describe('without customPath', () => {
            it('should generate PRD path for prd template', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My PRD Document',
                    'prd',
                    undefined,
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/prd/my-prd-document.md');
            });

            it('should generate requirements path for requirements template', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My Requirements',
                    'requirements',
                    undefined,
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/requirements/my-requirements.md');
            });

            it('should generate design path for design template', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My Design Doc',
                    'design',
                    undefined,
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/design/my-design-doc.md');
            });

            it('should generate specification path for specification template', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My Spec',
                    'specification',
                    undefined,
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/specs/my-spec.md');
            });

            it('should generate basic docs path for unknown template', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My Document',
                    'unknown',
                    undefined,
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/my-document.md');
            });

            it('should sanitize filename for basic template', () => {
                const result = FileUtils.generateSafeFilePath(
                    'My Document! @#$%^&*()',
                    'basic',
                    undefined,
                    '/test/workspace'
                );

                const normalizedResult = result.replace(/\\/g, '/');
                expect(normalizedResult).toBe('/test/workspace/docs/my-document.md');
            });
        });
    });
});