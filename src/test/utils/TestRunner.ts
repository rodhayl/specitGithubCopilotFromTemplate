import { TestDebugger } from './TestDebugger';
import { TestTimeoutManager } from './TestTimeoutManager';
import { VSCodeAPIMocks } from '../mocks/VSCodeAPIMocks';

export interface TestSuite {
    name: string;
    setup?: () => Promise<void> | void;
    teardown?: () => Promise<void> | void;
    tests: TestCase[];
}

export interface TestCase {
    name: string;
    fn: () => Promise<void> | void;
    timeout?: number;
    skip?: boolean;
    expectedDuration?: number;
}

export interface TestResult {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: Error;
}

export interface TestSuiteResult {
    suiteName: string;
    results: TestResult[];
    totalDuration: number;
    passed: number;
    failed: number;
    skipped: number;
}

export class TestRunner {
    private static instance: TestRunner;
    private suites: TestSuite[] = [];
    private globalSetup?: () => Promise<void> | void;
    private globalTeardown?: () => Promise<void> | void;

    private constructor() {}

    public static getInstance(): TestRunner {
        if (!TestRunner.instance) {
            TestRunner.instance = new TestRunner();
        }
        return TestRunner.instance;
    }

    /**
     * Register a test suite
     */
    public registerSuite(suite: TestSuite): void {
        this.suites.push(suite);
        TestDebugger.info(`Test suite registered: ${suite.name}`, {
            testCount: suite.tests.length
        });
    }

    /**
     * Set global setup function
     */
    public setGlobalSetup(setup: () => Promise<void> | void): void {
        this.globalSetup = setup;
    }

    /**
     * Set global teardown function
     */
    public setGlobalTeardown(teardown: () => Promise<void> | void): void {
        this.globalTeardown = teardown;
    }

    /**
     * Run all registered test suites
     */
    public async runAll(): Promise<{
        suiteResults: TestSuiteResult[];
        summary: {
            totalSuites: number;
            totalTests: number;
            totalPassed: number;
            totalFailed: number;
            totalSkipped: number;
            totalDuration: number;
            successRate: number;
        };
    }> {
        TestDebugger.info('Starting test execution', {
            suiteCount: this.suites.length
        });

        const startTime = Date.now();
        const suiteResults: TestSuiteResult[] = [];

        try {
            // Global setup
            if (this.globalSetup) {
                await TestDebugger.trackExecutionWithMetrics(
                    'global-setup',
                    async () => { await this.globalSetup!(); },
                    { category: 'setup', timeout: 30000 }
                );
            }

            // Setup VS Code mocks
            VSCodeAPIMocks.setupMocks();

            // Run each suite
            for (const suite of this.suites) {
                const suiteResult = await this.runSuite(suite);
                suiteResults.push(suiteResult);
            }

            // Global teardown
            if (this.globalTeardown) {
                await TestDebugger.trackExecutionWithMetrics(
                    'global-teardown',
                    async () => { await this.globalTeardown!(); },
                    { category: 'teardown', timeout: 30000 }
                );
            }

        } catch (error) {
            TestDebugger.error('Global test execution failed', error);
            throw error;
        } finally {
            // Cleanup VS Code mocks
            VSCodeAPIMocks.restoreMocks();
        }

        const totalDuration = Date.now() - startTime;
        const summary = this.calculateSummary(suiteResults, totalDuration);

        TestDebugger.info('Test execution completed', summary);

        return {
            suiteResults,
            summary
        };
    }

    /**
     * Run a specific test suite
     */
    public async runSuite(suite: TestSuite): Promise<TestSuiteResult> {
        TestDebugger.info(`Running test suite: ${suite.name}`);
        
        const startTime = Date.now();
        const results: TestResult[] = [];

        try {
            // Suite setup
            if (suite.setup) {
                await TestDebugger.trackExecutionWithMetrics(
                    `${suite.name}-setup`,
                    async () => { await suite.setup!(); },
                    { category: 'suite-setup', timeout: 15000 }
                );
            }

            // Run tests
            for (const test of suite.tests) {
                const result = await this.runTest(test, suite.name);
                results.push(result);
            }

            // Suite teardown
            if (suite.teardown) {
                await TestDebugger.trackExecutionWithMetrics(
                    `${suite.name}-teardown`,
                    async () => { await suite.teardown!(); },
                    { category: 'suite-teardown', timeout: 15000 }
                );
            }

        } catch (error) {
            TestDebugger.error(`Test suite failed: ${suite.name}`, error);
            // Continue with other suites
        }

        const totalDuration = Date.now() - startTime;
        const passed = results.filter(r => r.status === 'passed').length;
        const failed = results.filter(r => r.status === 'failed').length;
        const skipped = results.filter(r => r.status === 'skipped').length;

        const suiteResult: TestSuiteResult = {
            suiteName: suite.name,
            results,
            totalDuration,
            passed,
            failed,
            skipped
        };

        TestDebugger.info(`Test suite completed: ${suite.name}`, {
            passed,
            failed,
            skipped,
            duration: `${totalDuration}ms`
        });

        return suiteResult;
    }

