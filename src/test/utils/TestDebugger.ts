// Enhanced error reporting and debugging support for tests
export class TestDebugger {
    private static logs: Array<{
        timestamp: Date;
        level: 'info' | 'warn' | 'error' | 'debug';
        message: string;
        data?: any;
        stack?: string;
    }> = [];

    private static isDebugMode = process.env.TEST_DEBUG === 'true' || process.env.NODE_ENV === 'test';

    /**
     * Log test information
     */
    static info(message: string, data?: any): void {
        this.log('info', message, data);
    }

    /**
     * Log test warning
     */
    static warn(message: string, data?: any): void {
        this.log('warn', message, data);
    }

    /**
     * Log test error
     */
    static error(message: string, error?: Error | any): void {
        const stack = error instanceof Error ? error.stack : undefined;
        this.log('error', message, error, stack);
    }

    /**
     * Log debug information
     */
    static debug(message: string, data?: any): void {
        if (this.isDebugMode) {
            this.log('debug', message, data);
        }
    }

    /**
     * Internal logging method
     */
    private static log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any, stack?: string): void {
        const logEntry = {
            timestamp: new Date(),
            level,
            message,
            data,
            stack
        };

        this.logs.push(logEntry);

        // Console output for immediate feedback
        const prefix = `[TEST-${level.toUpperCase()}]`;
        const timestamp = logEntry.timestamp.toISOString();
        
        if (level === 'error') {
            console.error(`${prefix} ${timestamp}: ${message}`, data || '');
            if (stack) {
                console.error('Stack trace:', stack);
            }
        } else if (level === 'warn') {
            console.warn(`${prefix} ${timestamp}: ${message}`, data || '');
        } else if (level === 'debug' && this.isDebugMode) {
            console.log(`${prefix} ${timestamp}: ${message}`, data || '');
        } else {
            console.log(`${prefix} ${timestamp}: ${message}`, data || '');
        }

        // Limit log size to prevent memory issues
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-500);
        }
    }

    /**
     * Get all logs
     */
    static getLogs(): typeof TestDebugger.logs {
        return [...this.logs];
    }

    /**
     * Get logs by level
     */
    static getLogsByLevel(level: 'info' | 'warn' | 'error' | 'debug'): typeof TestDebugger.logs {
        return this.logs.filter(log => log.level === level);
    }

    /**
     * Get recent logs
     */
    static getRecentLogs(count: number = 50): typeof TestDebugger.logs {
        return this.logs.slice(-count);
    }

    /**
     * Clear all logs
     */
    static clearLogs(): void {
        this.logs = [];
    }

    /**
     * Generate test report
     */
    static generateTestReport(): string {
        const errorCount = this.getLogsByLevel('error').length;
        const warnCount = this.getLogsByLevel('warn').length;
        const infoCount = this.getLogsByLevel('info').length;
        const debugCount = this.getLogsByLevel('debug').length;

        let report = '# Test Execution Report\n\n';
        report += `**Generated:** ${new Date().toISOString()}\n\n`;
        report += `**Summary:**\n`;
        report += `- Errors: ${errorCount}\n`;
        report += `- Warnings: ${warnCount}\n`;
        report += `- Info: ${infoCount}\n`;
        report += `- Debug: ${debugCount}\n\n`;

        if (errorCount > 0) {
            report += '## Errors\n\n';
            this.getLogsByLevel('error').forEach((log, index) => {
                report += `### Error ${index + 1}\n`;
                report += `**Time:** ${log.timestamp.toISOString()}\n`;
                report += `**Message:** ${log.message}\n`;
                if (log.data) {
                    report += `**Data:** \`\`\`json\n${JSON.stringify(log.data, null, 2)}\n\`\`\`\n`;
                }
                if (log.stack) {
                    report += `**Stack:** \`\`\`\n${log.stack}\n\`\`\`\n`;
                }
                report += '\n';
            });
        }

        if (warnCount > 0) {
            report += '## Warnings\n\n';
            this.getLogsByLevel('warn').forEach((log, index) => {
                report += `### Warning ${index + 1}\n`;
                report += `**Time:** ${log.timestamp.toISOString()}\n`;
                report += `**Message:** ${log.message}\n`;
                if (log.data) {
                    report += `**Data:** \`\`\`json\n${JSON.stringify(log.data, null, 2)}\n\`\`\`\n`;
                }
                report += '\n';
            });
        }

        return report;
    }

    /**
     * Track test execution time
     */
    static trackExecution<T>(testName: string, fn: () => Promise<T>): Promise<T> {
        const startTime = Date.now();
        this.info(`Starting test: ${testName}`);

        return fn()
            .then(result => {
                const duration = Date.now() - startTime;
                this.info(`Test completed: ${testName}`, { duration: `${duration}ms` });
                return result;
            })
            .catch(error => {
                const duration = Date.now() - startTime;
                this.error(`Test failed: ${testName}`, { error: error.message, duration: `${duration}ms` });
                throw error;
            });
    }

    /**
     * Create test context with debugging
     */
    static createTestContext(testName: string): {
        log: (message: string, data?: any) => void;
        warn: (message: string, data?: any) => void;
        error: (message: string, error?: any) => void;
        debug: (message: string, data?: any) => void;
        finish: () => void;
    } {
        const contextId = `${testName}-${Date.now()}`;
        this.info(`Test context created: ${contextId}`);

        return {
            log: (message: string, data?: any) => this.info(`[${contextId}] ${message}`, data),
            warn: (message: string, data?: any) => this.warn(`[${contextId}] ${message}`, data),
            error: (message: string, error?: any) => this.error(`[${contextId}] ${message}`, error),
            debug: (message: string, data?: any) => this.debug(`[${contextId}] ${message}`, data),
            finish: () => this.info(`Test context finished: ${contextId}`)
        };
    }

    /**
     * Assert with debugging
     */
    static assert(condition: boolean, message: string, actualValue?: any, expectedValue?: any): void {
        if (!condition) {
            const errorData = {
                actual: actualValue,
                expected: expectedValue,
                message
            };
            this.error('Assertion failed', errorData);
            throw new Error(`Assertion failed: ${message}`);
        } else {
            this.debug('Assertion passed', { message });
        }
    }

    /**
     * Capture async operation details
     */
    static async captureAsyncOperation<T>(
        operationName: string,
        operation: () => Promise<T>
    ): Promise<T> {
        const startTime = Date.now();
        this.debug(`Starting async operation: ${operationName}`);

        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            this.debug(`Async operation completed: ${operationName}`, { duration: `${duration}ms` });
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.error(`Async operation failed: ${operationName}`, {
                error: error instanceof Error ? error.message : error,
                duration: `${duration}ms`
            });
            throw error;
        }
    }

    /**
     * Enable or disable debug mode
     */
    static setDebugMode(enabled: boolean): void {
        this.isDebugMode = enabled;
        this.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get debug mode status
     */
    static isDebugEnabled(): boolean {
        return this.isDebugMode;
    }

    /**
     * Analyze error patterns in logs
     */
    static analyzeErrorPatterns(): {
        commonErrors: Array<{ message: string; count: number; firstSeen: Date; lastSeen: Date }>;
        errorsByType: { [key: string]: number };
        timeDistribution: { [hour: string]: number };
    } {
        const errors = this.getLogsByLevel('error');
        const errorMap = new Map<string, { count: number; firstSeen: Date; lastSeen: Date }>();
        const errorsByType = new Map<string, number>();
        const timeDistribution = new Map<string, number>();

        errors.forEach(error => {
            // Group by message
            const key = error.message;
            if (errorMap.has(key)) {
                const existing = errorMap.get(key)!;
                existing.count++;
                existing.lastSeen = error.timestamp;
            } else {
                errorMap.set(key, {
                    count: 1,
                    firstSeen: error.timestamp,
                    lastSeen: error.timestamp
                });
            }

            // Group by error type (from stack trace)
            if (error.stack) {
                const errorTypeMatch = error.stack.match(/(\w+Error):/);
                const errorType = errorTypeMatch ? errorTypeMatch[1] : 'UnknownError';
                errorsByType.set(errorType, (errorsByType.get(errorType) || 0) + 1);
            }

            // Time distribution
            const hour = error.timestamp.getHours().toString().padStart(2, '0');
            timeDistribution.set(hour, (timeDistribution.get(hour) || 0) + 1);
        });

        return {
            commonErrors: Array.from(errorMap.entries())
                .map(([message, data]) => ({ message, ...data }))
                .sort((a, b) => b.count - a.count),
            errorsByType: Object.fromEntries(errorsByType),
            timeDistribution: Object.fromEntries(timeDistribution)
        };
    }

    /**
     * Monitor performance metrics
     */
    private static performanceMetrics = new Map<string, {
        totalTime: number;
        count: number;
        minTime: number;
        maxTime: number;
        avgTime: number;
    }>();

    /**
     * Record performance metric
     */
    static recordPerformance(operation: string, duration: number): void {
        const existing = this.performanceMetrics.get(operation);
        
        if (existing) {
            existing.totalTime += duration;
            existing.count++;
            existing.minTime = Math.min(existing.minTime, duration);
            existing.maxTime = Math.max(existing.maxTime, duration);
            existing.avgTime = existing.totalTime / existing.count;
        } else {
            this.performanceMetrics.set(operation, {
                totalTime: duration,
                count: 1,
                minTime: duration,
                maxTime: duration,
                avgTime: duration
            });
        }

        this.debug(`Performance recorded: ${operation}`, {
            duration: `${duration}ms`,
            avgTime: `${this.performanceMetrics.get(operation)!.avgTime.toFixed(2)}ms`
        });
    }

    /**
     * Get performance report
     */
    static getPerformanceReport(): {
        operations: Array<{
            name: string;
            totalTime: number;
            count: number;
            minTime: number;
            maxTime: number;
            avgTime: number;
        }>;
        summary: {
            totalOperations: number;
            totalTime: number;
            avgOperationTime: number;
        };
    } {
        const operations = Array.from(this.performanceMetrics.entries())
            .map(([name, metrics]) => ({ name, ...metrics }))
            .sort((a, b) => b.totalTime - a.totalTime);

        const totalOperations = operations.reduce((sum, op) => sum + op.count, 0);
        const totalTime = operations.reduce((sum, op) => sum + op.totalTime, 0);
        const avgOperationTime = totalOperations > 0 ? totalTime / totalOperations : 0;

        return {
            operations,
            summary: {
                totalOperations,
                totalTime,
                avgOperationTime
            }
        };
    }

    /**
     * Enhanced test execution tracking with performance monitoring
     */
    static async trackExecutionWithMetrics<T>(
        testName: string,
        fn: () => Promise<T>,
        options: {
            timeout?: number;
            expectedDuration?: number;
            category?: string;
        } = {}
    ): Promise<T> {
        const startTime = Date.now();
        const category = options.category || 'test';
        
        this.info(`Starting ${category}: ${testName}`, {
            timeout: options.timeout ? `${options.timeout}ms` : 'none',
            expectedDuration: options.expectedDuration ? `${options.expectedDuration}ms` : 'unknown'
        });

        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            
            // Record performance
            this.recordPerformance(`${category}:${testName}`, duration);
            
            // Check if duration exceeds expected
            if (options.expectedDuration && duration > options.expectedDuration) {
                this.warn(`${category} exceeded expected duration: ${testName}`, {
                    actual: `${duration}ms`,
                    expected: `${options.expectedDuration}ms`,
                    overhead: `${duration - options.expectedDuration}ms`
                });
            }
            
            this.info(`${category} completed: ${testName}`, { 
                duration: `${duration}ms`,
                status: 'success'
            });
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.recordPerformance(`${category}:${testName}:failed`, duration);
            
            this.error(`${category} failed: ${testName}`, {
                error: error instanceof Error ? error.message : error,
                duration: `${duration}ms`,
                status: 'failed'
            });
            
            throw error;
        }
    }

    /**
     * Create detailed error context for debugging
     */
    static createErrorContext(error: Error, context: {
        testName?: string;
        operation?: string;
        inputs?: any;
        expectedOutputs?: any;
        actualOutputs?: any;
        environment?: any;
    }): {
        errorId: string;
        timestamp: Date;
        error: {
            name: string;
            message: string;
            stack?: string;
        };
        context: typeof context;
        suggestions: string[];
    } {
        const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date();
        
        // Generate suggestions based on error type and context
        const suggestions: string[] = [];
        
        if (error.name === 'TypeError') {
            suggestions.push('Check for null/undefined values in inputs');
            suggestions.push('Verify object properties exist before accessing');
            suggestions.push('Ensure proper type checking before operations');
        }
        
        if (error.name === 'ReferenceError') {
            suggestions.push('Check variable declarations and scope');
            suggestions.push('Verify imports and module dependencies');
            suggestions.push('Ensure proper initialization order');
        }
        
        if (error.message.includes('timeout')) {
            suggestions.push('Increase timeout values for async operations');
            suggestions.push('Check for infinite loops or blocking operations');
            suggestions.push('Verify network connectivity and service availability');
        }
        
        if (error.message.includes('mock') || error.message.includes('Mock')) {
            suggestions.push('Verify mock setup and configuration');
            suggestions.push('Check mock method implementations');
            suggestions.push('Ensure mocks are properly reset between tests');
        }
        
        if (context.testName?.includes('integration')) {
            suggestions.push('Check component initialization order');
            suggestions.push('Verify service dependencies are available');
            suggestions.push('Ensure proper test environment setup');
        }

        const errorContext = {
            errorId,
            timestamp,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context,
            suggestions
        };

        this.error(`Detailed error context created: ${errorId}`, errorContext);
        
        return errorContext;
    }

    /**
     * Generate comprehensive test failure report
     */
    static generateFailureReport(testResults: {
        passed: number;
        failed: number;
        skipped: number;
        total: number;
        failures: Array<{
            testName: string;
            error: Error;
            duration: number;
        }>;
    }): string {
        const errorAnalysis = this.analyzeErrorPatterns();
        const performanceReport = this.getPerformanceReport();
        
        let report = '# Test Failure Analysis Report\n\n';
        report += `**Generated:** ${new Date().toISOString()}\n\n`;
        
        // Test Summary
        report += '## Test Summary\n\n';
        report += `- **Total Tests:** ${testResults.total}\n`;
        report += `- **Passed:** ${testResults.passed} (${((testResults.passed / testResults.total) * 100).toFixed(1)}%)\n`;
        report += `- **Failed:** ${testResults.failed} (${((testResults.failed / testResults.total) * 100).toFixed(1)}%)\n`;
        report += `- **Skipped:** ${testResults.skipped} (${((testResults.skipped / testResults.total) * 100).toFixed(1)}%)\n\n`;
        
        // Failure Details
        if (testResults.failures.length > 0) {
            report += '## Failure Details\n\n';
            testResults.failures.forEach((failure, index) => {
                report += `### Failure ${index + 1}: ${failure.testName}\n`;
                report += `**Duration:** ${failure.duration}ms\n`;
                report += `**Error:** ${failure.error.name}: ${failure.error.message}\n`;
                if (failure.error.stack) {
                    report += `**Stack Trace:**\n\`\`\`\n${failure.error.stack}\n\`\`\`\n`;
                }
                report += '\n';
            });
        }
        
        // Error Pattern Analysis
        if (errorAnalysis.commonErrors.length > 0) {
            report += '## Common Error Patterns\n\n';
            errorAnalysis.commonErrors.slice(0, 5).forEach((error, index) => {
                report += `${index + 1}. **${error.message}** (${error.count} occurrences)\n`;
                report += `   - First seen: ${error.firstSeen.toISOString()}\n`;
                report += `   - Last seen: ${error.lastSeen.toISOString()}\n\n`;
            });
        }
        
        // Performance Analysis
        if (performanceReport.operations.length > 0) {
            report += '## Performance Analysis\n\n';
            report += `**Summary:**\n`;
            report += `- Total Operations: ${performanceReport.summary.totalOperations}\n`;
            report += `- Total Time: ${performanceReport.summary.totalTime}ms\n`;
            report += `- Average Operation Time: ${performanceReport.summary.avgOperationTime.toFixed(2)}ms\n\n`;
            
            report += '**Slowest Operations:**\n';
            performanceReport.operations.slice(0, 5).forEach((op, index) => {
                report += `${index + 1}. **${op.name}**\n`;
                report += `   - Total: ${op.totalTime}ms (${op.count} runs)\n`;
                report += `   - Average: ${op.avgTime.toFixed(2)}ms\n`;
                report += `   - Range: ${op.minTime}ms - ${op.maxTime}ms\n\n`;
            });
        }
        
        // Recommendations
        report += '## Recommendations\n\n';
        if (testResults.failed > testResults.passed) {
            report += '- **High failure rate detected.** Consider reviewing test setup and environment configuration.\n';
        }
        if (performanceReport.summary.avgOperationTime > 1000) {
            report += '- **Slow test execution detected.** Consider optimizing test operations and reducing timeouts.\n';
        }
        if (errorAnalysis.commonErrors.length > 0) {
            report += '- **Recurring errors found.** Focus on fixing the most common error patterns first.\n';
        }
        report += '- Review the error patterns and stack traces to identify root causes.\n';
        report += '- Consider adding more specific assertions and error handling.\n';
        report += '- Ensure proper test isolation and cleanup between test cases.\n';
        
        return report;
    }

    /**
     * Clear performance metrics
     */
    static clearPerformanceMetrics(): void {
        this.performanceMetrics.clear();
        this.info('Performance metrics cleared');
    }

    /**
     * Export logs and metrics for external analysis
     */
    static exportDiagnostics(): {
        logs: typeof TestDebugger.logs;
        errorAnalysis: ReturnType<typeof TestDebugger.analyzeErrorPatterns>;
        performanceReport: ReturnType<typeof TestDebugger.getPerformanceReport>;
        timestamp: string;
    } {
        return {
            logs: this.getLogs(),
            errorAnalysis: this.analyzeErrorPatterns(),
            performanceReport: this.getPerformanceReport(),
            timestamp: new Date().toISOString()
        };
    }
}