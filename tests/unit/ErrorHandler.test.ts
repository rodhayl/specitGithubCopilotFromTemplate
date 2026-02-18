// Unit tests for ErrorHandler
import * as assert from 'assert';
import { ErrorHandler, ErrorContext } from '../../src/error/ErrorHandler';
import { TestUtilities } from '../utils/TestUtilities';
import { TestTimeoutManager } from '../utils/TestTimeoutManager';

describe('ErrorHandler Unit Tests', () => {
    let errorHandler: ErrorHandler;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        errorHandler = ErrorHandler.getInstance();
        errorHandler.clearHistory(); // Clear history before each test
        
        // Mock console.error to prevent test failures
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore console.error after each test
        consoleErrorSpy.mockRestore();
    });

    afterAll(() => {
        // Cleanup after tests
    });

    test('Should be singleton', () => {
        const instance1 = ErrorHandler.getInstance();
        const instance2 = ErrorHandler.getInstance();
        assert.strictEqual(instance1, instance2, 'Should return same instance');
    });

    test('Should categorize file not found errors', async () => {
        const error = new Error('ENOENT: no such file or directory');
        const context: ErrorContext = {
            operation: 'readFile',
            filePath: 'missing.md',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.strictEqual(report.severity, 'medium');
        assert.ok(report.userMessage.includes('File not found'));
        assert.ok(report.recoveryOptions.length > 0);
        assert.ok(report.recoveryOptions.some(opt => opt.label.includes('Create')));
    });

    test('Should categorize permission errors', async () => {
        const error = new Error('EACCES: permission denied');
        const context: ErrorContext = {
            operation: 'writeFile',
            filePath: 'protected.md',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.strictEqual(report.severity, 'high');
        assert.ok(report.userMessage.includes('Permission denied'));
        assert.ok(report.recoveryOptions.some(opt => opt.label.includes('Permission')));
    });

    test('Should categorize network errors', async () => {
        const error = new Error('Network timeout occurred');
        const context: ErrorContext = {
            operation: 'llm-request',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.strictEqual(report.severity, 'medium');
        assert.ok(report.userMessage.includes('Network error'));
        assert.ok(report.recoveryOptions.some(opt => opt.label.includes('Retry')));
    });

    test('Should categorize model errors', async () => {
        const error = new Error('Language model not available');
        const context: ErrorContext = {
            operation: 'agent-request',
            agentName: 'prd-creator',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.strictEqual(report.severity, 'high');
        assert.ok(report.userMessage.includes('Language model'));
        assert.ok(report.recoveryOptions.some(opt => opt.label.includes('Copilot')));
    });

    test('Should categorize workspace errors', async () => {
        const error = new Error('No workspace folder is open');
        const context: ErrorContext = {
            operation: 'file-operation',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.strictEqual(report.severity, 'critical');
        assert.ok(report.userMessage.includes('Workspace error'));
        assert.ok(report.recoveryOptions.some(opt => opt.label.includes('Workspace')));
    });

    test('Should categorize template errors', async () => {
        const error = new Error('Template not found');
        const context: ErrorContext = {
            operation: 'apply-template',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.strictEqual(report.severity, 'low');
        assert.ok(report.userMessage.includes('Template error'));
        assert.ok(report.recoveryOptions.some(opt => opt.label.includes('Template')));
    });

    test('Should handle generic errors', async () => {
        const error = new Error('Something unexpected happened');
        const context: ErrorContext = {
            operation: 'unknown-operation',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.strictEqual(report.severity, 'medium');
        assert.ok(report.userMessage.includes('unexpected error'));
        assert.ok(report.recoveryOptions.some(opt => opt.label.includes('Retry')));
    });

    test('Should maintain error history', async () => {
        const errors = [
            new Error('First error'),
            new Error('Second error'),
            new Error('Third error')
        ];

        for (let i = 0; i < errors.length; i++) {
            await TestTimeoutManager.wrapWithTimeout(
                errorHandler.handleError(errors[i], {
                    operation: `operation-${i}`,
                    timestamp: new Date()
                }),
                'error-handling'
            );
        }

        const stats = errorHandler.getErrorStatistics();
        assert.strictEqual(stats.totalErrors, 3);
        assert.strictEqual(stats.recentErrors.length, 3);
    });

    test('Should provide error statistics', async () => {
        // Add errors of different severities
        await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(new Error('ENOENT: file not found'), {
                operation: 'readFile',
                timestamp: new Date()
            }),
            'error-handling'
        );

        await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(new Error('EACCES: permission denied'), {
                operation: 'writeFile',
                timestamp: new Date()
            }),
            'error-handling'
        );

        const stats = errorHandler.getErrorStatistics();
        
        assert.ok(stats.totalErrors >= 2);
        assert.ok(stats.errorsBySeverity.medium >= 1);
        assert.ok(stats.errorsBySeverity.high >= 1);
        assert.ok(stats.errorsByOperation.readFile >= 1);
        assert.ok(stats.errorsByOperation.writeFile >= 1);
    });

    test('Should clear error history', async () => {
        await errorHandler.handleError(new Error('Test error'), {
            operation: 'test',
            timestamp: new Date()
        });

        let stats = errorHandler.getErrorStatistics();
        assert.ok(stats.totalErrors > 0);

        errorHandler.clearHistory();
        stats = errorHandler.getErrorStatistics();
        assert.strictEqual(stats.totalErrors, 0);
    });

    test('Should limit error history size', async () => {
        // Add more than the maximum history size (100)
        for (let i = 0; i < 105; i++) {
            await TestTimeoutManager.wrapWithTimeout(
                errorHandler.handleError(new Error(`Error ${i}`), {
                    operation: `operation-${i}`,
                    timestamp: new Date()
                }),
                'error-handling'
            );
        }

        const stats = errorHandler.getErrorStatistics();
        assert.ok(stats.totalErrors <= 100, 'Should not exceed maximum history size');
    });

    test('Should provide technical details', async () => {
        const error = new Error('Test error with stack trace');
        const context: ErrorContext = {
            operation: 'test-operation',
            filePath: 'test.md',
            timestamp: new Date()
        };

        const report = await TestTimeoutManager.wrapWithTimeout(
            errorHandler.handleError(error, context),
            'error-handling'
        );

        assert.ok(report.technicalDetails.includes('test-operation'));
        assert.ok(report.technicalDetails.includes('test.md'));
        assert.ok(report.technicalDetails.includes('Test error'));
    });
});