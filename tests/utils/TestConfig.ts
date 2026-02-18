import * as path from 'path';
import * as fs from 'fs';

export interface TestConfiguration {
    // Environment settings
    environment: {
        nodeEnv: string;
        testMode: boolean;
        debugMode: boolean;
        verboseLogging: boolean;
    };
    
    // Timeout settings
    timeouts: {
        test: number;
        suite: number;
        setup: number;
        teardown: number;
        async: number;
    };
    
    // Performance settings
    performance: {
        enableMetrics: boolean;
        slowTestThreshold: number;
        memoryMonitoring: boolean;
        maxMemoryUsage: number;
    };
    
    // Error handling settings
    errorHandling: {
        captureStackTraces: boolean;
        detailedErrorReports: boolean;
        errorPatternAnalysis: boolean;
        maxErrorHistory: number;
    };
    
    // Mock settings
    mocks: {
        enableVSCodeMocks: boolean;
        mockFileSystem: boolean;
        mockNetworkRequests: boolean;
        strictMocking: boolean;
    };
    
    // Reporting settings
    reports: {
        generateHtmlReport: boolean;
        generateJsonReport: boolean;
        generateCoverageReport: boolean;
        outputDirectory: string;
    };
    
    // Parallel execution settings
    parallel: {
        enabled: boolean;
        maxWorkers: number;
        suiteIsolation: boolean;
    };
}

export class TestConfig {
    private static instance: TestConfig;
    private config: TestConfiguration;
    private configPath: string;

    private constructor() {
        this.configPath = this.findConfigFile();
        this.config = this.loadConfiguration();
    }

    public static getInstance(): TestConfig {
        if (!TestConfig.instance) {
            TestConfig.instance = new TestConfig();
        }
        return TestConfig.instance;
    }

    /**
     * Get the current configuration
     */
    public getConfig(): TestConfiguration {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public updateConfig(updates: Partial<TestConfiguration>): void {
        this.config = this.mergeConfig(this.config, updates);
        this.saveConfiguration();
    }

    /**
     * Get a specific configuration value
     */
    public get<K extends keyof TestConfiguration>(key: K): TestConfiguration[K] {
        return this.config[key];
    }

    /**
     * Set a specific configuration value
     */
    public set<K extends keyof TestConfiguration>(key: K, value: TestConfiguration[K]): void {
        this.config[key] = value;
        this.saveConfiguration();
    }

    /**
     * Reset configuration to defaults
     */
    public resetToDefaults(): void {
        this.config = this.getDefaultConfiguration();
        this.saveConfiguration();
    }

    /**
     * Load configuration from environment variables
     */
    public loadFromEnvironment(): void {
        const envConfig: Partial<TestConfiguration> = {};

        // Environment settings
        if (process.env.NODE_ENV) {
            envConfig.environment = {
                ...this.config.environment,
                nodeEnv: process.env.NODE_ENV,
                testMode: process.env.NODE_ENV === 'test',
                debugMode: process.env.TEST_DEBUG === 'true',
                verboseLogging: process.env.TEST_VERBOSE === 'true'
            };
        }

        // Timeout settings
        if (process.env.TEST_TIMEOUT) {
            const timeout = parseInt(process.env.TEST_TIMEOUT, 10);
            if (!isNaN(timeout)) {
                envConfig.timeouts = {
                    ...this.config.timeouts,
                    test: timeout
                };
            }
        }

        // Performance settings
        if (process.env.TEST_PERFORMANCE_METRICS) {
            envConfig.performance = {
                ...this.config.performance,
                enableMetrics: process.env.TEST_PERFORMANCE_METRICS === 'true'
            };
        }

        // Mock settings
        if (process.env.TEST_MOCK_VSCODE) {
            envConfig.mocks = {
                ...this.config.mocks,
                enableVSCodeMocks: process.env.TEST_MOCK_VSCODE === 'true'
            };
        }

        // Parallel execution
        if (process.env.TEST_PARALLEL) {
            envConfig.parallel = {
                ...this.config.parallel,
                enabled: process.env.TEST_PARALLEL === 'true'
            };
        }

        if (process.env.TEST_MAX_WORKERS) {
            const maxWorkers = parseInt(process.env.TEST_MAX_WORKERS, 10);
            if (!isNaN(maxWorkers)) {
                envConfig.parallel = {
                    ...this.config.parallel,
                    maxWorkers
                };
            }
        }

        this.updateConfig(envConfig);
    }

    /**
     * Validate configuration
     */
    public validateConfig(): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate timeouts
        if (this.config.timeouts.test <= 0) {
            errors.push('Test timeout must be greater than 0');
        }
        if (this.config.timeouts.test > 300000) {
            warnings.push('Test timeout is very high (>5 minutes)');
        }

        // Validate performance settings
        if (this.config.performance.slowTestThreshold <= 0) {
            errors.push('Slow test threshold must be greater than 0');
        }
        if (this.config.performance.maxMemoryUsage <= 0) {
            errors.push('Max memory usage must be greater than 0');
        }

        // Validate parallel settings
        if (this.config.parallel.maxWorkers <= 0) {
            errors.push('Max workers must be greater than 0');
        }
        if (this.config.parallel.maxWorkers > require('os').cpus().length * 2) {
            warnings.push('Max workers exceeds recommended limit (2x CPU cores)');
        }

        // Validate output directory
        if (!path.isAbsolute(this.config.reports.outputDirectory)) {
            warnings.push('Report output directory should be an absolute path');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get configuration summary for logging
     */
    public getConfigSummary(): {
        environment: string;
        testTimeout: number;
        debugMode: boolean;
        mocksEnabled: boolean;
        parallelEnabled: boolean;
        performanceMetrics: boolean;
    } {
        return {
            environment: this.config.environment.nodeEnv,
            testTimeout: this.config.timeouts.test,
            debugMode: this.config.environment.debugMode,
            mocksEnabled: this.config.mocks.enableVSCodeMocks,
            parallelEnabled: this.config.parallel.enabled,
            performanceMetrics: this.config.performance.enableMetrics
        };
    }

    /**
     * Find configuration file
     */
    private findConfigFile(): string {
        const possiblePaths = [
            path.join(process.cwd(), 'test.config.json'),
            path.join(process.cwd(), '.test.config.json'),
            path.join(process.cwd(), 'src', 'test', 'config.json'),
            path.join(__dirname, 'config.json')
        ];

        for (const configPath of possiblePaths) {
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }

        // Return default path if no config file found
        return path.join(process.cwd(), 'test.config.json');
    }

    /**
     * Load configuration from file
     */
    private loadConfiguration(): TestConfiguration {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const fileConfig = JSON.parse(configData);
                return this.mergeConfig(this.getDefaultConfiguration(), fileConfig);
            }
        } catch (error) {
            console.warn(`Failed to load test configuration from ${this.configPath}:`, error);
        }

        return this.getDefaultConfiguration();
    }