    /**
     * Run a single test case
     */
    private async runTest(test: TestCase, suiteName: string): Promise<TestResult> {
        if (test.skip) {
            TestDebugger.info(`Test skipped: ${suiteName} > ${test.name}`);
            return {
                name: test.name,
                status: 'skipped',
                duration: 0
            };
        }

        const startTime = Date.now();
        const timeout = test.timeout || TestTimeoutManager.getTimeout('test');
        const testContext = TestDebugger.createTestContext(`${suiteName} > ${test.name}`);

        try {
            testContext.log('Test started');

            // Run test with timeout
            const testPromise = Promise.resolve(test.fn());
            await TestTimeoutManager.wrapWithTimeout(
                testPromise,
                'test'
            );

            const duration = Date.now() - startTime;
            
            // Record performance
            TestDebugger.recordPerformance(`test:${suiteName}:${test.name}`, duration);
            
            // Check expected duration
            if (test.expectedDuration && duration > test.expectedDuration) {
                testContext.warn('Test exceeded expected duration', {
                    actual: `${duration}ms`,
                    expected: `${test.expectedDuration}ms`
                });
            }

            testContext.log('Test passed', { duration: `${duration}ms` });
            testContext.finish();

            return {
                name: test.name,
                status: 'passed',
                duration
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            const testError = error instanceof Error ? error : new Error(String(error));
            
            // Create detailed error context
            const errorContext = TestDebugger.createErrorContext(testError, {
                testName: `${suiteName} > ${test.name}`,
                operation: 'test-execution',
                environment: {
                    timeout,
                    expectedDuration: test.expectedDuration
                }
            });

            testContext.error('Test failed', errorContext);
            testContext.finish();

            return {
                name: test.name,
                status: 'failed',
                duration,
                error: testError
            };
        }
    }

    /**
     * Calculate summary statistics
     */
    private calculateSummary(suiteResults: TestSuiteResult[], totalDuration: number): {
        totalSuites: number;
        totalTests: number;
        totalPassed: number;
        totalFailed: number;
        totalSkipped: number;
        totalDuration: number;
        successRate: number;
    } {
        const totalSuites = suiteResults.length;
        const totalTests = suiteResults.reduce((sum, suite) => sum + suite.results.length, 0);
        const totalPassed = suiteResults.reduce((sum, suite) => sum + suite.passed, 0);
        const totalFailed = suiteResults.reduce((sum, suite) => sum + suite.failed, 0);
        const totalSkipped = suiteResults.reduce((sum, suite) => sum + suite.skipped, 0);
        const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

        return {
            totalSuites,
            totalTests,
            totalPassed,
            totalFailed,
            totalSkipped,
            totalDuration,
            successRate
        };
    }

    /**
     * Generate comprehensive test report
     */
    public generateReport(results: {
        suiteResults: TestSuiteResult[];
        summary: ReturnType<TestRunner['calculateSummary']>;
    }): string {
        const failures = results.suiteResults
            .flatMap(suite => 
                suite.results
                    .filter(result => result.status === 'failed')
                    .map(result => ({
                        testName: `${suite.suiteName} > ${result.name}`,
                        error: result.error!,
                        duration: result.duration
                    }))
            );

        return TestDebugger.generateFailureReport({
            passed: results.summary.totalPassed,
            failed: results.summary.totalFailed,
            skipped: results.summary.totalSkipped,
            total: results.summary.totalTests,
            failures
        });
    }

    /**
     * Clear all registered suites
     */
    public clearSuites(): void {
        this.suites = [];
        TestDebugger.info('All test suites cleared');
    }

    /**
     * Get registered suites
     */
    public getSuites(): TestSuite[] {
        return [...this.suites];
    }

    /**
     * Run tests matching a pattern
     */
    public async runMatching(pattern: RegExp): Promise<{
        suiteResults: TestSuiteResult[];
        summary: ReturnType<TestRunner['calculateSummary']>;
    }> {
        const matchingSuites = this.suites.map(suite => ({
            ...suite,
            tests: suite.tests.filter(test => 
                pattern.test(test.name) || pattern.test(`${suite.name} > ${test.name}`)
            )
        })).filter(suite => suite.tests.length > 0);

        TestDebugger.info(`Running tests matching pattern: ${pattern}`, {
            matchingSuites: matchingSuites.length,
            totalTests: matchingSuites.reduce((sum, suite) => sum + suite.tests.length, 0)
        });

        const originalSuites = this.suites;
        this.suites = matchingSuites;

        try {
            return await this.runAll();
        } finally {
            this.suites = originalSuites;
        }
    }

    /**
     * Run only failed tests from previous run
     */
    public async runFailedTests(previousResults: TestSuiteResult[]): Promise<{
        suiteResults: TestSuiteResult[];
        summary: ReturnType<TestRunner['calculateSummary']>;
    }> {
        const failedTestNames = new Set(
            previousResults.flatMap(suite =>
                suite.results
                    .filter(result => result.status === 'failed')
                    .map(result => `${suite.suiteName} > ${result.name}`)
            )
        );

        const failedSuites = this.suites.map(suite => ({
            ...suite,
            tests: suite.tests.filter(test => 
                failedTestNames.has(`${suite.name} > ${test.name}`)
            )
        })).filter(suite => suite.tests.length > 0);

        TestDebugger.info(`Running failed tests`, {
            failedSuites: failedSuites.length,
            totalFailedTests: failedTestNames.size
        });

        const originalSuites = this.suites;
        this.suites = failedSuites;

        try {
            return await this.runAll();
        } finally {
            this.suites = originalSuites;
        }
    }
}

// Export convenience functions for test registration
export function registerTestSuite(suite: TestSuite): void {
    TestRunner.getInstance().registerSuite(suite);
}

export function setGlobalSetup(setup: () => Promise<void> | void): void {
    TestRunner.getInstance().setGlobalSetup(setup);
}

export function setGlobalTeardown(teardown: () => Promise<void> | void): void {
    TestRunner.getInstance().setGlobalTeardown(teardown);
}

export async function runAllTests(): Promise<{
    suiteResults: TestSuiteResult[];
    summary: ReturnType<TestRunner['calculateSummary']>;
}> {
    return TestRunner.getInstance().runAll();
}