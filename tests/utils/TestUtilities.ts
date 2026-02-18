// Comprehensive test utilities and helpers
import * as vscode from 'vscode';
import { VSCodeAPIMocks } from '../mocks/VSCodeAPIMocks';
import { TestTimeoutManager } from './TestTimeoutManager';
import { ErrorHandler } from '../../src/error/ErrorHandler';
import { TestDebugger } from './TestDebugger';

export class TestUtilities {
    private static setupComplete = false;

    /**
     * Complete test environment setup
     */
    static setupTestEnvironment(): void {
        if (this.setupComplete) {
            return;
        }

        // Set test environment variables
        process.env.NODE_ENV = 'test';
        
        // Setup VS Code API mocks
        VSCodeAPIMocks.setupMocks();
        
        // Reset timeout manager
        TestTimeoutManager.resetTimeouts();
        
        // Reset error handler
        ErrorHandler.getInstance().clearHistory();
        
        this.setupComplete = true;
        console.log('[TEST] Test environment setup complete');
    }

    /**
     * Clean up test environment
     */
    static teardownTestEnvironment(): void {
        if (!this.setupComplete) {
            return;
        }

        // Restore VS Code API mocks
        VSCodeAPIMocks.restoreMocks();
        
        // Reset timeout manager
        TestTimeoutManager.resetTimeouts();
        
        // Clear error handler
        ErrorHandler.getInstance().clearHistory();
        
        this.setupComplete = false;
        console.log('[TEST] Test environment teardown complete');
    }

    /**
     * Create mock data for testing
     */
    static createMockData() {
        return {
            workspaceRoot: '/mock/workspace',
            extensionPath: '/mock/extension',
            templateId: 'test-template',
            agentName: 'test-agent',
            fileName: 'test-document.md',
            content: '# Test Document\n\nThis is test content.',
            variables: {
                title: 'Test Title',
                content: 'Test Content',
                author: 'Test Author'
            }
        };
    }

    /**
     * Create test file content with front matter
     */
    static createTestFileContent(title: string, content: string, metadata?: Record<string, any>): string {
        const frontMatter = {
            title,
            created: new Date().toISOString(),
            ...metadata
        };

        const yamlFrontMatter = Object.entries(frontMatter)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n');

        return `---\n${yamlFrontMatter}\n---\n\n${content}`;
    }

    /**
     * Wait for async operations to complete
     */
    static async waitForAsyncOperations(ms: number = 100): Promise<void> {
        return TestTimeoutManager.wait(ms);
    }

    /**
     * Execute function with comprehensive error handling
     */
    static async executeWithErrorHandling<T>(
        fn: () => Promise<T>,
        operation: string,
        maxRetries: number = 1
    ): Promise<{ success: boolean; result?: T; error?: Error }> {
        try {
            const result = await TestTimeoutManager.executeWithRetry(fn, operation, maxRetries);
            return { success: true, result };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error : new Error('Unknown error') 
            };
        }
    }

    /**
     * Assert that async operation completes within timeout
     */
    static async assertAsyncCompletion<T>(
        promise: Promise<T>,
        operation: string,
        expectedResult?: (result: T) => boolean
    ): Promise<T> {
        const result = await TestTimeoutManager.wrapWithTimeout(promise, operation);
        
        if (expectedResult && !expectedResult(result)) {
            throw new Error(`Async operation ${operation} completed but result validation failed`);
        }
        
        return result;
    }

    /**
     * Create test suite setup function
     */
    static createSuiteSetup(additionalSetup?: () => void | Promise<void>) {
        return async () => {
            this.setupTestEnvironment();
            if (additionalSetup) {
                await additionalSetup();
            }
        };
    }

    /**
     * Create test suite teardown function
     */
    static createSuiteTeardown(additionalTeardown?: () => void | Promise<void>) {
        return async () => {
            if (additionalTeardown) {
                await additionalTeardown();
            }
            this.teardownTestEnvironment();
        };
    }

    /**
     * Create test case wrapper with timeout and error handling
     */
    static createTestCase<T>(
        testFn: () => Promise<T>,
        operation: string = 'test-case',
        timeout?: number
    ) {
        return async () => {
            if (timeout) {
                TestTimeoutManager.setCustomTimeout(operation, timeout);
            }
            
            try {
                return await TestTimeoutManager.wrapWithTimeout(testFn(), operation);
            } finally {
                if (timeout) {
                    TestTimeoutManager.resetTimeouts();
                }
            }
        };
    }

    /**
     * Validate test result structure
     */
    static validateTestResult(result: any, expectedProperties: string[]): boolean {
        if (!result || typeof result !== 'object') {
            return false;
        }

        return expectedProperties.every(prop => prop in result);
    }

    /**
     * Create mock error for testing
     */
    static createMockError(type: 'file' | 'permission' | 'network' | 'model' | 'workspace' | 'template' | 'generic'): Error {
        const errorMessages = {
            file: 'ENOENT: no such file or directory',
            permission: 'EACCES: permission denied',
            network: 'Network timeout occurred',
            model: 'Language model not available',
            workspace: 'No workspace folder is open',
            template: 'Template not found',
            generic: 'Something unexpected happened'
        };

        return new Error(errorMessages[type]);
    }

    /**
     * Log test progress
     */
    static logTestProgress(message: string, data?: any): void {
        console.log(`[TEST] ${message}${data ? `: ${JSON.stringify(data)}` : ''}`);
    }

    /**
     * Measure test execution time
     */
    static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;
        
        return { result, duration };
    }

    /**
     * Create test data generator
     */
    static createTestDataGenerator() {
        let counter = 0;
        
        return {
            nextId: () => `test-${++counter}`,
            nextTitle: () => `Test Title ${++counter}`,
            nextContent: () => `Test content for item ${counter}`,
            nextFilePath: () => `test-file-${counter}.md`,
            reset: () => { counter = 0; }
        };
    }

    /**
     * Validate VS Code API mock state
     */
    static validateMockState(): boolean {
        try {
            // Check if mocks are properly set up
            const mockContext = VSCodeAPIMocks.createMockExtensionContext();
            const mockToolContext = VSCodeAPIMocks.createMockToolContext();
            const mockCommandContext = VSCodeAPIMocks.createMockCommandContext();
            
            return !!(mockContext && mockToolContext && mockCommandContext);
        } catch (error) {
            console.error('[TEST] Mock state validation failed:', error);
            return false;
        }
    }
}