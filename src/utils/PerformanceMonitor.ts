/**
 * Performance monitoring and optimization utilities
 */
import { Logger } from '../logging/Logger';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
    operation: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    metadata?: Record<string, any>;
}

/**
 * Performance thresholds for different operations
 */
export interface PerformanceThresholds {
    commandExecution: number; // 2 seconds
    documentCreation: number; // 5 seconds
    templateRendering: number; // 100ms
    fileOperations: number; // 500ms
    agentSwitching: number; // 50ms
}

/**
 * Performance optimization suggestions
 */
export interface OptimizationSuggestion {
    operation: string;
    currentDuration: number;
    threshold: number;
    suggestions: string[];
    priority: 'low' | 'medium' | 'high';
}

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private logger: Logger;
    private metrics: Map<string, PerformanceMetrics> = new Map();
    private activeOperations: Map<string, PerformanceMetrics> = new Map();
    private thresholds: PerformanceThresholds;

    private constructor() {
        this.logger = Logger.getInstance();
        this.thresholds = {
            commandExecution: 2000, // 2 seconds
            documentCreation: 5000, // 5 seconds
            templateRendering: 100, // 100ms
            fileOperations: 500, // 500ms
            agentSwitching: 50 // 50ms
        };
    }

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Start tracking an operation
     */
    startOperation(operationId: string, operation: string, metadata?: Record<string, any>): void {
        const metrics: PerformanceMetrics = {
            operation,
            startTime: performance.now(),
            success: false,
            metadata
        };

        this.activeOperations.set(operationId, metrics);
        
        this.logger.debug('performance', `Started operation: ${operation}`, {
            operationId,
            metadata
        });
    }

    /**
     * End tracking an operation
     */
    endOperation(operationId: string, success: boolean = true, metadata?: Record<string, any>): PerformanceMetrics | null {
        const metrics = this.activeOperations.get(operationId);
        if (!metrics) {
            this.logger.warn('performance', `Operation not found: ${operationId}`);
            return null;
        }

        metrics.endTime = performance.now();
        metrics.duration = metrics.endTime - metrics.startTime;
        metrics.success = success;
        
        if (metadata) {
            metrics.metadata = { ...metrics.metadata, ...metadata };
        }

        // Store completed metrics
        this.metrics.set(operationId, metrics);
        this.activeOperations.delete(operationId);

        // Check performance thresholds
        this.checkPerformanceThreshold(metrics);

        this.logger.debug('performance', `Completed operation: ${metrics.operation}`, {
            operationId,
            duration: metrics.duration,
            success: metrics.success
        });

        return metrics;
    }

    /**
     * Track a simple operation with automatic timing
     */
    async trackOperation<T>(
        operationId: string,
        operation: string,
        fn: () => Promise<T>,
        metadata?: Record<string, any>
    ): Promise<T> {
        this.startOperation(operationId, operation, metadata);
        
        try {
            const result = await fn();
            this.endOperation(operationId, true);
            return result;
        } catch (error) {
            this.endOperation(operationId, false, { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Check if operation exceeds performance threshold
     */
    private checkPerformanceThreshold(metrics: PerformanceMetrics): void {
        if (!metrics.duration) return;

        let threshold: number | undefined;
        
        // Determine threshold based on operation type
        if (metrics.operation.includes('command')) {
            threshold = this.thresholds.commandExecution;
        } else if (metrics.operation.includes('document') || metrics.operation.includes('create')) {
            threshold = this.thresholds.documentCreation;
        } else if (metrics.operation.includes('template') || metrics.operation.includes('render')) {
            threshold = this.thresholds.templateRendering;
        } else if (metrics.operation.includes('file') || metrics.operation.includes('write') || metrics.operation.includes('read')) {
            threshold = this.thresholds.fileOperations;
        } else if (metrics.operation.includes('agent') || metrics.operation.includes('switch')) {
            threshold = this.thresholds.agentSwitching;
        }

        if (threshold && metrics.duration > threshold) {
            this.logger.warn('performance', `Operation exceeded threshold: ${metrics.operation}`, {
                duration: metrics.duration,
                threshold,
                exceedBy: metrics.duration - threshold
            });

            // Generate optimization suggestions
            const suggestion = this.generateOptimizationSuggestion(metrics, threshold);
            if (suggestion) {
                this.logger.info('performance', 'Optimization suggestion generated', suggestion);
            }
        }
    }

    /**
     * Generate optimization suggestions for slow operations
     */
    private generateOptimizationSuggestion(
        metrics: PerformanceMetrics,
        threshold: number
    ): OptimizationSuggestion | null {
        if (!metrics.duration) return null;

        const exceedRatio = metrics.duration / threshold;
        let priority: 'low' | 'medium' | 'high' = 'low';
        let suggestions: string[] = [];

        if (exceedRatio > 3) {
            priority = 'high';
        } else if (exceedRatio > 2) {
            priority = 'medium';
        }

        // Generate specific suggestions based on operation type
        if (metrics.operation.includes('command')) {
            suggestions = [
                'Consider caching command results',
                'Optimize command parsing logic',
                'Reduce command validation overhead',
                'Implement command result streaming'
            ];
        } else if (metrics.operation.includes('document') || metrics.operation.includes('create')) {
            suggestions = [
                'Use template caching',
                'Optimize file I/O operations',
                'Implement progressive document creation',
                'Reduce template complexity'
            ];
        } else if (metrics.operation.includes('template')) {
            suggestions = [
                'Cache compiled templates',
                'Optimize variable substitution',
                'Reduce template size',
                'Use lazy loading for template assets'
            ];
        } else if (metrics.operation.includes('file')) {
            suggestions = [
                'Use file streaming for large files',
                'Implement file operation batching',
                'Optimize file path resolution',
                'Use asynchronous file operations'
            ];
        } else if (metrics.operation.includes('agent')) {
            suggestions = [
                'Cache agent configurations',
                'Optimize agent initialization',
                'Use agent pooling',
                'Reduce agent switching overhead'
            ];
        } else {
            suggestions = [
                'Profile the operation for bottlenecks',
                'Consider caching strategies',
                'Optimize data structures',
                'Use asynchronous processing'
            ];
        }

        return {
            operation: metrics.operation,
            currentDuration: metrics.duration,
            threshold,
            suggestions,
            priority
        };
    }

    /**
     * Get performance statistics
     */
    getPerformanceStatistics(): {
        totalOperations: number;
        averageDuration: number;
        slowestOperations: PerformanceMetrics[];
        operationsByType: Record<string, number>;
        thresholdViolations: number;
        successRate: number;
    } {
        const allMetrics = Array.from(this.metrics.values());
        
        if (allMetrics.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                slowestOperations: [],
                operationsByType: {},
                thresholdViolations: 0,
                successRate: 0
            };
        }

        const totalDuration = allMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
        const averageDuration = totalDuration / allMetrics.length;
        
        const slowestOperations = allMetrics
            .filter(m => m.duration !== undefined)
            .sort((a, b) => (b.duration || 0) - (a.duration || 0))
            .slice(0, 10);

        const operationsByType: Record<string, number> = {};
        let thresholdViolations = 0;
        let successfulOperations = 0;

        for (const metrics of allMetrics) {
            operationsByType[metrics.operation] = (operationsByType[metrics.operation] || 0) + 1;
            
            if (metrics.success) {
                successfulOperations++;
            }

            // Check threshold violations
            if (metrics.duration) {
                let threshold: number | undefined;
                
                if (metrics.operation.includes('command')) {
                    threshold = this.thresholds.commandExecution;
                } else if (metrics.operation.includes('document')) {
                    threshold = this.thresholds.documentCreation;
                } else if (metrics.operation.includes('template')) {
                    threshold = this.thresholds.templateRendering;
                } else if (metrics.operation.includes('file')) {
                    threshold = this.thresholds.fileOperations;
                } else if (metrics.operation.includes('agent')) {
                    threshold = this.thresholds.agentSwitching;
                }

                if (threshold && metrics.duration > threshold) {
                    thresholdViolations++;
                }
            }
        }

        const successRate = successfulOperations / allMetrics.length;

        return {
            totalOperations: allMetrics.length,
            averageDuration,
            slowestOperations,
            operationsByType,
            thresholdViolations,
            successRate
        };
    }

    /**
     * Get optimization suggestions for all operations
     */
    getOptimizationSuggestions(): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];
        const allMetrics = Array.from(this.metrics.values());

        for (const metrics of allMetrics) {
            if (!metrics.duration) continue;

            let threshold: number | undefined;
            
            if (metrics.operation.includes('command')) {
                threshold = this.thresholds.commandExecution;
            } else if (metrics.operation.includes('document')) {
                threshold = this.thresholds.documentCreation;
            } else if (metrics.operation.includes('template')) {
                threshold = this.thresholds.templateRendering;
            } else if (metrics.operation.includes('file')) {
                threshold = this.thresholds.fileOperations;
            } else if (metrics.operation.includes('agent')) {
                threshold = this.thresholds.agentSwitching;
            }

            if (threshold && metrics.duration > threshold) {
                const suggestion = this.generateOptimizationSuggestion(metrics, threshold);
                if (suggestion) {
                    suggestions.push(suggestion);
                }
            }
        }

        // Sort by priority and duration
        return suggestions.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return b.currentDuration - a.currentDuration;
        });
    }

    /**
     * Clear performance metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
        this.activeOperations.clear();
        this.logger.info('performance', 'Performance metrics cleared');
    }

    /**
     * Update performance thresholds
     */
    updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        this.logger.info('performance', 'Performance thresholds updated', this.thresholds);
    }

    /**
     * Get current thresholds
     */
    getThresholds(): PerformanceThresholds {
        return { ...this.thresholds };
    }

    /**
     * Check for race conditions in concurrent operations
     */
    detectRaceConditions(): {
        potentialRaceConditions: string[];
        concurrentOperations: number;
        recommendations: string[];
    } {
        const activeOps = Array.from(this.activeOperations.values());
        const potentialRaceConditions: string[] = [];
        const recommendations: string[] = [];

        // Check for multiple file operations on the same path
        const fileOperations = activeOps.filter(op => 
            op.operation.includes('file') || op.operation.includes('write') || op.operation.includes('read')
        );

        const pathGroups = new Map<string, PerformanceMetrics[]>();
        for (const op of fileOperations) {
            const path = op.metadata?.filePath || op.metadata?.path;
            if (path) {
                if (!pathGroups.has(path)) {
                    pathGroups.set(path, []);
                }
                pathGroups.get(path)!.push(op);
            }
        }

        for (const [path, ops] of pathGroups) {
            if (ops.length > 1) {
                potentialRaceConditions.push(`Multiple file operations on: ${path}`);
                recommendations.push('Implement file operation queuing');
                recommendations.push('Use file locking mechanisms');
            }
        }

        // Check for concurrent agent operations
        const agentOperations = activeOps.filter(op => op.operation.includes('agent'));
        if (agentOperations.length > 1) {
            potentialRaceConditions.push('Multiple concurrent agent operations');
            recommendations.push('Implement agent operation serialization');
        }

        // Check for concurrent template operations
        const templateOperations = activeOps.filter(op => op.operation.includes('template'));
        if (templateOperations.length > 3) {
            potentialRaceConditions.push('High number of concurrent template operations');
            recommendations.push('Implement template operation batching');
        }

        return {
            potentialRaceConditions,
            concurrentOperations: activeOps.length,
            recommendations: [...new Set(recommendations)] // Remove duplicates
        };
    }
}

/**
 * Performance monitoring decorator
 */
export function withPerformanceMonitoring(operationName?: string) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        const operation = operationName || `${target.constructor.name}.${propertyName}`;

        descriptor.value = async function (...args: any[]) {
            const monitor = PerformanceMonitor.getInstance();
            const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return monitor.trackOperation(operationId, operation, async () => {
                return await method.apply(this, args);
            });
        };

        return descriptor;
    };
}

/**
 * Convenience functions
 */
export function startPerformanceTracking(operationId: string, operation: string, metadata?: Record<string, any>): void {
    PerformanceMonitor.getInstance().startOperation(operationId, operation, metadata);
}

export function endPerformanceTracking(operationId: string, success: boolean = true, metadata?: Record<string, any>): PerformanceMetrics | null {
    return PerformanceMonitor.getInstance().endOperation(operationId, success, metadata);
}

export async function trackPerformance<T>(
    operationId: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
): Promise<T> {
    return PerformanceMonitor.getInstance().trackOperation(operationId, operation, fn, metadata);
}