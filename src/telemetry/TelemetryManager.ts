// Telemetry and analytics system
import * as vscode from 'vscode';
import { Logger } from '../logging/Logger';

export interface TelemetryEvent {
    name: string;
    timestamp: Date;
    properties?: Record<string, any>;
    measurements?: Record<string, number>;
    userId?: string;
    sessionId: string;
}

export interface TelemetryConfig {
    enabled: boolean;
    collectUsageData: boolean;
    collectPerformanceData: boolean;
    collectErrorData: boolean;
    anonymizeData: boolean;
    maxEvents: number;
}

export interface PerformanceMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
}

export class TelemetryManager {
    private static instance: TelemetryManager;
    private config: TelemetryConfig;
    private events: TelemetryEvent[] = [];
    private performanceMetrics: Map<string, PerformanceMetric> = new Map();
    private sessionId: string;
    private logger: Logger;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.logger = Logger.getInstance();
        this.sessionId = this.generateSessionId();
        
        // Default configuration
        this.config = {
            enabled: true,
            collectUsageData: true,
            collectPerformanceData: true,
            collectErrorData: true,
            anonymizeData: true,
            maxEvents: 1000
        };

        this.loadConfiguration();
        this.trackEvent('extension.session.start');
    }

    static initialize(context: vscode.ExtensionContext): TelemetryManager {
        if (!TelemetryManager.instance) {
            TelemetryManager.instance = new TelemetryManager(context);
        }
        return TelemetryManager.instance;
    }

    static getInstance(): TelemetryManager {
        if (!TelemetryManager.instance) {
            throw new Error('TelemetryManager not initialized. Call TelemetryManager.initialize() first.');
        }
        return TelemetryManager.instance;
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('docu.telemetry');
        
        this.config.enabled = config.get('enabled', true);
        this.config.collectUsageData = config.get('collectUsageData', true);
        this.config.collectPerformanceData = config.get('collectPerformanceData', true);
        this.config.collectErrorData = config.get('collectErrorData', true);
        this.config.anonymizeData = config.get('anonymizeData', true);
        this.config.maxEvents = config.get('maxEvents', 1000);

        this.logger.extension.info('Telemetry configuration loaded', this.config);
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateUserId(): string {
        // Generate anonymous user ID based on machine ID
        const machineId = vscode.env.machineId;
        return this.config.anonymizeData ? 
            `user_${this.hashString(machineId)}` : 
            machineId;
    }

    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    private shouldCollectTelemetry(): boolean {
        return this.config.enabled && vscode.env.isTelemetryEnabled;
    }

    trackEvent(name: string, properties?: Record<string, any>, measurements?: Record<string, number>): void {
        if (!this.shouldCollectTelemetry()) {
            return;
        }

        const event: TelemetryEvent = {
            name,
            timestamp: new Date(),
            sessionId: this.sessionId,
            properties: this.sanitizeProperties(properties),
            measurements
        };

        if (this.config.anonymizeData) {
            event.userId = this.generateUserId();
        }

        this.events.push(event);

        // Trim events if exceeding max
        if (this.events.length > this.config.maxEvents) {
            this.events = this.events.slice(-this.config.maxEvents);
        }

        this.logger.extension.debug('Telemetry event tracked', { name, properties, measurements });
    }

    private sanitizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
        if (!properties) {
            return undefined;
        }

        const sanitized: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(properties)) {
            // Remove potentially sensitive data
            if (this.config.anonymizeData && this.isSensitiveKey(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'string' && this.containsSensitiveData(value)) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    private isSensitiveKey(key: string): boolean {
        const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential', 'email', 'username'];
        return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive));
    }

    private containsSensitiveData(value: string): boolean {
        // Check for patterns that might be sensitive
        const patterns = [
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
            /\b(?:\d{4}[-\s]?){3}\d{4}\b/, // Credit card
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN
            /\b[A-Za-z0-9]{20,}\b/ // Long tokens
        ];

        return patterns.some(pattern => pattern.test(value));
    }

    // Usage tracking methods
    trackCommand(command: string, success: boolean, duration?: number, error?: string): void {
        if (!this.config.collectUsageData) {
            return;
        }

        this.trackEvent('command.executed', {
            command,
            success,
            error: error ? '[ERROR]' : undefined
        }, {
            duration: duration || 0
        });
    }

    trackAgentUsage(agentName: string, operation: string, success: boolean, duration?: number): void {
        if (!this.config.collectUsageData) {
            return;
        }

        this.trackEvent('agent.used', {
            agentName,
            operation,
            success
        }, {
            duration: duration || 0
        });
    }

    trackTemplateUsage(templateId: string, operation: string, success: boolean): void {
        if (!this.config.collectUsageData) {
            return;
        }

        this.trackEvent('template.used', {
            templateId,
            operation,
            success
        });
    }

    trackToolUsage(toolName: string, success: boolean, duration?: number, error?: string): void {
        if (!this.config.collectUsageData) {
            return;
        }

        this.trackEvent('tool.used', {
            toolName,
            success,
            hasError: !!error
        }, {
            duration: duration || 0
        });
    }

    // Performance tracking methods
    startPerformanceMetric(name: string, metadata?: Record<string, any>): void {
        if (!this.config.collectPerformanceData) {
            return;
        }

        const metric: PerformanceMetric = {
            name,
            startTime: performance.now(),
            metadata
        };

        this.performanceMetrics.set(name, metric);
        this.logger.extension.debug('Performance metric started', { name, metadata });
    }

    endPerformanceMetric(name: string): number | undefined {
        if (!this.config.collectPerformanceData) {
            return undefined;
        }

        const metric = this.performanceMetrics.get(name);
        if (!metric) {
            this.logger.extension.warn('Performance metric not found', { name });
            return undefined;
        }

        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;

        this.trackEvent('performance.metric', {
            name: metric.name,
            ...metric.metadata
        }, {
            duration: metric.duration
        });

        this.performanceMetrics.delete(name);
        this.logger.extension.debug('Performance metric completed', { name, duration: metric.duration });

        return metric.duration;
    }

    // Error tracking methods
    trackError(error: Error, context?: Record<string, any>): void {
        if (!this.config.collectErrorData) {
            return;
        }

        this.trackEvent('error.occurred', {
            errorName: error.name,
            errorMessage: this.config.anonymizeData ? '[REDACTED]' : error.message,
            hasStack: !!error.stack,
            ...context
        });

        this.logger.extension.error('Error tracked in telemetry', error, context);
    }

    trackWorkflowStep(workflow: string, step: string, success: boolean, duration?: number): void {
        if (!this.config.collectUsageData) {
            return;
        }

        this.trackEvent('workflow.step', {
            workflow,
            step,
            success
        }, {
            duration: duration || 0
        });
    }

    // Analytics and reporting methods
    getUsageStatistics(): {
        totalEvents: number;
        eventsByType: Record<string, number>;
        sessionDuration: number;
        mostUsedCommands: Array<{ command: string; count: number }>;
        mostUsedAgents: Array<{ agent: string; count: number }>;
        mostUsedTemplates: Array<{ template: string; count: number }>;
        errorRate: number;
    } {
        const eventsByType: Record<string, number> = {};
        const commandCounts: Record<string, number> = {};
        const agentCounts: Record<string, number> = {};
        const templateCounts: Record<string, number> = {};
        let errorCount = 0;

        for (const event of this.events) {
            eventsByType[event.name] = (eventsByType[event.name] || 0) + 1;

            if (event.name === 'command.executed' && event.properties?.command) {
                const command = event.properties.command;
                commandCounts[command] = (commandCounts[command] || 0) + 1;
            }

            if (event.name === 'agent.used' && event.properties?.agentName) {
                const agent = event.properties.agentName;
                agentCounts[agent] = (agentCounts[agent] || 0) + 1;
            }

            if (event.name === 'template.used' && event.properties?.templateId) {
                const template = event.properties.templateId;
                templateCounts[template] = (templateCounts[template] || 0) + 1;
            }

            if (event.name === 'error.occurred') {
                errorCount++;
            }
        }

        const mostUsedCommands = Object.entries(commandCounts)
            .map(([command, count]) => ({ command, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const mostUsedAgents = Object.entries(agentCounts)
            .map(([agent, count]) => ({ agent, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const mostUsedTemplates = Object.entries(templateCounts)
            .map(([template, count]) => ({ template, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const sessionStart = this.events.find(e => e.name === 'extension.session.start');
        const sessionDuration = sessionStart ? Date.now() - sessionStart.timestamp.getTime() : 0;

        return {
            totalEvents: this.events.length,
            eventsByType,
            sessionDuration,
            mostUsedCommands,
            mostUsedAgents,
            mostUsedTemplates,
            errorRate: this.events.length > 0 ? errorCount / this.events.length : 0
        };
    }

    getPerformanceStatistics(): {
        averageCommandDuration: number;
        averageToolDuration: number;
        slowestOperations: Array<{ name: string; duration: number }>;
    } {
        const commandDurations: number[] = [];
        const toolDurations: number[] = [];
        const allOperations: Array<{ name: string; duration: number }> = [];

        for (const event of this.events) {
            if (event.measurements?.duration) {
                const duration = event.measurements.duration;
                
                if (event.name === 'command.executed') {
                    commandDurations.push(duration);
                    allOperations.push({ name: `command:${event.properties?.command}`, duration });
                } else if (event.name === 'tool.used') {
                    toolDurations.push(duration);
                    allOperations.push({ name: `tool:${event.properties?.toolName}`, duration });
                }
            }
        }

        const average = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        return {
            averageCommandDuration: average(commandDurations),
            averageToolDuration: average(toolDurations),
            slowestOperations: allOperations
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 10)
        };
    }

    exportTelemetryData(): string {
        const data = {
            sessionId: this.sessionId,
            config: this.config,
            events: this.events,
            statistics: this.getUsageStatistics(),
            performance: this.getPerformanceStatistics()
        };

        return JSON.stringify(data, null, 2);
    }

    clearTelemetryData(): void {
        this.events = [];
        this.performanceMetrics.clear();
        this.logger.extension.info('Telemetry data cleared');
    }

    updateConfiguration(): void {
        this.loadConfiguration();
        this.trackEvent('telemetry.config.updated');
    }

    dispose(): void {
        this.trackEvent('extension.session.end', undefined, {
            sessionDuration: Date.now() - new Date(this.sessionId.split('_')[1]).getTime()
        });
    }
}