    /**
     * Save configuration to file
     */
    private saveConfiguration(): void {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            fs.writeFileSync(
                this.configPath,
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
        } catch (error) {
            console.warn(`Failed to save test configuration to ${this.configPath}:`, error);
        }
    }

    /**
     * Get default configuration
     */
    private getDefaultConfiguration(): TestConfiguration {
        return {
            environment: {
                nodeEnv: process.env.NODE_ENV || 'test',
                testMode: true,
                debugMode: process.env.TEST_DEBUG === 'true',
                verboseLogging: process.env.TEST_VERBOSE === 'true'
            },
            timeouts: {
                test: 10000,
                suite: 60000,
                setup: 30000,
                teardown: 30000,
                async: 5000
            },
            performance: {
                enableMetrics: true,
                slowTestThreshold: 1000,
                memoryMonitoring: false,
                maxMemoryUsage: 512 * 1024 * 1024 // 512MB
            },
            errorHandling: {
                captureStackTraces: true,
                detailedErrorReports: true,
                errorPatternAnalysis: true,
                maxErrorHistory: 100
            },
            mocks: {
                enableVSCodeMocks: true,
                mockFileSystem: true,
                mockNetworkRequests: false,
                strictMocking: true
            },
            reports: {
                generateHtmlReport: false,
                generateJsonReport: true,
                generateCoverageReport: false,
                outputDirectory: path.join(process.cwd(), 'test-results')
            },
            parallel: {
                enabled: false,
                maxWorkers: Math.max(1, require('os').cpus().length - 1),
                suiteIsolation: true
            }
        };
    }

    /**
     * Deep merge configuration objects
     */
    private mergeConfig(base: TestConfiguration, override: Partial<TestConfiguration>): TestConfiguration {
        const result = { ...base };

        for (const key in override) {
            if (override.hasOwnProperty(key)) {
                const value = override[key as keyof TestConfiguration];
                if (value !== undefined) {
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        result[key as keyof TestConfiguration] = {
                            ...base[key as keyof TestConfiguration],
                            ...value
                        } as any;
                    } else {
                        result[key as keyof TestConfiguration] = value as any;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Export configuration to JSON string
     */
    public exportConfig(): string {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON string
     */
    public importConfig(configJson: string): void {
        try {
            const importedConfig = JSON.parse(configJson);
            this.config = this.mergeConfig(this.getDefaultConfiguration(), importedConfig);
            this.saveConfiguration();
        } catch (error) {
            throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get configuration for specific test type
     */
    public getTestTypeConfig(testType: 'unit' | 'integration' | 'e2e'): Partial<TestConfiguration> {
        const baseConfig = this.getConfig();

        switch (testType) {
            case 'unit':
                return {
                    ...baseConfig,
                    timeouts: {
                        ...baseConfig.timeouts,
                        test: 5000,
                        suite: 30000
                    },
                    mocks: {
                        ...baseConfig.mocks,
                        enableVSCodeMocks: true,
                        mockFileSystem: true
                    },
                    parallel: {
                        ...baseConfig.parallel,
                        enabled: true
                    }
                };

            case 'integration':
                return {
                    ...baseConfig,
                    timeouts: {
                        ...baseConfig.timeouts,
                        test: 15000,
                        suite: 120000
                    },
                    mocks: {
                        ...baseConfig.mocks,
                        enableVSCodeMocks: true,
                        mockFileSystem: false
                    },
                    parallel: {
                        ...baseConfig.parallel,
                        enabled: false
                    }
                };

            case 'e2e':
                return {
                    ...baseConfig,
                    timeouts: {
                        ...baseConfig.timeouts,
                        test: 30000,
                        suite: 300000
                    },
                    mocks: {
                        ...baseConfig.mocks,
                        enableVSCodeMocks: false,
                        mockFileSystem: false
                    },
                    parallel: {
                        ...baseConfig.parallel,
                        enabled: false
                    }
                };

            default:
                return baseConfig;
        }
    }
}

// Export convenience functions
export function getTestConfig(): TestConfiguration {
    return TestConfig.getInstance().getConfig();
}

export function updateTestConfig(updates: Partial<TestConfiguration>): void {
    TestConfig.getInstance().updateConfig(updates);
}

export function getConfigForTestType(testType: 'unit' | 'integration' | 'e2e'): Partial<TestConfiguration> {
    return TestConfig.getInstance().getTestTypeConfig(testType);
}