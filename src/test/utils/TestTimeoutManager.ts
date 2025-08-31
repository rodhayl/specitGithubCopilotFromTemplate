// Timeout management for async test operations
export class TestTimeoutManager {
    private static readonly timeouts = {
        'file-operation': 1000,
        'llm-request': 3000,
        'error-handling': 500,
        'tool-execution': 1500,
        'workflow-step': 2000,
        'agent-operation': 1000,
        'template-operation': 800,
        'default': 2000
    };

    /**
     * Get timeout value for specific operation type
     */
    static getTimeout(operation: string): number {
        return this.timeouts[operation as keyof typeof this.timeouts] || this.timeouts.default;
    }

    /**
     * Wrap promise with timeout to prevent test hangs
     */
    static wrapWithTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
        const timeout = this.getTimeout(operation);
        
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
                setTimeout(() => reject(new Error(`Operation ${operation} timed out after ${timeout}ms`)), timeout)
            )
        ]);
    }

    /**
     * Create a timeout promise for testing timeout scenarios
     */
    static createTimeoutPromise<T>(operation: string): Promise<T> {
        const timeout = this.getTimeout(operation);
        return new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
        );
    }

    /**
     * Wait for a specific duration (for testing timing-dependent scenarios)
     */
    static wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Execute function with retry logic and timeout
     */
    static async executeWithRetry<T>(
        fn: () => Promise<T>, 
        operation: string, 
        maxRetries: number = 3
    ): Promise<T> {
        let lastError: Error = new Error('Unknown error occurred');
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.wrapWithTimeout(fn(), operation);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                
                if (attempt === maxRetries) {
                    throw new Error(`Operation ${operation} failed after ${maxRetries} attempts: ${lastError.message}`);
                }
                
                // Wait before retry (exponential backoff)
                await this.wait(100 * Math.pow(2, attempt - 1));
            }
        }
        
        throw lastError;
    }

    /**
     * Set custom timeout for specific operation
     */
    static setCustomTimeout(operation: string, timeout: number): void {
        (this.timeouts as any)[operation] = timeout;
    }

    /**
     * Reset all timeouts to defaults
     */
    static resetTimeouts(): void {
        const defaultTimeouts = {
            'file-operation': 1000,
            'llm-request': 3000,
            'error-handling': 500,
            'tool-execution': 1500,
            'workflow-step': 2000,
            'agent-operation': 1000,
            'template-operation': 800,
            'default': 2000
        };
        
        Object.assign(this.timeouts, defaultTimeouts);
    }
}