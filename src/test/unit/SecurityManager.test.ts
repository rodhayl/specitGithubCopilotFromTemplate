// Unit tests for SecurityManager
import * as assert from 'assert';
import * as path from 'path';
import { SecurityManager } from '../../security/SecurityManager';
import { TestUtilities } from '../utils/TestUtilities';

suite('SecurityManager Unit Tests', () => {
    let securityManager: SecurityManager;
    const mockData = TestUtilities.createMockData();

    setup(TestUtilities.createSuiteSetup(() => {
        securityManager = new SecurityManager(mockData.workspaceRoot);
    }));

    teardown(TestUtilities.createSuiteTeardown());

    test('Should validate paths within workspace', () => {
        const validPaths = [
            'document.md',
            'docs/readme.md',
            'src/test.txt',
            './relative/path.md'
        ];

        for (const validPath of validPaths) {
            const result = securityManager.validateWorkspacePath(validPath);
            assert.strictEqual(result.valid, true, `Path should be valid: ${validPath}`);
        }
    });

    test('Should reject paths outside workspace', () => {
        const invalidPaths = [
            '../outside.md',
            '../../etc/passwd',
            '/absolute/path.md',
            'docs/../../../outside.md'
        ];

        for (const invalidPath of invalidPaths) {
            const result = securityManager.validateWorkspacePath(invalidPath);
            assert.strictEqual(result.valid, false, `Path should be invalid: ${invalidPath}`);
            assert.ok(result.error, `Should have error message for: ${invalidPath}`);
        }
    });

    test('Should reject blocked directories', () => {
        const blockedPaths = [
            'node_modules/package.json',
            '.git/config',
            '.vscode/settings.json',
            'dist/output.js',
            'build/artifact.txt'
        ];

        for (const blockedPath of blockedPaths) {
            const result = securityManager.validateWorkspacePath(blockedPath);
            assert.strictEqual(result.valid, false, `Blocked path should be invalid: ${blockedPath}`);
            assert.ok(result.error?.includes('not allowed'), `Should mention not allowed: ${blockedPath}`);
        }
    });

    test('Should validate file extensions', () => {
        const validExtensions = [
            'document.md',
            'notes.txt',
            'config.json',
            'template.yaml',
            'data.yml'
        ];

        const invalidExtensions = [
            'script.js',
            'executable.exe',
            'binary.bin',
            'image.png'
        ];

        for (const validExt of validExtensions) {
            const result = securityManager.validateWorkspacePath(validExt);
            assert.strictEqual(result.valid, true, `Valid extension should pass: ${validExt}`);
        }

        for (const invalidExt of invalidExtensions) {
            const result = securityManager.validateWorkspacePath(invalidExt);
            assert.strictEqual(result.valid, false, `Invalid extension should fail: ${invalidExt}`);
            assert.ok(result.error?.includes('not allowed'), `Should mention extension not allowed: ${invalidExt}`);
        }
    });

    test('Should sanitize user input', () => {
        const testCases = [
            {
                input: 'Normal text content',
                expected: 'Normal text content'
            },
            {
                input: '<script>alert("xss")</script>',
                expected: 'alert("xss")'
            },
            {
                input: 'javascript:void(0)',
                expected: 'void(0)'
            },
            {
                input: 'data:text/html,<h1>Test</h1>',
                expected: 'text/html,Test'
            },
            {
                input: 'onclick="malicious()" onload="bad()"',
                expected: ''
            },
            {
                input: '  Content with spaces  ',
                expected: 'Content with spaces'
            },
            {
                input: '<div>Content</div>',
                expected: 'Content'
            },
            {
                input: '<p onclick="alert()">Safe content</p>',
                expected: 'Safe content'
            },
            {
                input: 'Text with <b>bold</b> and <i>italic</i>',
                expected: 'Text with bold and italic'
            }
        ];

        for (const testCase of testCases) {
            const result = securityManager.sanitizeInput(testCase.input);
            assert.strictEqual(result, testCase.expected, 
                `Input: "${testCase.input}" should become: "${testCase.expected}"`);
        }
    });

    test('Should handle non-string input in sanitization', () => {
        const nonStringInputs = [
            null,
            undefined,
            123,
            true,
            {},
            []
        ];

        for (const input of nonStringInputs) {
            const result = securityManager.sanitizeInput(input as any);
            assert.strictEqual(result, '', `Non-string input should return empty string: ${input}`);
        }
    });

    test('Should provide security recommendations', () => {
        const recommendations = securityManager.getSecurityRecommendations();
        
        assert.ok(Array.isArray(recommendations), 'Should return array of recommendations');
        assert.ok(recommendations.length > 0, 'Should have at least one recommendation');
        
        // Check for key security recommendations
        const recommendationText = recommendations.join(' ').toLowerCase();
        assert.ok(recommendationText.includes('review'), 'Should recommend reviewing content');
        assert.ok(recommendationText.includes('version control') || recommendationText.includes('git'), 
            'Should recommend version control');
        assert.ok(recommendationText.includes('backup'), 'Should recommend backups');
    });

    test('Should handle path normalization edge cases', () => {
        const edgeCases = [
            '',
            '.',
            './',
            'normal/../path',
            'path/./file.md',
            'path//double//slash.md'
        ];

        for (const edgeCase of edgeCases) {
            const result = securityManager.validateWorkspacePath(edgeCase);
            // Should not throw errors, should handle gracefully
            assert.ok(typeof result.valid === 'boolean', `Should return boolean for: ${edgeCase}`);
        }
    });
});